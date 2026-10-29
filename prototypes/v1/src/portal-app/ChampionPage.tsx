import {RefreshCw,Users} from 'lucide-react';
import type {activationClient} from '../activation/client';
import type {ActivationSession} from '../activation/useActivation';
import type {PortalAccount} from './session';
import {navigate} from './router';
import {loadProblem} from './onboarding/model';
import {DreamDay} from './dreamday/DreamDay';
import {useDreamDay} from './dreamday/useDreamDay';
import {CoordinationView} from './work/Coordination';
import {useOpportunities} from './adoption/useOpportunities';
import {AdoptionSummary,GoalsList,OpportunityCard,opportunityProblem} from './adoption/Panels';
import {Section} from '../review/Editors';
import type {MilestoneWorkSession} from './work/useMilestoneWork';
import type {RepositoryEvidenceSession} from './work/useRepositoryEvidence';

/** Team Coordination: Dream Day (an optional look at the plan Chris published) and the team overview. */
export function ChampionPage({session,account,api,work,tab}:{session:ActivationSession;account:PortalAccount;api:ReturnType<typeof activationClient>;work:MilestoneWorkSession;repos?:RepositoryEvidenceSession;tab:'dream-day'|'team'}){
 const dd=useDreamDay(api);
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Users size={16} aria-hidden="true"/></span>Team Coordination</h1></div>
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">Team Coordination — {account.label}</p><h2>{tab==='dream-day'?'Dream Day':'Team overview'}</h2><p className="pt-note" style={{marginTop:6}}>{tab==='dream-day'?'The onboarding plan Chris published for your team. Nothing here needs approving.':'Your goals, the improvements suggested for your team, and how adoption is going.'}</p></div></div>
   <div className="pt-tabs" role="tablist" aria-label="Team Coordination sections">{([['dream-day','Dream Day','/champion'],['team','Team overview','/champion/team']] as const).map(([id,label,to])=>
    <button key={id} role="tab" aria-selected={tab===id} aria-controls="champion-panel" onClick={()=>navigate(to)}>{label}</button>)}</div>
   <div className="pt-tabpanel" role="tabpanel" id="champion-panel">
    {tab==='dream-day'?<DreamDay dd={dd} customer={account.label}/>:<TeamOverview session={session} account={account} work={work} api={api}/>}
   </div>
  </div>
 </div>;
}

/** Maya's team overview of the published plan: the company goals and their progress, the improvements suggested for
 * the team (she prioritises them and recommends some to developers), adoption and engagement, then each milestone's
 * coordination on demand. No technical configuration: that stays with Spotify's solutions engineers. A plan published
 * by an earlier version of the Portal (with no recorded publisher) is shown as its milestones only. */
function TeamOverview({session,account,work,api}:{session:ActivationSession;account:PortalAccount;work:MilestoneWorkSession;api:ReturnType<typeof activationClient>}){
 const {state,busy,error}=session,h=state?.handoff;
 const o=useOpportunities(h?.approval?api:null,{adoption:true});
 return <div>
  {!state?<div className="pt-empty" role={error&&!busy?'alert':'status'}><div><h2>{busy||!error?'Loading your team’s onboarding…':loadProblem(error).title}</h2>{error&&!busy&&<p>{loadProblem(error).detail}</p>}</div></div>:
  !h?.approval?<div className="pt-entity"><div className="pt-banner warn" role="status" style={{marginTop:22}}>This onboarding was published by an earlier version of the Portal, so goals, opportunities and adoption aren’t available for it.</div>
   <section className="pt-card" aria-label="Proposed work" style={{marginTop:22}}><h3>Milestones</h3>
    {h?.milestones.length?<ol className="pt-milestones">{h.milestones.map(m=><li key={m.id}><span className="pt-pill">Milestone</span><div><strong>{m.objective}</strong>{m.completionCriteria.length>0&&<p>Done when: {m.completionCriteria.join(' · ')}</p>}</div></li>)}</ol>
     :<p className="pt-note">Chris hasn’t published any milestones for {account.label} yet.</p>}</section></div>:
  <div style={{display:'grid',gap:20,marginTop:22}}>
   <div className="pt-banner" role="status" style={{marginTop:0}}>Published by {h.approval.by} on {new Date(h.approval.at).toLocaleString()}. Developers see the plan and choose what to work on.</div>
   {o.error&&<div className="pt-banner error" role="alert" style={{marginTop:0}}>{opportunityProblem(o.error)}</div>}
   <section className="pt-card" aria-label="Company goals">
    <div className="pt-card-head"><h3>Company goals</h3><span className="pt-note" style={{marginTop:0}}>Set priorities to tell your team what matters most</span></div>
    {o.data?<GoalsList goals={o.data.goals} session={o} champion/>:<p className="pt-note" role="status">Loading…</p>}
   </section>
   <section className="pt-card" aria-label="Improvement opportunities">
    <div className="pt-card-head"><h3>Improvement opportunities</h3><span className="pt-note" style={{marginTop:0}}>Recommend the ones you want developers to see first</span></div>
    <p className="pt-note">Suggestions for your repositories, services, docs and workflows, from the onboarding plan and what the Portal observed. Each says what backs it. Developers choose what to pursue; nothing is assigned.</p>
    {o.data?(o.data.opportunities.length?<div className="pt-opportunities">{o.data.opportunities.map(x=><OpportunityCard key={x.id} o={x} mode="champion" session={o}/>)}</div>:<p className="pt-note">No suggestions yet.</p>):<p className="pt-note" role="status">Loading…</p>}
   </section>
   <section className="pt-card" aria-label="Developer engagement">
    <div className="pt-card-head"><h3>Adoption and developer engagement</h3><button className="pt-tool" disabled={o.loading} onClick={()=>void o.reload()}><RefreshCw size={15} aria-hidden="true"/>{o.loading?'Refreshing…':'Refresh'}</button></div>
    {o.adoption?<AdoptionSummary a={o.adoption}/>:<p className="pt-note" role="status">Loading…</p>}
   </section>
   <Section id="team-milestones" title="Milestone progress and discussion" count={work.progress?.milestones.length} summary="Who picked up which milestone, questions waiting for you, and reviews.">
    <CoordinationView work={work} mode="champion"/>
   </Section>
  </div>}
 </div>;
}
