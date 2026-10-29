/** Handoff pipeline: sources → understanding → proposed milestones (draft) → Chris's reviewed
 * publication → developer-safe context/plan admitted through the existing activation store. */
import {randomUUID} from 'node:crypto';
import type {AnalysisJob,AnalysisStage,HandoffRecord,MilestoneDraft,SourceInput,SourceType,Understanding,Workspace} from '../../../../../contracts/activation/v1/handoff.ts';
import type {ActivationPlan,CustomerContext,EvidenceRecord} from '../../../../../contracts/activation/v1/types.ts';
import {validateContract} from '../../../../../contracts/activation/v1/validate.mjs';
import capabilities from '../capabilities.json' with {type:'json'};
import {ActivationError,type ActivationStore,type Principal} from '../store.ts';
import {interpretRuleBased} from './interpret.ts';
import {proposeMilestones,validMilestone} from './milestones.ts';
import {unsafeReason,type Analysis,type StageListener} from './intelligence.ts';
import {reviewFromAnalysis,reviewIssues,toMilestoneDrafts,validateReview} from './review.ts';
import {developerHandoff} from './project.ts';
import type {HandoffStore} from './store.ts';

const TYPES:SourceType[]=['crm','conversation','chris_notes','account_prep','technical_requirements','repository','integration_tools'];
const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};
const CAPABILITY:Record<string,string>={service_readiness:'onboard',techdocs:'docs',scaffolder:'docs',ci_investigation:'ci'};

export function parseSources(input:unknown):SourceInput[]{
 const list=(input as {sources?:unknown})?.sources;
 if(!Array.isArray(list)||!list.length||list.length>12)fail('INVALID_REQUEST');
 let total=0;
 return (list as Record<string,unknown>[]).map((s,i)=>{
  if(!s||typeof s!=='object'||!TYPES.includes(s.type as SourceType)||typeof s.text!=='string'||!s.text.trim()||s.text.length>60000||(s.label!==undefined&&(typeof s.label!=='string'||s.label.length>80)))fail('INVALID_REQUEST');
  total+=(s.text as string).length;if(total>120000)fail('PAYLOAD_TOO_LARGE');
  return {id:`s${i+1}`,type:s.type as SourceType,label:(s.label as string|undefined)?.trim()||'',text:(s.text as string).trim()};
 });
}

/** Developer-facing text must not contain commercial terms, private comments, deal stage or restated private passages. */
export function confidentialHits(m:MilestoneDraft,outcome:string,u:Understanding):string[]{
 const fields:[string,string][]=[['Objective',m.objective],['Why',m.why],['Expected output',m.expectedOutput],['Outcome',outcome],...m.actions.map((a,i)=>[`Action ${i+1}`,a] as [string,string]),...m.completionCriteria.map((c,i)=>[`Completion ${i+1}`,c] as [string,string]),...m.requiredInformation.map((c,i)=>[`Required information ${i+1}`,c] as [string,string]),...m.prerequisites.map((c,i)=>[`Prerequisite ${i+1}`,c.text] as [string,string])];
 // Same screen as model output: the customer's engineering problem is shareable, private context is not.
 const money=/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m)\b(?!\w)|\b(?:arr|acv|tcv|discount|pricing|renewal|opportunity|deal size|procurement)\b/i;
 return fields.filter(([,t])=>money.test(t)||unsafeReason(t,u)!==null).map(([f])=>f);
}

/** Saved information may be incomplete while Chris is still writing: empty entries are kept, never analyzed. */
export function parseWorkspaceSources(input:unknown):SourceInput[]{
 if(!Array.isArray(input)||input.length>12)fail('INVALID_REQUEST');
 let total=0;const ids=new Set<string>();
 return (input as Record<string,unknown>[]).map((s,i)=>{
  if(!s||typeof s!=='object'||!TYPES.includes(s.type as SourceType)||typeof s.text!=='string'||s.text.length>60000||(s.label!==undefined&&(typeof s.label!=='string'||s.label.length>80)))fail('INVALID_REQUEST');
  total+=(s.text as string).length;if(total>120000)fail('PAYLOAD_TOO_LARGE');
  const id=typeof s.id==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(s.id)&&!ids.has(s.id)?s.id:`w${i+1}`;ids.add(id);
  return {id,type:s.type as SourceType,label:(s.label as string|undefined)?.trim()??'',text:s.text as string};
 });
}

