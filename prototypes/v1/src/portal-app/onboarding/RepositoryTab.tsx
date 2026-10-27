import {useState} from 'react';
import {Github} from 'lucide-react';
import type {ActivationSession,Packet} from '../../activation/useActivation';
import {Link} from '../router';
import {STAGES,isHttps,stageIndex} from './model';

const evidenceHref=(id:string)=>'/activation/evidence#evidence-'+encodeURIComponent(id);
const statusTone=(s:Packet['status'])=>s==='prepared'?'green':s==='failed'?'red':'amber';

/** Read-only GitHub inspection and local preparation. Nothing here writes to GitHub or deploys. */
export function RepositoryTab({session}:{session:ActivationSession}){
 const state=session.state!;
 const packets=Object.values(state.githubPreparations??{});
 const actions=Object.entries(state.actions);
 return <div className="pt-grid">
  <section className="pt-card pt-span" aria-label="GitHub preparation">
   <div className="pt-card-head"><h3>Inspect the repository</h3><Github size={20} aria-hidden="true"/></div>
   <p className="pt-note">Request a read-only inspection of the repository authorized for your team, then prepare a local review packet for the current next action. Nothing is written to GitHub and nothing is deployed.</p>
   <div className="pt-actions">
    <button className="pt-btn sm" disabled={!session.ready} onClick={()=>void session.github.prepare()}>{session.github.draft?'Retry inspection':'Inspect and prepare'}</button>
    {session.github.draft&&<button className="pt-link" disabled={session.busy} onClick={session.github.clear}>Start a new inspection</button>}
   </div>
   {session.github.draft&&<p className="pt-note">Retries reuse the same request and plan revision. After a failure, refresh and start a new inspection.</p>}
  </section>

  {packets.length===0?<section className="pt-card pt-span"><h3>No inspection requested yet</h3><p className="pt-note">A suggestion alone is not execution.</p></section>:packets.map(packet=><PacketCard key={packet.id} session={session} packet={packet}/>)}

  <section className="pt-card pt-span" aria-label="Recorded actions">
   <h3>Recorded actions</h3>
   <p className="pt-note">Backend states only. A prepared artifact is not a merged pull request, a deployed service or verified adoption.</p>
   {actions.length===0?<p className="pt-note">No action transitions recorded yet.</p>:actions.map(([id,action])=><div key={id} style={{marginTop:20}}>
    <div className="pt-card-head"><strong style={{overflowWrap:'anywhere'}}>{id}</strong><span className="pt-pill">{action.status}</span></div>
    <p className="pt-note" style={{marginTop:4}}>{action.kind.replace('_',' ')} · revision {action.revision}{action.receiptId&&<> · receipt <code>{action.receiptId}</code></>}</p>
    <ol className="pt-stages">{STAGES.map((label,i)=><li key={label} className={i<=stageIndex(action.status)?'done':''}>{label}</li>)}</ol>
    {action.evidenceIds.length>0&&<p className="pt-note">Evidence: {action.evidenceIds.map(x=><Link className="pt-link" key={x} to={evidenceHref(x)}>{x} </Link>)}</p>}
    {action.blockedByIds.length>0&&<p className="pt-note">Blocked by: {action.blockedByIds.join(', ')}</p>}
   </div>)}
  </section>
 </div>;
}

