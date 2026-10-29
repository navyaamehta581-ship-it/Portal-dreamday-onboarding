import type {ActivationState} from '../../../../contracts/activation/v1/state';
import {championPlan} from '../activation/champion';
import {milestoneTone} from '../portal-app/onboarding/model';
import {planLabel} from './versions';
import {CoordinationView} from '../portal-app/work/Coordination';
import type {MilestoneWorkSession} from '../portal-app/work/useMilestoneWork';
import type {RepositoryEvidenceSession} from '../portal-app/work/useRepositoryEvidence';

/** Developer Progress: what developers reported, what was observed, and what needs Chris's decision. */
export function ProgressTab({state,work,repos}:{state:ActivationState|null;work?:MilestoneWorkSession;repos?:RepositoryEvidenceSession}){
 if(!state)return <section className="pt-card"><h3>Nothing published yet</h3><p className="pt-note">Developer progress appears here after you publish the customer context.</p></section>;
 const reports=state.evidence.filter(e=>e.kind==='developer_report').sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
 const observed=[...state.evidence,...state.plan.evidence].filter((e,i,all)=>e.kind==='github_observation'&&all.findIndex(x=>x.id===e.id)===i);
 const packets=Object.values(state.githubPreparations??{});
 const team=championPlan(state);
 const helping=state.chrisHelp.status==='requested';
 return <div className="pt-grid">
  <section className="pt-card pt-span" aria-label="Activation at a glance">
   <h3>Activation at a glance</h3>
   <dl className="pt-fields">
    <div className="pt-field"><dt>Milestone</dt><dd><span className={'pt-pill '+milestoneTone(state.milestone.status)}>{state.milestone.status.replace('_',' ')}</span></dd></div>
    <div className="pt-field"><dt>Plan</dt><dd>{planLabel(state.planRevision)}{state.replan.status==='pending'?' · updating':state.replan.status==='failed'?' · update failed':''}</dd></div>
    <div className="pt-field"><dt>Help requested</dt><dd><span className={'pt-pill '+(helping?'amber':'')}>{helping?'Yes':'No'}</span></dd></div>
    <div className="pt-field"><dt>Outcome</dt><dd data-testid="outcome-status">{state.outcome.status}</dd></div>
    <div className="pt-field"><dt>Developer reports</dt><dd>{reports.length}</dd></div>
    
   </dl>
   {state.outcome.summary&&<p className="pt-note">Latest reported outcome text: “{state.outcome.summary.slice(0,300)}”</p>}
  </section>

  {work?.progress&&<section className="pt-span" aria-label="Approved milestone progress">
   <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Approved milestone progress</h3>
   <p className="pt-note" style={{marginTop:0,marginBottom:16}}>Read-only: the same records Maya coordinates from. Developers and Maya make every change.</p>
   <CoordinationView work={work} repos={repos} mode="observer"/>
  </section>}

  <section className="pt-card pt-span" aria-label="Follow-up">
   <div className="pt-card-head"><h3>Follow-up decision</h3>{helping&&<span className="pt-pill amber">Chris intervention requested</span>}</div>
   {helping?<dl className="pt-fields">
     <div className="pt-field wide"><dt>Request</dt><dd>{state.chrisHelp.reason??'Developer needs assistance.'}</dd></div>
     <div className="pt-field"><dt>Owner</dt><dd>{state.chrisHelp.owner??'Not assigned'}</dd></div>
     <div className="pt-field wide"><dt>Blocker IDs</dt><dd>{state.chrisHelp.blockerIds.join(', ')||'none'}</dd></div>
     <div className="pt-field wide"><dt>Suggested next step</dt><dd className="plain">Review the developer’s blocker with the customer’s technical owner. Bring in a solutions engineer for deep configuration.</dd></div>
    </dl>:<p className="pt-note">No help requested.</p>}
   {state.replan.errorCode&&<div className="pt-banner error" role="status">Replan failed: {state.replan.errorCode}</div>}
  </section>

  <section className="pt-card" aria-label="Current plan">
   <h3>Current developer plan</h3>
   <dl className="pt-fields" style={{gridTemplateColumns:'1fr'}}>
    <div className="pt-field"><dt>First milestone</dt><dd className="plain">{state.plan.selectedMilestone.outcome}</dd></div>
    <div className="pt-field"><dt>Next action</dt><dd className="plain">{state.plan.suggestedNextAction.description}</dd></div>
    <div className="pt-field"><dt>Open prerequisites</dt><dd>{state.plan.prerequisites.filter(p=>p.state!=='met').length} of {state.plan.prerequisites.length}</dd></div>
   </dl>
  </section>
  <section className="pt-card" aria-label="Chris team handoff summary">
   <h3>Team handoff</h3>
   <p style={{marginTop:18}}>{team.verified?'First technical milestone verified; team adoption unverified.':team.blocked?'First developer outcome blocked or awaiting replanning.':'First developer outcome not verified.'}</p>
   <p className="pt-note">Suggested roles: {team.roles.map(r=>r.role).join(', ')||'none yet'}. {team.issues.length} open requirement(s).</p>
  </section>

  <section className="pt-card pt-span" aria-label="Developer activity">
   <h3>Developer reports</h3>
   {reports.length===0?<p className="pt-note">Nothing reported yet.</p>:<table className="pt-table"><thead><tr><th style={{width:'20%'}}>Type</th><th>Report</th><th style={{width:'20%'}}>Recorded</th></tr></thead>
    <tbody>{reports.map(r=><tr key={r.id} id={'evidence-'+r.id}><td><span className={'pt-pill '+(r.source.includes('blocker')?'red':'blue')}>{r.source.includes('blocker')?'Blocker':'Progress / question'}</span>{state.chrisHelp.evidenceIds.includes(r.id)&&<> <span className="pt-pill amber">Help requested</span></>}</td><td>{r.claim}</td><td>{new Date(r.observedAt).toLocaleString()}</td></tr>)}</tbody></table>}
  </section>

  <section className="pt-card pt-span" aria-label="Chris GitHub action evidence">
   <h3>Technical evidence</h3>
   {packets.length===0?<p className="pt-note">No repository inspection yet.</p>:<table className="pt-table"><thead><tr><th>Packet</th><th>Prepared</th><th>Approved</th><th>Executed</th><th>Verified</th></tr></thead>
    <tbody>{packets.map(p=><tr key={p.id}><td><span className={'pt-pill '+(p.status==='failed'?'red':p.status==='prepared'?'green':'amber')}>{p.status}</span> {p.repository} @ {p.commit.slice(0,12)} · plan {planLabel(p.planRevision).split(' · ')[0].toLowerCase()}{p.blockers.length>0&&<ul className="pt-list">{p.blockers.map(b=><li key={b}>{b}</li>)}</ul>}</td><td>{p.status==='prepared'?'Yes':'No'}</td><td>No{p.proposalApproval?' · proposal accepted for review':''}</td><td>No</td><td>No</td></tr>)}</tbody></table>}
   {observed.length>0&&<><hr/><p className="pt-label">Observed on GitHub</p><ul className="pt-list">{observed.map(e=><li key={e.id}>{e.claim}</li>)}</ul></>}
  </section>
 </div>;
}
