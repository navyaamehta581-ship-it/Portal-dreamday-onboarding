import type { ActivationState } from '../../../../contracts/activation/v1/state';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types';
import type { AikaCapability, AikaCapabilityId, AikaJob, AnalysisJob, Insights, ChampionReview, RepositoryEvidence, RepositoryInspection, TeamProgress, HandoffOverview, HandoffRecord, MilestoneDraft, ReviewDraft, ReviewItem, ReviewMilestone, SourceInput, SourceType, Workspace } from '../../../../contracts/activation/v1/handoff';

/** One change per request, as the server accepts it. */
export type MilestoneChange={action:{index:number;status:'not_started'|'started'|'blocked'|'completed'}}|{note:{kind:'update'|'blocker'|'question'|'response';text:string;evidence?:string|null;replyTo?:string}}|{resolve:string}|{status:'in_progress'|'ready_for_review'|'completed'};

/** The Champion's coordination: one change per request, as the server accepts it. */
export type CoordinationChange={note:{text:string}}|{followUp:{text:string}}|{respond:{to:string;text:string;resolve?:boolean}}|{review:{decision:'reviewed';note?:string|null}};

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
    // Dream Day: the Champion's review. The server builds the view and decides who may act.
    championReview:()=>call<ChampionReview>('/champion-review'),
    saveChampionReview:(draft:number,expectedRevision:number,plan:{goals:ReviewItem[];milestones:ReviewMilestone[];questions:ReviewItem[]})=>call<ChampionReview>('/champion-reviews',{draft,expectedRevision,plan}),
    requestChanges:(draft:number,reviewRevision:number,comment:string)=>call<ChampionReview>('/champion-decisions',{draft,reviewRevision,decision:'request_changes',comment}),
    approvePlan:(draft:number,reviewRevision:number)=>call<ChampionReview>('/champion-decisions',{draft,reviewRevision,decision:'approve',confirmed:true}),
    // Phase 5: each developer's attributed work on approved milestones; the server derives who they are.
    milestoneWork:()=>call<TeamProgress>('/milestone-work'),
    updateMilestone:(milestoneId:string,expectedRevision:number,change:MilestoneChange)=>call<TeamProgress>('/milestone-updates',{milestoneId,expectedRevision,...change}),
    coordinateMilestone:(milestoneId:string,expectedRevision:number,change:CoordinationChange)=>call<TeamProgress>('/milestone-coordination',{milestoneId,expectedRevision,...change}),
    // Phase 7: read-only repository evidence for configured repositories; requests name a configured id only.
    repositoryEvidence:()=>call<RepositoryEvidence>('/repository-evidence'),
    inspectRepository:(repositoryId:string)=>call<{inspection:RepositoryInspection;reused:boolean;evidence:RepositoryEvidence}>('/repository-inspections',{repositoryId}),
    // AiKA runs in the background on the server; asking returns at once and the answer is polled.
    askAika:(question:string,milestoneId?:string|null,capabilities?:AikaCapabilityId[])=>call<{job:AikaJob;duplicate:boolean}>('/aika-questions',{question,...(milestoneId?{milestoneId}:{}),...(capabilities?.length?{capabilities}:{})}),
    // Insights: progress computed on the server from stored records.
    insights:()=>call<Insights>('/insights'),
    // Slash-command capabilities this person may use; decided on the server.
    aikaCapabilities:()=>call<{capabilities:AikaCapability[];modelConfigured:boolean}>('/aika-capabilities'),
    aikaStatus:()=>call<{job:AikaJob|null}>('/aika-questions'),
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