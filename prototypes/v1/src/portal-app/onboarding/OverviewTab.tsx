import {useState} from 'react';
import {MessageSquare} from 'lucide-react';
import type {ActivationSession} from '../../activation/useActivation';
import {navigate} from '../router';
import {STAGES,currentStage} from './model';

const stateTone=(s:string)=>s==='met'?'green':s==='unmet'?'red':'amber';

export function OverviewTab({session}:{session:ActivationSession}){
 const state=session.state!;
 const action=state.plan.suggestedNextAction,stage=currentStage(state);
 return <div className="pt-grid">
  <section className="pt-card" aria-label="About this milestone">
   <div className="pt-card-head"><h3>About</h3></div>
   <dl className="pt-fields">
    <div className="pt-field wide"><dt>Goal agreed for your team</dt><dd>{state.context.agreedGoal.text}</dd></div>
    <div className="pt-field"><dt>Agreed by</dt><dd>{state.context.agreedGoal.agreedBy}</dd></div>
    <div className="pt-field"><dt>Agreed</dt><dd>{new Date(state.context.agreedGoal.agreedAt).toLocaleDateString()}</dd></div>
    <div className="pt-field"><dt>Context</dt><dd>revision {state.contextRevision}</dd></div>
   </dl>
   <hr/>
   <dl className="pt-fields">
    <div className="pt-field wide"><dt>Next action · {action.kind.replace('_',' ')}</dt><dd className="plain">{action.description}</dd></div>
   </dl>
   <ol className="pt-stages" aria-label="Next action lifecycle">{STAGES.map((label,i)=><li key={label} className={(i<=stage?'done':'')+(i===stage?' current':'')} aria-current={i===stage?'step':undefined}>{label}</li>)}</ol>
   <details className="pt-details"><summary>Why this step</summary><p className="pt-note">{state.plan.rationale}</p></details>
   <div className="pt-actions">
    {session.direction.accepted?<span className="pt-pill green">Direction accepted</span>:<button className="pt-btn sm" disabled={session.busy||state.replan.status==='pending'} onClick={session.direction.accept}>Accept this onboarding direction</button>}
    <button className="pt-btn sm ghost" onClick={()=>navigate('/activation/guide')}><MessageSquare size={15} aria-hidden="true"/>Ask a question or report a blocker</button>
   </div>
   <p className="pt-note">Accepting selects a proposed direction only. It does not complete a milestone.</p>
  </section>

  <section className="pt-card" aria-label="Your onboarding context">
   <div className="pt-card-head"><h3>What we already know</h3></div>
   <dl className="pt-fields"><div className="pt-field wide"><dt>Context shared for your team</dt><dd className="plain">{state.context.briefing}</dd></div></dl>
   <hr/>
   <p className="pt-label">Reported technical context</p>
   <ul className="pt-list">{state.context.constraints.map((c,i)=><li key={i}>{c}</li>)}</ul>
   {state.context.unknowns.length>0&&<><hr/><p className="pt-label">Still unknown</p><ul className="pt-list">{state.context.unknowns.map(u=><li key={u}>{u}</li>)}</ul></>}
   <p className="pt-note">Reported context comes from conversations with your organization. It has not been independently verified.</p>
  </section>

  <section className="pt-card" aria-label="Prerequisites">
   <h3>What has to be true first</h3>
   <table className="pt-table"><thead><tr><th>Prerequisite</th><th>State</th></tr></thead>
    <tbody>{state.plan.prerequisites.map((p,i)=><tr key={i}><td>{p.description}</td><td><span className={'pt-pill '+stateTone(p.state)}>{p.state}</span></td></tr>)}</tbody></table>
  </section>

  <section className="pt-card" aria-label="Success criteria">
   <h3>Success means</h3>
   <ul className="pt-list">{state.plan.selectedMilestone.successCriteria.map((c,i)=><li key={i}>{c}</li>)}</ul>
   <hr/>
   <p className="pt-label">Capability check</p>
   <table className="pt-table"><thead><tr><th>Capability</th><th>Availability</th></tr></thead>
    <tbody>{state.plan.capabilities.map(c=><tr key={c.id}><td>{c.id}</td><td><span className="pt-pill">{c.availability.replace('_',' ')}</span></td></tr>)}</tbody></table>
  </section>

  <PlanReview session={session}/>
 </div>;
}

/** Attributed developer progress report (existing progress-reports route). */
function PlanReview({session}:{session:ActivationSession}){
 const state=session.state!,{draft,accepted}=session.progressReport;
 const [note,setNote]=useState(''),[needsChris,setNeedsChris]=useState(false);
 const text=draft?.message??note;
 return <section className="pt-card pt-span" aria-label="Developer progress">
  <h3>Review the plan, then report what changed</h3>
  <p className="pt-note">Your report is saved with your name and shared with Chris. It doesn’t approve, execute or verify anything.</p>
  <label className="pt-sr" htmlFor="progress-note">Progress report</label>
  <textarea id="progress-note" className="pt-textarea" style={{marginTop:14}} aria-label="Progress report" rows={3} maxLength={4000} disabled={!!draft} value={text} onChange={e=>setNote(e.target.value)} placeholder="What did you review or change?"/>
  <label className="pt-check"><input type="checkbox" aria-label="Request Chris help" disabled={!!draft} checked={draft?.needsChris??needsChris} onChange={e=>setNeedsChris(e.target.checked)}/>Ask Chris for help with this report</label>
  <div className="pt-actions">
   <button className="pt-btn sm ghost" disabled={session.busy||!!draft} onClick={()=>setNote(`I reviewed plan revision ${state.planRevision} against the customer goal, prerequisites and constraints. Next action: ${state.plan.suggestedNextAction.description}`)}>Draft my plan review</button>
   <button className="pt-btn sm" disabled={!session.ready||!text.trim()||accepted} onClick={()=>void session.progressReport.submit(text,needsChris)}>{draft&&!accepted?'Retry report':'Submit report'}</button>
   {draft&&<button className="pt-link" disabled={session.busy} onClick={()=>{session.progressReport.clear();setNote('');setNeedsChris(false);}}>{accepted?'Write another report':'Discard draft'}</button>}
  </div>
  {accepted&&<p className="pt-note" role="status">Report saved. Chris can now see it. “Bring your team along” is available on the Team tab.</p>}
 </section>;
}
