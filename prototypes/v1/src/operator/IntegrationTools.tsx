import {useState} from 'react';
import type {ActivationSession} from '../activation/useActivation';

/** Integrator-only paths preserved from the previous workspace: exact reviewed commands and initialization. */
export function IntegrationTools({session}:{session:ActivationSession}){
 const [blocker,setBlocker]=useState(''),[progress,setProgress]=useState(''),[initial,setInitial]=useState('');
 const rb=session.reviewedBlocker,rp=session.reviewedProgress;
 return <details className="op-card op-tools"><summary>Integration tools</summary>
  <p className="op-muted">For reviewers using exact, evidence-admitted commands. The server checks scope, revisions, proof and authority.</p>
  {session.state&&<>
   <h3>Reviewed blocker command</h3>
   <textarea aria-label="Blocker command" rows={6} value={rb.pending?JSON.stringify(rb.pending):blocker} disabled={!!rb.pending} onChange={e=>setBlocker(e.target.value)} placeholder="Reviewed blocker JSON"/>
   <div className="op-actions"><button className="op-btn secondary" disabled={!session.ready||(!rb.pending&&!blocker)||rb.accepted} onClick={()=>void rb.submit(blocker)}>Submit / retry reviewed blocker</button><button className="op-link" disabled={session.busy} onClick={()=>{rb.clear();setBlocker('');}}>Clear</button>{rb.accepted&&<span role="status">Blocker accepted.</span>}</div>
   <h3>Reviewed progress command</h3>
   <textarea aria-label="Progress command" rows={6} value={rp.pending?JSON.stringify(rp.pending):progress} disabled={!!rp.pending} onChange={e=>setProgress(e.target.value)} placeholder="Reviewed progress JSON"/>
   <div className="op-actions"><button className="op-btn secondary" disabled={!session.ready||(!rp.pending&&!progress)||rp.accepted} onClick={()=>void rp.submit(progress)}>Submit / retry reviewed progress</button><button className="op-link" disabled={session.busy} onClick={()=>{rp.clear();setProgress('');}}>Clear</button>{rp.accepted&&<span role="status">Reviewed action progress saved.</span>}</div>
  </>}
  {!session.state&&<><h3>Initialize from an admitted context</h3>
   <textarea aria-label="Admitted initialization" rows={6} value={initial} onChange={e=>setInitial(e.target.value)}/>
   <div className="op-actions"><button className="op-btn secondary" disabled={!session.ready||!initial} onClick={()=>void session.initialize(initial)}>Initialize reviewed session</button></div></>}
 </details>;
}
