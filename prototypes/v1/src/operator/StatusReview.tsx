import type {ActivationState} from '../../../../contracts/activation/v1/state';
import {championPlan} from '../activation/champion';
import {evidenceLabel} from '../portal-app/onboarding/model';

/** Chris’s follow-up view: what developers reported, what was observed, and what needs a decision. */
export function StatusReview({state}:{state:ActivationState}){
 const reports=state.evidence.filter(e=>e.kind==='developer_report').sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
 const observed=[...state.evidence,...state.plan.evidence].filter((e,i,all)=>e.kind==='github_observation'&&all.findIndex(x=>x.id===e.id)===i);
 const packets=Object.values(state.githubPreparations??{});
 const team=championPlan(state);
 const helping=state.chrisHelp.status==='requested';
 return <>
  <section className="op-card" aria-label="Activation at a glance">
   <h2>Activation at a glance</h2>
   <div className="op-stats">
    <Stat label="Milestone" value={state.milestone.status.replace('_',' ')} tone={state.milestone.status==='blocked'?'bad':state.milestone.status==='reached'?'good':''}/>
    <Stat label="Plan" value={`revision ${state.planRevision}`}/>
    <Stat label="Replanning" value={state.replan.status}/>
    <Stat label="Chris help" value={state.chrisHelp.status} tone={helping?'warn':''}/>
    <Stat label="Outcome" value={state.outcome.status} testId="outcome-status"/>
    <Stat label="Developer reports" value={String(reports.length)}/>
   </div>
   {state.outcome.summary&&<p className="op-muted">Latest reported outcome text: “{state.outcome.summary.slice(0,300)}”</p>}
   <p className="op-muted">“Reported” means a developer submitted an attributed report (any update or question counts). It is not independent verification of success.</p>
  </section>

  <section className={'op-card'+(helping?' attention':'')} aria-label="Follow-up">
   <h2>Follow-up decision</h2>
   {helping?<><p className="op-badge warn">Chris intervention requested</p><p><strong>{state.chrisHelp.reason??'Developer needs assistance.'}</strong></p><p className="op-muted">Owner: {state.chrisHelp.owner??'Not assigned'} · Blocker IDs: {state.chrisHelp.blockerIds.join(', ')||'none'}</p>
    <p>Suggested next step: review the attributed blocker or help request with the customer’s technical owner; involve a solutions engineer for deep configuration.</p></>
    :<p>No help requested. Review the developer’s next report before deciding whether direct help is needed.</p>}
   {state.replan.errorCode&&<p className="op-badge bad">Replan failed: {state.replan.errorCode}</p>}
  </section>

  <div className="op-two">
   <section className="op-card" aria-label="Current plan">
    <h2>Current developer plan</h2>
    <dl className="op-dl"><dt>First milestone</dt><dd>{state.plan.selectedMilestone.outcome}</dd><dt>Next action</dt><dd>{state.plan.suggestedNextAction.description}</dd><dt>Open prerequisites</dt><dd>{state.plan.prerequisites.filter(p=>p.state!=='met').length} of {state.plan.prerequisites.length}</dd></dl>
   </section>
   <section className="op-card" aria-label="Chris team handoff summary">
    <h2>Team handoff · proposed</h2>
    <p>{team.verified?'First technical milestone verified; team adoption unverified.':team.blocked?'First developer outcome blocked or awaiting replanning.':'First developer outcome not verified.'}</p>
    <p className="op-muted">Suggested roles: {team.roles.map(r=>r.role).join(', ')||'None supported yet'}. {team.issues.length} unresolved requirement(s). Technical review and repeat onboarding remain proposed. Chris follow-up: {helping?'requested, not completed':'proposed, not achieved'}.</p>
   </section>
  </div>

  <section className="op-card" aria-label="Developer activity">
   <h2>Developer reports</h2>
   {reports.length===0?<p className="op-muted">Nothing reported yet.</p>:<ol className="op-timeline">{reports.map(r=><li key={r.id} id={'evidence-'+r.id}>
    <span className="op-badge">{r.source.includes('blocker')?'Blocker':'Progress / question'}</span>{state.chrisHelp.evidenceIds.includes(r.id)&&<span className="op-badge warn">Help requested</span>}
    <p>{r.claim}</p><p className="op-muted">{new Date(r.observedAt).toLocaleString()} · {r.id}</p></li>)}</ol>}
  </section>

  <section className="op-card" aria-label="Chris GitHub action evidence">
   <h2>Technical evidence</h2>
   {packets.length===0?<p className="op-muted">No repository inspection requested.</p>:packets.map(p=><div className="op-packet" key={p.id}>
    <p><span className={'op-badge'+(p.status==='failed'?' bad':'')}>{p.status}</span> {p.repository} @ {p.commit.slice(0,12)} · plan {p.planRevision}</p>
    <p className="op-muted">Prepared for review only — approval: {p.proposalApproval?'proposal accepted for review':'none'}; executed: no; verified: no; pull request: none.</p>
    {p.blockers.length>0&&<ul>{p.blockers.map(b=><li key={b}>{b}</li>)}</ul>}
   </div>)}
   {observed.length>0&&<><h3>Observed on GitHub</h3><ul>{observed.map(e=><li key={e.id}>{e.claim}</li>)}</ul></>}
  </section>

  <section className="op-card" aria-label="Published customer handoff">
   <h2>Published context</h2>
   <dl className="op-dl"><dt>Agreed outcome</dt><dd>{state.context.agreedGoal.text}</dd><dt>Agreed by</dt><dd>{state.context.agreedGoal.agreedBy} · {new Date(state.context.agreedGoal.agreedAt).toLocaleString()}</dd><dt>Developer-visible context</dt><dd className="pre">{state.context.briefing}</dd></dl>
   <h3>Constraints</h3><ul>{state.context.constraints.map((c,i)=><li key={i}>{c}</li>)}</ul>
   <h3>Unknowns</h3><ul>{state.context.unknowns.map(u=><li key={u}>{u}</li>)}</ul>
   <h3>All evidence</h3><ul>{[...state.evidence].map(e=><li key={e.id}><span className="op-badge">{evidenceLabel(e.kind)}</span> {e.claim.slice(0,240)}</li>)}</ul>
  </section>
 </>;
}

function Stat({label,value,tone='',testId}:{label:string;value:string;tone?:string;testId?:string}){
 return <div className={'op-stat '+tone}><span>{label}</span><strong data-testid={testId}>{value}</strong></div>;
}
