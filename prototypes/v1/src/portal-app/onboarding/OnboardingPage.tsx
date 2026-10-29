import {Flag,RefreshCw} from 'lucide-react';
import type {ActivationSession} from '../../activation/useActivation';
import type {PortalAccount} from '../session';
import {navigate} from '../router';
import {loadProblem} from './model';
import {DeveloperOverview} from './DeveloperOverview';
import {GuideTab} from './GuideTab';
import {WorkTab} from '../work/WorkTab';
import type {MilestoneWorkSession} from '../work/useMilestoneWork';
import type {OpportunitiesSession} from '../adoption/useOpportunities';

export const TABS=[['overview','Overview'],['work','My milestones'],['guide','Guide']] as const;
export type Tab=typeof TABS[number][0];

/** The developer's onboarding, laid out like a Portal entity page (reference 047): what they can build or improve
 * (Overview), the milestones they chose (My milestones) and step-by-step guides (Guide). Repositories, wikis and
 * services are already connected by Spotify's team: nothing here asks for setup, uploads or reports. */
export function OnboardingPage({session,tab,account,work,opps}:{session:ActivationSession;tab:Tab;account:PortalAccount;work:MilestoneWorkSession;opps:OpportunitiesSession}){
 const {state,busy,error}=session;
 const approved=!!work.progress;
 const active=!approved&&!work.loading?'overview':tab;
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Flag size={16} aria-hidden="true"/></span>Onboarding</h1>
   <div className="tools"><button className="pt-tool" disabled={busy} onClick={()=>{void session.refresh();void work.reload();void opps.reload();}}><RefreshCw size={15} aria-hidden="true"/>{busy?'Refreshing…':'Refresh'}</button></div></div>
  {!state||!approved?<div className="pt-empty" role={error&&!busy?'alert':'status'}><div>
   <h2>{busy||work.loading?'Loading your onboarding…':error&&error!=='NOT_FOUND'?loadProblem(error).title:'Your team’s plan isn’t approved yet'}</h2>
   <p>{error&&error!=='NOT_FOUND'?loadProblem(error).detail:'When your Champion approves the plan in Dream Day, your team’s goals and what you can build or improve appear here.'}</p></div></div>:<div className="pt-entity">
   <div className="pt-entity-head">
    <div><p className="pt-crumb">Onboarding — {account.label}</p><h2>{opps.data?.goals[0]?.text??state.context.agreedGoal.text}</h2></div>
   </div>
   <div className="pt-tabs" role="tablist" aria-label="Onboarding sections">{TABS.map(([id,label])=><button key={id} role="tab" id={'tab-'+id} aria-selected={active===id} aria-controls="onboarding-panel" onClick={()=>navigate(id==='overview'?'/activation':'/activation/'+id)}>{label}</button>)}</div>
   <div className="pt-tabpanel" role="tabpanel" id="onboarding-panel" aria-labelledby={'tab-'+active}>
    {active==='overview'&&<DeveloperOverview opps={opps} work={work}/>}
    {active==='work'&&<WorkTab work={work}/>}
    {active==='guide'&&<GuideTab opps={opps}/>}
   </div>
  </div>}
 </div>;
}
