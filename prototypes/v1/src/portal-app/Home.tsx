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
  {state&&(persona.role==='champion'?<ChampionCard session={session}/>:<AssignedWork session={session} persona={persona}/>)}
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

/** Work assigned to this developer. Only approved assignments name anyone; nothing is approved until the
 * Champion approval step exists, so this says so instead of guessing from proposals. */
function AssignedWork({session,persona}:{session:ActivationSession;persona:Persona}){
 const mine=(session.state?.handoff?.milestones??[]).filter(m=>m.assignmentStatus==='approved'&&m.proposedAssignee===persona.name);
 return <section className="pt-guide" aria-label="Your assigned work">
  <div className="pt-guide-head"><span className="icon"><ClipboardList size={20} aria-hidden="true"/></span><h2>Your assigned work</h2></div>
  {mine.length?<div className="pt-rows">{mine.map(m=><div key={m.id} className="pt-row"><span className="label">{m.objective}<small>{m.completionCriteria[0]??''}</small></span><Link className="pt-btn" to="/activation">Open</Link></div>)}</div>
   :<div className="pt-step"><h3>Nothing is assigned to you yet</h3><p>Proposed assignments are shown to you once your Champion approves them. That approval step isn’t available in this demo yet, so your team’s shared onboarding is below.</p></div>}
 </section>;
}

function ChampionCard({session}:{session:ActivationSession}){
 const milestones=session.state?.handoff?.milestones.length??0;
 return <section className="pt-guide" aria-label="Team coordination">
  <div className="pt-guide-head"><span className="icon"><Users size={20} aria-hidden="true"/></span><h2>Coordinate your team</h2></div>
  <div className="pt-step"><h3>{milestones?`${milestones} proposed milestone${milestones>1?'s':''} from Chris`:'Nothing published by Chris yet'}</h3><p>Review your technical team and the proposed work. Approving it isn’t available yet.</p><button className="pt-btn" onClick={()=>navigate('/champion')}>Open Team Coordination</button></div>
 </section>;
}
