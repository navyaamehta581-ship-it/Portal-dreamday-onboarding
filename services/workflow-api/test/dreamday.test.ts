/** Chris finalizes → the plan is published to the Champion and developers at once; Dream Day is the Champion's optional,
 * non-blocking view of it. Exercised over HTTP with separate credentials per role and customer. */
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
/** Chris: analyse, name the technical team, keep Jamie (AE) as an internal person, suggest owners, finalize. */
async function chrisDraft(call:Call,milestones=[milestone('m-1','Assess payments-api repository readiness','Alex Rivera'),milestone('m-jordan','Validate payments-api and docs discoverability','Jordan Lee',['m-1'])]){
 await call('aperture','handoff-workspace','op',{expectedRevision:0,sources:SOURCES});
 await call('aperture','handoff-analyses','op',{workspaceRevision:1});
 for(let i=0;i<50&&(await call('aperture','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(r=>setTimeout(r,5));
 const record:HandoffRecord=(await call('aperture','handoff','op')).json.drafts[0];
 const review:ReviewDraft={...record.review!,goals:[{id:'g1',text:'Establish a service-readiness baseline for payments-api',origin:'ai'}],
  stakeholders:[{id:'p1',name:'Maya Chen',role:'Champion, Director of Platform Engineering',responsibilities:'Coordinate',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p2',name:'Alex Rivera',role:'Developer',responsibilities:'Initial repository readiness assessment',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p3',name:'Jordan Lee',role:'Developer',responsibilities:'Independent discoverability check',basis:'stated',sources:['Call with Maya'],technical:true},
   {id:'p4',name:'Jamie Park',role:'Account executive',responsibilities:'Owns the commercial relationship',basis:'stated',sources:['Pricing notes for Jamie'],technical:false}],
  milestones,questions:[{id:'q1',text:'Which CI system deploys payments-api today?',origin:'ai'}]};
 assert.equal((await call('aperture','handoff-reviews','op',{draft:1,expectedRevision:0,review})).status,200);
}
const finalize=(call:Call,reviewRevision=1)=>call('aperture','handoff-submissions','op',{draft:1,reviewRevision,action:'submit',confirmed:true},'Chris');

test('Chris finalizes and the plan is published at once: the Champion and every developer see it, nobody approves it',async()=>{
 const h=await harness();
 try{
  const {call}=h;
  assert.equal((await call('aperture','champion-review','champ')).json.status,'not_submitted');
  await chrisDraft(call);
  // Saving the draft publishes nothing.
  assert.equal((await call('aperture','state','dev')).status,404);
  assert.equal((await finalize(call,1).then(r=>r)).json.status,'published');
  // The Champion's Dream Day shows the published plan, customer-safe, with who finalized it.
  const view:ChampionReview=(await call('aperture','champion-review','champ')).json;
  assert.equal(view.status,'published');assert.equal(view.approval!.by,'Chris');
  for(const x of PRIVATE)assert.ok(!JSON.stringify(view).includes(x),'champion view leaked '+x);
  assert.deepEqual(view.plan!.stakeholders.map(s=>s.name),['Maya Chen','Alex Rivera','Jordan Lee'],'internal people stay with Chris');
  assert.ok(view.plan!.stakeholders.every(s=>s.sources.every(x=>x==='Conversational Transcript')),'source names become categories');
  assert.deepEqual(view.plan!.milestones.map(m=>[m.title,m.assignee,m.dependsOn]),[['Assess payments-api repository readiness','Alex Rivera',[]],['Validate payments-api and docs discoverability','Jordan Lee',['m-1']]]);
  // There is nothing to approve or send back, and the published plan is not edited in place.
  assert.equal((await call('aperture','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve',confirmed:true})).json.error.code,'ALREADY_APPROVED');
  assert.equal((await call('aperture','champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan:{}})).json.error.code,'NOT_UNDER_REVIEW');
  assert.equal((await call('aperture','handoff-reviews','op',{draft:1,expectedRevision:view.reviewRevision,review:{}})).json.error.code,'ALREADY_APPROVED','published plans are final');
  // Alex and Jordan see the whole plan, the work suggested for them first; a teammate with no suggestion too.
  const state=async(token:string,actor:string)=>{const r=await call('aperture','state',token,undefined,actor);for(const x of PRIVATE)assert.ok(!r.raw.includes(x),`${actor} state leaked ${x}`);return r.json;};
  const alex=await state('alex','Alex Rivera'),jordan=await state('jordan','Jordan Lee'),maya=await state('champ','Maya Chen');
  assert.deepEqual(alex.handoff.milestones.map((m:{objective:string})=>m.objective),['Assess payments-api repository readiness','Validate payments-api and docs discoverability']);
  assert.deepEqual(jordan.handoff.milestones.map((m:{objective:string;dependencies:string[]})=>[m.objective,m.dependencies]),[['Validate payments-api and docs discoverability',['Assess payments-api repository readiness']],['Assess payments-api repository readiness',[]]]);
  assert.equal(jordan.plan.selectedMilestone.outcome,'Validate payments-api and docs discoverability');
  assert.deepEqual(maya.handoff.milestones.map((m:{proposedAssignee:string})=>m.proposedAssignee),['Alex Rivera','Jordan Lee']);
  assert.equal(alex.handoff.approval.by,'Chris');
  const sam=await state('sam','Sam Nobody');
  // A forged name header on the shared credential grants no identity: no personal filtering, no work updates.
  assert.equal((await call('aperture','milestone-updates','dev',{milestoneId:'m-1',expectedRevision:0,action:{index:0,status:'started'}},'Alex Rivera')).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');
  assert.equal(sam.handoff.milestones.length,2,'every developer on the team sees the plan');assert.equal(sam.plan.selectedMilestone.outcome,'Assess payments-api repository readiness','nothing suggested for Sam: the plan’s first milestone');
  const final:HandoffRecord=(await call('aperture','handoff','op')).json.drafts[0];
  assert.equal(final.status,'published');assert.equal(final.approvals!.champion.status,'pending','no Champion approval is involved');
  assert.deepEqual(final.history!.map(e=>[e.action,e.by]),[['published','Chris']]);
  const ids=(x:{handoff:{milestones:{id:string}[]}})=>x.handoff.milestones.map(m=>m.id).sort();
  assert.deepEqual(ids(alex),ids(maya));assert.deepEqual(ids(jordan),ids(maya));
 }finally{await h.close();}
});

test('authorization: only the customer’s Champion opens Dream Day; the old publishing paths are closed; customers stay isolated; finalizing is screened',async()=>{
 const h=await harness();
 try{
  const {call}=h;
  // A suggested owner outside the technical team (the account executive) is refused when Chris finalizes.
  await chrisDraft(call,[milestone('m-1','Assess payments-api repository readiness','Jamie Park')]);
  const wrong=await finalize(call);
  assert.deepEqual(wrong.json.error.details.issues.map((i:{reason:string})=>i.reason),['not_a_technical_stakeholder']);
  assert.equal((await call('aperture','state','dev')).status,404,'nothing published');
  for(const token of ['dev','op'])for(const [path,body] of [['champion-review',undefined],['champion-reviews',{draft:1,expectedRevision:1,plan:{}}],['champion-decisions',{draft:1,reviewRevision:1,decision:'approve',confirmed:true}]] as const){
   const r=await call('aperture',path,token,body);assert.equal(r.status,403,`${token} on ${path}`);assert.equal(r.json.error.code,'CHAMPION_REQUIRED');
  }
  assert.equal((await call('aperture','champion-review','lumen-champ')).status,403);
  assert.equal((await call('lumen','champion-review','lumen-champ')).json.status,'not_submitted');
  // Removed bypasses: direct publication without the reviewed draft, intake and initialization are refused.
  for(const [path,body] of [['handoff-publications',{draft:1,fromReview:true,outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true}],['intake',{briefing:'x',outcome:'y',agreedBy:'z',agreementConfirmed:true}],['state',{context:{}}]] as const)
   assert.equal((await call('aperture',path,'op',body)).json.error.code,'CHAMPION_APPROVAL_REQUIRED',path);
  // Developers and the Champion cannot finalize.
  for(const token of ['dev','champ','alex'])assert.equal((await call('aperture','handoff-submissions',token,{draft:1,reviewRevision:1,action:'submit',confirmed:true})).status,403,token);
 }finally{await h.close();}
});

test('a published plan survives a restart; a draft left with the Champion by the earlier flow can be withdrawn and finalized',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dreamday-'));
 try{
  let h=await harness(join(dir,'db.sqlite'));
  await chrisDraft(h.call);
  // An older record still waiting for the Champion (the earlier approval flow): Chris withdraws it and finalizes.
  const P={tenantId:'t',customerId:'aperture',sessionId:'s'},old=h.handoffs.all(P)[0];
  h.handoffs.save(P,{...old,status:'submitted',reviewRevision:2,history:[{action:'submitted',at:'2026-10-29T09:00:00Z',by:'Chris'}]});
  assert.equal((await h.call('aperture','champion-review','champ')).json.status,'submitted');
  assert.equal((await h.call('aperture','handoff-submissions','op',{draft:1,action:'withdraw'},'Chris')).json.status,'draft');
  assert.equal((await finalize(h.call,3)).json.status,'published');
  await h.close();
  h=await harness(join(dir,'db.sqlite'));
  const view=(await h.call('aperture','champion-review','champ')).json;
  assert.equal(view.status,'published');assert.equal(view.plan.milestones[0].assignee,'Alex Rivera');
  assert.deepEqual(view.history.map((e:{action:string})=>e.action),['submitted','withdrawn','published']);
  assert.equal((await h.call('aperture','state','alex')).status,200);
  await h.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('finalizing on a server that doesn’t publish is recorded as finalized, not published; plans published before Dream Day stay labelled',async()=>{
 const h=await harness(':memory:',false);
 try{
  await chrisDraft(h.call);
  const r=await finalize(h.call);
  assert.equal(r.json.status,'approved');assert.equal((await h.call('aperture','state','dev')).status,404,'not published: developers see nothing');
  const view=(await h.call('aperture','champion-review','champ')).json;
  assert.equal(view.status,'approved');assert.equal(view.approval.by,'Chris');
  // Legacy: a record published by the old direct path, with nobody recorded as having finalized it.
  const P={tenantId:'t',customerId:'aperture',sessionId:'s'},legacy=h.handoffs.all(P)[0];
  h.handoffs.save(P,{...legacy,status:'published',developer:null,approvals:{chris:{status:'pending',by:null,at:null},champion:{status:'pending',by:null,at:null}}});
  const old=(await h.call('aperture','champion-review','champ')).json;
  assert.equal(old.status,'published_before_dream_day');assert.equal(old.approval,null);assert.equal(old.plan,null);
 }finally{await h.close();}
});
