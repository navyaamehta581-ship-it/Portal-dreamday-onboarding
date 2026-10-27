import {BookOpenText,Check,Clock3,Lock} from 'lucide-react';
import type {ActivationSession} from '../activation/useActivation';
import {Link,navigate} from './router';
import {STAGES,currentStage,loadProblem} from './onboarding/model';

/** “Welcome to Portal” with the Setup Guide card pattern, filled from the published customer context. */
export function Home({session}:{session:ActivationSession}){
 const {state,busy,error}=session;
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  <section className="pt-guide" aria-label="Your onboarding">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Get started with your team’s onboarding</h2></div>
   {!state?<div className="pt-step" role={error?'alert':'status'}><h3>{busy||!error?'Loading your onboarding…':loadProblem(error).title}</h3>{error&&!busy&&<p>{loadProblem(error).detail}</p>}{error&&!busy&&<button className="pt-btn" onClick={()=>void session.refresh()}>Try again</button>}</div>:<HomeGuide session={session}/>}
  </section>
 </div>;
}

function HomeGuide({session}:{session:ActivationSession}){
 const state=session.state!;
 const stage=currentStage(state);
 const reports=state.evidence.filter(e=>e.kind==='developer_report').length;
 const prepared=Object.values(state.githubPreparations??{}).some(p=>p.status==='prepared'&&p.planRevision===state.planRevision);
 const teamOpen=session.teamUnlocked;
 return <>
  <div className="pt-progress" aria-hidden="true"><span style={{width:`${(stage+1)/STAGES.length*100}%`}}/></div>
  <div className="pt-guide-meta"><span>Next action: {STAGES[stage]} · {stage+1} of {STAGES.length} stages</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>Milestone {state.milestone.status.replace('_',' ')}</span></div>
  <div className="pt-step">
   <h3>First up: {state.plan.selectedMilestone.outcome}</h3>
   <p>Your team agreed: {state.context.agreedGoal.text}</p>
   <button className="pt-btn" onClick={()=>navigate('/activation')}>Open your onboarding</button>
  </div>
  <div className="pt-rows">
   <Row done={false} label="Review your context and next action" detail={state.plan.suggestedNextAction.description} to="/activation" cta="Go to Overview"/>
   <Row done={reports>0} label="Ask a question or report a blocker" detail={reports?`${reports} report(s) saved`:'Nothing reported yet'} to="/activation/guide" cta="Go to Guide"/>
   <Row done={prepared} label="Inspect the repository" detail={prepared?'Review packet prepared · not executed':'No inspection requested yet'} to="/activation/repository" cta="Go to Repository"/>
   {teamOpen?<Row done={false} label="Bring your team along" detail="Suggested roles, a kickoff message and proposed milestones" to="/activation/team" cta="Go to Team"/>:
    <div className="pt-row locked"><Lock size={18} aria-hidden="true"/>&nbsp;Accept an onboarding direction to unlock Bring your team along</div>}
  </div>
 </>;
}

function Row({done,label,detail,to,cta}:{done:boolean;label:string;detail:string;to:string;cta:string}){
 return <div className="pt-row">
  <span className="check" aria-label={done?'Recorded':'Not recorded'}>{done&&<Check size={20} strokeWidth={2.6}/>}</span>
  <span className="label">{label}<small className="pt-clamp">{detail}</small></span>
  <Link className="pt-btn" to={to}>{cta}</Link>
 </div>;
}
