import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {interpretRuleBased} from '../src/activation/handoff/interpret.ts';
import {proposeMilestones,validMilestone} from '../src/activation/handoff/milestones.ts';
import {developerHandoff,developerState} from '../src/activation/handoff/project.ts';
import {confidentialHits,parseSources} from '../src/activation/handoff/service.ts';
import {hostedInterpreter} from '../src/activation/handoff/hosted.ts';
import type {SourceInput} from '../../../contracts/activation/v1/handoff.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/aperture-sources.json',import.meta.url),'utf8'));
const aperture=():SourceInput[]=>parseSources(fixture);
/** Strings from Chris's research that must never reach a developer. */
export const PRIVATE=['480K','2,400','Jamie','Stage 3','Procurement','Budget','sceptical','pricing','Maya','45-day','walking other teams','Head of Platform','Close date'];

test('combines CRM, conversation, notes and repository sources into one structured understanding',()=>{
 const u=interpretRuleBased(aperture());
 assert.deepEqual(u.entities.services,['payments-api']);
 assert.deepEqual(u.entities.repositories,['aperture/payments-api']);
 assert.equal(u.entities.scm,'GitHub');assert.equal(u.entities.ci,'GitHub Actions');assert.equal(u.entities.docs,'Confluence');
 assert.equal(u.findings.find(f=>f.statement==='CI/CD runs on Jenkins.')?.status,'outdated','Jenkins is a past setup, not a contradiction');
 assert.equal(u.contradictions.filter(c=>c.topic==='CI/CD').length,0);
 // Commercial and stakeholder statements stay internal.
 for(const f of u.findings.filter(f=>/480K|2,400|Jamie|Budget|sceptical/.test(f.statement)))assert.equal(f.audience,'internal',f.statement);
 // The need is recognised and restated, not quoted.
 assert.equal(u.goals[0].playbook,'service_readiness');
 assert.ok(!u.goals[0].need.includes('walking'));
 // Repository observations are verified; catalog metadata comes from two sources.
 const cat=u.findings.find(f=>f.topic==='Catalog metadata')!;
 assert.equal(cat.status,'verified');assert.deepEqual([...new Set(cat.sources.map(s=>s.type))].sort(),['chris_notes','repository']);
 assert.ok(cat.sources.every(s=>s.excerpt.length<=80),'provenance is a short excerpt');
 assert.equal(u.findings.find(f=>f.topic==='Ownership')!.statement,'Service ownership is not confirmed.');
 // Unknowns are prioritised: ownership blocks the milestone, sign-in does not.
 assert.equal(u.unknowns.find(x=>/owns payments-api/.test(x.question))?.priority,'blocks_first_milestone');
 assert.equal(u.unknowns.find(x=>/identity provider/.test(x.question))?.priority,'not_needed_now');
});

test('proposes a specific technical milestone instead of a vague POC summary',()=>{
 const {milestones,missing}=proposeMilestones(interpretRuleBased(aperture()));
 const m=milestones[0];
 assert.equal(m.objective,'Review payments-api repository readiness and prepare it for Catalog registration');
 assert.equal(m.system.repository,'aperture/payments-api');assert.equal(m.system.platform,'GitHub');
 assert.ok(validMilestone(m));
 assert.ok(m.actions[0].includes('aperture/payments-api')&&m.actions[0].includes('catalog-info.yaml'));
 assert.ok(m.completionCriteria.some(c=>/names an owner, a type and a lifecycle/.test(c)));
 assert.ok(!/POC|bounded|proof of concept/i.test(JSON.stringify(m)));
 assert.deepEqual(missing,[],'nothing that only Chris can answer blocks this milestone');
});

test('asks Chris for missing information instead of inventing a milestone, then adapts to a new source',()=>{
 const lumen:SourceInput[]=[{id:'s1',type:'conversation',label:'Call',text:'We want to spin up a new recommendation service from a template. Code is on GitLab. SSO via Entra ID. Python preferred.'}];
 const first=proposeMilestones(interpretRuleBased(lumen));
 assert.equal(first.milestones.length,0);assert.ok(first.missing.some(q=>/repository/.test(q)));
 const second=interpretRuleBased([...lumen,{id:'s2',type:'technical_requirements',label:'Requirements',text:'Template repo is gitlab.com/lumen/recs-service. New services must use the approved Python template.'}]);
 const m=proposeMilestones(second).milestones[0];
 assert.equal(second.goals[0].playbook,'scaffolder');assert.equal(m.system.platform,'GitLab');assert.equal(m.system.repository,'lumen/recs-service');assert.match(m.objective,/Software Template/);
});

