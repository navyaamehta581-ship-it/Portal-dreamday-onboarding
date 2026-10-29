import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import fixtures from '../../../contracts/activation/v1/fixtures.json' with {type:'json'};
import { openActivationStore } from '../src/activation/store.ts';
import type { Principal, Policy } from '../src/activation/store.ts';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate, EvidenceRecord } from '../../../contracts/activation/v1/types.ts';
import { createApp } from '../src/app.ts';
import { openGoalStore } from '../src/store.ts';
const principal:Principal={tenantId:'tenant',customerId:'ledger',sessionId:'session-ledger'};
function setup() {
  const f=structuredClone(fixtures);
  const context=f.ledger.context as CustomerContext, plan=f.ledger.plan as ActivationPlan, progress=f.progress as ProgressUpdate, blocker=f.blockerReplan.blocker as BlockerUpdate, replacement=f.blockerReplan.plan as ActivationPlan;
  plan.suggestedNextAction.id='inspect';blocker.replan.invalidateActionIds=['inspect'];
  // Authenticated test adapter owns exact records. These are test doubles, no live operations.
  const records=new Map<string,EvidenceRecord>();
  const at=new Date(Date.now()+1000).toISOString();
  for(const obj of [context,plan,progress,blocker,replacement]) {
    obj.evidence=obj.evidence.map(e=>{
      if(records.has(e.id))return structuredClone(records.get(e.id)!);
      e.source=`test-ledger/${e.id}`;e.sourceRevision='a'.repeat(40);e.producer='test-adapter';e.proof.reference=`test://${e.id}`;e.observedAt=at;
      records.set(e.id,structuredClone(e));return e;
    });
  }
  progress.transitions.forEach(t=>t.at=at);
  const policy:Policy={admitContext:(_p,c)=>isDeepStrictEqual(c,context),admitPlan:(_p,_c,p)=>isDeepStrictEqual(p,plan)||isDeepStrictEqual(p,replacement),admit:(_p,e)=>isDeepStrictEqual(records.get(e.id),e)};
  const file=join(mkdtempSync(join(tmpdir(),'activation-')),'state.sqlite');
  const store=openActivationStore(file,policy);
  return {context,plan,progress,blocker,replacement,policy,file,store};
}
const rejects=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:unknown)=>!!e&&typeof e==='object'&&'code' in e&&e.code===code);
test('reload every action state, immutable receipts, outcome stays unassessed at reached milestone',t=>{
  // Freeze this test's wall clock so cold startup cannot overtake its proof timestamps.
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const x=setup();let store=x.store;store.initialize(principal,x.context,x.plan);
  for(let i=0;i<4;i++) {
    const event={...x.progress,id:`p${i}`,expectedRevision:i,revision:i+1,milestoneStatus:i===3?'reached' as const:'in_progress' as const,transitions:[x.progress.transitions[i]]};
    store.progress(principal,event);store.close();store=openActivationStore(x.file,x.policy);
    const s=store.get(principal);assert.equal(s.actions.inspect.status,event.transitions[0].toStatus);assert.equal(s.revision,i+1);
    assert.deepEqual(s.evidence.find(e=>e.id==='receipt'),x.progress.evidence.find(e=>e.id==='receipt'));
    assert.equal(s.outcome.status,'unassessed');
  }
  assert.equal(store.get(principal).milestone.status,'reached');store.close();
});
test('separate-process restart reloads exact committed snapshot',()=>{
  const x=setup();const expected=x.store.initialize(principal,x.context,x.plan);x.store.close();
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {openActivationStore} from ${JSON.stringify(new URL('../src/activation/store.ts',import.meta.url).href)};const s=openActivationStore(${JSON.stringify(x.file)});console.log(JSON.stringify(s.get(${JSON.stringify(principal)})));s.close();`],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),expected);
});
test('tenant, customer and session isolation plus duplicate initialization',()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);
  for(const p of [{...principal,tenantId:'other'},{...principal,customerId:'other'},{...principal,sessionId:'other'}]) rejects(()=>x.store.get(p),'NOT_FOUND');
  x.store.initialize({...principal,tenantId:'other'},x.context,x.plan);
  rejects(()=>x.store.initialize(principal,x.context,x.plan),'REVISION_CONFLICT');
  const otherPrincipal={...principal,customerId:'other-customer'};
  const otherContext={...x.context,customerId:otherPrincipal.customerId};
  const otherPlan={...x.plan,customerId:otherPrincipal.customerId};
  const other=openActivationStore(x.file,{...x.policy,admitContext:(_p,c)=>isDeepStrictEqual(c,otherContext),admitPlan:(_p,_c,p)=>isDeepStrictEqual(p,otherPlan)});
  other.initialize(otherPrincipal,otherContext,otherPlan);x.store.progress(principal,x.progress);
  assert.equal(other.get(otherPrincipal).actions.inspect.status,'suggested');assert.equal(other.get(principal).actions.inspect.status,'verified');
  other.close();x.store.close();
});
test('blocker before progress survives restart; failed worker retry publishes new suggested revision',()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.blocker.replan.invalidateActionIds=[];
  const blocked=x.store.blocker(principal,x.blocker);assert.equal(blocked.replan.status,'pending');assert.deepEqual(blocked.actions.inspect.blockedByIds,[x.blocker.id]);
  assert.equal(blocked.chrisHelp.owner,'Chris');assert.equal(blocked.outcome.status,'unassessed');assert.deepEqual(blocked.chrisHelp.evidenceIds,['developer']);
  x.store.close();const s=openActivationStore(x.file,x.policy);
  assert.equal(s.blocker(principal,x.blocker).revision,1);assert.deepEqual(s.getEvent(principal,x.blocker.id),x.blocker);assert.equal(s.getRevision(principal,0).plan.revision,0);
  rejects(()=>s.blocker(principal,{...x.blocker,newInformation:'changed'}),'IDEMPOTENCY_CONFLICT');
  rejects(()=>s.progress(principal,{...x.progress,expectedRevision:1,revision:2}),'INVALID_TRANSITION');
  s.completeReplan(principal,'failed',1,x.blocker.id,null);s.close();
  const next=openActivationStore(x.file,x.policy);assert.equal(next.get(principal).replan.status,'failed');
  const ready=next.completeReplan(principal,'retry',2,x.blocker.id,x.replacement);
  assert.equal(ready.replan.status,'ready');assert.equal(ready.actions['offline-review'].status,'suggested');assert.equal(ready.planRevision,1);assert.equal(ready.chrisHelp.status,'requested');
  assert.equal(next.completeReplan(principal,'retry',2,x.blocker.id,x.replacement).revision,3);next.close();
});
test('approved action cannot execute after blocker; stale concurrent writer fails atomically',()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);
  const p={...x.progress,milestoneStatus:'in_progress' as const,transitions:x.progress.transitions.slice(0,2)};
  x.store.progress(principal,p);
  const second=openActivationStore(x.file,x.policy);
  rejects(()=>second.progress(principal,{...p,id:'stale'}),'REVISION_CONFLICT');
  x.store.blocker(principal,{...x.blocker,expectedRevision:1,revision:2});
  rejects(()=>second.progress(principal,{...x.progress,id:'execute',expectedRevision:2,revision:3,transitions:[x.progress.transitions[2]]}),'INVALID_TRANSITION');
  assert.equal(second.get(principal).revision,2);second.close();x.store.close();
});
test('receipt substitution, synthetic trust and agreement admission fail closed with rollback',()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);
  x.progress.evidence[2].proof.reference='forged://receipt';rejects(()=>x.store.progress(principal,x.progress),'INVALID_EVIDENCE');assert.equal(x.store.get(principal).revision,0);x.store.close();
  const closed=openActivationStore(':memory:');rejects(()=>closed.initialize(principal,x.context,x.plan),'INVALID_EVIDENCE');closed.close();
  const synthetic=openActivationStore(':memory:',{admit:()=>true,admitContext:()=>true,admitPlan:()=>true});rejects(()=>synthetic.initialize(principal,fixtures.ledger.context as CustomerContext,fixtures.ledger.plan as ActivationPlan),'INVALID_EVIDENCE');synthetic.close();
});
test('unsupported adapter and empty criterion rejected; client narrative never proves deployment',()=>{
  const x=setup();rejects(()=>x.store.initialize(principal,x.context,{...x.plan,planner:'aika_adapter'}),'ADAPTER_UNAVAILABLE');
  rejects(()=>x.store.initialize(principal,x.context,{...x.plan,selectedMilestone:{...x.plan.selectedMilestone,successCriteria:[]}}),'INVALID_REQUEST');
  x.store.initialize(principal,x.context,x.plan);x.progress.valueDemonstrated='Deployed to Portal, ROI verified';
  assert.equal(x.store.progress(principal,x.progress).outcome.status,'unassessed');x.store.close();
});
test('HTTP authenticated init/reload/update, no-store and ETag; legacy Goal API still works',async t=>{
  // Keep proof timestamps stable while the HTTP server starts under load.
  t.mock.timers.enable({apis:['Date'],now:Date.now()});
  const x=setup(),goals=openGoalStore(':memory:');
  const app=createApp(goals,undefined,{store:x.store,isOperator:()=>true,authorize:(r,c)=>r.headers.authorization==='Bearer test'&&c==='ledger'?principal:null});
  await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
  const address=app.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}`;
  const path='/api/activation/v1/customers/ledger/state';
  try {
    assert.equal((await fetch(base+path)).status,403);
    const preflight=await fetch(base+path,{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:5173','Access-Control-Request-Headers':'authorization, content-type'}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers')!,/Authorization/);
    const headers={'Content-Type':'application/json',Authorization:'Bearer test'};
    assert.equal((await fetch(base+path,{method:'POST',headers,body:JSON.stringify({context:x.context,plan:x.plan})})).status,201);
    const read=await fetch(base+path,{headers});assert.equal(read.headers.get('cache-control'),'no-store');assert.equal(read.headers.get('etag'),'"activation-0"');assert.equal((await read.json()).actions.inspect.status,'suggested');
    const update=await fetch(base+'/api/activation/v1/customers/ledger/progress',{method:'POST',headers,body:JSON.stringify(x.progress)});assert.equal(update.status,200);assert.equal((await update.json()).revision,1);
    assert.equal((await fetch(base+'/api/goals',{method:'POST',headers,body:JSON.stringify({serviceId:'test-service',goal:'Inspect configuration'})})).status,201);
  } finally { await new Promise<void>(resolve=>app.close(()=>resolve()));goals.close();x.store.close(); }
});

