import {useEffect,useRef,useState} from 'react';
import type {activationClient} from './client';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {CustomerContext,ActivationPlan,BlockerUpdate,ProgressUpdate} from '../../../../contracts/activation/v1/types';

export type ActivationApi=ReturnType<typeof activationClient>;
export type Packet=NonNullable<ActivationState['githubPreparations']>[string];
type Report={id:string;expectedRevision:number;planRevision:number;message:string};
type ProgressReport=Report&{needsChris:boolean};
type GitHubCommand=Parameters<ActivationApi['prepareGitHub']>[0];
type ApprovalCommand=Parameters<ActivationApi['acceptSetupProposal']>[0];

const directionKey=(s:ActivationState)=>`portal-direction:${s.customerId}:${s.developerSessionId}:${s.planRevision}`;

export function describeError(e:unknown){
 // A different persona signed in elsewhere is not a revision conflict: the page must stop, not retry.
 if(e instanceof Error&&e.message==='PERSONA_CHANGED')return 'PERSONA_CHANGED';
 if(typeof e==='object'&&e!==null&&'status' in e&&(e as {status:number}).status===409)return 'This session changed elsewhere. Your draft is still here; refresh the saved session before retrying. If the command was rejected as stale, copy your text, clear the draft, and review a new submission against the refreshed plan. Exact retries never silently adopt a newer revision.';
 if(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name))return 'The request timed out. Your draft is preserved. Refresh canonical state, then retry the exact submission.';
 return e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE';
}

/** Presentation-free activation session: exact-retry drafts, polling and canonical state.
 * `scope` identifies customer + credential; changing it discards every draft and loaded state. */
