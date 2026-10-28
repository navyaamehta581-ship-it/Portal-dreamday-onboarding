import {useState} from 'react';
import type {ActivationSession} from '../activation/useActivation';

/** Integrator-only paths: exact reviewed commands and initialization from an admitted context. */
export function IntegrationTools({session}:{session:ActivationSession}){
 const [blocker,setBlocker]=useState(''),[progress,setProgress]=useState(''),[initial,setInitial]=useState('');
 const rb=session.reviewedBlocker,rp=session.reviewedProgress;
 return <section className="pt-card pt-span" style={{marginTop:26}}><details className="pt-details" style={{marginTop:0}}><summary>Integration tools</summary>
  {session.state?<>
   <label className="pt-form-field"><span>Reviewed blocker command</span><textarea className="pt-textarea" aria-label="Blocker command" rows={5} value={rb.pending?JSON.stringify(rb.pending):blocker} disabled={!!rb.pending} onChange={e=>setBlocker(e.target.value)} placeholder="Reviewed blocker JSON"/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||(!rb.pending&&!blocker)||rb.accepted} onClick={()=>void rb.submit(blocker)}>Submit / retry reviewed blocker</button><button className="pt-link" disabled={session.busy} onClick={()=>{rb.clear();setBlocker('');}}>Clear</button>{rb.accepted&&<span className="pt-note" style={{marginTop:0}} role="status">Blocker accepted.</span>}</div>
   <label className="pt-form-field"><span>Reviewed progress command</span><textarea className="pt-textarea" aria-label="Progress command" rows={5} value={rp.pending?JSON.stringify(rp.pending):progress} disabled={!!rp.pending} onChange={e=>setProgress(e.target.value)} placeholder="Reviewed progress JSON"/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||(!rp.pending&&!progress)||rp.accepted} onClick={()=>void rp.submit(progress)}>Submit / retry reviewed progress</button><button className="pt-link" disabled={session.busy} onClick={()=>{rp.clear();setProgress('');}}>Clear</button>{rp.accepted&&<span className="pt-note" style={{marginTop:0}} role="status">Reviewed action progress saved.</span>}</div>
  </>:<>
   <label className="pt-form-field"><span>Initialize from an admitted context</span><textarea className="pt-textarea" aria-label="Admitted initialization" rows={5} value={initial} onChange={e=>setInitial(e.target.value)}/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||!initial} onClick={()=>void session.initialize(initial)}>Initialize reviewed session</button></div>
  </>}
 </details></section>;
}
