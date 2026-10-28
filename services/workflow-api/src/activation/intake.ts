import {customerSignals} from './customer-signals.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import capabilities from './capabilities.json' with {type:'json'};
import { validateInterpretation } from './interpretation/schema.mjs';
import { validateContract } from '../../../../contracts/activation/v1/validate.mjs';
import { ActivationError, type Principal, type Policy } from './store.ts';
import type { CustomerContext, ActivationPlan, EvidenceRecord } from '../../../../contracts/activation/v1/types.ts';
/** Ephemeral exact admission for server-built intake only. Saved state needs no re-admission. */
export function createIntake(base:Policy, interpret?:(input:unknown)=>Promise<unknown>) {
 const pending=new Map<string,{p:Principal;context:CustomerContext;plan:ActivationPlan}>();
 const entry=(p:Principal)=>pending.get(JSON.stringify(p));
 const policy:Policy={
  admitContext:(p,c)=>isDeepStrictEqual(entry(p)?.context,c)||!!base.admitContext?.(p,c),
  admitPlan:(p,c,a)=>(isDeepStrictEqual(entry(p)?.context,c)&&isDeepStrictEqual(entry(p)?.plan,a))||!!base.admitPlan?.(p,c,a),
  admit:(p,e,purpose)=>!!entry(p)?.plan.evidence.some(x=>isDeepStrictEqual(x,e))||base.admit(p,e,purpose)
 };
 async function prepare(p:Principal,input:unknown) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ActivationError('INVALID_REQUEST');
  const b=input as Record<string,unknown>;
  const simulated=b.agreementMode==='simulated';
  if(Object.keys(b).some(k=>!['agreedBy','agreementConfirmed','briefing','outcome','agreementMode','developerMessage'].includes(k))||(b.agreementMode!==undefined&&!['simulated','reported'].includes(b.agreementMode as string))||(simulated?b.agreementConfirmed!==false:b.agreementConfirmed!==true)||(b.developerMessage!==undefined&&(typeof b.developerMessage!=='string'||b.developerMessage.length>4000))||!['briefing','outcome','agreedBy'].every(k=>typeof b[k]==='string'&&(b[k] as string).trim().length>0&&(b[k] as string).length<=(k==='briefing'?6000:k==='outcome'?1000:200)))throw new ActivationError('INVALID_REQUEST');
  const briefing=(b.briefing as string).trim(),outcome=(b.outcome as string).trim(),at=new Date().toISOString(),id=randomUUID();
  const proof={type:'none' as const,actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked' as const};
  const source=simulated?'Simulated local demonstration intake':'Chris activation intake';
  const record=(suffix:string,kind:EvidenceRecord['kind'],claim:string,basisIds:string[]=[]):EvidenceRecord=>({id:`${id}-${suffix}`,kind,claim,source,observedAt:at,sourceRevision:id,scope:outcome,producer:'authenticated local intake operator',basisIds,proof});
  const report=record('brief',simulated?'portal_simulated':'customer_report',briefing),agreement=record('agreement',simulated?'portal_simulated':'customer_report',simulated?`Agreement status: Simulated for local demonstration. Participants: ${b.agreedBy}. Real-world approval: Not obtained or verified. Proposed outcome: ${outcome}`:`Chris reports agreement by ${b.agreedBy}: ${outcome}`);
  const developer=typeof b.developerMessage==='string'&&b.developerMessage.trim()?record('developer',simulated?'portal_simulated':'developer_report',b.developerMessage.trim()):null;
  const messages=[{id:'briefing',role:'user',content:briefing},{id:'outcome',role:'user',content:outcome} ,...(developer?[{id:'developer',role:'user',content:developer.claim}]:[])],state={messages,constraints:[]};
  let modelNeedsClarification=false;
  let intent='unclassified',mode='deterministic fallback: provider unavailable or invalid';
  try{if(interpret){const result=await interpret({state});validateInterpretation(result,state);const parsed=result as {intent:string;ambiguous:boolean;missingInformation:{source:string;blocksNextDecision:boolean}[]};intent=parsed.intent;modelNeedsClarification=parsed.ambiguous||parsed.missingInformation.some(m=>m.source==='developer'&&m.blocksNextDecision);mode='validated hosted interpretation + bounded deterministic plan';}}catch{/* No provider output becomes authority. */}
  const signals=customerSignals(briefing);
  const missing=briefing.length<40||modelNeedsClarification;
  const combined=briefing+' '+(developer?.claim??'');
  const creation=intent==='creation'||/new (?:backend |recommendation )?service|create.{0,35}service/i.test(combined);
  if(intent==='unclassified'&&creation)intent='creation';
  const troubleshooting=intent==='troubleshooting'||/fail|broken|incident|error|outage/i.test(briefing);
  const catalogId=creation?'docs':troubleshooting?'ci':/onboard|existing|legacy/i.test(briefing)?'onboard':/node\.?js/i.test(briefing)?'node':'docs';
  const cap=capabilities.find(c=>c.id===catalogId)!;
  const task=creation?'Inspect available Scaffolder templates and documented prerequisites; when access cannot be verified, prepare a template-readiness checklist without choosing a runtime or template':missing?'Clarify the service or workflow in the pasted briefing':troubleshooting?'Prepare a read-only failure investigation checklist':signals.reported.some(s=>s.label==='Backstage familiarity or migration')?'Review the reported Backstage starting point and map only the workflows needed for the agreed outcome; ask a solutions engineer about unresolved configuration':signals.reported.some(s=>s.label==='Identity and SSO')?'Review the reported SSO and access prerequisites for the agreed outcome with the technical owner; do not assume identity configuration is working':`Prepare a review checklist for ${cap.title}`;
  const inference=record('reason','ai_inference',`${mode}; interpreted intent ${intent}; candidate catalog capability ${cap.id} is representative only. No Portal access or execution established.`,[report.id,agreement.id,...(developer?[developer.id]:[])]);
  const evidence=[report,agreement,...(developer?[developer]:[]),inference];
  const context:CustomerContext={contractVersion:'1.0.0',customerId:p.customerId,revision:0,evidence:[report,agreement,...(developer?[developer]:[])],briefing,briefingEvidenceIds:[report.id],agreedGoal:{text:outcome,agreedBy:simulated?`SIMULATED — no real-world approval: ${b.agreedBy}`:b.agreedBy as string,agreedAt:at,evidenceIds:[agreement.id]},unknowns:[...signals.unknowns,...(creation?['Approved runtime','Available Scaffolder templates and documented prerequisites','Repository permissions','Approval requirements','Deployment configuration']:[]),...(missing?['Service/workflow identity and concrete starting context']:[]),'Portal permissions and installed capabilities','Repository state and independently observed results'],constraints:[...signals.reported.map(s=>`Reported ${s.label}: ${s.quote}`),...(simulated?['Simulated local demonstration; outcome proposed; no actual Chris or customer approval']:[]),'Planning only; no external writes or execution','Pasted briefing is an attributed report, not verified technical evidence']};
  const plan:ActivationPlan={contractVersion:'1.0.0',customerId:p.customerId,revision:0,contextRevision:0,supersedesRevision:null,planner:'demo_backend_adapter',evidence,selectedMilestone:{id:'first-review',outcome:`Review a bounded first step toward: ${outcome}`,successCriteria:['Developer reviews the checklist against the original briefing','Prerequisites and evidence gaps are explicit'],evidenceIds:[agreement.id]},prerequisites:context.unknowns.map(description=>({description,state:'unknown',evidenceIds:[report.id]})),capabilities:[{id:cap.id,availability:'representative',evidenceIds:[inference.id]}],rationale:`${task}. Basis: ${simulated?'simulated briefing and proposed demo outcome; no real approval':'Chris’s pasted briefing and separately reported agreement'}. ${mode}. All briefing constraints remain in the original text for review.`,suggestedNextAction:{id:'prepare-first-review',revision:0,kind:'prepare_artifact',description:`${task}. Use this briefing: ${briefing.slice(0,350)}. Target: ${outcome.slice(0,250)}. Review original constraints before preparing any artifact.`,capabilityId:cap.id,status:'suggested',evidenceIds:[report.id,agreement.id,inference.id]},blockerIds:[]};
  validateContract('ActivationPlan',plan);
  // Preview only: frozen CustomerContext requires real reported agreement.
  // Never grant admission to a simulated context or proposed outcome.
  if(simulated)return {context,plan};
  validateContract('CustomerContext',context);
  pending.set(JSON.stringify(p),{p,context,plan});return {context,plan};
 }
 // Server-built handoff publications are staged for exact admission the same way.
 return {policy,prepare,stage:(p:Principal,context:CustomerContext,plan:ActivationPlan)=>{pending.set(JSON.stringify(p),{p,context,plan});},release:(p:Principal)=>pending.delete(JSON.stringify(p))};
}