test('Chris outcome projection requires admitted goal-scoped report and pins agreement revision',()=>{
  const x=setup();
  const report:EvidenceRecord={...structuredClone(x.context.evidence[0]),id:'goal-report',kind:'customer_report',scope:x.context.agreedGoal.text,claim:'Customer reports this goal helped',basisIds:[]};
  const policy:Policy={...x.policy,admit:(p,e,purpose)=>e.id===report.id?isDeepStrictEqual(e,report):x.policy.admit(p,e,purpose)};
  x.store.close();const s=openActivationStore(x.file,policy);s.initialize(principal,x.context,x.plan);
  rejects(()=>s.reportOutcome(principal,'bad',0,99,[report]),'INVALID_EVIDENCE');
  rejects(()=>s.reportOutcome(principal,'scope',0,0,[{...report,scope:'deployment'}]),'INVALID_EVIDENCE');
  const state=s.reportOutcome(principal,'report',0,0,[report]);assert.equal(state.outcome.status,'reported');assert.equal(state.outcome.summary,report.claim);assert.deepEqual(state.outcome.evidenceIds,[report.id]);
  s.close();const restart=openActivationStore(x.file,policy);assert.deepEqual(restart.get(principal).outcome,state.outcome);restart.close();
});

// Automatic recovery uses real SQLite persistence; planner is an explicit test double.
import { createReplanWorker } from '../src/activation/worker.ts';
import { registryPolicy, evidenceLabel } from '../src/activation/admission.ts';
test('automatic worker recovers pending intent after restart and repeated scans are idempotent',async()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.store.blocker(principal,x.blocker);x.store.close();
  const store=openActivationStore(x.file,x.policy);let calls=0;
  const worker=createReplanWorker(store,async(_p,_s,intent)=>{calls++;assert.equal(intent.newInformation,x.blocker.newInformation);return x.replacement;});
  await Promise.all([worker.tick(),worker.tick()]);await worker.tick();
  assert.equal(calls,1);assert.equal(store.get(principal).revision,2);assert.equal(store.get(principal).actions['offline-review'].status,'suggested');store.close();
});
test('automatic worker persists planner failure and a restarted worker safely retries',async()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.store.blocker(principal,x.blocker);
  await createReplanWorker(x.store,async()=>{throw new Error('private failure');}).tick();
  assert.equal(x.store.get(principal).replan.status,'failed');x.store.close();
  const store=openActivationStore(x.file,x.policy);await createReplanWorker(store,async()=>x.replacement).tick();
  assert.equal(store.get(principal).replan.status,'ready');assert.equal(store.get(principal).revision,3);store.close();
});
test('overlapping independent workers publish only one replacement',async()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.store.blocker(principal,x.blocker);
  const second=openActivationStore(x.file,x.policy);
  await Promise.all([createReplanWorker(x.store,async()=>x.replacement).tick(),createReplanWorker(second,async()=>x.replacement).tick()]);
  assert.equal(x.store.get(principal).revision,2);second.close();x.store.close();
});
test('registry admission binds exact owner, expiry, bytes and technical-only verification',()=>{
  const x=setup(), now=Date.now()+2000;
  const bundle={principal,context:x.context,plans:[x.plan,x.replacement],evidence:[...x.context.evidence,...x.progress.evidence],expiresAt:new Date(now+60000).toISOString()};
  const policy=registryPolicy([bundle],()=>now), e=x.context.evidence[0];
  assert.equal(policy.admit(principal,e,'initialize'),true);
  assert.equal(policy.admit({...principal,tenantId:'other'},e,'initialize'),false);
  assert.equal(policy.admit(principal,{...e,claim:'forged'},'initialize'),false);
  assert.equal(registryPolicy([bundle],()=>now+60001).admit(principal,e,'initialize'),false);
  const verification=x.progress.evidence.find(e=>e.proof.type==='verification')!;
  assert.equal(policy.admit(principal,verification,'progress'),false);
  assert.match(evidenceLabel({...e,kind:'portal_simulated'}),/Simulated/);x.store.close();
});
test('invalid planner output persists safe failed intent without publishing an action',async()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.store.blocker(principal,x.blocker);
  await createReplanWorker(x.store,async()=>({...x.replacement,rationale:'forged'})).tick();
  const s=x.store.get(principal);assert.equal(s.replan.status,'failed');assert.equal(s.planRevision,0);assert.equal(s.milestone.status,'blocked');x.store.close();
});