type Analyze=(s:SourceInput[],onStage?:StageListener)=>Promise<Analysis>;
export function createHandoffService(deps:{handoffs:HandoffStore;store:()=>ActivationStore;analyze?:Analyze;stage:(p:Principal,context:CustomerContext,plan:ActivationPlan)=>void;release:(p:Principal)=>void;publishEnabled?:boolean;now?:()=>number}){
 const now=deps.now??(()=>Date.now());
 const analyze:Analyze=deps.analyze??(async(s,onStage)=>{onStage?.('interpreting',null);const understanding=interpretRuleBased(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};});
 const pending={status:'pending' as const,by:null,at:null};
 // Generated plans are drafts: Chris reviews and submits them; the Champion step and assignments stay proposed.
 function addRecord(p:Principal,sources:SourceInput[],{understanding,proposal}:Analysis,extra:Partial<HandoffRecord>={}){
  return deps.handoffs.add(p,{status:'draft',createdAt:new Date(now()).toISOString(),publishedVersion:null,publishedAt:null,sources,understanding,proposal,developer:null,
   approvals:{chris:pending,champion:pending},assignments:proposal.milestones.map(m=>({milestoneId:m.id,role:m.recommendedRole??'developer',proposedAssignee:m.proposedAssignee??null,status:'proposed' as const})),
   review:reviewFromAnalysis({understanding,proposal}),reviewRevision:0,submittedAt:null,...extra});
 }
 const published=(p:Principal)=>deps.handoffs.all(p).some(r=>r.status==='published');
 const latest=(p:Principal)=>deps.handoffs.all(p).at(-1)??null;
 async function draft(p:Principal,input:unknown){
  const sources=parseSources(input);
  return addRecord(p,sources,await analyze(sources));
 }

 // ---- Saved information (before analysis).
 function workspace(p:Principal):Workspace{
  const w=deps.handoffs.workspace(p);
  // Customers analysed before saved information existed: start from the latest analysed sources.
  if(w.revision===0&&!w.sources.length){const r=latest(p);if(r)return {...w,sources:r.sources};}
  return w;
 }
 function saveWorkspace(p:Principal,input:unknown){
  const b=input as {expectedRevision?:unknown;sources?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  if(published(p))fail('ALREADY_PUBLISHED');
  const sources=parseWorkspaceSources(b.sources);
  const current=deps.handoffs.workspace(p);
  if(b.expectedRevision!==current.revision)fail('REVISION_CONFLICT');
  const next:Workspace={revision:current.revision+1,updatedAt:new Date(now()).toISOString(),sources};
  deps.handoffs.saveWorkspace(p,next);return next;
 }

 // ---- Analysis runs in the background; the browser polls its status. One run per customer at a time.
 const jobs=new Map<string,{job:AnalysisJob;started:number;ended:number|null}>();
 const jobKey=(p:Principal)=>JSON.stringify([p.tenantId,p.customerId,p.sessionId]);
 const snapshot=(e:{job:AnalysisJob;started:number;ended:number|null})=>({...e.job,elapsedMs:(e.ended??now())-e.started});
 function analysisStatus(p:Principal){const e=jobs.get(jobKey(p));return e?snapshot(e):null;}
 function startAnalysis(p:Principal,input:unknown){
  const running=jobs.get(jobKey(p));
  // Repeated clicks or a second tab get the run already in progress, never a second one.
  if(running?.job.status==='running')return {job:snapshot(running),duplicate:true};
  const b=input as {workspaceRevision?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.workspaceRevision))fail('INVALID_REQUEST');
  if(published(p))fail('ALREADY_PUBLISHED');
  if(latest(p)?.status==='submitted')fail('AWAITING_CHAMPION_REVIEW');
  const saved=deps.handoffs.workspace(p);
  if(b.workspaceRevision!==saved.revision)fail('REVISION_CONFLICT');
  // Only saved information is analysed, so the result always matches a revision Chris can see.
  const sources=parseSources({sources:saved.sources.filter(s=>s.text.trim()).map(({type,label,text})=>({type,label,text}))});
  const entry={job:{id:randomUUID(),status:'running',stage:'preparing',stageDetail:null,startedAt:new Date(now()).toISOString(),finishedAt:null,elapsedMs:0,
   workspaceRevision:saved.revision,draft:null,interpreter:null,modelOk:null,modelError:null,error:null} as AnalysisJob,started:now(),ended:null as number|null};
  jobs.set(jobKey(p),entry);
  const set=(stage:AnalysisStage,detail:string|null)=>{entry.job.stage=stage;entry.job.stageDetail=detail;};
  void (async()=>{
   try{
    const analysis=await analyze(sources,set);
    set('preparing_review',null);
    const record=addRecord(p,sources,analysis,{basedOnWorkspaceRevision:saved.revision});
    const model=analysis.understanding.model;
    Object.assign(entry.job,{status:'succeeded',draft:record.draft,interpreter:analysis.understanding.interpreter,modelOk:model?model.ok:null,modelError:model&&!model.ok?model.error:null});
   }catch(error){
    // Codes only: the reason never carries customer content.
    Object.assign(entry.job,{status:'failed',error:error instanceof ActivationError?error.code:'ANALYSIS_FAILED'});
   }finally{entry.ended=now();entry.job.finishedAt=new Date(entry.ended).toISOString();}
  })();
  return {job:snapshot(entry),duplicate:false};
 }

 // ---- Chris's review of the latest analysis, then submission for Champion review.
 function editable(p:Principal,draftNumber:unknown){
  if(!Number.isSafeInteger(draftNumber))fail('INVALID_REQUEST');
  const record=deps.handoffs.get(p,draftNumber as number)??fail('NOT_FOUND');
  if(record.draft!==latest(p)!.draft)fail('NOT_LATEST_DRAFT');
  return record;
 }
 function saveReview(p:Principal,input:unknown){
  const b=input as {draft?:unknown;expectedRevision?:unknown;review?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  const record=editable(p,b.draft);
  if(record.status!=='draft')fail(record.status==='submitted'?'AWAITING_CHAMPION_REVIEW':'ALREADY_PUBLISHED');
  if((record.reviewRevision??0)!==b.expectedRevision)fail('REVISION_CONFLICT');
  const saved:HandoffRecord={...record,review:validateReview(b.review),reviewRevision:(record.reviewRevision??0)+1,reviewUpdatedAt:new Date(now()).toISOString()};
  deps.handoffs.save(p,saved);return saved;
 }
 function submission(p:Principal,input:unknown){
  const b=input as {draft?:unknown;reviewRevision?:unknown;action?:unknown;confirmed?:unknown};
  if(!b||typeof b!=='object'||!['submit','withdraw'].includes(b.action as string))fail('INVALID_REQUEST');
  const record=editable(p,b.draft),at=new Date(now()).toISOString();
  if(record.status==='published')fail('ALREADY_PUBLISHED');
  if(b.action==='withdraw'){
   if(record.status!=='submitted')fail('INVALID_TRANSITION');
   const saved:HandoffRecord={...record,status:'draft',submittedAt:null,approvals:{chris:pending,champion:pending}};
   deps.handoffs.save(p,saved);return saved;
  }
  if(record.status!=='draft')fail('INVALID_TRANSITION');
  if(b.confirmed!==true||!Number.isSafeInteger(b.reviewRevision))fail('INVALID_REQUEST');
  if((record.reviewRevision??0)!==b.reviewRevision)fail('REVISION_CONFLICT');
  const review=record.review??reviewFromAnalysis(record);
  const issues=reviewIssues(review,record.understanding);
  if(issues.length)fail(issues.some(i=>!['missing','no_milestone','not_a_technical_stakeholder','unknown_milestone','circular_dependencies'].includes(i.reason))?'CONFIDENTIAL_CONTENT':'REVIEW_INCOMPLETE',{issues});
  // Submitting records Chris's approval of this draft for Champion review. Nothing is shared or published.
  const saved:HandoffRecord={...record,review,status:'submitted',submittedAt:at,approvals:{chris:{status:'approved',by:'Account operator',at},champion:pending},
   assignments:review.milestones.map(m=>({milestoneId:m.id,role:m.role,proposedAssignee:m.assignee,status:'proposed' as const}))};
  deps.handoffs.save(p,saved);return saved;
 }

 function publish(p:Principal,input:unknown){
  if(deps.publishEnabled===false)fail('ADAPTER_UNAVAILABLE');
  const b=input as {draft?:unknown;milestones?:unknown;fromReview?:unknown;outcome?:unknown;agreedBy?:unknown;agreementConfirmed?:unknown};
  // Milestones come from the request, or with fromReview from Chris's saved review of this draft (first three, in order).
  const fromReview=b?.fromReview===true;
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.draft)||(!fromReview&&(!Array.isArray(b.milestones)||b.milestones.length<1||b.milestones.length>3||!b.milestones.every(validMilestone)))||b.agreementConfirmed!==true
   ||typeof b.outcome!=='string'||!b.outcome.trim()||b.outcome.length>300||typeof b.agreedBy!=='string'||!b.agreedBy.trim()||b.agreedBy.length>200)fail('INVALID_REQUEST');
  const record=deps.handoffs.get(p,b.draft as number)??fail('NOT_FOUND');
  if(deps.handoffs.all(p).some(r=>r.status==='published'))fail('REVISION_CONFLICT');
  // A draft awaiting Champion review is not published around that review; withdraw it first.
  if(record.status==='submitted')fail('AWAITING_CHAMPION_REVIEW');
  if(fromReview){const reviewed=record.review?toMilestoneDrafts(record.review,record).slice(0,3):[];if(!reviewed.length||!reviewed.every(validMilestone))fail('INVALID_REQUEST');b.milestones=reviewed;}
  const milestones=b.milestones as MilestoneDraft[],outcome=(b.outcome as string).trim(),agreedBy=(b.agreedBy as string).trim();
  if(milestones.some(m=>confidentialHits(m,outcome,record.understanding).length))fail('CONFIDENTIAL_CONTENT');
  const at=new Date().toISOString(),id=randomUUID(),developer=developerHandoff(1,at,record.understanding,milestones),m=milestones[0];
  const proof={type:'none' as const,actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked' as const};
  const ev=(suffix:string,kind:EvidenceRecord['kind'],claim:string,basisIds:string[]=[]):EvidenceRecord=>({id:`${id}-${suffix}`,kind,claim,source:'Chris activation intake',observedAt:at,sourceRevision:id,scope:m.objective,producer:'authenticated local intake operator',basisIds,proof});
  const kinds=[...new Set(record.sources.map(s=>s.type))].join(', ');
  const brief=ev('brief','customer_report',`Customer context from ${record.sources.length} source(s) (${kinds}) reviewed by Chris.`),agreement=ev('agreement','customer_report',`Chris reports agreement by ${agreedBy}: ${outcome}`);
  const inference=ev('reason','ai_inference',`${record.understanding.interpreter==='hosted_model'?'Model-assisted':'Rule-based'} interpretation proposed the ${record.understanding.goals[0]?.playbook??'first'} milestone; reviewed by Chris.`,[brief.id,agreement.id]);
  const capability=capabilities.find(c=>c.id===CAPABILITY[record.understanding.goals[0]?.playbook??'service_readiness'])??capabilities[0];
  const context:CustomerContext={contractVersion:'1.0.0',customerId:p.customerId,revision:0,evidence:[brief,agreement],briefing:developer.summary,briefingEvidenceIds:[brief.id],
   agreedGoal:{text:outcome,agreedBy,agreedAt:at,evidenceIds:[agreement.id]},unknowns:developer.unknowns.map(u=>u.question),constraints:developer.context.map(n=>`${n.topic}: ${n.text}`)};
  const plan:ActivationPlan={contractVersion:'1.0.0',customerId:p.customerId,revision:0,contextRevision:0,supersedesRevision:null,planner:'demo_backend_adapter',evidence:[brief,agreement,inference],
   selectedMilestone:{id:m.id,outcome:m.objective,successCriteria:m.completionCriteria,evidenceIds:[agreement.id]},
   prerequisites:m.prerequisites.map(x=>({description:x.text,state:x.state,evidenceIds:[brief.id]})),
   capabilities:[{id:capability.id,availability:'representative',evidenceIds:[inference.id]}],rationale:m.why,
   suggestedNextAction:{id:'prepare-first-review',revision:0,kind:'prepare_artifact',description:m.actions[0],capabilityId:capability.id,status:'suggested',evidenceIds:[brief.id,agreement.id,inference.id]},blockerIds:[]};
  validateContract('CustomerContext',context);validateContract('ActivationPlan',plan);
  deps.stage(p,context,plan);
  try{const state=deps.store().initialize(p,context,plan);
   deps.handoffs.save(p,{...record,status:'published',publishedVersion:1,publishedAt:at,proposal:{...record.proposal,milestones},developer,approvals:{chris:{status:'approved',by:agreedBy,at},champion:record.approvals?.champion??{status:'pending',by:null,at:null}}});
   return state;}
  finally{deps.release(p);}
 }
 return {draft,publish,saveWorkspace,startAnalysis,analysisStatus,saveReview,submission,
  overview:(p:Principal)=>({drafts:deps.handoffs.all(p),workspace:workspace(p),analysis:analysisStatus(p)}),published:(p:Principal)=>deps.handoffs.published(p)};
}
export type HandoffService=ReturnType<typeof createHandoffService>;
