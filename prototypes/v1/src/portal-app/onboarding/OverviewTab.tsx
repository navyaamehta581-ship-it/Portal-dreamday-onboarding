import {useEffect,useState,type ReactNode} from 'react';
import {BookOpenText,Check,ChevronDown,ChevronUp,Clock3,Lock,MessageSquare,TriangleAlert,Users} from 'lucide-react';
import type {ActivationSession} from '../../activation/useActivation';
import {Link,navigate} from '../router';
import {STAGES,currentStage} from './model';
import {onboardingSteps,type Step,type StepId} from './steps';

const stateTone=(s:string)=>s==='met'?'green':s==='unmet'?'red':'amber';

/** Setup-guide layout (references 011, 023, 036): progress, then one row per step with the current step expanded. */
export function OverviewTab({session}:{session:ActivationSession}){
 const state=session.state!;
 const {steps,done,total,current}=onboardingSteps(session);
 const [open,setOpen]=useState<StepId|null>(current?.id??null);
 // Completing a step opens the next one.
 useEffect(()=>{if(current)setOpen(current.id);},[current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
 const allDone=done===total;
 return <>
  {allDone&&<section className="pt-done" aria-label="Onboarding complete">
   <p className="pt-done-mark" aria-hidden="true">🎉</p><h3>You’re all done!</h3>
   <p>Chris can see your progress. Bring your team along next.</p>
   {session.teamUnlocked&&<button className="pt-btn" onClick={()=>navigate('/activation/team')}>Go to Team</button>}
  </section>}
  <section className="pt-guide" aria-label="Onboarding steps">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Your first milestone</h2></div>
   <div className="pt-progress" aria-hidden="true"><span style={{width:`${done/total*100}%`}}/></div>
   <div className="pt-guide-meta"><span>{done} of {total} completed</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>Milestone {state.milestone.status.replace('_',' ')}</span></div>
   <ol className="pt-acc">
    {steps.map((step,i)=>step.status==='locked'?<li key={step.id} className="pt-row locked"><Lock size={18} aria-hidden="true"/>&nbsp;Accept your direction or share an update to unlock {step.title}</li>:
     <StepRow key={step.id} step={step} index={i} open={open===step.id} onToggle={()=>setOpen(open===step.id?null:step.id)}>
      {step.id==='goal'&&<GoalDetail session={session}/>}
      {step.id==='repository'&&<RepositoryDetail session={session}/>}
      {step.id==='report'&&<ReportDetail session={session}/>}
      {step.id==='team'&&<div className="pt-actions"><Link className="pt-btn sm" to={step.to}>Go to Team</Link></div>}
     </StepRow>)}
   </ol>
  </section>
  <section className="pt-about" aria-label="Your team’s context">
   <div><h3>What we know</h3><p className="pt-about-text">{state.context.briefing}</p>
    <ul className="pt-list">{state.context.constraints.map((c,i)=><li key={i}>{c}</li>)}</ul></div>
   <div>{state.context.unknowns.length>0&&<><h3>Still unknown</h3><ul className="pt-list">{state.context.unknowns.map(u=><li key={u}>{u}</li>)}</ul></>}
    <h3 style={{marginTop:state.context.unknowns.length?28:0}}>Success means</h3><ul className="pt-list">{state.plan.selectedMilestone.successCriteria.map((c,i)=><li key={i}>{c}</li>)}</ul></div>
  </section>
 </>;
}

function StepRow({step,index,open,onToggle,children}:{step:Step;index:number;open:boolean;onToggle:()=>void;children:ReactNode}){
 const done=step.status==='done';
 return <li className={'pt-acc-row '+step.status+(step.attention?' attention':'')+(open?' open':'')}>
  <div className="pt-acc-head">
   <button className="pt-acc-toggle" aria-expanded={open} aria-controls={'step-'+step.id} onClick={onToggle}>
    <span className="icon" aria-hidden="true">{done?<Check size={20} strokeWidth={2.6}/>:step.attention?<TriangleAlert size={18}/>:step.id==='team'?<Users size={18}/>:index+1}</span>
    <span className="title">{step.title}<small>{step.attention??step.summary}</small></span>
    <span className="pt-sr">{done?'Completed':step.status==='current'?'Current step':'Not started'}</span>
   </button>
   {done&&!open&&<Link className="pt-btn sm" to={step.to}>{step.goLabel}</Link>}
   <span className="chev" aria-hidden="true">{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</span>
  </div>
  {open&&<div className="pt-acc-body" id={'step-'+step.id}>{children}</div>}
 </li>;
}

function GoalDetail({session}:{session:ActivationSession}){
 const state=session.state!,goal=state.context.agreedGoal,action=state.plan.suggestedNextAction;
 return <>
  <dl className="pt-fields">
   <div className="pt-field wide"><dt>First milestone</dt><dd>{state.plan.selectedMilestone.outcome}</dd></div>
   <div className="pt-field"><dt>Agreed by</dt><dd>{goal.agreedBy}</dd></div>
   <div className="pt-field"><dt>Agreed</dt><dd>{new Date(goal.agreedAt).toLocaleDateString()}</dd></div>
  </dl>
  <p className="pt-label" style={{marginTop:22}}>First step</p>
  <p className="pt-clamp3">{action.description}</p>
  <details className="pt-details"><summary>Full step and why it was chosen</summary><p className="pt-prose">{action.description}</p><p className="pt-prose">{state.plan.rationale}</p></details>
  {state.plan.prerequisites.length>0&&<table className="pt-table" aria-label="Prerequisites"><thead><tr><th>Before you start</th><th style={{width:120}}>Status</th></tr></thead>
   <tbody>{state.plan.prerequisites.map((p,i)=><tr key={i}><td>{p.description}</td><td><span className={'pt-pill '+stateTone(p.state)}>{p.state}</span></td></tr>)}</tbody></table>}
  <div className="pt-actions">
   {session.direction.accepted?<span className="pt-pill green"><Check size={14} aria-hidden="true"/>Direction accepted</span>:<button className="pt-btn sm" disabled={session.busy||state.replan.status==='pending'} onClick={session.direction.accept}>Accept this onboarding direction</button>}
   <button className="pt-btn sm ghost" onClick={()=>navigate('/activation/guide')}><MessageSquare size={15} aria-hidden="true"/>Ask a question</button>
  </div>
 </>;
}

function RepositoryDetail({session}:{session:ActivationSession}){
 const stage=currentStage(session.state!);
 return <>
  <p>Inspect the repository your team has authorized, then review the prepared packet before anything changes.</p>
  <ol className="pt-stages" aria-label="First step progress">{STAGES.map((label,i)=><li key={label} className={(i<=stage?'done':'')+(i===stage?' current':'')} aria-current={i===stage?'step':undefined}>{label}</li>)}</ol>
  <div className="pt-actions"><Link className="pt-btn sm" to="/activation/repository">Go to Repository</Link></div>
 </>;
}

/** Attributed developer progress report (existing progress-reports route). */
function ReportDetail({session}:{session:ActivationSession}){
 const state=session.state!,{draft,accepted}=session.progressReport;
 const [note,setNote]=useState(''),[needsChris,setNeedsChris]=useState(false);
 const text=draft?.message??note;
 return <div aria-label="Developer progress">
  <label className="pt-sr" htmlFor="progress-note">Progress report</label>
  <textarea id="progress-note" className="pt-textarea" aria-label="Progress report" rows={3} maxLength={4000} disabled={!!draft} value={text} onChange={e=>setNote(e.target.value)} placeholder="What did you review or change?"/>
  <label className="pt-check"><input type="checkbox" aria-label="Request Chris help" disabled={!!draft} checked={draft?.needsChris??needsChris} onChange={e=>setNeedsChris(e.target.checked)}/>Ask Chris for help</label>
  <div className="pt-actions">
   <button className="pt-btn sm" disabled={!session.ready||!text.trim()||accepted} onClick={()=>void session.progressReport.submit(text,needsChris)}>{draft&&!accepted?'Retry':'Share update'}</button>
   <button className="pt-btn sm ghost" disabled={session.busy||!!draft} onClick={()=>setNote(`I reviewed the plan against our goal, prerequisites and constraints. Next: ${state.plan.suggestedNextAction.description}`)}>Draft from my plan</button>
   {draft&&<button className="pt-link" disabled={session.busy} onClick={()=>{session.progressReport.clear();setNote('');setNeedsChris(false);}}>{accepted?'Write another update':'Discard draft'}</button>}
  </div>
  {accepted&&<p className="pt-note" role="status">Shared with Chris.</p>}
 </div>;
}
