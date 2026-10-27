import type {ActivationState} from '../../../../../contracts/activation/v1/state';

export const STAGES=['Suggested','Prepared','Approved','Executed','Verified'] as const;
const KEYS=['suggested','prepared','approved','executed','verified'];

/** Lifecycle index of the current suggested action, from recorded backend state only. */
export function currentStage(state:ActivationState){
 const a=state.plan.suggestedNextAction,recorded=state.actions[a.id];
 return Math.max(0,KEYS.indexOf(recorded&&recorded.planRevision===state.planRevision?recorded.status:a.status));
}
export const stageIndex=(status:string)=>Math.max(0,KEYS.indexOf(status));

export const EVIDENCE_LABEL:Record<string,string>={github_observation:'Observed on GitHub',portal_simulated:'Portal simulation',customer_report:'Customer reported',developer_report:'Developer reported',ai_inference:'Inferred',action_record:'Action record',verified_outcome:'Technical verification'};
export const evidenceLabel=(kind:string)=>EVIDENCE_LABEL[kind]??kind;

export function milestoneTone(status:string){return status==='reached'?'green':status==='blocked'?'red':status==='in_progress'?'blue':'';}

export function loadProblem(code:string){
 switch(code){
  case 'NOT_FOUND':return {title:'Your onboarding hasn’t been published yet',detail:'Your Portal contact is still preparing the context for your team. Check back soon.'};
  case 'FORBIDDEN':return {title:'You don’t have access to this onboarding',detail:'Your account is not authorized for this customer’s context.'};
  case 'SIGN_IN_REQUIRED':return {title:'Your session has ended',detail:'Sign in again to continue.'};
  case 'ACCOUNT_UNAVAILABLE':case 'ACTIVATION_API_UNREACHABLE':return {title:'Onboarding is temporarily unavailable',detail:'The onboarding service could not be reached.'};
  default:return {title:'Something went wrong',detail:code.length<80?code:'Refresh and try again.'};
 }
}
export const isHttps=(value:string)=>{try{return new URL(value).protocol==='https:';}catch{return false;}};

/** Developer-facing wording for command failures; the code is kept for support. */
export function actionProblem(code:string){
 const known:Record<string,string>={
  FORBIDDEN:'This action isn’t authorized for your account in this environment. Nothing was changed.',
  OPERATOR_REQUIRED:'Only your Portal contact can do this.',
  ADAPTER_UNAVAILABLE:'This capability isn’t available in this environment. Nothing was changed.',
  CAPABILITY_UNAVAILABLE:'This capability isn’t available in this environment. Nothing was changed.',
  REPLAN_PENDING:'A revised plan is still being prepared. Try again once it’s ready.',
  INVALID_REQUEST:'The request was rejected as invalid. Refresh and try again.',
  SIGN_IN_REQUIRED:'Your session has ended. Sign in again.',
  ACTIVATION_API_UNREACHABLE:'The onboarding service could not be reached. Your draft is kept; try again.',
 };
 return known[code]?`${known[code]} (${code})`:code;
}
