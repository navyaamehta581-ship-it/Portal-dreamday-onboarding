import {Flag,RefreshCw} from 'lucide-react';
import type {ActivationSession} from '../../activation/useActivation';
import type {PortalAccount} from '../session';
import {navigate} from '../router';
import {actionProblem,loadProblem,milestoneTone} from './model';
import {OverviewTab} from './OverviewTab';
import {GuideTab} from './GuideTab';
import {RepositoryTab} from './RepositoryTab';
import {EvidenceTab} from './EvidenceTab';
import {TeamTab} from './TeamTab';
import {WorkTab} from '../work/WorkTab';
import type {MilestoneWorkSession} from '../work/useMilestoneWork';

export const TABS=[['overview','Overview'],['work','My work'],['guide','Guide'],['repository','Repository'],['evidence','Evidence'],['team','Team']] as const;
export type Tab=typeof TABS[number][0];

/** Customer-specific onboarding, laid out like a Portal entity page (reference 047). */
export function OnboardingPage({session,tab,account,work}:{session:ActivationSession;tab:Tab;account:PortalAccount;work:MilestoneWorkSession}){
 const {state,busy,error}=session;
 const teamOpen=session.teamUnlocked;
 // “My work” appears once the team's plan is approved in Dream Day.
 const tabs=TABS.filter(([id])=>(id!=='team'||teamOpen)&&(id!=='work'||!!work.progress));
 const active=(tab==='team'&&!teamOpen)||(tab==='work'&&!work.progress&&!work.loading)?'overview':tab;
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Flag size={16} aria-hidden="true"/></span>Onboarding</h1>
   <div className="tools"><button className="pt-tool" disabled={busy} onClick={()=>{void session.refresh();void work.reload();}}><RefreshCw size={15} aria-hidden="true"/>{busy?'Refreshing…':'Refresh'}</button></div></div>
  {!state?<div className="pt-empty" role={error&&!busy?'alert':'status'}><div><h2>{busy||!error?'Loading your onboarding…':loadProblem(error).title}</h2>{error&&!busy&&<p>{loadProblem(error).detail}</p>}</div></div>:<div className="pt-entity">
   <div className="pt-entity-head">
    <div><p className="pt-crumb">Onboarding — {account.label}</p><h2>{state.context.agreedGoal.text}</h2></div>
    <div className="pt-meta"><div>Milestone<span><span className={'pt-pill '+milestoneTone(state.milestone.status)}>{state.milestone.status.replace('_',' ')}</span></span></div></div>
   </div>
   {error&&<div className="pt-banner error" role="alert">{actionProblem(error)}</div>}
   {state.replan.status==='pending'&&<div className="pt-banner warn" role="status">Your blocker was recorded. Your next step is being updated.</div>}
   {state.replan.status==='failed'&&<div className="pt-banner error" role="status">Your next step couldn’t be updated automatically. Chris has been asked to help.</div>}
   <div className="pt-tabs" role="tablist" aria-label="Onboarding sections">{tabs.map(([id,label])=><button key={id} role="tab" id={'tab-'+id} aria-selected={active===id} aria-controls="onboarding-panel" onClick={()=>navigate(id==='overview'?'/activation':'/activation/'+id)}>{label}</button>)}</div>
   <div className="pt-tabpanel" role="tabpanel" id="onboarding-panel" aria-labelledby={'tab-'+active}>
    {active==='overview'&&<OverviewTab session={session}/>}
    {active==='work'&&<WorkTab work={work}/>}
    {active==='guide'&&<GuideTab session={session} account={account}/>}
    {active==='repository'&&<RepositoryTab session={session}/>}
    {active==='evidence'&&<EvidenceTab state={state}/>}
    {active==='team'&&<TeamTab key={state.customerId+state.developerSessionId+':'+state.revision} state={state}/>}
   </div>
  </div>}
 </div>;
}
