/** Handoff pipeline: sources → understanding → proposed milestones (draft) → Chris's reviewed
 * publication → developer-safe context/plan admitted through the existing activation store. */
import {randomUUID} from 'node:crypto';
import type {AnalysisJob,AnalysisStage,ChampionReview,DocumentReport,HandoffRecord,MilestoneDraft,ReviewEvent,SourceInput,SourceType,Understanding,Workspace} from '../../../../../contracts/activation/v1/handoff.ts';
import type {ActivationPlan,CustomerContext,EvidenceRecord} from '../../../../../contracts/activation/v1/types.ts';
import {validateContract} from '../../../../../contracts/activation/v1/validate.mjs';
import capabilities from '../capabilities.json' with {type:'json'};
import {ActivationError,type ActivationStore,type Principal} from '../store.ts';
import {interpretRuleBased} from './interpret.ts';
import {proposeMilestones,validMilestone} from './milestones.ts';
import {unsafeReason,type Analysis,type StageListener} from './intelligence.ts';
import {applyChampionEdits,approvalIssues,championPlan,reviewFromAnalysis,reviewIssues,toMilestoneDrafts,validateReview} from './review.ts';
import {developerHandoff} from './project.ts';
import type {HandoffStore} from './store.ts';

const TYPES:SourceType[]=['crm','conversation','chris_notes','account_prep','technical_requirements','repository','integration_tools'];
const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};
const underReview=(s:HandoffRecord['status'])=>s==='submitted'||s==='resubmitted';
const chrisEditable=(s:HandoffRecord['status'])=>s==='draft'||s==='changes_requested';
// Review issues that mean "incomplete" rather than "not shareable".
const STRUCTURAL=['missing','no_milestone','not_a_technical_stakeholder','unknown_milestone','circular_dependencies','unassigned'];
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
 /** Chris's PDF, already extracted and structured: it replaces the saved information and the analysis starts at
  * once. Checked before anything is saved, so an upload never changes information under review or mid-analysis. */
 function documentAllowed(p:Principal){
  if(published(p))fail('ALREADY_PUBLISHED');
  const current=latest(p);
  if(current&&!chrisEditable(current.status))fail(blockedFor(current.status));
  if(jobs.get(jobKey(p))?.job.status==='running')fail('ANALYSIS_RUNNING');
 }
 function saveDocument(p:Principal,document:{sources:SourceInput[];report:DocumentReport}){
  documentAllowed(p);
  const sources=parseWorkspaceSources(document.sources);
  const saved=deps.handoffs.workspace(p);
  const next:Workspace={revision:saved.revision+1,updatedAt:new Date(now()).toISOString(),sources,document:document.report};
  deps.handoffs.saveWorkspace(p,next);
  return {workspace:next,job:startAnalysis(p,{workspaceRevision:next.revision}).job};
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
  const current=latest(p);
  if(current&&!chrisEditable(current.status))fail(blockedFor(current.status));
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
    // A new analysis while revising keeps the review history (the Champion's feedback) with the new draft.
    const record=addRecord(p,sources,analysis,{basedOnWorkspaceRevision:saved.revision,...(current?.history?.length?{history:current.history}:{})});
    const model=analysis.understanding.model;
    Object.assign(entry.job,{status:'succeeded',draft:record.draft,interpreter:analysis.understanding.interpreter,modelOk:model?model.ok:null,modelError:model&&!model.ok?model.error:null,modelErrorDetail:model&&!model.ok?model.errorDetail??null:null});
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
 const stamp=()=>new Date(now()).toISOString();
 const blockedFor=(status:HandoffRecord['status'])=>underReview(status)?'AWAITING_CHAMPION_REVIEW':status==='approved'||status==='published'?'ALREADY_APPROVED':'INVALID_TRANSITION';
 const bump=(r:HandoffRecord)=>(r.reviewRevision??0)+1;
 const event=(r:HandoffRecord,e:ReviewEvent)=>[...(r.history??[]),e];
 const refuse=(issues:{reason:string}[])=>fail(issues.some(i=>!STRUCTURAL.includes(i.reason))?'CONFIDENTIAL_CONTENT':'REVIEW_INCOMPLETE',{issues});

 // ---- Chris: edit while drafting or after changes were requested; submit, withdraw, resubmit.
 function saveReview(p:Principal,input:unknown){
  const b=input as {draft?:unknown;expectedRevision?:unknown;review?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  const record=editable(p,b.draft);
  if(!chrisEditable(record.status))fail(blockedFor(record.status));
  if((record.reviewRevision??0)!==b.expectedRevision)fail('REVISION_CONFLICT');
  const saved:HandoffRecord={...record,review:validateReview(b.review),reviewRevision:bump(record),reviewUpdatedAt:stamp()};
  deps.handoffs.save(p,saved);return saved;
 }
 function submission(p:Principal,input:unknown,actor='Account operator'){
  const b=input as {draft?:unknown;reviewRevision?:unknown;action?:unknown;confirmed?:unknown};
  if(!b||typeof b!=='object'||!['submit','withdraw'].includes(b.action as string))fail('INVALID_REQUEST');
  const record=editable(p,b.draft),at=stamp();
  if(b.action==='withdraw'){
   if(!underReview(record.status))fail('INVALID_TRANSITION');
   // Withdrawing moves the revision on, so the Champion can no longer act on the withdrawn version.
   const saved:HandoffRecord={...record,status:'draft',submittedAt:null,reviewRevision:bump(record),approvals:{chris:pending,champion:pending},history:event(record,{action:'withdrawn',at,by:actor})};
   deps.handoffs.save(p,saved);return saved;
  }
  if(!chrisEditable(record.status))fail(blockedFor(record.status));
  if(b.confirmed!==true||!Number.isSafeInteger(b.reviewRevision))fail('INVALID_REQUEST');
  if((record.reviewRevision??0)!==b.reviewRevision)fail('REVISION_CONFLICT');
  const review=record.review??reviewFromAnalysis(record);
  const issues=reviewIssues(review,record.understanding);
  if(issues.length)refuse(issues);
  // Submitting records Chris's approval for Champion review. Nothing is shared with developers.
  const again=(record.history??[]).some(e=>e.action==='submitted'||e.action==='resubmitted');
  const status=again?'resubmitted' as const:'submitted' as const;
  const saved:HandoffRecord={...record,review,status,submittedAt:at,reviewRevision:bump(record),approvals:{chris:{status:'approved',by:actor,at},champion:pending},
   assignments:review.milestones.map(m=>({milestoneId:m.id,role:m.role,proposedAssignee:m.assignee,status:'proposed' as const})),history:event(record,{action:status,at,by:actor})};
  deps.handoffs.save(p,saved);return saved;
 }

 // ---- Dream Day: the Champion reviews, edits, requests changes or approves. The view is built here.
 function championView(p:Principal):ChampionReview{
  const r=latest(p);
  if(!r)return {draft:null,status:'not_submitted',reviewRevision:0,submittedAt:null,analysis:null,history:[],approval:null,plan:null};
  const championApproved=r.approvals?.champion.status==='approved';
  const status:ChampionReview['status']=r.status==='draft'?((r.history??[]).length?'revising':'not_submitted'):r.status==='published'&&!championApproved?'published_before_dream_day':r.status;
  const visible=underReview(r.status)||(championApproved&&(r.status==='approved'||r.status==='published'));
  const m=r.understanding.model;
  return {draft:r.draft,status,reviewRevision:r.reviewRevision??0,submittedAt:r.submittedAt??null,
   analysis:m?(m.ok?'model':'rule_based_fallback'):r.understanding.interpreter==='hosted_model'?'model':'rule_based',
   // Only review steps and the Champion's own comments; never operator content.
   history:(r.history??[]).map(e=>({action:e.action,at:e.at,by:e.by,...(e.comment?{comment:e.comment}:{})})),
   approval:championApproved?{by:r.approvals!.champion.by!,at:r.approvals!.champion.at!}:null,
   plan:visible?championPlan(r):null};
 }
 function saveChampionReview(p:Principal,input:unknown){
  const b=input as {draft?:unknown;expectedRevision?:unknown;plan?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  const record=editable(p,b.draft);
  if(!underReview(record.status))fail('NOT_UNDER_REVIEW');
  if((record.reviewRevision??0)!==b.expectedRevision)fail('REVISION_CONFLICT');
  const review=applyChampionEdits(record.review??reviewFromAnalysis(record),b.plan);
  deps.handoffs.save(p,{...record,review,reviewRevision:bump(record),reviewUpdatedAt:stamp()});
  return championView(p);
 }
 function championDecision(p:Principal,input:unknown,actor='Customer Champion'){
  const b=input as {draft?:unknown;reviewRevision?:unknown;decision?:unknown;comment?:unknown;confirmed?:unknown};
  if(!b||typeof b!=='object'||!['approve','request_changes'].includes(b.decision as string)||!Number.isSafeInteger(b.reviewRevision))fail('INVALID_REQUEST');
  const record=editable(p,b.draft),at=stamp();
  // One decision per submission: a second approval, or a decision on a withdrawn or outdated version, is refused.
  if(!underReview(record.status))fail(record.status==='approved'||record.status==='published'?'ALREADY_APPROVED':'NOT_UNDER_REVIEW');
  if((record.reviewRevision??0)!==b.reviewRevision)fail('REVISION_CONFLICT');
  if(b.decision==='request_changes'){
   const comment=typeof b.comment==='string'?b.comment.trim():'';
   if(comment.length<3||comment.length>2000)fail('COMMENT_REQUIRED');
   const saved:HandoffRecord={...record,status:'changes_requested',reviewRevision:bump(record),approvals:{chris:pending,champion:pending},history:event(record,{action:'changes_requested',at,by:actor,comment})};
   deps.handoffs.save(p,saved);return championView(p);
  }
  if(b.confirmed!==true)fail('INVALID_REQUEST');
  const review=record.review??reviewFromAnalysis(record);
  const issues=approvalIssues(review,record.understanding);
  if(issues.length)refuse(issues);
  const approval={status:'approved' as const,by:actor,at};
  const approved:HandoffRecord={...record,review,reviewRevision:bump(record),approvals:{chris:record.approvals?.chris??pending,champion:approval},
   assignments:review.milestones.map(m=>({milestoneId:m.id,role:m.role,proposedAssignee:m.assignee,status:'approved' as const})),history:event(record,{action:'approved',at,by:actor})};
  if(deps.publishEnabled===false){deps.handoffs.save(p,{...approved,status:'approved'});return championView(p);}
  // Approval is what publishes: only the approved, developer-safe milestones with their approved assignments.
  const milestones=toMilestoneDrafts(review,record).map(m=>({...m,assignmentStatus:'approved' as const}));
  const outcome=(review.goals[0]?.text||milestones[0].objective).slice(0,300);
  publishRecord(p,{...approved,history:event(approved,{action:'published',at,by:actor})},milestones,outcome,`${actor} (Champion), Dream Day approval`,{by:actor,at});
  return championView(p);
 }

 /** The pre-Dream Day direct publication. Refused: new developer plans are published only by a Champion approval. */
 function publish(_p:Principal,_input:unknown):never{return fail('CHAMPION_APPROVAL_REQUIRED');}
 function publishRecord(p:Principal,record:HandoffRecord,milestones:MilestoneDraft[],outcome:string,agreedBy:string,approval:{by:string;at:string}){
  if(deps.handoffs.all(p).some(r=>r.status==='published'))fail('REVISION_CONFLICT');
  if(!milestones.length||!milestones.every(validMilestone))fail('INVALID_REQUEST');
  if(milestones.some(m=>confidentialHits(m,outcome,record.understanding).length))fail('CONFIDENTIAL_CONTENT');
  // The broader objective developers may see: the approved problem, goals and open questions, screened again.
  const safe=(t:string)=>!!t.trim()&&!unsafeReason(t,record.understanding),r=record.review;
  const objective=r?{problem:safe(r.problem.summary)?r.problem.summary:null,goals:r.goals.map(g=>g.text).filter(safe),questions:r.questions.map(q=>q.text).filter(safe)}:undefined;
  const at=approval.at,id=randomUUID(),developer={...developerHandoff(1,at,record.understanding,milestones),approval,...(objective?{objective}:{})},m=milestones[0];
  const proof={type:'none' as const,actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked' as const};
  const ev=(suffix:string,kind:EvidenceRecord['kind'],claim:string,basisIds:string[]=[]):EvidenceRecord=>({id:`${id}-${suffix}`,kind,claim,source:'Chris activation intake',observedAt:at,sourceRevision:id,scope:m.objective,producer:'authenticated local intake operator',basisIds,proof});
  const kinds=[...new Set(record.sources.map(s=>s.type))].join(', ');
  const brief=ev('brief','customer_report',`Customer context from ${record.sources.length} source(s) (${kinds}) reviewed by Chris.`),agreement=ev('agreement','customer_report',`Approved by ${agreedBy}: ${outcome}`);
  const inference=ev('reason','ai_inference',`${record.understanding.interpreter==='hosted_model'?'Model-assisted':'Rule-based'} interpretation proposed the plan; reviewed by Chris and approved by the Champion.`,[brief.id,agreement.id]);
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
   deps.handoffs.save(p,{...record,status:'published',publishedVersion:1,publishedAt:at,proposal:{...record.proposal,milestones},developer});
   return state;}
  finally{deps.release(p);}
 }
 return {draft,publish,saveWorkspace,documentAllowed,saveDocument,startAnalysis,analysisStatus,saveReview,submission,championView,saveChampionReview,championDecision,
  overview:(p:Principal)=>({drafts:deps.handoffs.all(p),workspace:workspace(p),analysis:analysisStatus(p)}),published:(p:Principal)=>deps.handoffs.published(p)};
}
export type HandoffService=ReturnType<typeof createHandoffService>;
