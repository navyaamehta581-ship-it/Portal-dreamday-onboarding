/** Phase 6: Maya coordinates approved work. One progress record per milestone (Phase 5) carries the developers' work,
 * the shared discussion and Maya's review; the server computes every status and count, so Maya, Chris and the
 * developers see the same numbers. Exercised over HTTP against the real stores. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {MilestoneProgress,TeamProgress} from '../../../contracts/activation/v1/handoff.ts';
import {PRIVATE,approvedPlan,coordinate,harness,update,work} from './support/work-harness.ts';

const ms=(t:TeamProgress,id:string)=>t.milestones.find(m=>m.id===id)! as MilestoneProgress;
const rev=async(call:Parameters<typeof work>[0],id:string)=>ms(await work(call,'champ'),id).detail!.revision;

test('team progress: Maya and Chris see the same server-computed status, counts and attention as the developers',async()=>{
 const h=await harness({evidence:['northstar/platform has no catalog-info.yaml at the root']});
 try{
  await approvedPlan(h.call);
  let t=await work(h.call,'champ');
  assert.deepEqual({...t.summary,overdue:t.summary!.overdue},{milestones:2,notStarted:2,inProgress:0,blocked:0,readyForReview:0,completed:0,reviewed:0,awaitingReview:0,openBlockers:0,openQuestions:0,openFollowUps:0,actionsCompleted:0,actionsTotal:4,overdue:null},'no deadlines in the plan, so nothing is overdue');
  assert.equal((await update(h.call,'alex','m-alex',0,{action:{index:0,status:'completed'}})).status,200);
  assert.equal((await update(h.call,'alex','m-alex',1,{note:{kind:'blocker',text:'No read access to payments-api',evidence:'https://example.test/req/7'}})).status,200);
  assert.equal((await update(h.call,'alex','m-alex',2,{note:{kind:'question',text:'Who owns the payments-api runbook?'}})).status,200);
  t=await work(h.call,'champ');
  const alex=ms(t,'m-alex');
  assert.equal(alex.status,'blocked');assert.equal(alex.actionsCompleted,1);assert.equal(alex.actionsTotal,2);
  assert.deepEqual(alex.attention,['blocked','open_question']);
  assert.deepEqual(alex.latest,{at:alex.detail!.updates.at(-1)!.at,by:'Alex Rivera',kind:'question'});
  assert.equal(alex.detail!.updates[0].evidence,'https://example.test/req/7');
  assert.equal(t.summary!.blocked,1);assert.equal(t.summary!.openBlockers,1);assert.equal(t.summary!.openQuestions,1);assert.equal(t.summary!.actionsCompleted,1);
  assert.deepEqual(t.verifiedEvidence,['northstar/platform has no catalog-info.yaml at the root'],'only what the backend observed is verified');
  // Jordan's dependent milestone is shown as waiting once he starts it.
  await update(h.call,'jordan','m-jordan',0,{action:{index:0,status:'started'}});
  t=await work(h.call,'champ');
  assert.ok(ms(t,'m-jordan').attention!.includes('waiting_on_dependency'));
  // Chris sees the same numbers, read-only; the developers see the same statuses.
  const chris=await work(h.call,'op');
  assert.deepEqual(chris.summary,t.summary);assert.deepEqual(chris.milestones.map(m=>[m.id,m.status,m.reviewState]),t.milestones.map(m=>[m.id,m.status,m.reviewState]));
  const jordan=await work(h.call,'jordan');
  assert.deepEqual(jordan.summary,t.summary);assert.equal(ms(jordan,'m-alex').status,'blocked');
  assert.equal(ms(jordan,'m-alex').detail,null);assert.equal(ms(jordan,'m-alex').latest,null,'Alex’s notes stay his');
  assert.equal(jordan.verifiedEvidence,undefined);
  for(const v of [t,chris])assert.ok(!PRIVATE.some(x=>JSON.stringify(v).includes(x)),'no commercial or internal notes in progress views');
 }finally{await h.close();}
});

test('discussion: Maya responds to questions and blockers, requests follow-up and adds notes; everything attributed, nothing changes the developer’s status',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call);
  await update(h.call,'alex','m-alex',0,{action:{index:0,status:'started'}});
  await update(h.call,'alex','m-alex',1,{note:{kind:'question',text:'Who owns the payments-api runbook?'}});
  await update(h.call,'alex','m-alex',2,{note:{kind:'blocker',text:'No read access to payments-api'}});
  let a=ms(await work(h.call,'champ'),'m-alex');
  const [question,blocker]=a.detail!.updates;
  let r=await coordinate(h.call,'champ','m-alex',3,{respond:{to:question.id,text:'The platform team owns it; ask in #platform.'}});
  assert.equal(r.status,200,r.raw);
  a=ms(r.json,'m-alex');assert.equal(a.openQuestions,0);assert.equal(a.status,'blocked');
  const reply=a.detail!.updates.at(-1)!;
  assert.deepEqual([reply.kind,reply.role,reply.by,reply.replyTo],['response','champion','Maya Chen',question.id]);
  // Maya unblocks Alex and says so; the blocker is resolved by her, and the status follows from the work.
  r=await coordinate(h.call,'champ','m-alex',4,{respond:{to:blocker.id,text:'Access granted through the platform-readers team.',resolve:true}});
  a=ms(r.json,'m-alex');assert.deepEqual(a.detail!.updates.find(u=>u.id===blocker.id)!.resolved?.by,'Maya Chen');assert.equal(a.status,'in_progress');
  assert.equal((await coordinate(h.call,'champ','m-alex',5,{respond:{to:question.id,text:'Not a blocker',resolve:true}})).json.error.code,'INVALID_REQUEST','only an open blocker can be resolved');
  // Follow-up request: open until Alex replies.
  r=await coordinate(h.call,'champ','m-alex',5,{followUp:{text:'Can you share the access request link?'}});
  a=ms(r.json,'m-alex');assert.equal(a.openFollowUps,1);
  const follow=a.detail!.updates.at(-1)!;
  assert.equal((await update(h.call,'alex','m-alex',6,{note:{kind:'response',text:'Here it is',replyTo:'not-an-entry'}})).json.error.code,'INVALID_REQUEST');
  assert.equal((await update(h.call,'jordan','m-alex',6,{note:{kind:'response',text:'I can answer',replyTo:follow.id}})).json.error.code,'NOT_ASSIGNEE','only the assignee replies on their milestone');
  r=await update(h.call,'alex','m-alex',6,{note:{kind:'response',text:'Linked in the blocker note.',replyTo:follow.id}});
  a=ms(r.json,'m-alex');assert.equal(a.openFollowUps,0);assert.equal(a.detail!.updates.at(-1)!.by,'Alex Rivera');
  // A coordination note on untouched work doesn't start it.
  r=await coordinate(h.call,'champ','m-jordan',0,{note:{text:'Jordan, start once Alex confirms access.'}});
  const j=ms(r.json,'m-jordan');assert.equal(j.status,'not_started');assert.equal(j.detail!.updates[0].kind,'coordination');
  // Jordan sees Maya's note on his milestone.
  assert.equal(ms(await work(h.call,'jordan'),'m-jordan').detail!.updates[0].by,'Maya Chen');
 }finally{await h.close();}
});

test('review: only after the developer marks it ready; recorded beside the status, never completing it; outdated when the work changes',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call);
  assert.equal((await coordinate(h.call,'champ','m-alex',0,{review:{decision:'reviewed'}})).json.error.code,'REVIEW_NOT_READY');
  await update(h.call,'alex','m-alex',0,{action:{index:0,status:'completed'}});
  await update(h.call,'alex','m-alex',1,{action:{index:1,status:'completed'}});
  await update(h.call,'alex','m-alex',2,{status:'ready_for_review'});
  let a=ms(await work(h.call,'champ'),'m-alex');
  assert.equal(a.reviewState,'awaiting_review');assert.ok(a.attention!.includes('awaiting_review'));
  let r=await coordinate(h.call,'champ','m-alex',3,{review:{decision:'reviewed',note:'Checklist looks complete.'}});
  a=ms(r.json,'m-alex');
  assert.equal(a.status,'ready_for_review','reviewing never completes the milestone');assert.equal(a.reviewState,'reviewed');
  assert.deepEqual([a.review!.by,a.review!.note],['Maya Chen','Checklist looks complete.']);
  assert.equal(r.json.summary.reviewed,1);assert.equal(r.json.summary.completed,0);
  assert.equal((await coordinate(h.call,'champ','m-alex',4,{review:{decision:'reviewed'}})).json.error.code,'ALREADY_REVIEWED');
  // A question doesn't outdate the review; changing the work does.
  await update(h.call,'alex','m-alex',4,{note:{kind:'question',text:'Anything else to add?'}});
  assert.equal(ms(await work(h.call,'champ'),'m-alex').reviewState,'reviewed');
  await update(h.call,'alex','m-alex',5,{status:'completed'});
  a=ms(await work(h.call,'champ'),'m-alex');
  assert.equal(a.status,'completed');assert.equal(a.reviewState,'reviewed_outdated','completion is the developer’s, and Maya hasn’t seen it');
  r=await coordinate(h.call,'champ','m-alex',6,{review:{decision:'reviewed'}});
  assert.equal(ms(r.json,'m-alex').reviewState,'reviewed');
  // Jordan's dependent milestone is not completed by any of this.
  assert.equal(ms(r.json,'m-jordan').status,'not_started');
 }finally{await h.close();}
});

test('authorization and stale updates: only Maya coordinates, only the assignee updates, Chris only reads; per customer',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call);
  for(const token of ['alex','jordan','dev','op']){
   const r=await coordinate(h.call,token,'m-alex',0,{note:{text:'Trying to coordinate'}});
   assert.equal(r.status,403,token);assert.equal(r.json.error.code,'CHAMPION_REQUIRED');
  }
  for(const token of ['champ','op'])assert.equal((await update(h.call,token,'m-alex',0,{action:{index:0,status:'started'}})).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');
  assert.equal((await h.call('northstar','milestone-work','op')).status,200,'Chris reads approved progress');
  assert.equal((await h.call('northstar','milestone-coordination','lumen-champ',{milestoneId:'m-alex',expectedRevision:0,note:{text:'Other customer'}},'Priya Nair')).status,403,'another customer’s Champion');
  assert.equal((await h.call('northstar','milestone-work','lumen-champ')).status,403);
  // Developers still can't approve plans or reach operator-only routes.
  assert.equal((await h.call('northstar','champion-decisions','alex',{draft:1,reviewRevision:1,decision:'approve',confirmed:true})).status,403);
  assert.equal((await h.call('northstar','handoff-workspace','alex')).status,403);
  // Stale on both sides: Maya's note makes Alex's open page stale, and the other way round.
  assert.equal((await coordinate(h.call,'champ','m-alex',0,{note:{text:'Starting soon?'}})).status,200);
  const stale=await update(h.call,'alex','m-alex',0,{action:{index:0,status:'started'}});
  assert.equal(stale.status,409);assert.equal(stale.json.error.code,'REVISION_CONFLICT');
  assert.equal((await update(h.call,'alex','m-alex',1,{action:{index:0,status:'started'}})).status,200);
  assert.equal((await coordinate(h.call,'champ','m-alex',1,{note:{text:'Thanks'}})).json.error.code,'REVISION_CONFLICT');
  const a=ms(await work(h.call,'champ'),'m-alex');
  assert.deepEqual(a.detail!.updates.map(u=>[u.kind,u.by]),[['coordination','Maya Chen']],'nothing was overwritten');
  assert.equal(a.detail!.actions[0].by,'Alex Rivera');
 }finally{await h.close();}
});

test('coordination survives a restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'phase6-'));
 try{
  let h=await harness({file:join(dir,'db.sqlite')});
  await approvedPlan(h.call);
  await update(h.call,'alex','m-alex',0,{action:{index:0,status:'completed'}});
  await update(h.call,'alex','m-alex',1,{action:{index:1,status:'completed'}});
  await update(h.call,'alex','m-alex',2,{status:'ready_for_review'});
  await coordinate(h.call,'champ','m-alex',3,{review:{decision:'reviewed'}});
  await coordinate(h.call,'champ','m-alex',4,{note:{text:'Great start.'}});
  await h.close();
  h=await harness({file:join(dir,'db.sqlite')});
  const a=ms(await work(h.call,'champ'),'m-alex');
  assert.equal(a.reviewState,'reviewed');assert.equal(a.status,'ready_for_review');assert.equal(a.detail!.updates[0].by,'Maya Chen');assert.equal(await rev(h.call,'m-alex'),5);
  await h.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
