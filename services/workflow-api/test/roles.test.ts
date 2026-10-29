/** Role redesign: Chris proposes, the Champion steers adoption, developers choose their work. Several engineering
 * problems per draft, no invented responsibilities, approval without required owners, the Champion's edits reported
 * to Chris by count, developers choosing milestones and opportunities, opportunities labelled by what backs them,
 * Champion-only priorities, adoption for the Champion and Chris only, and AiKA with the chosen opportunity. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {Adoption,Finding,HandoffRecord,Opportunities,TeamProgress,Understanding} from '../../../contracts/activation/v1/handoff.ts';
import {reviewFromAnalysis,reviewIssues,approvalIssues,championPlan} from '../src/activation/handoff/review.ts';
import type {RepositoryConfig} from '../src/activation/repository.ts';
import {PRIVATE,approvedPlan,harness,ollamaStub,update,finalizePlan} from './support/work-harness.ts';

const FIXTURE:RepositoryConfig={customerId:'aperture',id:'payments-api',label:'payments-api',repository:'aperture-commerce/payments-api',mode:'fixture',fixture:'aperture-payments-api',services:['payments-api']};
const ref={sourceId:'s1',type:'conversation' as const,label:'Discovery call',excerpt:'…'};
const need=(id:string,topic:string,statement:string):Finding=>({id,category:'business_need',topic,statement,status:'reported',audience:'champion',sources:[ref]});
const opps=async(call:Parameters<typeof approvedPlan>[0],token:string)=>(await call('aperture','opportunities',token)).json as Opportunities;

test('one customer context, several engineering problems: each stated need is its own problem, nothing invented',()=>{
 const u:Understanding={interpreter:'rule_based',findings:[need('f1','Ownership','Nobody can tell who owns payments-api.'),need('f2','Ownership','Owners change without anyone updating them.'),
  need('f3','Releases','Releases of checkout-api fail differently in every team.')],goals:[],unknowns:[],contradictions:[],
  entities:{services:['payments-api','checkout-api'],repositories:[],scm:null,sso:null,docs:null,ci:null,languages:[]},engineeringProblem:'Service ownership is unclear.',
  stakeholders:[{name:'Maya Chen',role:'Platform Champion',responsibilities:['Coordinates the onboarding'],confidence:'reported',sources:[ref],workBasis:'role_default'},
   {name:'Alex Rivera',role:'Developer',responsibilities:['Assesses payments-api readiness'],confidence:'reported',sources:[ref],workBasis:'stated'}]};
 const r=reviewFromAnalysis({understanding:u,proposal:{milestones:[],missing:[]} as unknown as HandoffRecord['proposal']});
 assert.deepEqual(r.problem.challenges.map(c=>c.text),['Nobody can tell who owns payments-api.','Owners change without anyone updating them.']);
 assert.equal(r.moreProblems?.length,1);
 assert.equal(r.moreProblems![0].summary,'Releases of checkout-api fail differently in every team.');
 assert.deepEqual(r.moreProblems![0].systems.map(s=>s.text),['checkout-api (service)'],'the systems its own statements name');
 // A role's usual duties aren't presented as what this person does; stated work is kept.
 assert.deepEqual(r.stakeholders.map(s=>[s.name,s.responsibilities]),[['Maya Chen',''],['Alex Rivera','Assesses payments-api readiness']]);
 // Every problem is screened and reaches the Champion's plan.
 const leaky={...r,moreProblems:[{...r.moreProblems![0],summary:'Their renewal discount is 20%.'}]};
 assert.ok(reviewIssues(leaky,u).some(i=>i.path==='moreProblems[0].summary'));
 assert.equal(championPlan({review:r,understanding:u,proposal:{milestones:[],missing:[]} as unknown as HandoffRecord['proposal'],sources:[]}).moreProblems?.length,1);
 // Milestones may stay without a suggested owner: approval doesn't ask for one.
 const draft={...r,milestones:[{id:'m1',title:'Register payments-api',description:'',system:'payments-api',actions:['Add catalog-info.yaml'],completionCriteria:['It shows in the Catalog'],assignee:null,role:'developer',dependsOn:[],origin:'ai' as const}]};
 assert.deepEqual(approvalIssues(draft,u),[]);
});

test('developers choose their work: the whole plan is visible, anyone may pick up a milestone, notes stay with whoever works on it',async()=>{
 const h=await harness();
 try{
  await approvedPlan(h.call);
  const jordan=(await h.call('aperture','milestone-work','jordan')).json as TeamProgress;
  const alexMilestone=jordan.milestones.find(m=>m.id==='m-alex')!;
  assert.equal(alexMilestone.mine,false);assert.equal(alexMilestone.detail,null,'Alex’s notes stay his');
  assert.deepEqual(alexMilestone.outline!.actions,['Start Assess payments-api repository readiness','Record what was found'],'but anyone can read what the milestone is about');
  assert.equal(jordan.milestones.find(m=>m.id==='m-jordan')!.suggestedForMe,true);
  // Jordan can't change Alex's milestone until he chooses to work on it too.
  assert.equal((await update(h.call,'jordan','m-alex',0,{action:{index:0,status:'started'}})).json.error.code,'NOT_ASSIGNEE');
  assert.equal(alexMilestone.revision,0,'the revision to choose it with is visible without the details');
  const chose=await update(h.call,'jordan','m-alex',alexMilestone.revision!,{pursue:true});
  assert.equal(chose.status,200,chose.raw);
  const m=(chose.json as TeamProgress).milestones.find(x=>x.id==='m-alex')!;
  assert.equal(m.mine,true);assert.deepEqual(m.workingOn,['Jordan Lee']);assert.equal(m.revision,1);
  assert.equal((await update(h.call,'jordan','m-alex',1,{action:{index:0,status:'started'}})).status,200);
  // Stopping is a choice too; the shared credential has no identity to choose with.
  assert.equal((await update(h.call,'jordan','m-alex',2,{pursue:false})).status,200);
  assert.equal((await update(h.call,'dev','m-alex',3,{pursue:true})).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');
  assert.equal((await h.call('aperture','milestone-updates','champ',{milestoneId:'m-alex',expectedRevision:3,pursue:true})).status,403,'the Champion doesn’t pick up work');
 }finally{await h.close();}
});

test('opportunities: from the approved plan and the Portal’s own observations, labelled verified, sample or hypothesis',async()=>{
 const h=await harness({repositories:[FIXTURE]});
 try{
  await approvedPlan(h.call,false);
  assert.equal((await h.call('aperture','opportunities','alex')).json.error.code,'NO_APPROVED_PLAN');
  await finalizePlan(h.call);
  const v=await opps(h.call,'alex');
  assert.deepEqual(v.goals.map(g=>[g.text,g.milestones.map(m=>m.id)]),[['Establish a service-readiness baseline for payments-api',['m-alex']]]);
  assert.ok(v.opportunities.length>=3);
  assert.ok(v.opportunities.every(o=>o.basis==='sample'&&o.evidence.every(e=>e.startsWith('Sample data · aperture-commerce/payments-api'))),'fixture-backed: never called verified');
  const owners=v.opportunities.find(o=>o.id==='owners-payments-api')!;
  assert.equal(owners.kind,'improvement');assert.match(owners.title,/Record who owns payments-api/);assert.ok(owners.steps.length>=3);
  assert.equal(owners.pursuedBy,undefined,'developers don’t see who else chose what');assert.equal(owners.mine,false);
  for(const x of PRIVATE)assert.ok(!JSON.stringify(v).includes(x),`no ${x}`);
  // Without any repository, the plan's suggestions are hypotheses.
  const plain=await harness();
  try{await approvedPlan(plain.call);const p=await opps(plain.call,'alex');
   assert.ok(p.opportunities.length>0&&p.opportunities.every(o=>o.basis==='hypothesis'&&/not yet confirmed/.test(o.evidence[0])));}
  finally{await plain.close();}
 }finally{await h.close();}
});

test('the Champion prioritises and highlights; developers choose; adoption is for the Champion and Chris only',async()=>{
 const h=await harness({repositories:[FIXTURE]});
 try{
  await approvedPlan(h.call);
  const v=await opps(h.call,'champ'),goal=v.goals[0].id,first=v.opportunities.at(-1)!.id;
  // Only the Champion sets priorities; values are checked; goals can't be "highlighted".
  for(const t of ['alex','op'])assert.equal((await h.call('aperture','opportunity-priorities',t,{id:first,priority:'high'})).status,403,t);
  assert.equal((await h.call('aperture','opportunity-priorities','champ',{id:first,priority:'urgent'})).json.error.code,'INVALID_REQUEST');
  assert.equal((await h.call('aperture','opportunity-priorities','champ',{id:'nope',priority:'high'})).json.error.code,'NOT_FOUND');
  assert.equal((await h.call('aperture','opportunity-priorities','champ',{id:goal,highlighted:true})).json.error.code,'INVALID_REQUEST');
  assert.equal((await h.call('aperture','opportunity-priorities','champ',{id:goal,priority:'high'})).json.goals[0].priority,'high');
  const hl=(await h.call('aperture','opportunity-priorities','champ',{id:first,highlighted:true,priority:'high'})).json as Opportunities;
  assert.equal(hl.opportunities[0].id,first,'highlighted first');assert.equal(hl.opportunities[0].priority,'high');
  // Developers choose; the Champion can't choose for them.
  assert.equal((await h.call('aperture','opportunity-pursuits','champ',{id:first,pursue:true})).status,403);
  assert.equal((await h.call('aperture','opportunity-pursuits','dev',{id:first,pursue:true})).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');
  const mine=(await h.call('aperture','opportunity-pursuits','alex',{id:first,pursue:true})).json as Opportunities;
  assert.equal(mine.opportunities.find(o=>o.id===first)!.mine,true);assert.equal(mine.opportunities.find(o=>o.id===first)!.pursuers,1);
  assert.deepEqual((await opps(h.call,'champ')).opportunities.find(o=>o.id===first)!.pursuedBy,['Alex Rivera']);
  await update(h.call,'jordan','m-jordan',0,{action:{index:0,status:'started'}});
  // Adoption: goals, milestones and engagement from recorded activity, for the Champion and Chris.
  assert.equal((await h.call('aperture','adoption','alex')).status,403,'developers aren’t shown team metrics');
  const a=(await h.call('aperture','adoption','champ')).json as Adoption;
  assert.equal(a.scope,'onboarding_activity');assert.deepEqual(a.opportunities,{total:v.opportunities.length,pursued:1,highlighted:1});
  assert.deepEqual(a.developers.map(d=>d.name).sort(),['Alex Rivera','Jordan Lee']);assert.ok(a.developers.every(d=>d.activeThisWeek));
  assert.equal(a.weekly.length,6);assert.equal(a.weekly.at(-1)!.activeDevelopers,2);
  assert.deepEqual((await h.call('aperture','adoption','op')).json.developers.length,2);
  assert.equal((await h.call('aperture','opportunities','lumen-alex')).status,403,'another customer');
 }finally{await h.close();}
});

test('AiKA knows the goals and opportunities, and which one the developer is asking about',async()=>{
 const stub=await ollamaStub(()=>({sections:[{kind:'suggestion',text:'Start with the first step.',citations:[]}],next_step:null}));
 const h=await harness({repositories:[FIXTURE],modelUrl:stub.url});
 try{
  await approvedPlan(h.call);
  await opps(h.call,'alex');
  await h.call('aperture','opportunity-pursuits','alex',{id:'owners-payments-api',pursue:true});
  await h.call('aperture','aika-questions','alex',{question:'How do I get started?',opportunityId:'runbooks-payments-api'});
  for(let i=0;i<100&&(await h.call('aperture','aika-questions','alex')).json.job.status==='running';i++)await new Promise(r=>setTimeout(r,10));
  const prompt=stub.requests.at(-1).messages[1].content as string;
  assert.match(prompt,/ENGINEERING SUGGESTION \(the question is about this one\): Add runbooks next to payments-api’s code — improvement — SAMPLE data/);
  assert.match(prompt,/ENGINEERING SUGGESTION \(you chose this\): Record who owns payments-api’s code/);
  assert.match(prompt,/Step 1: Add a runbooks section/);
  // /my-work is available once a developer chose something, even with no milestone suggested for them.
  const caps=(await h.call('aperture','aika-capabilities','alex')).json.capabilities as {id:string;available:boolean}[];
  assert.equal(caps.find(c=>c.id==='my-work')!.available,true);
 }finally{await h.close();await stub.close();}
});
