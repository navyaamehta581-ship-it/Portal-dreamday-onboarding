import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createIntake} from '../src/activation/intake.ts';
import {openActivationStore} from '../src/activation/store.ts';
const principal={tenantId:'test',customerId:'new-customer',sessionId:'chris'};
const base={admit:()=>false};
test('unseen incident and existing-service briefs generate distinct grounded suggestions',async()=>{
 const intake=createIntake(base);
 const first=await intake.prepare(principal,{briefing:'Payments has failing CI after a dependency update. Production writes are prohibited.',outcome:'Review an investigation checklist',agreedBy:'Customer via Chris',agreementConfirmed:true});
 const second=await intake.prepare(principal,{briefing:'Our legacy Java estate needs onboarding for twenty engineers. No new repositories are permitted.',outcome:'Review a first onboarding guide',agreedBy:'Customer via Chris',agreementConfirmed:true});
 assert.equal(first.plan.capabilities[0].id,'ci');assert.equal(second.plan.capabilities[0].id,'onboard');
 assert.notEqual(first.plan.suggestedNextAction.description,second.plan.suggestedNextAction.description);
 assert.ok(second.plan.evidence.every(e=>e.proof.type==='none'));
 assert.match(second.plan.rationale,/deterministic fallback/);
 assert.equal(intake.policy.admitPlan!(principal,first.context,first.plan),false);
 const tampered=structuredClone(second.plan);tampered.suggestedNextAction.status='executed' as 'suggested';
 assert.equal(intake.policy.admitPlan!(principal,second.context,tampered),false);
});
test('missing info, invalid provider, agreement validation and process-style reopen',async()=>{
 const intake=createIntake(base,async()=>({intent:'creation',fake:'execute everything'}));
 await assert.rejects(intake.prepare(principal,{briefing:'Help',outcome:'Review',agreedBy:'Chris',agreementConfirmed:false}));
 const prepared=await intake.prepare(principal,{briefing:'Help',outcome:'Review the first step',agreedBy:'Customer via Chris',agreementConfirmed:true});
 assert.match(prepared.plan.suggestedNextAction.description,/Clarify/);
 const filename=join(mkdtempSync(join(tmpdir(),'activation-intake-')),'state.sqlite');
 const store=openActivationStore(filename,intake.policy);const saved=store.initialize(principal,prepared.context,prepared.plan);store.close();intake.release(principal);
 const reopened=openActivationStore(filename,base);assert.deepEqual(reopened.get(principal),saved);assert.equal(saved.outcome.status,'unassessed');assert.equal(saved.actions['prepare-first-review'].status,'suggested');reopened.close();
});
test('validated interpreter guides planning but cannot supply capabilities or authority',async()=>{
 const intake=createIntake(base,async()=>({intent:'troubleshooting',secondaryIntents:[],rationale:'Investigate first',ambiguous:false,statedProblem:'Need investigation',desiredOutcome:null,context:[],friction:[],constraints:[],existingCapabilities:[],missingInformation:[],assumptions:[],conflictingConstraintIds:[],clarification:null}));
 const result=await intake.prepare(principal,{briefing:'Customer asks why the deployment pipeline cannot complete its normal validation stage.',outcome:'Review investigation steps',agreedBy:'Customer via Chris',agreementConfirmed:true});
 assert.equal(result.plan.capabilities[0].id,'ci');assert.match(result.plan.rationale,/validated hosted interpretation/);assert.equal(result.plan.suggestedNextAction.kind,'prepare_artifact');
 assert.ok(result.plan.evidence.find(e=>e.kind==='ai_inference')?.basisIds.includes(result.context.briefingEvidenceIds[0]));
});
test('authenticated HTTP intake persists generated plan, rejects duplicate and unconfirmed intake',async()=>{
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');
 const intake=createIntake(base),store=openActivationStore(':memory:',intake.policy),goals=openGoalStore(':memory:');
 const server=createApp(goals,undefined,{store,isOperator:()=>true,authorize:r=>r.headers.authorization==='Bearer local-test'?principal:null,intake:async(p,b)=>{try{const prepared=await intake.prepare(p,b);return store.initialize(p,prepared.context,prepared.plan);}finally{intake.release(p);}}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};
 const url=`http://127.0.0.1:${address.port}/api/activation/v1/customers/new-customer`;
 try{
 const body={briefing:'An existing regulated Java service needs an onboarding guide without repository writes.',outcome:'Review a safe onboarding checklist',agreedBy:'Customer via Chris',agreementConfirmed:true};
 const post=(value:unknown,auth=true)=>fetch(url+'/intake',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-test'}:{})},body:JSON.stringify(value)});
 assert.equal((await post(body,false)).status,403);assert.equal((await post({...body,agreementConfirmed:false})).status,400);
 const response=await post(body);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.plan.capabilities[0].id,'onboard');assert.equal(saved.outcome.status,'unassessed');assert.equal(response.headers.get('cache-control'),'no-store');
 const loaded=await fetch(url+'/state',{headers:{Authorization:'Bearer local-test'}});assert.deepEqual(await loaded.json(),saved);assert.equal((await post(body)).status,409);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));store.close();goals.close();}
});
test('user supplied simulated recommendation service stays creation with no real agreement or runtime selection',async()=>{
 const {readFileSync}=await import('node:fs');
 const input=JSON.parse(readFileSync(new URL('../../../docs/activation/evidence/recommendation-demo-intake.json',import.meta.url),'utf8'));
 const intake=createIntake(base);const prepared=await intake.prepare(principal,input);
 assert.match(prepared.plan.suggestedNextAction.description,/Scaffolder templates/);
 assert.match(prepared.plan.suggestedNextAction.description,/template-readiness checklist/);
 assert.match(prepared.plan.evidence.find(e=>e.kind==='ai_inference')!.claim,/intent creation/);
 assert.ok(prepared.plan.evidence.every(e=>e.kind!=='customer_report'&&e.proof.type==='none'));
 assert.match(prepared.context.agreedGoal.agreedBy,/SIMULATED/);
 assert.equal(prepared.plan.capabilities[0].id,'docs');
 assert.ok(prepared.context.unknowns.includes('Approved runtime'));
 assert.equal(prepared.plan.suggestedNextAction.status,'suggested');
 const store=openActivationStore(':memory:',intake.policy);assert.throws(()=>store.initialize(principal,prepared.context,prepared.plan));assert.equal(intake.policy.admitContext!(principal,prepared.context),false);store.close();
 await assert.rejects(intake.prepare(principal,{...input,agreementConfirmed:true}));
});
