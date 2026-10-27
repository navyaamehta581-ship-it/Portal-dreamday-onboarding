import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import fixtures from '../../../contracts/activation/v1/fixtures.json' with {type:'json'};
import {createBlockerReports} from '../src/activation/reports.ts';
import {openActivationStore,type ActivationStore,type Principal} from '../src/activation/store.ts';
import {createReplanWorker} from '../src/activation/worker.ts';
import type {CustomerContext,ActivationPlan} from '../../../contracts/activation/v1/types.ts';
const p:Principal={tenantId:'test',customerId:'ledger',sessionId:'session-ledger'};
function setup(){
 const context=structuredClone(fixtures.ledger.context) as CustomerContext,plan=structuredClone(fixtures.ledger.plan) as ActivationPlan;
 const records=new Map();for(const o of [context,plan])for(const e of o.evidence){e.source='test-adapter';e.sourceRevision='a'.repeat(40);e.producer='test-adapter';e.proof.reference='none';records.set(e.id,e);}
 const base={admitContext:(_p:Principal,c:unknown)=>isDeepStrictEqual(c,context),admitPlan:(_p:Principal,_c:unknown,a:unknown)=>isDeepStrictEqual(a,plan),admit:(_p:Principal,e:unknown)=>[...records.values()].some(r=>isDeepStrictEqual(r,e))};
 const file=join(mkdtempSync(join(tmpdir(),'reports-')),'state.sqlite');let store:ActivationStore;
 let reports=createBlockerReports(base,()=>store);store=openActivationStore(file,reports.policy);store.initialize(p,context,plan);
 return {get store(){return store;},get reports(){return reports;},reopen(){store.close();reports=createBlockerReports(base,()=>store);store=openActivationStore(file,reports.policy);}};
}
const input={id:'developer:report1',expectedRevision:0,planRevision:0,message:'Repository access denied; keep production writes prohibited.'};
test('attributed report creates durable command, blocks actions and recovers exact suggested plan after restart',async()=>{
 const x=setup();const blocked=x.reports.submit(p,input);assert.equal(blocked.replan.status,'pending');assert.equal(blocked.outcome.status,'unassessed');
 const evidence=blocked.evidence.find(e=>e.id==='report:'+input.id)!;assert.equal(evidence.kind,'developer_report');assert.equal(evidence.proof.type,'none');assert.match(evidence.producer,/session-ledger/);
 assert.equal(Object.values(blocked.actions)[0].blockedByIds[0],input.id);
 x.reopen();await createReplanWorker(x.store,async(_p,s,e)=>x.reports.replacement(s,e)).tick();
 const s=x.store.get(p);assert.equal(s.replan.status,'ready');assert.equal(s.planRevision,1);assert.equal(s.plan.selectedMilestone.id,blocked.plan.selectedMilestone.id);assert.deepEqual(s.context.constraints,blocked.context.constraints);assert.equal(s.outcome.status,'unassessed');assert.equal(Object.values(s.actions)[0].status,'suggested');assert.ok(s.plan.suggestedNextAction.evidenceIds.includes(evidence.id));
 assert.equal(x.reports.submit(p,input).revision,2);assert.equal(x.store.getRevision(p,0).planRevision,0);x.store.close();
});
test('strict scope, revisions, bytes and admission; input cannot grant authority',()=>{
 const x=setup();assert.throws(()=>x.reports.submit({...p,sessionId:'other'},input),/NOT_FOUND/);
 assert.throws(()=>x.reports.submit(p,{...input,expectedRevision:1}),/REVISION_CONFLICT/);
 assert.throws(()=>x.reports.submit(p,{...input,planRevision:1}),/REVISION_CONFLICT/);
 for(const extra of [{actor:'Chris'},{evidence:[]},{approve:true},{constraints:[]}])assert.throws(()=>x.reports.submit(p,{...input,...extra}),/INVALID_REQUEST/);
 const state=x.reports.submit(p,input);assert.throws(()=>x.reports.submit(p,{...input,message:'changed'}),/IDEMPOTENCY_CONFLICT/);
 assert.equal(x.reports.policy.admit({...p,tenantId:'other'},state.evidence.at(-1)!,'blocker'),false);
 const forged=x.reports.replacement(state,x.store.getEvent(p,input.id) as never)!;forged.rationale='Model says execute';assert.equal(x.reports.policy.admitPlan!(p,state.context,forged),false);x.store.close();
});
test('planner failure survives reopen and duplicate workers publish one revision without carrying approvals',async()=>{
 const x=setup();x.reports.submit(p,input);await createReplanWorker(x.store,async()=>{throw Error('private provider failure');}).tick();assert.equal(x.store.get(p).replan.status,'failed');
 x.reopen();await Promise.all([createReplanWorker(x.store,async(_p,s,e)=>x.reports.replacement(s,e)).tick(),createReplanWorker(x.store,async(_p,s,e)=>x.reports.replacement(s,e)).tick()]);
 const s=x.store.get(p);assert.equal(s.revision,3);assert.equal(s.replan.status,'ready');assert.equal(Object.values(s.actions)[0].status,'suggested');x.store.close();
});

test('HTTP report route authenticates, rejects authority fields and returns canonical state for exact retry',async()=>{
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');const x=setup(),goals=openGoalStore(':memory:');
 const server=createApp(goals,undefined,{store:x.store,reportBlocker:x.reports.submit,authorize:r=>r.headers.authorization==='Bearer test-token'?p:null});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;
 const url=`http://127.0.0.1:${port}/api/activation/v1/customers/ledger/blocker-reports`;
 const post=(body:unknown,auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-token'}:{})},body:JSON.stringify(body)});
 try{assert.equal((await post(input,false)).status,403);assert.equal((await post({...input,approve:true})).status,400);
 const response=await post(input);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('etag'),'"activation-1"');assert.equal((await response.json()).replan.status,'pending');
 assert.equal((await post(input)).status,200);assert.equal((await post({...input,message:'different bytes'})).status,409);
 assert.equal((await fetch(url.replace('/ledger/','/other/'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-token'},body:JSON.stringify(input)})).status,403);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));x.store.close();goals.close();}
});