test('developer handoff and projected state contain no private research',()=>{
 const u=interpretRuleBased(aperture()),m=proposeMilestones(u).milestones;
 const h=developerHandoff(1,new Date().toISOString(),u,m),raw=JSON.stringify(h);
 for(const p of PRIVATE)assert.ok(!raw.includes(p),`developer handoff must not contain: ${p}`);
 assert.ok(h.context.every(n=>n.text.split(/(?<=\.)\s/).length<=3),'two or three sentences per topic');
 assert.ok(h.unknowns.every(x=>!/identity provider|security/i.test(x.question)),'only developer-actionable unknowns');
 assert.deepEqual(confidentialHits({...m[0],why:'Show value before the $480K renewal.'},'x',u),['Why']);
 assert.deepEqual(confidentialHits(m[0],'Prepare payments-api for Catalog registration',u),[]);
});

test('legacy states are projected on the server: briefing, agreement and evidence claims are replaced',()=>{
 const briefing=fixture.sources.map((s:{text:string})=>s.text).join('\n');
 const ev=(id:string,claim:string)=>({id,kind:'customer_report' as const,claim,source:'Chris activation intake',observedAt:'2026-10-28T00:00:00Z',sourceRevision:'x',scope:'x',producer:'op',basisIds:[],proof:{type:'none' as const,actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked' as const}});
 const evidence=[ev('x-brief',briefing),ev('x-agreement','Chris reports agreement by Maya Patel: 45-day POC')];
 const state={contractVersion:'1.0.0',customerId:'c',developerSessionId:'s',revision:0,contextRevision:0,planRevision:0,
  context:{contractVersion:'1.0.0',customerId:'c',revision:0,evidence,briefing,briefingEvidenceIds:['x-brief'],agreedGoal:{text:'45-day POC for $480K deal',agreedBy:'Maya Patel',agreedAt:'2026-10-28T00:00:00Z',evidenceIds:[]},unknowns:['Budget owner'],constraints:['Reported Trial: Procurement wants a 45-day POC']},
  plan:{contractVersion:'1.0.0',customerId:'c',revision:0,evidence,contextRevision:0,supersedesRevision:null,planner:'demo_backend_adapter',selectedMilestone:{id:'m',outcome:'Review a bounded first step toward: 45-day POC',successCriteria:['x'],evidenceIds:[]},prerequisites:[],capabilities:[],rationale:'Basis: Chris’s pasted briefing',suggestedNextAction:{id:'a',revision:0,kind:'prepare_artifact',description:`Task. Use this briefing: ${briefing.slice(0,350)}. Target: 45-day POC.`,capabilityId:'onboard',status:'suggested',evidenceIds:[]},blockerIds:[]},
  milestone:{id:'m',status:'pending',requiredActions:[],evidenceIds:[]},actions:{},evidence,replan:{status:'none',blockerId:null,replacementPlanRevision:null,errorCode:null},chrisHelp:{status:'none',blockerIds:[],owner:null,reason:null,evidenceIds:[]},outcome:{agreedGoalContextRevision:0,status:'unassessed',summary:'',evidenceIds:[],scope:'45-day POC'}} as unknown as Parameters<typeof developerState>[0];
 const raw=JSON.stringify(developerState(state,null));
 for(const p of PRIVATE)assert.ok(!raw.includes(p),`projected legacy state must not contain: ${p}`);
 assert.match(raw,/payments-api/);
});

test('hosted interpretation is validated; invented quotes fall back to the rule-based result',async()=>{
 const reply=(content:unknown)=>async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]}));
 const env={PORTAL_LLM_ENDPOINT:'http://127.0.0.1:9/v1',PORTAL_LLM_MODEL:'test'};
 const sources=aperture();
 const good={findings:[{category:'business_need',topic:'Need',statement:'Platform team repeats the same setup guidance',status:'reported',sourceId:'s2',quote:'walking other teams through the same service setup'}],goals:[{need:'Repeatable setup',technicalGoal:'Service readiness',playbook:'service_readiness',quotes:[{sourceId:'s2',quote:'same service setup'}]}],services:['payments-api'],repositories:['aperture/payments-api']};
 const u=await hostedInterpreter(env,reply(good) as typeof fetch).interpret(sources);
 assert.equal(u.interpreter,'hosted_model');assert.equal(u.findings.find(f=>f.id==='m1')?.audience,'champion');
 const invented={...good,findings:[{...good.findings[0],quote:'we have 40 repos without owners'}]};
 assert.equal((await hostedInterpreter(env,reply(invented) as typeof fetch).interpret(sources)).interpreter,'rule_based');
 assert.equal((await hostedInterpreter({},reply(good) as typeof fetch).interpret(sources)).interpreter,'rule_based','no model configured');
});

