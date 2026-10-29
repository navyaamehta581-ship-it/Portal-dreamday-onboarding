import type { ActivationState } from '../../../../contracts/activation/v1/state';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types';
import type { AnalysisJob, HandoffOverview, HandoffRecord, MilestoneDraft, ReviewDraft, SourceInput, SourceType, Workspace } from '../../../../contracts/activation/v1/handoff';

export class ActivationRequestError extends Error {
  /** Server details such as which review fields failed a check (labels and reason codes, never content). */
  constructor(public readonly code:string, public readonly status:number, public readonly details:unknown=null){super(code);this.name='ActivationRequestError';}
}

/** Separate client: the existing conversation StateResponse remains unchanged.
 * An empty token omits Authorization; the Portal session layer then supplies it server-side. With a persona,
 * each request names it so the session layer refuses requests after another tab signed in as someone else. */
export function activationClient(customerId:string,token:string,base='',apiPrefix='/api',persona?:string) {
  const root=`${base}${apiPrefix}/activation/v1/customers/${encodeURIComponent(customerId)}`;
  const headers=(json:boolean)=>({...(token?{Authorization:`Bearer ${token}`}:{}),...(persona?{'X-Portal-Persona':persona}:{}),...(json?{'Content-Type':'application/json'}:{})});
  async function request(route:string,body?:unknown):Promise<ActivationState> {
    const response=await fetch(root+route,{method:body===undefined?'GET':'POST',headers:headers(body!==undefined),...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(30000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new ActivationRequestError(data?.error?.code??'ACTIVATION_UNAVAILABLE',response.status);
    if(data?.contractVersion!=='1.0.0'||data.customerId!==customerId||!Number.isSafeInteger(data.revision)||data.context?.customerId!==customerId||data.plan?.customerId!==customerId||typeof data.developerSessionId!=='string'||!data.developerSessionId||!data.milestone||!data.chrisHelp||!data.actions||Array.isArray(data.actions)||!Array.isArray(data.evidence)||!data.replan||!data.outcome)throw new ActivationRequestError('INVALID_ACTIVATION_RESPONSE',response.status);
    return data as ActivationState;
  }
  // Operator-only handoff routes return handoff records rather than session state.
  // Model-assisted drafting can take minutes on a laptop; the session layer allows the same.
  async function call<T>(route:string,body?:unknown,timeout=60000):Promise<T> {
    const response=await fetch(root+route,{method:body===undefined?'GET':'POST',headers:headers(body!==undefined),...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(timeout)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new ActivationRequestError(data?.error?.code??'ACTIVATION_UNAVAILABLE',response.status,data?.error?.details??null);
    return data as T;
  }
  // On timeout retain the exact command ID/body; GET then retry the same body, never invent progress.
  return {
    handoffOverview:()=>call<HandoffOverview>('/handoff'),
    saveWorkspace:(expectedRevision:number,sources:SourceInput[])=>call<Workspace>('/handoff-workspace',{expectedRevision,sources}),
    // Analysis runs on the server; starting returns at once and the status is polled.
    startAnalysis:(workspaceRevision:number)=>call<{job:AnalysisJob;duplicate:boolean}>('/handoff-analyses',{workspaceRevision}),
    analysisStatus:()=>call<{job:AnalysisJob|null}>('/handoff-analyses'),
    saveReview:(draft:number,expectedRevision:number,review:ReviewDraft)=>call<HandoffRecord>('/handoff-reviews',{draft,expectedRevision,review}),
    submitReview:(draft:number,reviewRevision:number)=>call<HandoffRecord>('/handoff-submissions',{draft,reviewRevision,action:'submit',confirmed:true}),
    withdrawReview:(draft:number)=>call<HandoffRecord>('/handoff-submissions',{draft,action:'withdraw'}),
    publishReviewed:(draft:number,outcome:string,agreedBy:string)=>request('/handoff-publications',{draft,fromReview:true,outcome,agreedBy,agreementConfirmed:true}),
    draftHandoff:(sources:{type:SourceType;label:string;text:string}[])=>call<HandoffRecord>('/handoff-drafts',{sources},300000),
    publishHandoff:(body:{draft:number;milestones:MilestoneDraft[];outcome:string;agreedBy:string;agreementConfirmed:true})=>request('/handoff-publications',body),
    intake:(briefing:string,outcome:string,agreedBy:string,agreementConfirmed:boolean)=>request('/intake',{briefing,outcome,agreedBy,agreementConfirmed}),
    prepareGitHub:(command:{id:string;expectedRevision:number;planRevision:number;actionId:string;actionRevision:number})=>request('/github-preparations',command),
    acceptSetupProposal:(command:{id:string;expectedRevision:number;preparationId:string;artifactDigest:string;sourceCommit:string;planRevision:number;actionRevision:number;decision:'accept_proposal_only'})=>request('/setup-approvals',command),
    read:()=>request('/state'),
    reportProgress:(event:{id:string;expectedRevision:number;planRevision:number;message:string;needsChris:boolean})=>request('/progress-reports',event),
    reportBlocker:(event:{id:string;expectedRevision:number;planRevision:number;message:string})=>request('/blocker-reports',event),
    initialize:(context:CustomerContext,plan?:ActivationPlan)=>request('/state',{context,...(plan?{plan}:{})}),
    progress:(event:ProgressUpdate)=>request('/progress',event),
    blocker:(event:BlockerUpdate)=>request('/blockers',event)
  };
}