export function useActivation(api:ActivationApi|null,scope:string){
 const [state,setState]=useState<ActivationState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [blockerDraft,setBlockerDraft]=useState<Report|null>(null),[blockerAccepted,setBlockerAccepted]=useState(false);
 const [progressDraft,setProgressDraft]=useState<ProgressReport|null>(null),[progressAccepted,setProgressAccepted]=useState(false);
 const [reviewedBlocker,setReviewedBlocker]=useState<BlockerUpdate|null>(null),[reviewedBlockerAccepted,setReviewedBlockerAccepted]=useState(false);
 const [reviewedProgress,setReviewedProgress]=useState<ProgressUpdate|null>(null),[reviewedProgressAccepted,setReviewedProgressAccepted]=useState(false);
 const [githubDraft,setGithubDraft]=useState<GitHubCommand|null>(null),[approvalDraft,setApprovalDraft]=useState<ApprovalCommand|null>(null);
 const [directionAccepted,setDirectionAccepted]=useState(false),[reportedThisPlan,setReportedThisPlan]=useState(false);
 const inFlight=useRef(false);

 function reset(){setState(null);setError('');setBlockerDraft(null);setBlockerAccepted(false);setProgressDraft(null);setProgressAccepted(false);setReviewedBlocker(null);setReviewedBlockerAccepted(false);setReviewedProgress(null);setReviewedProgressAccepted(false);setGithubDraft(null);setApprovalDraft(null);setDirectionAccepted(false);setReportedThisPlan(false);}
 useEffect(reset,[scope]);
 useEffect(()=>{let saved=false;try{saved=!!state&&sessionStorage.getItem(directionKey(state))==='1';}catch{/* storage unavailable */}setDirectionAccepted(saved);setProgressAccepted(false);setReportedThisPlan(false);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[state?.planRevision,state?.developerSessionId,state?.customerId]);

 async function run(work:(api:ActivationApi)=>Promise<ActivationState>,onSuccess?:()=>void){
  if(!api||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{setState(await work(api));onSuccess?.();}
  catch(e){setError(describeError(e));}
  finally{inFlight.current=false;setBusy(false);}
 }
 // Poll only while server-side recovery is pending; the canonical GET is the source of truth.
 useEffect(()=>{
  if(!api||!state||!['pending','failed'].includes(state.replan.status))return;
  const timer=window.setInterval(()=>{void run(a=>a.read());},5000);
  return()=>window.clearInterval(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[state?.replan.status,api,scope]);

 const refresh=()=>run(a=>a.read());
 return {state,error,setError,busy,ready:!!api&&!busy,refresh,
  // Existing gate: an accepted direction or a submitted report for the current plan.
  teamUnlocked:directionAccepted||reportedThisPlan,
  intake:(briefing:string,outcome:string,agreedBy:string,confirmed:boolean)=>run(a=>a.intake(briefing,outcome,agreedBy,confirmed)),
  initialize:(json:string)=>{let body:{context:CustomerContext;plan?:ActivationPlan};try{body=JSON.parse(json);}catch{setError('Initialization must be valid JSON.');return Promise.resolve();}return run(a=>a.initialize(body.context,body.plan));},
  blockerReport:{draft:blockerDraft,accepted:blockerAccepted,
   submit(message:string){if(!state)return Promise.resolve();const draft=blockerDraft??{id:'developer:'+crypto.randomUUID(),expectedRevision:state.revision,planRevision:state.planRevision,message:message.trim()};setBlockerDraft(draft);return run(a=>a.reportBlocker(draft),()=>setBlockerAccepted(true));},
   clear(){setBlockerDraft(null);setBlockerAccepted(false);}},
  progressReport:{draft:progressDraft,accepted:progressAccepted,
   submit(message:string,needsChris:boolean){if(!state)return Promise.resolve();const draft=progressDraft??{id:'progress:'+crypto.randomUUID(),expectedRevision:state.revision,planRevision:state.planRevision,message:message.trim(),needsChris};setProgressDraft(draft);return run(a=>a.reportProgress(draft),()=>{setProgressAccepted(true);setReportedThisPlan(true);});},
   clear(){setProgressDraft(null);setProgressAccepted(false);}},
  direction:{accepted:directionAccepted,
   // A local decision only (no server record): it selects a proposed direction and completes nothing.
   accept(){if(!state)return;setDirectionAccepted(true);try{sessionStorage.setItem(directionKey(state),'1');}catch{/* storage unavailable */}}},
  reviewedBlocker:{pending:reviewedBlocker,accepted:reviewedBlockerAccepted,
   submit(json:string){if(!state)return Promise.resolve();let command=reviewedBlocker;
    try{if(!command){const c=JSON.parse(json) as BlockerUpdate;if(c.customerId!==state.customerId||c.developerSessionId!==state.developerSessionId||c.expectedRevision!==state.revision||c.planRevision!==state.planRevision)throw Error('STALE_BLOCKER');command=c;setReviewedBlocker(c);}}
    catch{setError('The reviewed command is invalid or belongs to a different customer, session, or revision. Refresh and request a new reviewed command.');return Promise.resolve();}
    const exact=command;return run(a=>a.blocker(exact),()=>setReviewedBlockerAccepted(true));},
   clear(){setReviewedBlocker(null);setReviewedBlockerAccepted(false);}},
  reviewedProgress:{pending:reviewedProgress,accepted:reviewedProgressAccepted,
   submit(json:string){if(!state)return Promise.resolve();let command=reviewedProgress;
    try{if(!command){const c=JSON.parse(json) as ProgressUpdate;if(c.customerId!==state.customerId||c.developerSessionId!==state.developerSessionId||c.expectedRevision!==state.revision||c.planRevision!==state.planRevision||c.milestoneId!==state.milestone.id)throw Error('STALE_PROGRESS');command=c;setReviewedProgress(c);}}
    catch{setError('The reviewed progress command is invalid or belongs to a different customer, session, milestone, or revision. Refresh and request a new reviewed command.');return Promise.resolve();}
    const exact=command;return run(a=>a.progress(exact),()=>setReviewedProgressAccepted(true));},
   clear(){setReviewedProgress(null);setReviewedProgressAccepted(false);}},
  github:{draft:githubDraft,
   prepare(resume?:Packet){if(!state)return Promise.resolve();const action=state.plan.suggestedNextAction;
    const draft=resume?{id:resume.id,expectedRevision:resume.startedRevision-1,planRevision:resume.planRevision,actionId:resume.actionId,actionRevision:resume.actionRevision}:githubDraft??{id:'prepare:'+crypto.randomUUID(),expectedRevision:state.revision,planRevision:state.planRevision,actionId:action.id,actionRevision:action.revision};
    setGithubDraft(draft);return run(a=>a.prepareGitHub(draft));},
   clear(){setGithubDraft(null);}},
  approval:{draft:approvalDraft,
   accept(packet:Packet){if(!state||!packet.artifactDigest)return Promise.resolve();
    const draft=approvalDraft??{id:'approval:'+crypto.randomUUID(),expectedRevision:state.revision,preparationId:packet.id,artifactDigest:packet.artifactDigest,sourceCommit:packet.commit,planRevision:packet.planRevision,actionRevision:packet.actionRevision,decision:'accept_proposal_only' as const};
    setApprovalDraft(draft);return run(a=>a.acceptSetupProposal(draft));},
   clear(){setApprovalDraft(null);}},
 };
}
export type ActivationSession=ReturnType<typeof useActivation>;