test('HTTP: Chris drafts and submits, the Champion approves (Dream Day); developers get only the projected view on every route',async()=>{
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');
 const {openActivationStore}=await import('../src/activation/store.ts');const {createIntake}=await import('../src/activation/intake.ts');
 const {createBlockerReports}=await import('../src/activation/reports.ts');
 const {openHandoffStore}=await import('../src/activation/handoff/store.ts');const {createHandoffService}=await import('../src/activation/handoff/service.ts');
 const p={tenantId:'t',customerId:'aperture',sessionId:'s'};
 const intake=createIntake({admit:()=>false});let store:ReturnType<typeof openActivationStore>;
 const reports=createBlockerReports(intake.policy,()=>store);store=openActivationStore(':memory:',reports.policy);
 const handoffs=openHandoffStore(':memory:'),goals=openGoalStore(':memory:');
 const handoff=createHandoffService({handoffs,store:()=>store,stage:intake.stage,release:intake.release});
 const server=createApp(goals,undefined,{store,handoff,championApproval:true,reportProgress:reports.progress,reportBlocker:reports.submit,authorize:(r,c)=>['Bearer dev','Bearer op','Bearer champ'].includes(r.headers.authorization??'')&&c===p.customerId?p:null,isOperator:r=>r.headers.authorization==='Bearer op',isChampion:r=>r.headers.authorization==='Bearer champ'});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const root=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/aperture/`;
 const call=(path:string,token:string,body?:unknown)=>fetch(root+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Portal-Actor':token==='champ'?'Riley Champion':token==='op'?'Chris':'Alex Rivera'},body:body===undefined?undefined:JSON.stringify(body)});
 const clean=async(r:Response,where:string)=>{const raw=await r.text();for(const x of [...PRIVATE,'Discovery call','CRM account record'])assert.ok(!raw.includes(x),`${where} leaked: ${x}`);return JSON.parse(raw);};
 try{
  assert.equal((await call('handoff-drafts','dev',fixture)).status,403);
  assert.equal((await call('handoff','dev')).status,403);
  const draftRes=await call('handoff-drafts','op',fixture);assert.equal(draftRes.status,201);const draft=await draftRes.json();
  assert.equal(draft.draft,1);assert.equal(draft.status,'draft');assert.ok(draft.sources.length===4,'Chris keeps the private sources');
  const m=draft.proposal.milestones[0];
  // The pre-Dream Day direct publication is closed on the server, whatever the body says.
  assert.equal((await call('handoff-publications','op',{draft:1,milestones:[m],outcome:'Prepare payments-api',agreedBy:'Maya',agreementConfirmed:true})).status,403);
  // Chris names the developer who will do the work, then submits.
  const review={...draft.review,stakeholders:[...draft.review.stakeholders,{id:'p-alex',name:'Alex Rivera',role:'Developer',responsibilities:'Repository readiness',basis:'chris',sources:[],technical:true}],
   milestones:[{...draft.review.milestones[0],assignee:'Alex Rivera'}]};
  assert.equal((await call('handoff-reviews','op',{draft:1,expectedRevision:0,review})).status,200);
  assert.equal((await call('handoff-submissions','op',{draft:1,reviewRevision:1,action:'submit',confirmed:true})).status,200);
  // The Champion's edits are screened at approval: a commercial remark blocks it, with a field label.
  const view=await clean(await call('champion-review','champ'),'champion review');
  const leaky=await call('champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision,plan:{goals:view.plan.goals,questions:view.plan.questions,milestones:[{...view.plan.milestones[0],description:'Prove value before the $480K renewal.'}]}});
  assert.equal(leaky.status,200);
  const refused=await call('champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+1,decision:'approve',confirmed:true});
  assert.equal(refused.status,400);assert.equal((await refused.json()).error.code,'CONFIDENTIAL_CONTENT');
  await call('champion-reviews','champ',{draft:1,expectedRevision:view.reviewRevision+1,plan:{goals:view.plan.goals,questions:view.plan.questions,milestones:[view.plan.milestones[0]]}});
  const approved=await call('champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+2,decision:'approve',confirmed:true});
  assert.equal(approved.status,200);assert.equal((await approved.json()).status,'published');
  assert.equal((await call('champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision+3,decision:'approve',confirmed:true})).status,409,'no second approval');
  const opState=await (await call('state','op')).json();assert.equal(opState.context.agreedGoal.agreedBy,'Riley Champion (Champion), Dream Day approval');
  const dev=await clean(await call('state','dev'),'GET state');
  assert.equal(dev.plan.selectedMilestone.outcome,m.objective);
  assert.equal(dev.handoff.milestones[0].system.repository,'aperture/payments-api');assert.equal(dev.handoff.milestones[0].proposedAssignee,'Alex Rivera');
  assert.deepEqual(dev.handoff.approval.by,'Riley Champion');
  const progress=await call('progress-reports','dev',{id:'progress:1',expectedRevision:dev.revision,planRevision:0,message:'Checked the repository root.',needsChris:false});
  const afterProgress=await clean(progress,'progress report');
  await clean(await call('blocker-reports','dev',{id:'developer:b1',expectedRevision:afterProgress.revision,planRevision:0,message:'No read access to aperture/payments-api.'}),'blocker report');
  const overview=await (await call('handoff','op')).json();assert.equal(overview.drafts[0].status,'published');assert.equal(overview.drafts[0].approvals.champion.by,'Riley Champion');
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();handoffs.close();goals.close();}
});
