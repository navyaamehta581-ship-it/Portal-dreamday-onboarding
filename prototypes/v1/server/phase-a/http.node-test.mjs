import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequestHandler} from '../http-handler.mjs';
import {createStore} from './store.mjs';

async function withServer(work) {
 const dir=await mkdtemp(join(tmpdir(),'phase-a-http-'));
 const server=createServer(createRequestHandler(createStore(dir),{allowedHosts:['test.local']}));
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,options={})=>new Promise((resolve,reject)=>{
   const req=httpRequest(base+path,{method:options.method??'GET',headers:{Host:'test.local','Content-Type':'application/json',...options.headers}},res=>{
    let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>{try{resolve({status:res.statusCode,headers:new Headers(res.headers),body:JSON.parse(body)});}catch(e){reject(e);}});
   });
   req.on('error',reject);req.end(options.body);
  });
  await work(request,dir);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
}
const version='1.0.0',root='/api/conversations/v1';
test('HTTP create, append, get, fixtures and durable constraints without a model',()=>withServer(async(request,dir)=>{
 const created=await request(root,{method:'POST',body:JSON.stringify({contractVersion:version})});assert.equal(created.status,201);
 const path=`${root}/${created.body.state.conversationId}`;
 const input={contractVersion:version,expectedRevision:0,content:'Deploy service',confirmedConstraints:['Keep existing tests unchanged']};
 const first=await request(path+'/messages',{method:'POST',body:JSON.stringify(input)});assert.equal(first.status,200);
 assert.equal(first.body.state.constraints[0].sourceMessageId,'m-1');
 assert.deepEqual(first.body.state.events.map(e=>e.stage),['understanding_request','ready']);
 assert.equal(first.body.state.boundary,'read_only');
 const second=await request(path+'/messages',{method:'POST',body:JSON.stringify({...input,expectedRevision:1,content:'Use staging',confirmedConstraints:[]})});
 assert.deepEqual(second.body.state.constraints,first.body.state.constraints);
 assert.deepEqual((await createStore(dir).read(created.body.state.conversationId)),second.body.state);
 assert.deepEqual((await request(path)).body,second.body);
 const fixtures=await request(root+'/fixtures');assert.equal(fixtures.status,200);assert.equal(fixtures.body.mode,'development_fixture');assert.equal(fixtures.body.examples.confirmedConstraint.state.constraints.length,1);
 assert.equal(fixtures.body.examples.clarification.state.stage,'awaiting_clarification');
 assert.equal(fixtures.body.examples.investigation.state.evidence.find(e=>e.id==='fixture-file-1').status,'verified');
 assert.equal(fixtures.body.examples.recommendation.state.selectedSolution.approach,'modify');
 assert.equal(Object.keys(fixtures.body.examples.errors).length,8);
 assert.equal((await request(path+'/messages',{method:'POST',body:JSON.stringify(input)})).status,409);
 assert.equal(second.headers.get('cache-control'),'no-store');
}));
test('HTTP rejection paths all use versioned errors; injected backend control is rejected',()=>withServer(async(request,dir)=>{
 const expectError=async(path,options,status,code)=>{const result=await request(path,options);assert.equal(result.status,status);assert.equal(result.body.contractVersion,version);assert.equal(result.body.error.code,code);assert.equal(typeof result.body.error.message,'string');return result;};
 await expectError(root,{method:'POST',body:'{'},400,'INVALID_REQUEST');
 await expectError(root,{method:'POST',body:'{}'},400,'UNSUPPORTED_VERSION');
 await expectError(root,{method:'POST',body:JSON.stringify({contractVersion:version,stage:'ready'})},400,'INVALID_REQUEST');
 await expectError(root,{headers:{Host:'untrusted.local'}},403,'FORBIDDEN');
 await expectError(root,{headers:{Origin:'https://untrusted.local'}},403,'FORBIDDEN');
 await expectError(root,{method:'POST',headers:{'Content-Type':'application/json-malicious'},body:'{}'},415,'UNSUPPORTED_MEDIA_TYPE');
 await expectError(root,{method:'POST',body:'x'.repeat(8193)},413,'PAYLOAD_TOO_LARGE');
 await expectError(root+'/absent',{},404,'NOT_FOUND');
 await expectError(root,{method:'DELETE'},404,'NOT_FOUND');
 const created=await request(root,{method:'POST',body:JSON.stringify({contractVersion:version})});const id=created.body.state.conversationId;
 const path=`${root}/${id}/messages`;
 for(const extra of [{stage:'generating_artifact'},{boundary:'write'},{evidence:[{status:'verified'}]},{expectedRevision:-1},{expectedRevision:0.5},{confirmedConstraints:[' ']},{answersQuestionId:'invented'}])await expectError(path,{method:'POST',body:JSON.stringify({contractVersion:version,expectedRevision:0,content:'Goal',...extra})},400,'INVALID_REQUEST');
 assert.equal((await createStore(dir).read(id)).revision,0);
 await writeFile(join(dir,`${id}.json`),'invalid');
 const error=await expectError(`${root}/${id}`,{},500,'INTERNAL_ERROR');assert.ok(!error.body.error.message.includes(dir));
 // Existing inspector keeps its existing validation response and does not call GitHub here.
 const inspector=await request('/api/diagnose',{method:'POST',body:'{}'});assert.equal(inspector.status,400);assert.equal(typeof inspector.body.error,'string');
}));
test('local inspector route 404 is explicitly different from upstream GitHub failure',()=>withServer(async request=>{
 const r=await request('/api/diagnose-typo',{method:'POST',body:'{}'});
 assert.equal(r.status,404);assert.deepEqual(r.body.error,{code:'NOT_FOUND',message:'Route not found.',source:'local_inspector'});
}));
