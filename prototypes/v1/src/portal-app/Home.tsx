import {BookOpenText,Check,Clock3,ClipboardList,Lock,TriangleAlert,Users} from 'lucide-react';
import type {ActivationSession} from '../activation/useActivation';
import type {Persona} from './session';
import {Link,navigate} from './router';
import {loadProblem} from './onboarding/model';
import {onboardingSteps} from './onboarding/steps';

/** “Welcome to Portal” with the Setup Guide card (011, 036), filled from the developer's onboarding steps. */
export function Home({session,persona}:{session:ActivationSession;persona:Persona}){
 const {state,busy,error}=session;
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  {persona.role==='champion'?<ChampionCard session={session}/>:state&&<AssignedWork session={session} persona={persona}/>}
  {!state?<section className="pt-guide" aria-label="Your onboarding">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Get started with your onboarding</h2></div>
   <div className="pt-step" role={error?'alert':'status'}><h3>{busy||!error?'Loading your onboarding…':loadProblem(error).title}</h3>{error&&!busy&&<p>{loadProblem(error).detail}</p>}{error&&!busy&&<button className="pt-btn" onClick={()=>void session.refresh()}>Try again</button>}</div>
  </section>:<HomeGuide session={session}/>}
 </div>;
}

function HomeGuide({session}:{session:ActivationSession}){
 const state=session.state!;
 const {steps,done,total,current}=onboardingSteps(session);
 return <>
  {!current&&<section className="pt-done" aria-label="Onboarding complete">
   <p className="pt-done-mark" aria-hidden="true">🎉</p><h3>You’re all done!</h3>
   <p>Chris can see your progress. Bring your team along next.</p>
   <button className="pt-btn" onClick={()=>navigate('/activation/team')}>Go to Team</button>
  </section>}
  <section className="pt-guide" aria-label="Your onboarding">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Get started with your onboarding</h2></div>
   <div className="pt-progress" aria-hidden="true"><span style={{width:`${done/total*100}%`}}/></div>
   <div className="pt-guide-meta"><span>{done} of {total} completed</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>Milestone {state.milestone.status.replace('_',' ')}</span></div>
   {current&&<div className="pt-step">
    <h3>First up: {current.title.charAt(0).toLowerCase()+current.title.slice(1)}</h3>
    <p className="pt-clamp">{current.attention??(current.id==='goal'?state.context.agreedGoal.text:current.summary)}</p>
    <button className="pt-btn" onClick={()=>navigate('/activation')}>Open your onboarding</button>
   </div>}
   <div className="pt-rows">{steps.filter(s=>s!==current).map(s=>s.status==='locked'?
    <div key={s.id} className="pt-row locked"><Lock size={18} aria-hidden="true"/>&nbsp;Accept your direction or share an update to unlock {s.title}</div>:
    <div key={s.id} className={'pt-row '+s.status}>
     <span className="check" aria-label={s.status==='done'?'Completed':'Not started'}>{s.status==='done'?<Check size={20} strokeWidth={2.6}/>:s.attention?<TriangleAlert size={18}/>:s.id==='team'?<Users size={18}/>:<span className="num">{steps.indexOf(s)+1}</span>}</span>
     <span className="label">{s.title}<small className="pt-clamp">{s.attention??s.summary}</small></span>
     {(s.status==='done'||s.id==='team')&&<Link className="pt-btn" to={s.to}>{s.goLabel}</Link>}
    </div>)}</div>
  </section>
 </>;
}

/** Work approved for this developer in Dream Day. The server sends each developer only their own approved
 * milestones, so everything here is theirs; before approval nothing is assigned. */
function AssignedWork({session,persona}:{session:ActivationSession;persona:Persona}){
 const h=session.state?.handoff;
 const mine=(h?.milestones??[]).filter(m=>m.assignmentStatus==='approved'&&m.proposedAssignee===persona.name);
 return <section className="pt-guide" aria-label="Your assigned work">
  <div className="pt-guide-head"><span className="icon"><ClipboardList size={20} aria-hidden="true"/></span><h2>Your assigned work</h2></div>
  {mine.length?<>
   {h?.approval&&<p className="pt-note" style={{margin:'14px 0 0'}}>Approved by {h.approval.by} in Dream Day on {new Date(h.approval.at).toLocaleDateString()}.</p>}
   {mine.map(m=><div key={m.id} className="pt-step assigned" aria-label={`Assigned: ${m.objective}`}>
    <h3>{m.objective}</h3>
    {m.why&&m.why!==m.objective&&<p>{m.why}</p>}
    <p className="pt-label" style={{marginTop:16}}>Actions</p><ol className="pt-plain-list">{m.actions.map(a=><li key={a}>{a}</li>)}</ol>
    <p className="pt-label" style={{marginTop:14}}>Done when</p><ul className="pt-plain-list">{m.completionCriteria.map(c=><li key={c}>{c}</li>)}</ul>
    {m.dependencies.length>0&&<p className="pt-note">Starts after: {m.dependencies.join(', ')}</p>}
    <Link className="pt-btn" to="/activation">Open your onboarding</Link>
   </div>)}</>
   :<div className="pt-step"><h3>Nothing is assigned to you yet</h3><p>{h?.approval?'Your Champion approved the team’s plan, but none of its milestones are assigned to you. Ask your Champion if you expected work.':'Work is assigned when your Champion approves the team’s onboarding plan in Dream Day.'}</p></div>}
 </section>;
}

function ChampionCard({session}:{session:ActivationSession}){
 const h=session.state?.handoff;
 return <section className="pt-guide" aria-label="Team coordination">
  <div className="pt-guide-head"><span className="icon"><Users size={20} aria-hidden="true"/></span><h2>Coordinate your team</h2></div>
  <div className="pt-step"><h3>{h?.approval?`Plan approved · ${h.milestones.length} milestone${h.milestones.length===1?'':'s'} assigned`:'Review your team’s onboarding plan in Dream Day'}</h3>
   <p>{h?.approval?'See who is doing what in Team Coordination.':'When Chris submits the plan, you review it, assign the work and approve it in Dream Day.'}</p>
   <button className="pt-btn" onClick={()=>navigate(h?.approval?'/champion/team':'/champion')}>{h?.approval?'Open Team overview':'Open Dream Day'}</button></div>
 </section>;
}
