import {createServer as createHttpServer} from 'node:http';
import {createServer as createViteServer} from 'vite';
import {expect,it} from 'vitest';
import {createApiProxy} from './api-proxy';

it('maps only the current Codespace origin through the actual HTTP proxy',async()=>{
 const backend=createHttpServer((request,response)=>{
  if(request.headers.origin!=='http://127.0.0.1:5173'){
   response.writeHead(403);response.end('Origin is not allowed.');return;
  }
  response.setHeader('Content-Type','application/json');
  response.end(JSON.stringify({origin:request.headers.origin,host:request.headers.host}));
 });
 await new Promise<void>(resolve=>backend.listen(0,'127.0.0.1',resolve));
 const address=backend.address();if(!address||typeof address==='string')throw new Error('No backend port');
 const proxy=createApiProxy('test-workspace');proxy.target=`http://127.0.0.1:${address.port}`;
 const vite=await createViteServer({configFile:false,server:{host:'127.0.0.1',port:0,strictPort:false,proxy:{'/api/conversations':proxy}}});
 try{
  await vite.listen();const port=await vite.httpServer?.address();if(!port||typeof port==='string')throw new Error('No frontend port');
  const endpoint=`http://127.0.0.1:${port.port}/api/conversations/v1`;
  for(const origin of ['https://test-workspace-5173.app.github.dev','http://127.0.0.1:5173']){
   const response=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
   expect(response.status).toBe(200);expect(await response.json()).toEqual({origin:'http://127.0.0.1:5173',host:`127.0.0.1:${address.port}`});
  }
  for(const origin of ['https://another-workspace-5173.app.github.dev','https://test-workspace-8787.app.github.dev','https://test-workspace-5173.app.github.dev.evil.example','null']){
   const response=await fetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});expect(response.status).toBe(403);
  }
 }finally{await vite.close();await new Promise<void>((resolve,reject)=>backend.close(error=>error?reject(error):resolve()));}
});
it('does not configure a wildcard, enable CORS, or widen localhost-only binding',()=>{
 for(const name of [undefined,'bad/name','bad.name','UPPER']){
  const proxy=createApiProxy(name);let listener:Function|undefined;
  proxy.configure!({on:(_event:string,fn:Function)=>{listener=fn;}} as never,proxy);
  let changed=false;listener!({setHeader:()=>{changed=true;}},{headers:{origin:'https://test-workspace-5173.app.github.dev'}});expect(changed).toBe(false);
 }
});
