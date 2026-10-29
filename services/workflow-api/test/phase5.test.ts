/** Phase 5: developers work on approved milestones with their own credentials, and AiKA answers from approved,
 * developer-safe context only. Exercised over HTTP against the real stores; AiKA runs against a local stub of
 * Ollama's /api/chat (a fixed reply, not a model). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {TeamProgress} from '../../../contracts/activation/v1/handoff.ts';
import {PRIVATE,ollamaStub,harness,approvedPlan,work,update} from './support/work-harness.ts';

test('nothing to work on before approval; afterwards each developer works on their own milestone, attributed and revision-checked',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call,false);
  assert.equal((await h.call('northstar','milestone-work','alex')).json.error.code,'NO_APPROVED_PLAN','submitted, not approved: nothing to work on');
  const view=(await h.call('northstar','champion-review','champ')).json;
  await h.call('northstar','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve',confirmed:true},'Maya Chen');
  const alex=await work(h.call,'alex');
  assert.deepEqual(alex.milestones.map(m=>[m.title,m.assignee,m.mine,!!m.detail]),[['Assess payments-api repository readiness','Alex Rivera',true,true],['Validate payments-api discoverability','Jordan Lee',false,false]]);
  assert.equal(alex.approval!.by,'Maya Chen');assert.deepEqual(alex.objective!.goals,['Establish a service-readiness baseline for payments-api']);
  for(const x of PRIVATE)assert.ok(!JSON.stringify(alex).includes(x),'work view leaked '+x);
  // Alex starts an action; Jordan cannot touch Alex's milestone; stale revisions are refused.
  const started=await update(h.call,'alex','m-alex',0,{action:{index:0,status:'started'}});
  assert.equal(started.status,200,started.raw);
  const mine=(started.json as TeamProgress).milestones[0];
  assert.deepEqual([mine.status,mine.detail!.actions[0].status,mine.detail!.actions[0].by,mine.detail!.updatedBy],['in_progress','started','Alex Rivera','Alex Rivera']);
  assert.equal((await update(h.call,'jordan','m-alex',1,{action:{index:0,status:'completed'}})).json.error.code,'NOT_ASSIGNEE');
  assert.equal((await update(h.call,'alex','m-alex',0,{action:{index:1,status:'started'}})).json.error.code,'REVISION_CONFLICT','no silent overwrite');
  // Only a developer's own credential can change work: shared credential, forged name, Champion and Chris are refused.
  for(const token of ['dev','champ','op'])assert.equal((await h.call('northstar','milestone-updates',token,{milestoneId:'m-alex',expectedRevision:1,action:{index:0,status:'completed'}},'Alex Rivera')).json.error.code,'DEVELOPER_IDENTITY_REQUIRED',token);
  // Jordan sees Alex's milestone only as title, assignee and status; Maya and Chris see the consolidated detail.
  const jordan=await work(h.call,'jordan');
  assert.deepEqual([jordan.milestones[0].status,jordan.milestones[0].detail],['in_progress',null]);
  assert.deepEqual(jordan.milestones[1].dependsOn.map(d=>[d.title,d.assignee,d.status]),[['Assess payments-api repository readiness','Alex Rivera','in_progress']]);
  for(const token of ['champ','op']){const all=await work(h.call,token);assert.ok(all.milestones.every(m=>m.detail),token);assert.equal(all.milestones[0].detail!.actions[0].by,'Alex Rivera');}
  // Another customer's developer with the same name cannot reach Northstar.
  assert.equal((await h.call('northstar','milestone-work','lumen-alex')).status,403);
  assert.equal((await h.call('northstar','milestone-updates','lumen-alex',{milestoneId:'m-alex',expectedRevision:1,action:{index:0,status:'completed'}})).status,403);
 }finally{await h.close();}
});

test('dependencies and blockers: no completing ahead of a dependency, no ready-for-review with open blockers, nothing completes automatically',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call);
  let rev=0;const j=async(change:object)=>{const r=await update(h.call,'jordan','m-jordan',rev,change);if(r.status===200)rev++;return r;};
  await j({action:{index:0,status:'completed'}});await j({action:{index:1,status:'completed'}});
  const early=await j({status:'completed'});
  assert.equal(early.json.error.code,'MILESTONE_NOT_READY');assert.deepEqual(early.json.error.details.issues,['dependencies_incomplete']);
  // A blocker blocks the milestone and stops "ready for review" until it is resolved.
  const blocked=await j({note:{kind:'blocker',text:'No read access to the payments-api repository',evidence:'https://github.example/northstar/payments-api/issues/12'}});
  const mine=(blocked.json as TeamProgress).milestones[1];
  assert.equal(mine.status,'blocked');assert.equal(mine.openBlockers,1);assert.equal(mine.detail!.updates[0].by,'Jordan Lee');
  assert.equal(mine.detail!.updates[0].evidence,'https://github.example/northstar/payments-api/issues/12');
  assert.deepEqual((await j({status:'ready_for_review'})).json.error.details.issues,['open_blockers']);
  assert.equal((await j({note:{kind:'update',text:'Has a reference',evidence:'two words'}})).json.error.code,'INVALID_EVIDENCE_REFERENCE');
  await j({resolve:mine.detail!.updates[0].id});
  assert.equal((await j({status:'ready_for_review'})).json.milestones[1].status,'ready_for_review');
  // Maya sees the blocker history and Jordan's readiness; Alex's milestone is unaffected.
  const maya=await work(h.call,'champ');
  assert.equal(maya.milestones[1].detail!.updates[0].resolved!.by,'Jordan Lee');assert.equal(maya.milestones[0].status,'not_started');
  // Alex completes his work; Jordan's milestone stays ready for review until Jordan completes it.
  let a=0;for(const change of [{action:{index:0,status:'completed'}},{action:{index:1,status:'completed'}},{status:'completed'}])assert.equal((await update(h.call,'alex','m-alex',a++,change)).status,200);
  assert.deepEqual((await work(h.call,'jordan')).milestones.map(m=>m.status),['completed','ready_for_review']);
  assert.equal((await j({status:'completed'})).json.milestones[1].status,'completed');
  // Changing an action afterwards reopens the milestone instead of keeping a stale "completed".
  assert.equal((await j({action:{index:1,status:'started'}})).json.milestones[1].status,'in_progress');
 }finally{await h.close();}
});

test('progress survives a restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'phase5-'));
 try{
  let h=await harness({file:join(dir,'db.sqlite')});
  await approvedPlan(h.call);
  await update(h.call,'alex','m-alex',0,{action:{index:0,status:'blocked'}});
  await update(h.call,'alex','m-alex',1,{note:{kind:'question',text:'Which branch is deployed to production?'}});
  await h.close();
  h=await harness({file:join(dir,'db.sqlite')});
  const m=(await work(h.call,'alex')).milestones[0];
  assert.deepEqual([m.status,m.detail!.revision,m.detail!.actions[0].status,m.detail!.updates[0].text],['blocked',2,'blocked','Which branch is deployed to production?']);
  await h.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('AiKA: answers from approved, developer-safe context only, labels what it knows, and never claims an inspection',async()=>{
 const stub=await ollamaStub(()=>({sections:[
  {kind:'known',text:'Your milestone is to assess payments-api repository readiness.'},
  {kind:'known',text:'The Kubernetes cluster runs version 1.29 in three regions.'},
  {kind:'reported',text:'I inspected the repository and the catalog file is valid.'},
  {kind:'unknown',text:'Which CI system deploys payments-api is still open; ask your Champion.'}],next_step:'Start action 1: locate the payments-api repository.'}));
 const h=await harness({modelUrl:stub.url});
 try{
  assert.equal((await h.call('northstar','aika-questions','alex',{question:'What should I do next?'})).json.error.code,'NO_APPROVED_PLAN');
  await approvedPlan(h.call);
  await update(h.call,'jordan','m-jordan',0,{note:{kind:'update',text:'Jordan private scratch note about search'}});
  const asked=await h.call('northstar','aika-questions','alex',{question:'What should I do next?',milestoneId:'m-alex'});
  assert.equal(asked.status,202,asked.raw);
  assert.equal((await h.call('northstar','aika-questions','alex',{question:'Again?'})).json.duplicate,true,'one run at a time');
  let job;for(let i=0;i<100;i++){job=(await h.call('northstar','aika-questions','alex')).json.job;if(job.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'succeeded',JSON.stringify(job));
  assert.deepEqual(job.answer.sections.map((s:{kind:string})=>s.kind),['known','suggestion','unknown'],'ungrounded "known" becomes a suggestion');
  assert.equal(job.answer.removed,1,'the claimed inspection is removed');
  assert.match(job.answer.nextStep,/locate the payments-api repository/);
  // Exactly what the model received: Alex's own milestone and progress, the team's statuses, no private context.
  const prompt=stub.requests[0].messages[1].content as string;
  assert.match(prompt,/YOUR MILESTONE \(the question is about this one\): Assess payments-api repository readiness — assigned to Alex Rivera/);
  assert.match(prompt,/TEAM MILESTONE: Validate payments-api discoverability — Jordan Lee — status in progress/);
  assert.match(prompt,/REPOSITORY EVIDENCE: none/);assert.match(prompt,/TECHNICAL GOAL: Establish a service-readiness baseline/);
  for(const x of [...PRIVATE,'Jordan private scratch note','Opportunity','My pricing notes'])assert.ok(!JSON.stringify(stub.requests).includes(x),'AiKA prompt leaked '+x);
  assert.equal(stub.requests[0].model,'qwen3:1.7b');
  // Chris (operator) has no AiKA here; a different viewer has a separate conversation.
  assert.equal((await h.call('northstar','aika-questions','op',{question:'Hello there'})).status,403);
  assert.equal((await h.call('northstar','aika-questions','jordan')).json.job,null);
 }finally{await h.close();await stub.close();}
});

test('AiKA failures are reported as codes: invalid output, timeout, model not configured',async()=>{
 const bad=await ollamaStub(()=>({sections:[{kind:'reported',text:'We verified the repository yesterday.'}],next_step:null}));
 const slow=await ollamaStub(()=>({sections:[],next_step:null}),1500);
 for(const [url,timeoutMs,code] of [[bad.url,5000,'INVALID_MODEL_OUTPUT'],[slow.url,1000,'MODEL_TIMEOUT']] as const){
  const h=await harness({modelUrl:url,timeoutMs});
  try{
   await approvedPlan(h.call);
   assert.equal((await h.call('northstar','aika-questions','alex',{question:'What is next?'})).status,202);
   let job;for(let i=0;i<300;i++){job=(await h.call('northstar','aika-questions','alex')).json.job;if(job.status!=='running')break;await new Promise(r=>setTimeout(r,10));}
   assert.deepEqual([job.status,job.error,job.answer],['failed',code,null]);
  }finally{await h.close();}
 }
 await bad.close();await slow.close();
 const none=await harness();
 try{await approvedPlan(none.call);assert.equal((await none.call('northstar','aika-questions','alex',{question:'What is next?'})).json.error.code,'AIKA_UNAVAILABLE');}
 finally{await none.close();}
});
