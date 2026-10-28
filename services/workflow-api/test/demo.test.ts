import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, statSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
const script=new URL('../scripts/demo.ts',import.meta.url);
test('fictional bootstrap authenticates, persists reports across process restart, and fails closed',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'activation-demo-test-'));
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));
 const address=probe.address();assert.ok(address&&typeof address==='object');const port=address.port;
 await new Promise<void>(r=>probe.close(()=>r()));
 const env={...process.env,NODE_ENV:'development',ACTIVATION_DEMO_DIR:directory,PORT:String(port)};
 let child:ReturnType<typeof spawn>|undefined;
 async function start(){
  const proc=spawn(process.execPath,[script.pathname],{env,stdio:['ignore','pipe','pipe']});child=proc;
  await new Promise<void>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Demo startup timed out')),10000);
   proc.stdout!.on('data',data=>{if(String(data).includes('FICTIONAL DEMO API:')){clearTimeout(timer);resolve();}});
   proc.once('exit',code=>{clearTimeout(timer);reject(Error(`Demo exited: ${code}`));});
  });
 }
 async function stop(){if(child&&child.exitCode===null){const proc=child;await new Promise<void>(r=>{proc.once('exit',()=>r());proc.kill('SIGTERM');});}}
 try{
  await start();
  const token=readFileSync(join(directory,'token'),'utf8');assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal(statSync(join(directory,'token')).mode&0o077,0);
  const base=`http://127.0.0.1:${port}/api/activation/v1/customers/`;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'fictional-recommendation-demo/state')).status,403);
  assert.equal((await fetch(base+'other/state',{headers})).status,403);
  const url=base+'fictional-recommendation-demo/';
  const response=await fetch(url+'state',{headers});assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const state=await response.json();assert.doesNotMatch(JSON.stringify(state),/FICTIONAL LOCAL DEMO/,'developer view never carries the stored briefing');assert.ok(state.handoff);
  assert.equal(state.outcome.status,'unassessed');
  const report=await fetch(url+'progress-reports',{headers,method:'POST',body:JSON.stringify({id:'progress:demo-test-report',expectedRevision:state.revision,planRevision:state.planRevision,message:'Fictional developer reviewed the proposed onboarding path.',needsChris:true})});
  assert.equal(report.status,200);const saved=await report.json();
  await stop();await start();
  assert.equal(readFileSync(join(directory,'token'),'utf8'),token);
  assert.deepEqual(await (await fetch(url+'state',{headers})).json(),saved);
  await stop();
  const bundle=JSON.parse(readFileSync(join(directory,'admission.json'),'utf8'));bundle[0].expiresAt='2000-01-01T00:00:00Z';
  writeFileSync(join(directory,'admission.json'),JSON.stringify(bundle));
  const expired=spawnSync(process.execPath,[script.pathname],{env,encoding:'utf8'});
  assert.notEqual(expired.status,0);assert.match(expired.stderr,/expired/);
  const production=spawnSync(process.execPath,[script.pathname],{env:{...env,NODE_ENV:'production'},encoding:'utf8'});
  assert.notEqual(production.status,0);assert.match(production.stderr,/forbidden in production/);
 }finally{await stop();rmSync(directory,{recursive:true,force:true});}
});