function PacketCard({session,packet}:{session:ActivationSession;packet:Packet}){
 const state=session.state!;
 const [reviewed,setReviewed]=useState('');
 const key=packet.id+':'+packet.artifactDigest;
 const historical=packet.planRevision!==state.planRevision;
 return <section className="pt-card pt-span" aria-label={'Review packet '+packet.id}>
  <div className="pt-card-head"><h3>Local review packet</h3><span className={'pt-pill '+statusTone(packet.status)}>{packet.status}</span></div>
  <dl className="pt-fields">
   <div className="pt-field"><dt>Repository</dt><dd>{packet.repository}</dd></div>
   <div className="pt-field"><dt>Commit</dt><dd><a className="pt-link" href={'https://github.com/'+packet.repository+'/commit/'+packet.commit} target="_blank" rel="noreferrer">{packet.commit.slice(0,12)}</a></dd></div>
   <div className="pt-field"><dt>Template</dt><dd>{packet.templatePath}</dd></div>
   <div className="pt-field"><dt>Observed</dt><dd>{new Date(packet.observedAt).toLocaleString()}</dd></div>
   <div className="pt-field"><dt>Completed</dt><dd>{packet.completedAt?new Date(packet.completedAt).toLocaleString():'Pending · safe to resume'}</dd></div>
   <div className="pt-field"><dt>Plan / action</dt><dd>plan {packet.planRevision} · {packet.actionId} r{packet.actionRevision}</dd></div>
  </dl>
  <table className="pt-table" aria-label="Packet state"><thead><tr><th>Prepared</th><th>Approved</th><th>Executed</th><th>Verified</th><th>Pull request</th></tr></thead>
   <tbody><tr><td>{packet.status==='prepared'?'Yes':'No'}</td><td>No{packet.proposalApproval?' · proposal accepted for review only':''}</td><td>No</td><td>No</td><td>None</td></tr></tbody></table>
  {historical&&<div className="pt-banner warn" role="status">Historical packet: the plan has changed since this was prepared. Review again before use.</div>}
  {packet.status==='inspecting'&&<div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready} onClick={()=>void session.github.prepare(packet)}>Resume saved inspection</button></div>}
  {packet.errorCode&&<div className="pt-banner error" role="status">Inspection failed: {packet.errorCode}</div>}
  {packet.blockers.length>0&&<><hr/><p className="pt-label">Missing prerequisites and blockers</p><ul className="pt-list">{packet.blockers.map(x=><li key={x}>{x}</li>)}</ul></>}
  {packet.evidenceIds.length>0&&<p className="pt-note">Observed evidence: {packet.evidenceIds.map(id=><Link className="pt-link" key={id} to={evidenceHref(id)}>{id} </Link>)}</p>}
  {packet.setupProposal&&<div aria-label="Setup proposal"><hr/>
   <div className="pt-card-head"><h3>Proposed configuration</h3><span className="pt-pill amber">Not runnable</span></div>
   <p className="pt-note">Template review: {packet.setupProposal.templateReview.replaceAll('_',' ')}.</p>
   {packet.setupProposal.missingPrerequisites.length>0&&<><p className="pt-label" style={{marginTop:16}}>Missing prerequisites</p><ul className="pt-list">{packet.setupProposal.missingPrerequisites.map(x=><li key={x}>{x}</li>)}</ul></>}
   <p className="pt-label" style={{marginTop:16}}>Template dependencies</p>
   <ul className="pt-list">{packet.setupProposal.dependencies.map(d=><li key={d.path}><span>{isHttps(d.source)?<a className="pt-link" href={d.source} target="_blank" rel="noreferrer">{d.path}</a>:d.path}: {d.status.replaceAll('_',' ')}</span></li>)}</ul>
   <details className="pt-details"><summary>Review proposed file diff</summary><pre className="pt-pre">{packet.setupProposal.diff}</pre></details>
   {packet.proposalApproval?<div className="pt-banner" role="status">Proposal accepted for review at {new Date(packet.proposalApproval.acceptedAt).toLocaleString()} (digest {packet.proposalApproval.artifactDigest.slice(0,16)}…). This records review consent only; nothing was executed.</div>:<>
    <label className="pt-check"><input type="checkbox" aria-label={'Reviewed proposal '+packet.id} disabled={session.busy||!!session.approval.draft} checked={reviewed===key} onChange={e=>setReviewed(e.target.checked?key:'')}/>I reviewed this exact artifact and accept the proposal only, including unresolved prerequisites. This authorizes no execution.</label>
    <div className="pt-actions">
     <button className="pt-btn sm" disabled={!session.ready||reviewed!==key||historical||!!state.actions[packet.actionId]?.blockedByIds.length||(!!session.approval.draft&&session.approval.draft.preparationId!==packet.id)} onClick={()=>void session.approval.accept(packet)}>{session.approval.draft?'Retry acceptance':'Accept proposal only'}</button>
     {session.approval.draft&&<button className="pt-link" disabled={session.busy} onClick={()=>{session.approval.clear();setReviewed('');}}>Discard acceptance</button>}
    </div>
    <p className="pt-note">Acceptance also needs a separate grant for this artifact. Session access alone cannot approve.</p>
   </>}
  </div>}
  {packet.artifact&&<details className="pt-details"><summary>Review prepared artifact</summary><pre className="pt-pre">{packet.artifact}</pre><p className="pt-note">SHA-256: {packet.artifactDigest}</p></details>}
 </section>;
}
