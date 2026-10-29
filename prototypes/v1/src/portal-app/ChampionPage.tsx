import {CircleCheck,Users} from 'lucide-react';
import type {ActivationSession} from '../activation/useActivation';
import type {PortalAccount} from './session';
import {Link} from './router';
import {loadProblem} from './onboarding/model';

/** Maya's coordination view: who is on the technical team and which work Chris published, as proposals.
 * Approving work and assignments is a later phase, so nothing here can approve, and nothing is shown as approved
 * unless the server says so. Assignees stay hidden until approved (developer-safe projection on the server). */
export function ChampionPage({session,account}:{session:ActivationSession;account:PortalAccount}){
 const {state,busy,error}=session,h=state?.handoff;
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><Users size={16} aria-hidden="true"/></span>Team Coordination</h1></div>
  {!state?<div className="pt-empty" role={error&&!busy?'alert':'status'}><div><h2>{busy||!error?'Loading your team’s onboarding…':loadProblem(error).title}</h2>{error&&!busy&&<p>{loadProblem(error).detail}</p>}</div></div>:
  <div className="pt-entity">
   <div className="pt-entity-head"><div><p className="pt-crumb">Team Coordination — {account.label}</p><h2>{state.context.agreedGoal.text}</h2></div></div>
   <div className="pt-banner warn" role="status" style={{marginTop:22}}>Approving work and assignments isn’t available yet. Nothing has been approved: everything below is a proposal from Chris’s published handoff.</div>
   <div style={{display:'grid',gap:20,marginTop:22}}>
    <section className="pt-card" aria-label="Technical team">
     <h3>Technical team</h3>
     {h?.team?.length?<ul style={{listStyle:'none',padding:0,margin:'4px 0 0'}}>{h.team.map(p=><li key={p.name} style={{marginTop:12}}><strong>{p.name}</strong> — {p.role} <span className={'pt-pill'+(p.status==='reported'?' green':'')}>{p.status==='reported'?'Named in sources':'Inferred'}</span></li>)}</ul>
      :<p className="pt-note">No technical team has been published for {account.label} yet.</p>}
    </section>
    <section className="pt-card" aria-label="Proposed work">
     <h3>Proposed work</h3>
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
