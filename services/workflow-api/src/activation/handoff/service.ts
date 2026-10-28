/** Handoff pipeline: sources → understanding → proposed milestones (draft) → Chris's reviewed
 * publication → developer-safe context/plan admitted through the existing activation store. */
import {randomUUID} from 'node:crypto';
import type {MilestoneDraft,SourceInput,SourceType,Understanding} from '../../../../../contracts/activation/v1/handoff.ts';
import type {ActivationPlan,CustomerContext,EvidenceRecord} from '../../../../../contracts/activation/v1/types.ts';
import {validateContract} from '../../../../../contracts/activation/v1/validate.mjs';
import capabilities from '../capabilities.json' with {type:'json'};
import {ActivationError,type ActivationStore,type Principal} from '../store.ts';
import {interpretRuleBased} from './interpret.ts';
import {proposeMilestones,validMilestone} from './milestones.ts';
import {developerHandoff} from './project.ts';
import type {HandoffStore} from './store.ts';

const TYPES:SourceType[]=['crm','conversation','chris_notes','account_prep','technical_requirements','repository'];
const fail=(code:string):never=>{throw new ActivationError(code);};
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

/** Developer-facing text must not contain internal findings or commercial terms. */
export function confidentialHits(m:MilestoneDraft,outcome:string,u:Understanding):string[]{
 const fields:[string,string][]=[['Objective',m.objective],['Why',m.why],['Expected output',m.expectedOutput],['Outcome',outcome],...m.actions.map((a,i)=>[`Action ${i+1}`,a] as [string,string]),...m.completionCriteria.map((c,i)=>[`Completion ${i+1}`,c] as [string,string]),...m.requiredInformation.map((c,i)=>[`Required information ${i+1}`,c] as [string,string])];
 const internal=u.findings.filter(f=>f.audience!=='developer').map(f=>f.statement.toLowerCase()).filter(s=>s.length>=24);
 const money=/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m)\b(?!\w)|\b(?:arr|acv|tcv|discount|pricing|renewal|opportunity|deal size|procurement)\b/i;
 return fields.filter(([,t])=>money.test(t)||internal.some(s=>t.toLowerCase().includes(s.slice(0,40)))).map(([f])=>f);
}

export function createHandoffService(deps:{handoffs:HandoffStore;store:()=>ActivationStore;interpret?:(s:SourceInput[])=>Promise<Understanding>;stage:(p:Principal,context:CustomerContext,plan:ActivationPlan)=>void;release:(p:Principal)=>void;publishEnabled?:boolean}){
 const interpret=deps.interpret??(async(s:SourceInput[])=>interpretRuleBased(s));
 async function draft(p:Principal,input:unknown){
  const sources=parseSources(input);
  const understanding=await interpret(sources);
  return deps.handoffs.add(p,{status:'draft',createdAt:new Date().toISOString(),publishedVersion:null,publishedAt:null,sources,understanding,proposal:proposeMilestones(understanding),developer:null});
 }
 function publish(p:Principal,input:unknown){
  if(deps.publishEnabled===false)fail('ADAPTER_UNAVAILABLE');
  const b=input as {draft?:unknown;milestones?:unknown;outcome?:unknown;agreedBy?:unknown;agreementConfirmed?:unknown};
  if(!b||typeof b!=='object'||!Number.isSafeInteger(b.draft)||!Array.isArray(b.milestones)||b.milestones.length<1||b.milestones.length>3||!b.milestones.every(validMilestone)||b.agreementConfirmed!==true
   ||typeof b.outcome!=='string'||!b.outcome.trim()||b.outcome.length>300||typeof b.agreedBy!=='string'||!b.agreedBy.trim()||b.agreedBy.length>200)fail('INVALID_REQUEST');
  const record=deps.handoffs.get(p,b.draft as number)??fail('NOT_FOUND');
  if(deps.handoffs.all(p).some(r=>r.status==='published'))fail('REVISION_CONFLICT');
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
   deps.handoffs.save(p,{...record,status:'published',publishedVersion:1,publishedAt:at,proposal:{...record.proposal,milestones},developer});
   return state;}
  finally{deps.release(p);}
 }
 return {draft,publish,overview:(p:Principal)=>({drafts:deps.handoffs.all(p)}),published:(p:Principal)=>deps.handoffs.published(p)};
}
export type HandoffService=ReturnType<typeof createHandoffService>;
