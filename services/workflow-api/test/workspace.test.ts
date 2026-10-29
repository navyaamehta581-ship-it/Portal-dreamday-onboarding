/** Chris's customer workspace (Phase 3): saved information, background analysis with real stages, editable review,
 * submission for Champion review, and the boundary that keeps all of it away from the Champion and developers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {Analysis} from '../src/activation/handoff/intelligence.ts';
import type {StageListener} from '../src/activation/handoff/intelligence.ts';
import type {ReviewDraft,SourceInput} from '../../../contracts/activation/v1/handoff.ts';
import {interpretRuleBased} from '../src/activation/handoff/interpret.ts';
import {proposeMilestones,validMilestone} from '../src/activation/handoff/milestones.ts';
import {reviewFromAnalysis,reviewIssues,toMilestoneDrafts,validateReview} from '../src/activation/handoff/review.ts';
import {openHandoffStore} from '../src/activation/handoff/store.ts';
import {createHandoffService} from '../src/activation/handoff/service.ts';
import {ActivationError} from '../src/activation/store.ts';

const p={tenantId:'t',customerId:'northstar',sessionId:'s'},other={...p,customerId:'lumen'};
const CALL='Maya Chen: Nobody can tell who owns a service and the runbooks are missing.\nMaya Chen: Let’s pilot with payments-api on GitHub. Alex Rivera can do the repository readiness assessment.';
const NOTES='Opportunity: $300K ARR. Her VP thinks Backstage is a nice-to-have.';
const sources=[{id:'a',type:'conversation',label:'Discovery call',text:CALL},{id:'b',type:'chris_notes',label:'My notes',text:NOTES},{id:'c',type:'integration_tools',label:'Tools',text:'Docs live in Confluence.'}];
const rule=async(s:SourceInput[],onStage?:StageListener):Promise<Analysis>=>{onStage?.('interpreting',null);const understanding=interpretRuleBased(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};};

function setup(analyze=rule,file=':memory:'){
 const handoffs=openHandoffStore(file);
 const service=createHandoffService({handoffs,store:()=>{throw Error('activation store not used');},analyze,stage:()=>undefined,release:()=>undefined});
 return {handoffs,service};
}
const code=(c:string)=>(e:unknown)=>e instanceof ActivationError&&e.code===c;
async function done(service:ReturnType<typeof setup>['service']){for(let i=0;i<50&&service.analysisStatus(p)?.status==='running';i++)await new Promise(r=>setTimeout(r,5));return service.analysisStatus(p)!;}
function deferred(){let open!:(a:Analysis)=>void,fail!:(e:unknown)=>void;const promise=new Promise<Analysis>((a,b)=>{open=a;fail=b;});return {promise,open,fail};}

test('saved information: add, edit, remove; revisions guard against overwriting; survives a restart; isolated per customer',()=>{
 const dir=mkdtempSync(join(tmpdir(),'workspace-'));
 try{
  const {handoffs,service}=setup(rule,join(dir,'h.sqlite'));
  assert.deepEqual(service.overview(p).workspace,{revision:0,updatedAt:null,sources:[]});
  const w1=service.saveWorkspace(p,{expectedRevision:0,sources:[sources[0],{id:'draft',type:'crm',label:'',text:''}]});
  assert.equal(w1.revision,1);assert.equal(w1.sources[1].text,'','an empty entry Chris is still writing is kept');
  const w2=service.saveWorkspace(p,{expectedRevision:1,sources:[{...sources[0],text:CALL+'\nJordan Lee should check discoverability.'},sources[2]]});
  assert.deepEqual(w2.sources.map(s=>[s.id,s.type]),[['a','conversation'],['c','integration_tools']]);
  assert.throws(()=>service.saveWorkspace(p,{expectedRevision:1,sources:[]}),code('REVISION_CONFLICT'),'a stale tab cannot overwrite');
  assert.throws(()=>service.saveWorkspace(p,{expectedRevision:2,sources:[{type:'pricing',text:'x'}]}),code('INVALID_REQUEST'));
  handoffs.close();
  const reopened=setup(rule,join(dir,'h.sqlite'));
  assert.equal(reopened.service.overview(p).workspace.revision,2);assert.match(reopened.service.overview(p).workspace.sources[0].text,/Jordan Lee/);
  assert.equal(reopened.service.overview(other).workspace.revision,0,'another customer sees nothing');
  reopened.handoffs.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('analysis runs in the background, reports real stages, ignores duplicate starts and records how it was produced',async()=>{
 const gate=deferred(),seen:string[]=[];
 const {service}=setup(async(s,onStage)=>{onStage?.('interpreting','part 1 of 1');seen.push('interpreting');const r=await gate.promise;onStage?.('planning',null);return r;});
 const w=service.saveWorkspace(p,{expectedRevision:0,sources});
 assert.throws(()=>service.startAnalysis(p,{workspaceRevision:0}),code('REVISION_CONFLICT'),'only the saved revision is analysed');
 const first=service.startAnalysis(p,{workspaceRevision:w.revision});
 assert.equal(first.duplicate,false);assert.equal(first.job.status,'running');
 assert.deepEqual([service.analysisStatus(p)!.stage,service.analysisStatus(p)!.stageDetail],['interpreting','part 1 of 1']);
 const again=service.startAnalysis(p,{workspaceRevision:w.revision});
 assert.equal(again.duplicate,true);assert.equal(again.job.id,first.job.id);assert.deepEqual(seen,['interpreting'],'no second run');
 const u=interpretRuleBased(sources.slice(0,1) as SourceInput[]);
 gate.open({understanding:{...u,model:{provider:'ollama',model:'qwen3:1.7b',ok:false,error:'MODEL_TIMEOUT',durationMs:1,chunks:0,discarded:0}},proposal:proposeMilestones(u)});
 const job=await done(service);
 assert.equal(job.status,'succeeded');assert.equal(job.draft,1);assert.equal(job.workspaceRevision,1);
 assert.deepEqual([job.interpreter,job.modelOk,job.modelError],['rule_based',false,'MODEL_TIMEOUT'],'a fallback is reported as a fallback');
 const record=service.overview(p).drafts[0];
 assert.equal(record.basedOnWorkspaceRevision,1);assert.equal(record.reviewRevision,0);assert.ok(record.review);
 assert.equal(record.sources.length,3,'only saved, non-empty information is analysed');
});

test('a failed analysis keeps the saved information and reports a code, never content',async()=>{
 const {service}=setup(async()=>{throw Error('model exploded with $300K in it');});
 service.saveWorkspace(p,{expectedRevision:0,sources});
 service.startAnalysis(p,{workspaceRevision:1});
 const job=await done(service);
 assert.deepEqual([job.status,job.error],['failed','ANALYSIS_FAILED']);assert.ok(!JSON.stringify(job).includes('300K'));
 assert.equal(service.overview(p).drafts.length,0);assert.equal(service.overview(p).workspace.sources.length,3);
 // Nothing to analyse is refused up front.
 const empty=setup();empty.service.saveWorkspace(p,{expectedRevision:0,sources:[{type:'conversation',label:'',text:'  '}]});
 assert.throws(()=>empty.service.startAnalysis(p,{workspaceRevision:1}),code('INVALID_REQUEST'));
});

test('the review is built from the analysis with origins, keeps every milestone, and edits persist with revisions',async()=>{
 const {service}=setup();
 service.saveWorkspace(p,{expectedRevision:0,sources});service.startAnalysis(p,{workspaceRevision:1});await done(service);
 const record=service.overview(p).drafts[0],r=record.review!;
 assert.ok(r.problem.challenges.every(c=>c.origin==='customer'));assert.ok(r.questions.every(q=>q.origin==='ai'));
 assert.equal(r.milestones.length,record.proposal.milestones.length);
 const edited:ReviewDraft={...r,milestones:[...r.milestones,
  {id:'chris-1',title:'Validate payments-api discoverability',description:'Independent check by a second engineer',system:'payments-api',actions:['Search the Catalog for payments-api','Open its docs'],completionCriteria:['payments-api is found from Catalog search'],assignee:null,role:'developer',dependsOn:[r.milestones[0].id],origin:'chris' as const}].reverse(),
  questions:[...r.questions,{id:'q-chris',text:'Who owns the runbooks today?',origin:'chris'}]};
 const saved=service.saveReview(p,{draft:1,expectedRevision:0,review:edited});
 assert.equal(saved.reviewRevision,1);assert.deepEqual(service.overview(p).drafts[0].review!.milestones.map(m=>m.id),edited.milestones.map(m=>m.id),'order is kept');
 assert.throws(()=>service.saveReview(p,{draft:1,expectedRevision:0,review:edited}),code('REVISION_CONFLICT'));
 assert.throws(()=>service.saveReview(p,{draft:1,expectedRevision:1,review:{...edited,milestones:[{...edited.milestones[0],actions:'not a list'}]}}),code('INVALID_REQUEST'));
 const forged=validateReview({...edited,stakeholders:[{id:'p-x',name:'Jamie Park',role:'Account executive',responsibilities:'',basis:'chris',sources:[],technical:true}]});
 assert.equal(forged.stakeholders[0].technical,false,'the server recomputes who is technical');
 // Reviewed milestones convert to valid publication milestones, dependencies by title.
 const drafts=toMilestoneDrafts(service.overview(p).drafts[0].review!,record);
 assert.ok(drafts.every(validMilestone));assert.deepEqual(drafts[0].dependencies,[r.milestones[0].title]);
});

test('submission: incomplete or confidential reviews are refused with field labels; submitted drafts are locked, cannot be published around the Champion, and can be withdrawn',async()=>{
 const {service}=setup();
 service.saveWorkspace(p,{expectedRevision:0,sources});service.startAnalysis(p,{workspaceRevision:1});await done(service);
 const r=service.overview(p).drafts[0].review!;
 const broken:ReviewDraft={...r,milestones:[{id:'m-1',title:'Assess payments-api readiness',description:'',system:'payments-api',actions:[],completionCriteria:['Each item marked verified, missing or inaccessible'],assignee:'Chris',role:'developer',dependsOn:['nope'],origin:'chris'}]};
 service.saveReview(p,{draft:1,expectedRevision:0,review:broken});
 assert.throws(()=>service.submission(p,{draft:1,reviewRevision:1,action:'submit',confirmed:true}),(e:unknown)=>e instanceof ActivationError&&e.code==='REVIEW_INCOMPLETE'&&
  JSON.stringify(e.details).includes('Milestone 1 · actions')&&JSON.stringify(e.details).includes('Milestone 1 · proposed assignee')&&JSON.stringify(e.details).includes('Milestone 1 · depends on'));
 const leaky:ReviewDraft={...r,goals:[...r.goals,{id:'g',text:'Close the $300K deal before the VP loses interest',origin:'chris'}],
  milestones:[{...broken.milestones[0],actions:['Inspect the repository'],assignee:null,dependsOn:[],description:'Her VP thinks Backstage is a nice-to-have'}]};
 service.saveReview(p,{draft:1,expectedRevision:1,review:leaky});
 assert.throws(()=>service.submission(p,{draft:1,reviewRevision:2,action:'submit',confirmed:true}),(e:unknown)=>e instanceof ActivationError&&e.code==='CONFIDENTIAL_CONTENT'&&
  JSON.stringify(e.details).includes('Technical goals')&&JSON.stringify(e.details).includes('Milestone 1 · description')&&!JSON.stringify(e.details).includes('300K'));
 const clean:ReviewDraft={...leaky,goals:r.goals,milestones:[{...leaky.milestones[0],description:'Establish a readiness baseline'}]};
 service.saveReview(p,{draft:1,expectedRevision:2,review:clean});
 assert.throws(()=>service.submission(p,{draft:1,reviewRevision:3,action:'submit'}),code('INVALID_REQUEST'),'confirmation required');
 assert.throws(()=>service.submission(p,{draft:1,reviewRevision:2,action:'submit',confirmed:true}),code('REVISION_CONFLICT'));
 const submitted=service.submission(p,{draft:1,reviewRevision:3,action:'submit',confirmed:true});
 assert.equal(submitted.status,'submitted');assert.equal(submitted.approvals!.chris.status,'approved');assert.equal(submitted.approvals!.champion.status,'pending');
 assert.throws(()=>service.saveReview(p,{draft:1,expectedRevision:3,review:clean}),code('AWAITING_CHAMPION_REVIEW'));
 assert.throws(()=>service.saveWorkspace(p,{expectedRevision:1,sources}).revision===2&&service.startAnalysis(p,{workspaceRevision:2}),code('AWAITING_CHAMPION_REVIEW'));
 assert.throws(()=>service.publish(p,{draft:1,milestones:toMilestoneDrafts(clean,submitted),outcome:'Assess payments-api readiness',agreedBy:'Maya Chen, call',agreementConfirmed:true}),code('AWAITING_CHAMPION_REVIEW'));
 const back=service.submission(p,{draft:1,action:'withdraw'});
 assert.equal(back.status,'draft');assert.equal(back.approvals!.chris.status,'pending');
});

test('privacy screen for the Champion: internal people stay out, technical stakeholders and the engineering problem are fine',()=>{
 const u=interpretRuleBased(sources as SourceInput[]);
 const r=reviewFromAnalysis({understanding:u,proposal:proposeMilestones(u)});
 const base:ReviewDraft={...r,milestones:[{id:'m',title:'Assess payments-api readiness',description:'Nobody can tell who owns a service',system:'payments-api',actions:['Inspect the repository'],completionCriteria:['Each item marked verified, missing or inaccessible'],assignee:'Alex Rivera',role:'developer',dependsOn:[],origin:'ai'}],
  stakeholders:[{id:'p1',name:'Alex Rivera',role:'Developer',responsibilities:'Repository readiness assessment',basis:'stated',sources:['Discovery call'],technical:true},
   {id:'p2',name:'Jamie Park',role:'Account executive',responsibilities:'Owns the $300K renewal',basis:'stated',sources:['CRM'],technical:false}]};
 assert.deepEqual(reviewIssues(base,u),[],'non-technical people are internal, so their notes are not screened as shared');
 assert.ok(reviewIssues({...base,questions:[{id:'q',text:'Is the evaluation still in technical validation?',origin:'chris'}]},u).some(i=>i.reason==='deal_stage'));
 assert.ok(reviewIssues({...base,questions:[{id:'q',text:'Is the deal closing this quarter?',origin:'chris'}]},u).some(i=>i.reason==='commercial_text'));
});

test('HTTP: workspace routes are operator-only; submission shows nothing to developers or the Champion; customers are isolated',async()=>{
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');
 const {openActivationStore}=await import('../src/activation/store.ts');const {createIntake}=await import('../src/activation/intake.ts');
 const intake=createIntake({admit:()=>false});
 const store=openActivationStore(':memory:',intake.policy),handoffs=openHandoffStore(':memory:'),goals=openGoalStore(':memory:');
 const service=createHandoffService({handoffs,store:()=>store,analyze:rule,stage:intake.stage,release:intake.release});
 const tokens:Record<string,{p:typeof p;op:boolean}>={'Bearer dev':{p,op:false},'Bearer op':{p,op:true},'Bearer lumen-op':{p:other,op:true}};
 const server=createApp(goals,undefined,{store,handoff:service,authorize:(r,c)=>{const t=tokens[r.headers.authorization??''];return t&&t.p.customerId===c?t.p:null;},isOperator:r=>tokens[r.headers.authorization??'']?.op===true});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/`;
 const call=async(customer:string,path:string,token:string,body?:unknown)=>{const r=await fetch(base+customer+'/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,json:await r.json()};};
 try{
  for(const [path,body] of [['handoff',undefined],['handoff-workspace',{expectedRevision:0,sources}],['handoff-analyses',undefined],['handoff-analyses',{workspaceRevision:1}],['handoff-reviews',{}],['handoff-submissions',{}]] as const)
   assert.equal((await call('northstar',path,'Bearer dev',body)).status,403,`developer refused on ${path}`);
  assert.equal((await call('northstar','handoff','Bearer lumen-op')).status,403,'another customer’s operator is refused');
  assert.equal((await call('northstar','handoff-workspace','Bearer op',{expectedRevision:0,sources})).status,200);
  const started=await call('northstar','handoff-analyses','Bearer op',{workspaceRevision:1});
  assert.ok([200,202].includes(started.status));
  for(let i=0;i<50&&(await call('northstar','handoff-analyses','Bearer op')).json.job.status==='running';i++)await new Promise(r=>setTimeout(r,5));
  const overview=(await call('northstar','handoff','Bearer op')).json;
  assert.equal(overview.analysis.status,'succeeded');assert.equal(overview.workspace.revision,1);
  const review=overview.drafts[0].review as ReviewDraft;
  const leaky={...review,milestones:[{id:'m',title:'Assess payments-api readiness',description:'Her VP thinks Backstage is a nice-to-have',system:'payments-api',actions:['Inspect the repository'],completionCriteria:['Each item marked verified, missing or inaccessible'],assignee:null,role:'developer',dependsOn:[],origin:'chris'}]};
  assert.equal((await call('northstar','handoff-reviews','Bearer op',{draft:1,expectedRevision:0,review:leaky})).status,200);
  const refused=await call('northstar','handoff-submissions','Bearer op',{draft:1,reviewRevision:1,action:'submit',confirmed:true});
  assert.equal(refused.status,400);assert.equal(refused.json.error.code,'CONFIDENTIAL_CONTENT');
  assert.deepEqual(refused.json.error.details.issues.map((i:{label:string})=>i.label),['Milestone 1 · description']);assert.ok(!JSON.stringify(refused.json).includes('nice-to-have'));
  await call('northstar','handoff-reviews','Bearer op',{draft:1,expectedRevision:1,review:{...leaky,milestones:[{...leaky.milestones[0],description:'Establish a readiness baseline'}]}});
  assert.equal((await call('northstar','handoff-submissions','Bearer op',{draft:1,reviewRevision:2,action:'submit',confirmed:true})).json.status,'submitted');
  // Submission publishes nothing: developer and Champion credentials still see no onboarding at all.
  const dev=await call('northstar','state','Bearer dev');
  assert.equal(dev.status,404);assert.ok(!JSON.stringify(dev.json).match(/payments-api|readiness|Discovery/));
  assert.equal((await call('northstar','handoff-publications','Bearer op',{draft:1,milestones:toMilestoneDrafts(review,overview.drafts[0]),outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true})).json.error.code,'AWAITING_CHAMPION_REVIEW');
  assert.equal((await call('lumen','handoff','Bearer lumen-op')).json.drafts.length,0,'Lumen’s operator sees only Lumen');
  // The existing direct publication path still works once withdrawn, and uses Chris's reviewed milestones.
  assert.equal((await call('northstar','handoff-submissions','Bearer op',{draft:1,action:'withdraw'})).json.status,'draft');
  const pub=await call('northstar','handoff-publications','Bearer op',{draft:1,fromReview:true,outcome:'Assess payments-api readiness',agreedBy:'Maya Chen, discovery call',agreementConfirmed:true});
  assert.equal(pub.status,201,JSON.stringify(pub.json));
  const devView=await call('northstar','state','Bearer dev');
  assert.equal(devView.status,200);assert.deepEqual(devView.json.handoff.milestones.map((m:{objective:string})=>m.objective),['Assess payments-api readiness']);
  for(const x of ['300K','nice-to-have','VP','Discovery call','My notes'])assert.ok(!JSON.stringify(devView.json).includes(x),'developer view leaked '+x);
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();handoffs.close();goals.close();}
});
