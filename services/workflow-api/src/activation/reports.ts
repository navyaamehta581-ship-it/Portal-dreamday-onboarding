import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {ActivationError,type ActivationStore,type ActivationState,type Principal,type Policy} from './store.ts';
import type {ActivationPlan,BlockerUpdate,EvidenceRecord} from '../../../../contracts/activation/v1/types.ts';

export type BlockerReport={id:string;expectedRevision:number;planRevision:number;message:string};
const fail=(code:string):never=>{throw new ActivationError(code);};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Server template only: text remains a report; it never establishes capability, approval or proof. */
export function replacementForReport(state:ActivationState,event:BlockerUpdate):ActivationPlan|null {
 const report=event.evidence.find(e=>e.id===`report:${event.id}`&&e.kind==='developer_report'&&e.source==='Authenticated activation blocker report'&&e.sourceRevision===hash({id:event.id,expectedRevision:event.expectedRevision,planRevision:event.planRevision,message:event.newInformation}));
 if(!report||!event.id.startsWith('developer:')||state.replan.blockerId!==event.id)return null;
 const old=state.plan;
 return {...structuredClone(old),revision:old.revision+1,supersedesRevision:old.revision,blockerIds:[event.id],
  evidence:[...state.evidence],
  capabilities:[{id:'bounded-review',availability:'representative',evidenceIds:[report.id]}],
  prerequisites:[...old.prerequisites.filter(item=>item.description!=='Confirm the attributed blocker and recover authorized prerequisites; do not bypass original constraints'),{description:'Confirm the attributed blocker and recover authorized prerequisites; do not bypass original constraints',state:'unknown',evidenceIds:[report.id]}],
  rationale:'Deterministic fallback: developer reported a blocker. Preserve the original goal and constraints; prepare an offline review checklist and ask Chris to resolve prerequisites. No repository facts, approval, execution or customer outcome inferred.',
  suggestedNextAction:{id:`review-${hash(event.id).slice(0,24)}`,revision:0,kind:'prepare_artifact',status:'suggested',capabilityId:'bounded-review',description:`Prepare a review checklist for the reported blocker: ${event.newInformation}. Check the original briefing and constraints; ask Chris to confirm authorized access or missing information.`,evidenceIds:[report.id]}};
}
/** Admission exists only during the synchronous store transaction. Recovery derives exact plans from durable events. */
export function createBlockerReports(base:Policy,getStore:()=>ActivationStore) {
 let admitted:{principal:Principal;record:EvidenceRecord}|null=null;
 const policy:Policy={...base,
  admit:(p,e,purpose)=>(['blocker','progress'].includes(purpose)&&isDeepStrictEqual(admitted?.principal,p)&&isDeepStrictEqual(admitted?.record,e))||base.admit(p,e,purpose),
  admitPlan:(p,c,plan)=>{
   if(base.admitPlan?.(p,c,plan))return true;
   try{const s=getStore().get(p);if(!isDeepStrictEqual(s.context,c)||!s.replan.blockerId)return false;
    const event=getStore().getEvent(p,s.replan.blockerId) as BlockerUpdate;
    const exact=replacementForReport(s,event);return !!exact&&isDeepStrictEqual(exact,plan);
   }catch{return false;}
  }
 };
 function submit(p:Principal,input:unknown) {
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_REQUEST');
  const b=input as BlockerReport;
  if(Object.keys(b).sort().join(',')!=='expectedRevision,id,message,planRevision'||typeof b.id!=='string'||!/^developer:[A-Za-z0-9_-]{1,80}$/.test(b.id)||typeof b.message!=='string'||!b.message.trim()||b.message!==b.message.trim()||b.message.length>4000||![b.expectedRevision,b.planRevision].every(n=>Number.isSafeInteger(n)&&n>=0))return fail('INVALID_REQUEST');
  const store=getStore();
  let prior:BlockerUpdate|undefined;
  try{prior=store.getEvent(p,b.id) as BlockerUpdate;}catch(e){if((e as ActivationError).code!=='NOT_FOUND')throw e;}
  if(prior){if(prior.newInformation!==b.message||prior.expectedRevision!==b.expectedRevision||prior.planRevision!==b.planRevision)return fail('IDEMPOTENCY_CONFLICT');return store.blocker(p,prior);}
  const state=store.get(p);
  if(state.revision!==b.expectedRevision||state.planRevision!==b.planRevision)return fail('REVISION_CONFLICT');
  const record:EvidenceRecord={id:`report:${b.id}`,kind:'developer_report',claim:b.message,source:'Authenticated activation blocker report',sourceRevision:hash({id:b.id,expectedRevision:b.expectedRevision,planRevision:b.planRevision,message:b.message}),observedAt:new Date().toISOString(),scope:state.context.agreedGoal.text,producer:`principal:${JSON.stringify(p)}`,basisIds:[],proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}};
  const event:BlockerUpdate={contractVersion:'1.0.0',customerId:p.customerId,developerSessionId:p.sessionId,id:b.id,expectedRevision:b.expectedRevision,revision:b.expectedRevision+1,planRevision:b.planRevision,newInformation:b.message,evidence:[record],evidenceIds:[record.id],constraints:[...state.context.constraints],replan:{required:true,reason:'Attributed developer blocker requires bounded prerequisite review',preserveMilestoneIds:[state.milestone.id],invalidateActionIds:Object.keys(state.actions)},escalation:{required:true,owner:'Chris',reason:'Review the developer report and confirm authorized prerequisites'}};
  admitted={principal:structuredClone(p),record};
  try{return store.blocker(p,event);}finally{admitted=null;}
 }
 function progress(p:Principal,input:unknown) {
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_REQUEST');
  const b=input as BlockerReport&{needsChris:boolean};
  if(Object.keys(b).sort().join(',')!=='expectedRevision,id,message,needsChris,planRevision'||typeof b.id!=='string'||!/^progress:[A-Za-z0-9_-]{1,80}$/.test(b.id)||typeof b.message!=='string'||!b.message.trim()||b.message!==b.message.trim()||b.message.length>4000||typeof b.needsChris!=='boolean'||![b.expectedRevision,b.planRevision].every(n=>Number.isSafeInteger(n)&&n>=0))return fail('INVALID_REQUEST');
  const store=getStore();
  let prior:{planRevision:number;record:EvidenceRecord;needsChris:boolean}|undefined;
  try{prior=store.getEvent(p,b.id) as typeof prior;}catch(e){if((e as ActivationError).code!=='NOT_FOUND')throw e;}
  const digest=hash({id:b.id,expectedRevision:b.expectedRevision,planRevision:b.planRevision,message:b.message,needsChris:b.needsChris});
  if(prior){if(!prior.record||prior.record.sourceRevision!==digest)return fail('IDEMPOTENCY_CONFLICT');return store.reportDeveloperProgress(p,b.id,b.expectedRevision,b.planRevision,prior.record,b.needsChris);}
  const state=store.get(p);
  if(state.revision!==b.expectedRevision||state.planRevision!==b.planRevision)return fail('REVISION_CONFLICT');
  const record:EvidenceRecord={id:`report:${b.id}`,kind:'developer_report',claim:b.message,source:'Authenticated activation progress report',sourceRevision:digest,observedAt:new Date().toISOString(),scope:state.context.agreedGoal.text,producer:`principal:${JSON.stringify(p)}`,basisIds:[],proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}};
  admitted={principal:structuredClone(p),record};
  try{return store.reportDeveloperProgress(p,b.id,b.expectedRevision,b.planRevision,record,b.needsChris);}finally{admitted=null;}
 }
 return {policy,submit,progress,replacement:replacementForReport};
}
