import {useCallback,useEffect,useState} from 'react';
import type {TeamProgress} from '../../../../../contracts/activation/v1/handoff';
import {ActivationRequestError,type CoordinationChange,type MilestoneChange,type activationClient} from '../../activation/client';

export type WorkError={code:string;milestoneId:string|null;issues?:string[]};

/** Approved milestone work as the server shows it to this viewer. The server is the only source of statuses and
 * counts. Every change names the revision the viewer is looking at; on a conflict the latest work is reloaded
 * instead of overwriting someone else's change. */
export function useMilestoneWork(api:ReturnType<typeof activationClient>|null){
 const [progress,setProgress]=useState<TeamProgress|null>(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<WorkError|null>(null);
 const load=useCallback(async()=>{
  if(!api)return;setLoading(true);
  try{setProgress(await api.milestoneWork());setError(null);}
  catch(e){setProgress(null);setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE',milestoneId:null});}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{void load();},[load]);
 async function write(milestoneId:string,send:(revision:number)=>Promise<TeamProgress>){
  const m=progress?.milestones.find(x=>x.id===milestoneId);
  // Choosing a milestone works from its outline; every other change needs the viewer's own detail.
  const revision=m?.detail?.revision??m?.revision;
  if(!api||!m||revision===undefined||busy)return false;
  setBusy(milestoneId);setError(null);
  try{setProgress(await send(revision));return true;}
  catch(e){
   const code=e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE';
   setError({code,milestoneId,issues:e instanceof ActivationRequestError?(e.details as {issues?:string[]}|null)?.issues:undefined});
   if(code==='REVISION_CONFLICT')await api.milestoneWork().then(setProgress).catch(()=>undefined);
   return false;
  }finally{setBusy(null);}
 }
 return {progress,loading,busy,error,reload:load,
  update:(milestoneId:string,change:MilestoneChange)=>write(milestoneId,r=>api!.updateMilestone(milestoneId,r,change)),
  coordinate:(milestoneId:string,change:CoordinationChange)=>write(milestoneId,r=>api!.coordinateMilestone(milestoneId,r,change))};
}
export type MilestoneWorkSession=ReturnType<typeof useMilestoneWork>;

export const STATUS_LABEL={not_started:'Not started',in_progress:'In progress',blocked:'Blocked',ready_for_review:'Ready for review',completed:'Completed'} as const;
export const statusTone=(s:keyof typeof STATUS_LABEL)=>s==='completed'?'green':s==='blocked'?'red':s==='ready_for_review'?'blue':s==='in_progress'?'amber':'';
export const REVIEW_LABEL={none:'',awaiting_review:'Awaiting Champion review',reviewed:'Reviewed',reviewed_outdated:'Changed since review'} as const;
const ISSUE:Record<string,string>={actions_incomplete:'every action is completed',open_blockers:'open blockers are resolved',dependencies_incomplete:'the work it depends on is completed by its owner'};
/** Plain-language messages for the server's codes; no server text is shown. */
export function workProblem(e:WorkError):string{
 switch(e.code){
  case 'NO_APPROVED_PLAN':return 'Nothing to work on yet. Work opens when your Champion approves the team’s plan in Dream Day.';
  case 'NOT_ASSIGNEE':return 'This milestone is assigned to someone else, so you can’t change it.';
  case 'DEVELOPER_IDENTITY_REQUIRED':return 'Your sign-in isn’t linked to your own developer credential, so you can see your work but not update it. Ask your Portal admin to set one up.';
  case 'CHAMPION_REQUIRED':return 'Only your team’s Champion can coordinate and review milestones.';
  case 'REVISION_CONFLICT':return 'This milestone changed since you opened it. The latest version is shown now; make your change again.';
  case 'MILESTONE_NOT_READY':return `Not yet: this can be marked once ${(e.issues??[]).map(i=>ISSUE[i]??i).join(', and ')||'it is ready'}.`;
  case 'REVIEW_NOT_READY':return 'This milestone can be reviewed once its developer marks it ready for review.';
  case 'ALREADY_REVIEWED':return 'You already reviewed this version of the milestone.';
  case 'INVALID_EVIDENCE_REFERENCE':return 'An evidence reference is one link or identifier without spaces (for example a pull request URL or a commit SHA), up to 300 characters.';
  case 'INVALID_REQUEST':return 'Check what you entered: a note needs 3 to 1000 characters.';
  case 'NOT_FOUND':return 'That item no longer exists. Refresh to see the latest work.';
  case 'FORBIDDEN':return 'You don’t have access to this customer’s work.';
  case 'SIGN_IN_REQUIRED':return 'Your session ended. Sign in again.';
  default:return 'Your work couldn’t be loaded or saved. Check that the demo API is running, then try again.';
 }
}
