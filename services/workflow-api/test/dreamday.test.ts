/** Dream Day (Phase 4): Chris submits → the Champion reviews, edits, assigns, requests changes or approves →
 * developers receive only their approved work. Exercised over HTTP with separate credentials per role and customer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ChampionReview,HandoffRecord,ReviewDraft,ReviewMilestone,SourceInput} from '../../../contracts/activation/v1/handoff.ts';
import {interpretRuleBased} from '../src/activation/handoff/interpret.ts';
import {proposeMilestones} from '../src/activation/handoff/milestones.ts';
import type {Analysis,StageListener} from '../src/activation/handoff/intelligence.ts';

const CALL='Maya Chen: Nobody can tell who owns a service and the runbooks are missing.\nMaya Chen: Let’s pilot with payments-api on GitHub. Alex Rivera can do the initial repository readiness assessment. Jordan Lee should independently check whether people can find the service and its docs.';
const NOTES='Opportunity: $300K ARR, stage: technical validation. Her VP thinks Backstage is a nice-to-have. Jamie Park (AE) owns the renewal.';
const SOURCES=[{id:'a',type:'conversation',label:'Call with Maya',text:CALL},{id:'b',type:'chris_notes',label:'Pricing notes for Jamie',text:NOTES}];
const PRIVATE=['300K','ARR','nice-to-have','VP thinks','Jamie','renewal','Pricing notes','technical validation','Call with Maya'];
const rule=async(s:SourceInput[],onStage?:StageListener):Promise<Analysis>=>{onStage?.('interpreting',null);const understanding=interpretRuleBased(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};};

type Call=(customer:string,path:string,token:string,body?:unknown,actor?:string)=>Promise<{status:number;json:any;raw:string}>;
async function harness(file=':memory:',publishEnabled=true){
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');
 const {openActivationStore}=await import('../src/activation/store.ts');const {createIntake}=await import('../src/activation/intake.ts');
 const {openHandoffStore}=await import('../src/activation/handoff/store.ts');const {createHandoffService}=await import('../src/activation/handoff/service.ts');
 const intake=createIntake({admit:()=>false});
 const store=openActivationStore(file,intake.policy),handoffs=openHandoffStore(file),goals=openGoalStore(':memory:');
 const service=createHandoffService({handoffs,store:()=>store,analyze:rule,stage:intake.stage,release:intake.release,publishEnabled});
 const {createWorkService,openWorkStore}=await import('../src/activation/handoff/work.ts');
 const workStore=openWorkStore(file),work=createWorkService({published:p=>handoffs.published(p),work:workStore});
 const north={tenantId:'t',customerId:'aperture',sessionId:'s'},lumen={...north,customerId:'lumen'};
 // One credential per role and customer, as the demo launcher creates them.
 // Developers also get personal credentials (Phase 5): the API names them from the credential, never from a header.
 const tokens:Record<string,{p:typeof north;role:'dev'|'op'|'champ';name?:string}>={dev:{p:north,role:'dev'},op:{p:north,role:'op'},champ:{p:north,role:'champ'},'lumen-champ':{p:lumen,role:'champ'},'lumen-dev':{p:lumen,role:'dev'},
  alex:{p:north,role:'dev',name:'Alex Rivera'},jordan:{p:north,role:'dev',name:'Jordan Lee'},sam:{p:north,role:'dev',name:'Sam Nobody'}};
 const who=(r:{headers:{authorization?:string}})=>tokens[(r.headers.authorization??'').replace('Bearer ','')];
 const server=createApp(goals,undefined,{store,handoff:service,work,championApproval:true,authorize:(r,c)=>who(r)?.p.customerId===c?who(r)!.p:null,isOperator:r=>who(r)?.role==='op',isChampion:r=>who(r)?.role==='champ',developerName:r=>who(r)?.name??null,
  initialPlan:()=>null,intake:async()=>{throw Error('intake must not run');}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/`;
 const call:Call=async(customer,path,token,body,actor)=>{const r=await fetch(base+customer+'/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(actor?{'X-Portal-Actor':actor}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();return {status:r.status,json:raw?JSON.parse(raw):null,raw};};
 return {call,handoffs,close:async()=>{await new Promise<void>(r=>server.close(()=>r()));store.close();handoffs.close();workStore.close();goals.close();}};
}
const milestone=(id:string,title:string,assignee:string|null,dependsOn:string[]=[]):ReviewMilestone=>({id,title,description:`${title} for the pilot`,system:'payments-api',
 actions:[`Start: ${title}`,'Record what was found'],completionCriteria:['Each item is marked verified, missing or inaccessible'],assignee,role:'developer',dependsOn,origin:'ai'});
/** Chris: analyse, name the technical team, keep Jamie (AE) as an internal person, submit. */
async function chrisSubmits(call:Call){
 await call('aperture','handoff-workspace','op',{expectedRevision:0,sources:SOURCES});
 await call('aperture','handoff-analyses','op',{workspaceRevision:1});
 for(let i=0;i<50&&(await call('aperture','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(r=>setTimeout(r,5));
 const record:HandoffRecord=(await call('aperture','handoff','op')).json.drafts[0];
 const review:ReviewDraft={...record.review!,goals:[{id:'g1',text:'Establish a service-readiness baseline for payments-api',origin:'ai'}],
  stakeholders:[{id:'p1',name:'Maya Chen',role:'Champion, Director of Platform Engineering',responsibilities:'Coordinate and approve',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p2',name:'Alex Rivera',role:'Developer',responsibilities:'Initial repository readiness assessment',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p3',name:'Jordan Lee',role:'Developer',responsibilities:'Independent discoverability check',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p4',name:'Jamie Park',role:'Account executive',responsibilities:'Owns the commercial relationship',basis:'stated',sources:['Pricing notes for Jamie'],technical:false}],
  milestones:[milestone('m-1','Assess payments-api repository readiness',null)],questions:[{id:'q1',text:'Which CI system deploys payments-api today?',origin:'ai'}]};
 assert.equal((await call('aperture','handoff-reviews','op',{draft:1,expectedRevision:0,review})).status,200);
 const sub=await call('aperture','handoff-submissions','op',{draft:1,reviewRevision:1,action:'submit',confirmed:true},'Chris');
 assert.equal(sub.status,200,sub.raw);return sub.json as HandoffRecord;
}

test('Dream Day end to end: review, edit and assign, request changes, resubmit, approve; each persona sees the same approved plan',async()=>{
 const h=await harness();
 try{
  const {call}=h;
  assert.equal((await call('aperture','champion-review','champ')).json.status,'not_submitted');
  await chrisSubmits(call);
  // 1–2. Maya opens Dream Day: a server-built, customer-safe view.
  let view:ChampionReview=(await call('aperture','champion-review','champ')).json;
  assert.equal(view.status,'submitted');
  for(const x of PRIVATE)assert.ok(!JSON.stringify(view).includes(x),'champion view leaked '+x);
  assert.deepEqual(view.plan!.stakeholders.map(s=>s.name),['Maya Chen','Alex Rivera','Jordan Lee'],'internal people stay with Chris');
  assert.ok(view.plan!.stakeholders.every(s=>s.sources.every(x=>x==='Conversational Transcript')),'source names become categories');
  // 3. Maya edits, adds Jordan's milestone with a dependency, assigns both, adds a question, and saves.
  const plan={goals:view.plan!.goals,questions:[...view.plan!.questions,{id:'q-maya',text:'Who owns the runbooks today?',origin:'champion'}],
   milestones:[{...view.plan!.milestones[0],assignee:'Alex Rivera',edited:true},milestone('m-jordan','Validate payments-api and docs discoverability','Jordan Lee',['m-1'])].map(m=>m.id==='m-jordan'?{...m,origin:'champion'}:m)};
  const saved=await call('aperture','champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan});
  assert.equal(saved.status,200,saved.raw);
  assert.equal((await call('aperture','champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan})).json.error.code,'REVISION_CONFLICT','stale save refused');
  view=(await call('aperture','champion-review','champ')).json;
  assert.deepEqual(view.plan!.milestones.map(m=>[m.title,m.assignee,m.dependsOn]),[['Assess payments-api repository readiness','Alex Rivera',[]],['Validate payments-api and docs discoverability','Jordan Lee',['m-1']]]);
  // Saving is not approving: developers still see nothing.
  assert.equal((await call('aperture','state','dev')).status,404);
  // 4. Request changes needs a reason; Chris sees it, revises and resubmits.
  assert.equal((await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'request_changes',comment:''})).json.error.code,'COMMENT_REQUIRED');
  const back=await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'request_changes',comment:'Please confirm which CI system deploys payments-api before Alex starts.'},'Maya Chen');
  assert.equal(back.json.status,'changes_requested');assert.equal(back.json.plan,null,'Chris’s revision in progress is not shown');
  assert.equal((await call('aperture','state','dev')).status,404,'returned plans never reach developers');
  const chris:HandoffRecord=(await call('aperture','handoff','op')).json.drafts[0];
  assert.equal(chris.status,'changes_requested');
  assert.deepEqual(chris.history!.map(e=>[e.action,e.by]),[['submitted','Chris'],['changes_requested','Maya Chen']]);assert.match(chris.history![1].comment!,/which CI system/);
  assert.equal(chris.review!.milestones[1].assignee,'Jordan Lee','Maya’s edits carry back to Chris');
  const revised={...chris.review!,problem:{...chris.review!.problem,unknowns:[...chris.review!.problem.unknowns,{id:'u-ci',text:'Deploys use GitHub Actions; Jenkins is retired (confirmed with Maya)',origin:'chris' as const}]}};
  assert.equal((await call('aperture','handoff-reviews','op',{draft:1,expectedRevision:chris.reviewRevision,review:revised})).status,200);
  const resub=await call('aperture','handoff-submissions','op',{draft:1,reviewRevision:chris.reviewRevision!+1,action:'submit',confirmed:true},'Chris');
  assert.equal(resub.json.status,'resubmitted');
  // A stale Maya page (revision from before the resubmission) cannot approve.
  assert.equal((await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve',confirmed:true})).json.error.code,'REVISION_CONFLICT');
  view=(await call('aperture','champion-review','champ')).json;assert.equal(view.status,'resubmitted');
  // 5. Approve the revised plan: an explicit decision, recorded with who and when.
  assert.equal((await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve'})).status,400,'confirmation required');
  const approved=await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve',confirmed:true},'Maya Chen');
  assert.equal(approved.json.status,'published',approved.raw);assert.equal(approved.json.approval.by,'Maya Chen');
  assert.equal((await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+1,decision:'approve',confirmed:true})).json.error.code,'ALREADY_APPROVED');
  // 6–7. Alex and Jordan each see only their approved work; 8. Chris sees the approval; Maya sees the whole plan.
  const state=async(token:string,actor:string)=>{const r=await call('aperture','state',token,undefined,actor);for(const x of PRIVATE)assert.ok(!r.raw.includes(x),`${actor} state leaked ${x}`);return r.json;};
  const alex=await state('alex','Alex Rivera'),jordan=await state('jordan','Jordan Lee'),maya=await state('champ','Maya Chen');
  assert.deepEqual(alex.handoff.milestones.map((m:{objective:string})=>m.objective),['Assess payments-api repository readiness']);
  assert.deepEqual(jordan.handoff.milestones.map((m:{objective:string;dependencies:string[]})=>[m.objective,m.dependencies]),[['Validate payments-api and docs discoverability',['Assess payments-api repository readiness']]]);
  assert.equal(jordan.plan.selectedMilestone.outcome,'Validate payments-api and docs discoverability');
  assert.deepEqual(maya.handoff.milestones.map((m:{proposedAssignee:string})=>m.proposedAssignee),['Alex Rivera','Jordan Lee']);
  assert.equal(alex.handoff.approval.by,'Maya Chen');
  const sam=await state('sam','Sam Nobody');
  // A forged name header on the shared credential grants no identity: no personal filtering, no work updates.
  assert.equal((await call('aperture','milestone-updates','dev',{milestoneId:'m-1',expectedRevision:0,action:{index:0,status:'started'}},'Alex Rivera')).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');assert.deepEqual(sam.handoff.milestones,[]);assert.equal(sam.plan.selectedMilestone.outcome,'No approved work is assigned to you yet');
  const final:HandoffRecord=(await call('aperture','handoff','op')).json.drafts[0];
  assert.equal(final.status,'published');assert.equal(final.approvals!.champion.by,'Maya Chen');
  assert.deepEqual(final.history!.map(e=>e.action),['submitted','changes_requested','resubmitted','approved','published']);
  // The same milestones in every view.
  assert.deepEqual(maya.handoff.milestones.map((m:{id:string})=>m.id),[...alex.handoff.milestones,...jordan.handoff.milestones].map((m:{id:string})=>m.id));
 }finally{await h.close();}
});

test('authorization: only the customer’s Champion can review or decide; the old publishing paths are closed; customers stay isolated',async()=>{
 const h=await harness();
 try{
  const {call}=h;await chrisSubmits(call);
  const rev=(await call('aperture','champion-review','champ')).json.reviewRevision;
  for(const token of ['dev','op'])for(const [path,body] of [['champion-review',undefined],['champion-reviews',{draft:1,expectedRevision:rev,plan:{}}],['champion-decisions',{draft:1,reviewRevision:rev,decision:'approve',confirmed:true}]] as const){
   const r=await call('aperture',path,token,body);assert.equal(r.status,403,`${token} on ${path}`);assert.equal(r.json.error.code,'CHAMPION_REQUIRED');
  }
  // Another customer's Champion and developers are refused for Aperture; their own customer has nothing to review.
  assert.equal((await call('aperture','champion-review','lumen-champ')).status,403);
  assert.equal((await call('aperture','champion-decisions','lumen-champ',{draft:1,reviewRevision:rev,decision:'approve',confirmed:true})).status,403);
  assert.equal((await call('lumen','champion-review','lumen-champ')).json.status,'not_submitted');
  // Removed bypasses: direct publication, intake and initialization are refused on the server.
  for(const [path,body] of [['handoff-publications',{draft:1,fromReview:true,outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true}],['intake',{briefing:'x',outcome:'y',agreedBy:'z',agreementConfirmed:true}],['state',{context:{}}]] as const)
   assert.equal((await call('aperture',path,'op',body)).json.error.code,'CHAMPION_APPROVAL_REQUIRED',path);
  assert.equal((await call('aperture','state','dev')).status,404);
  // Approval needs an explicit assignee on every milestone.
  const incomplete=await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:rev,decision:'approve',confirmed:true});
  assert.equal(incomplete.json.error.code,'REVIEW_INCOMPLETE');assert.deepEqual(incomplete.json.error.details.issues.map((i:{label:string;reason:string})=>[i.label,i.reason]),[['Milestone 1 · assignee','unassigned']]);
  // A Champion can't assign work to someone outside the technical team (e.g. the account executive).
  const view=(await call('aperture','champion-review','champ')).json;
  await call('aperture','champion-reviews','champ',{draft:1,expectedRevision:rev,plan:{goals:view.plan.goals,questions:view.plan.questions,milestones:[{...view.plan.milestones[0],assignee:'Jamie Park'}]}});
  const wrong=await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:rev+1,decision:'approve',confirmed:true});
  assert.deepEqual(wrong.json.error.details.issues.map((i:{reason:string})=>i.reason),['not_a_technical_stakeholder']);assert.ok(!wrong.raw.includes('Jamie'));
 }finally{await h.close();}
});

test('withdrawn or changed drafts cannot be approved; edits and decisions survive a restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dreamday-'));
 try{
  let h=await harness(join(dir,'db.sqlite'));
  await chrisSubmits(h.call);
  let view=(await h.call('aperture','champion-review','champ')).json;
  await h.call('aperture','champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan:{goals:view.plan.goals,questions:view.plan.questions,milestones:[{...view.plan.milestones[0],assignee:'Alex Rivera'}]}});
  // Chris withdraws while Maya still has the page open.
  assert.equal((await h.call('aperture','handoff-submissions','op',{draft:1,action:'withdraw'},'Chris')).json.status,'draft');
  assert.equal((await h.call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+1,decision:'approve',confirmed:true})).json.error.code,'NOT_UNDER_REVIEW');
  assert.equal((await h.call('aperture','champion-review','champ')).json.status,'revising');
  const chris:HandoffRecord=(await h.call('aperture','handoff','op')).json.drafts[0];
  await h.call('aperture','handoff-submissions','op',{draft:1,reviewRevision:chris.reviewRevision,action:'submit',confirmed:true},'Chris');
  await h.close();
  // Restart: the review, Maya's assignment and the history are still there.
  h=await harness(join(dir,'db.sqlite'));
  view=(await h.call('aperture','champion-review','champ')).json;
  assert.equal(view.status,'resubmitted');assert.equal(view.plan.milestones[0].assignee,'Alex Rivera');
  assert.deepEqual(view.history.map((e:{action:string})=>e.action),['submitted','withdrawn','resubmitted']);
  await h.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('approval without publication is recorded as Approved; plans published before Dream Day are not shown as approved',async()=>{
 const h=await harness(':memory:',false);
 try{
  await chrisSubmits(h.call);
  const view=(await h.call('aperture','champion-review','champ')).json;
  await h.call('aperture','champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan:{goals:view.plan.goals,questions:view.plan.questions,milestones:[{...view.plan.milestones[0],assignee:'Alex Rivera'}]}});
  const r=await h.call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+1,decision:'approve',confirmed:true},'Maya Chen');
  assert.equal(r.json.status,'approved');assert.equal((await h.call('aperture','state','dev')).status,404,'approved but not published: developers see nothing');
  // Legacy: a record published by the old direct path, with no Champion approval.
  const legacy=h.handoffs.all({tenantId:'t',customerId:'aperture',sessionId:'s'})[0];
  h.handoffs.save({tenantId:'t',customerId:'aperture',sessionId:'s'},{...legacy,status:'published',approvals:{chris:legacy.approvals!.chris,champion:{status:'pending',by:null,at:null}}});
  const old=(await h.call('aperture','champion-review','champ')).json;
  assert.equal(old.status,'published_before_dream_day');assert.equal(old.approval,null);assert.equal(old.plan,null);
 }finally{await h.close();}
});