test('registry admits independently attributed technical check, rejects simulated basis and stale sources',()=>{
  const x=setup(),now=Date.now()+2000;
  const records=structuredClone(x.progress.evidence);
  const verification=records.find(e=>e.proof.type==='verification')!;
  verification.scope='technical: inspected configuration';verification.proof.verifier='independent-checker';
  const make=()=>registryPolicy([{principal,context:x.context,plans:[x.plan],evidence:records,expiresAt:new Date(now+60000).toISOString()}],()=>now);
  assert.equal(make().admit(principal,verification,'progress'),true);
  const receipt=records.find(e=>e.proof.type==='execution_receipt')!;receipt.kind='portal_simulated';
  assert.equal(make().admit(principal,verification,'progress'),false);
  receipt.kind='action_record';verification.observedAt=new Date(now-86400001).toISOString();
  assert.equal(make().admit(principal,verification,'progress'),false);x.store.close();
});

import { writeFileSync } from 'node:fs';
import { developmentActivation } from '../src/activation/dev.ts';
test('explicit development configuration starts recovery worker and keeps customer route scoped',async()=>{
  const x=setup();x.store.initialize(principal,x.context,x.plan);x.store.blocker(principal,x.blocker);x.store.close();
  const env={...process.env};
  const records=[...new Map([...x.context.evidence,...x.plan.evidence,...x.blocker.evidence,...x.replacement.evidence].map(e=>[e.id,e])).values()];
  const path=join(mkdtempSync(join(tmpdir(),'activation-bundle-')),'admission.json');
  writeFileSync(path,JSON.stringify([{principal,context:x.context,plans:[x.plan,x.replacement],evidence:records,expiresAt:new Date(Date.now()+60000).toISOString()}]));
  let dev:ReturnType<typeof developmentActivation>;
  try {
    process.env.ACTIVATION_DEV='1';process.env.ACTIVATION_DEV_TOKEN='t'.repeat(32);process.env.ACTIVATION_ADMISSION_PATH=path;process.env.ACTIVATION_DATABASE_PATH=x.file;
    dev=developmentActivation(join(tmpdir(),'unused-goals.sqlite'));
    assert.ok(dev);
    assert.equal(dev.options.authorize({headers:{authorization:`Bearer ${'t'.repeat(32)}`}} as never,'other'),null);
    const deadline=Date.now()+8000;
    while(dev.options.store.get(principal).replan.status!=='ready'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(dev.options.store.get(principal).replan.status,'ready');
  } finally {await dev!?.close();process.env=env;}
});

test('collector observations require exact registry admission and persist without action or outcome advancement',async()=>{
 const {collectActivationEvidence}=await import('../../../prototypes/v1/server/activation-evidence.mjs');
 const {registryPolicy}=await import('../src/activation/admission.ts');
 const x=setup();x.store.close();
 const collected=await collectActivationEvidence({goal:'Inspect CI',repository:'example/service'},{token:'',fetchImpl:async(input)=>({ok:true,json:async()=>String(input).includes('/git/trees/')?{tree:[]}:String(input).includes('/commits/')?{sha:'c'.repeat(40)}:{default_branch:'release/next'}} as Response)});
 const records=collected.records;assert.equal(records.length,3);assert.match(records[0].source,/commits\/c{40}$/);
 const bundle={principal,context:x.context,plans:[x.plan],evidence:records,expiresAt:new Date(Date.now()+60000).toISOString()};
 const policy=registryPolicy([bundle]);
 const store=openActivationStore(x.file,{...x.policy,admit:(p,e,purpose)=>x.policy.admit(p,e,purpose)||policy.admit(p,e,purpose)});
 store.initialize(principal,x.context,x.plan);
 const command={...x.progress,id:'inspection-only',evidence:records,transitions:[],milestoneStatus:'pending' as const};
 rejects(()=>store.progress(principal,{...command,evidence:[{...records[0],claim:'invented passing check'}]}),'INVALID_EVIDENCE');
 const state=store.progress(principal,command);assert.equal(state.actions.inspect.status,'suggested');assert.equal(state.outcome.status,'unassessed');assert.ok(state.evidence.some(e=>e.id===records[0].id));
 store.close();const reopened=openActivationStore(x.file);assert.equal(reopened.get(principal).evidence.find(e=>e.id===records[0].id)?.proof.type,'none');reopened.close();
 const blocked=await collectActivationEvidence({goal:'Inspect CI',repository:'example/service'},{token:'',fetchImpl:async()=>({ok:false,status:404} as Response)});assert.deepEqual(blocked.records,[]);
});

test('actual authenticated GitHub observations enter a test-owned ledger only through exact registry admission',async()=>{
 const {readFileSync}=await import('node:fs');
 const {registryPolicy}=await import('../src/activation/admission.ts');
 const snapshot=JSON.parse(readFileSync(new URL('../../../docs/activation/evidence/authenticated-project-inspection.json',import.meta.url),'utf8')) as {observedAt:string;records:EvidenceRecord[]};
 const x=setup();x.store.close();
 // Context/plan are test doubles. Only the GitHub observation bytes are real captured evidence.
 // Fixed clock tests admission at collection time; it does not renew historical evidence.
 const at=Date.parse(snapshot.observedAt)+1000;
 const policy=registryPolicy([{principal,context:x.context,plans:[x.plan],evidence:snapshot.records,expiresAt:new Date(at+60000).toISOString()}],()=>at);
 const store=openActivationStore(x.file,{...x.policy,admit:(p,e,purpose)=>x.policy.admit(p,e,purpose)||policy.admit(p,e,purpose)});
 store.initialize(principal,x.context,x.plan);
 const event={...x.progress,id:'captured-project-observations',evidence:snapshot.records,transitions:[],milestoneStatus:'pending' as const};
 rejects(()=>store.progress(principal,{...event,evidence:[{...snapshot.records[0],producer:'invented-collector'}]}),'INVALID_EVIDENCE');
 const state=store.progress(principal,event);
 for(const record of snapshot.records)assert.deepEqual(state.evidence.find(e=>e.id===record.id),record);
 assert.equal(state.outcome.status,'unassessed');assert.equal(state.actions.inspect.status,'suggested');
 store.close();const reopened=openActivationStore(x.file);assert.equal(reopened.get(principal).evidence.filter(e=>snapshot.records.some(r=>r.id===e.id)).length,4);reopened.close();
});

test('context-only initialization selects the server reviewed initial plan and retains admission checks',async()=>{
 const x=setup();const goal=openGoalStore(':memory:');
 const server=createApp(goal,'http://127.0.0.1:5173',{store:x.store,isOperator:()=>true,authorize:()=>principal,initialPlan:(_p,c)=>isDeepStrictEqual(c,x.context)?x.plan:null});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const address=server.address();assert.ok(address&&typeof address==='object');
  const url=`http://127.0.0.1:${address.port}/api/activation/v1/customers/ledger/state`;
  const send=(context:CustomerContext)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context})});
  assert.equal((await send({...x.context,briefing:'unreviewed alteration'})).status,503);
  const r=await send(x.context);assert.equal(r.status,201);const state=await r.json();assert.deepEqual(state.plan,x.plan);assert.equal(state.outcome.status,'unassessed');
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));x.store.close();goal.close();}
});
