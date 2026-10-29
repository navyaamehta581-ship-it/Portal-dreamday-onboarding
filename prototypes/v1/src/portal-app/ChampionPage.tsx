import {CircleCheck,Users} from 'lucide-react';
import type {activationClient} from '../activation/client';
import type {ActivationSession} from '../activation/useActivation';
import type {PortalAccount} from './session';
import {Link,navigate} from './router';
import {loadProblem} from './onboarding/model';
import {DreamDay} from './dreamday/DreamDay';
import {useDreamDay} from './dreamday/useDreamDay';

/** Team Coordination: Dream Day (review and approve Chris's plan) and the team overview of the published plan. */
export function ChampionPage({session,account,api,tab}:{session:ActivationSession;account:PortalAccount;api:ReturnType<typeof activationClient>;tab:'dream-day'|'team'}){
 // After a decision the onboarding state may change (approval publishes), so refresh it too.
 const dd=useDreamDay(api,()=>void session.refresh());
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Users size={16} aria-hidden="true"/></span>Team Coordination</h1></div>
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">Team Coordination — {account.label}</p><h2>{tab==='dream-day'?'Dream Day':'Team overview'}</h2><p className="pt-note" style={{marginTop:6}}>{tab==='dream-day'?'Review, refine and approve your team’s technical onboarding plan.':'Who is doing what in the published plan.'}</p></div></div>
   <div className="pt-tabs" role="tablist" aria-label="Team Coordination sections">{([['dream-day','Dream Day','/champion'],['team','Team overview','/champion/team']] as const).map(([id,label,to])=>
    <button key={id} role="tab" aria-selected={tab===id} aria-controls="champion-panel" onClick={()=>navigate(to)}>{label}</button>)}</div>
   <div className="pt-tabpanel" role="tabpanel" id="champion-panel">
    {tab==='dream-day'?<DreamDay dd={dd} customer={account.label}/>:<TeamOverview session={session} account={account}/>}
   </div>
  </div>
 </div>;
}

/** Maya's coordination view: who is on the technical team and which work Chris published, as proposals.
 * Approving work and assignments is a later phase, so nothing here can approve, and nothing is shown as approved
 * unless the server says so. Assignees stay hidden until approved (developer-safe projection on the server). */
function TeamOverview({session,account}:{session:ActivationSession;account:PortalAccount}){
 const {state,busy,error}=session,h=state?.handoff;
 return <div>
  {!state?<div className="pt-empty" role={error&&!busy?'alert':'status'}><div><h2>{busy||!error?'Loading your team’s onboarding…':loadProblem(error).title}</h2>{error&&!busy&&<p>{loadProblem(error).detail}</p>}</div></div>:
  <div className="pt-entity">
   <p style={{marginTop:6,fontWeight:700}}>{state.context.agreedGoal.text}</p>
   {h?.approval?<div className="pt-banner" role="status" style={{marginTop:22}}>Approved by {h.approval.by} in Dream Day on {new Date(h.approval.at).toLocaleString()}. Each developer sees the work assigned to them.</div>
    :<div className="pt-banner warn" role="status" style={{marginTop:22}}>This onboarding was published before Dream Day. Nothing here has been approved; plans are reviewed and approved in Dream Day.</div>}
   <div style={{display:'grid',gap:20,marginTop:22}}>
    <section className="pt-card" aria-label="Technical team">
     <h3>Technical team</h3>
     {h?.team?.length?<ul style={{listStyle:'none',padding:0,margin:'4px 0 0'}}>{h.team.map(p=><li key={p.name} style={{marginTop:12}}><strong>{p.name}</strong> — {p.role} <span className={'pt-pill'+(p.status==='reported'?' green':'')}>{p.status==='reported'?'Named in sources':'Inferred'}</span></li>)}</ul>
      :<p className="pt-note">No technical team has been published for {account.label} yet.</p>}
    </section>
    <section className="pt-card" aria-label="Proposed work">
     <h3>{h?.approval?'Approved work':'Proposed work'}</h3>
     {h?.milestones.length?<ol className="pt-milestones">{h.milestones.map(m=><li key={m.id}>
      <span className={'pt-pill'+(m.assignmentStatus==='approved'?' green':'')}>{m.assignmentStatus==='approved'?'Approved':'Proposed — not approved'}</span>
      <div><strong>{m.objective}</strong>
       <p>{[m.system.service,m.system.repository].filter(Boolean).join(' · ')||'System not confirmed'}{m.recommendedRole&&m.recommendedRole!=='unassigned'?` · Suggested role: ${m.recommendedRole.replace('_',' ')}`:''}</p>
       <p>Assignee: {m.assignmentStatus==='approved'&&m.proposedAssignee?m.proposedAssignee:'not shown until the assignment is approved'}</p>
       {m.completionCriteria.length>0&&<p>Done when: {m.completionCriteria.join(' · ')}</p>}
      </div></li>)}</ol>
      :<p className="pt-note">Chris hasn’t published any milestones for {account.label} yet.</p>}
    </section>
    <section className="pt-card" aria-label="Bring your team along">
     <h3>Bring your team along</h3>
     <p className="pt-note">{session.teamUnlocked?'Suggested roles and a kickoff message you can edit and copy are in the Team tab.':'The Team tab with suggested roles and a kickoff message opens once your team accepts its onboarding direction or shares an update.'}</p>
     {session.teamUnlocked&&<Link className="pt-btn sm" style={{marginTop:16}} to="/activation/team"><CircleCheck size={15} aria-hidden="true"/>Open Team tab</Link>}
    </section>
   </div>
  </div>}
 </div>;
}
