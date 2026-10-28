import {useEffect} from 'react';
import type {ActivationState} from '../../../../../contracts/activation/v1/state';
import {evidenceLabel,isHttps} from './model';

const tone=(kind:string)=>kind==='github_observation'||kind==='verified_outcome'?'green':kind==='ai_inference'||kind==='portal_simulated'?'amber':'blue';

/** Every record with its provenance; reported, inferred and simulated evidence is never shown as verified. */
export function EvidenceTab({state}:{state:ActivationState}){
 const all=[...state.evidence,...state.plan.evidence.filter(r=>!state.evidence.some(e=>e.id===r.id))];
 useEffect(()=>{const id=decodeURIComponent(window.location.hash.slice(1));if(id)document.getElementById(id)?.scrollIntoView?.({block:'start'});},[]);
 return <section className="pt-card" aria-label="Evidence">
  <h3>Evidence</h3>
  {state.handoff&&state.handoff.context.length>0&&<table className="pt-table" aria-label="Technical findings"><thead><tr><th style={{width:'18%'}}>Topic</th><th>Finding</th><th style={{width:'14%'}}>Status</th><th style={{width:'20%'}}>Action</th></tr></thead>
   <tbody>{state.handoff.context.map(n=><tr key={n.topic}><td>{n.topic}</td><td>{n.text.split(/(?<=\.)\s/)[0]}</td><td><span className={'pt-pill '+(n.status==='verified'?'green':n.status==='assumption'?'amber':'')}>{n.status==='verified'?'Verified':n.status==='assumption'?'Unconfirmed':'Reported'}</span></td><td>{/missing|incomplete|not confirmed|no confirmed|isn’t known|not identified|disagree/i.test(n.text)?'Part of this milestone':n.status==='verified'?'None':'Confirm during inspection'}</td></tr>)}</tbody></table>}
  <p className="pt-label" style={{marginTop:28}}>Records</p>
  {all.length===0?<p className="pt-note">No evidence recorded yet.</p>:<table className="pt-table"><thead><tr><th style={{width:'18%'}}>Source type</th><th>Claim</th><th style={{width:'24%'}}>Provenance</th></tr></thead><tbody>
   {all.map(r=><tr key={r.id} id={'evidence-'+r.id}>
    <td><span className={'pt-pill '+tone(r.kind)}>{evidenceLabel(r.kind)}</span><p className="pt-note" style={{marginTop:8}}>Proof: {r.proof.type} · {r.proof.result.replace('_',' ')}</p></td>
    <td>{r.claim}{r.proof.type!=='none'&&<details className="pt-details"><summary>Recorded proof</summary><p className="pt-note">Action {r.proof.actionId} · revision {r.proof.actionRevision} · verifier {r.proof.verifier}</p><pre className="pt-pre">{JSON.stringify(r.proof,null,2)}</pre></details>}</td>
    <td><p className="pt-note" style={{marginTop:0}}>{isHttps(r.source)?<a className="pt-link" href={r.source} target="_blank" rel="noreferrer">Open source</a>:r.source}<br/>{new Date(r.observedAt).toLocaleString()}</p><details className="pt-details" style={{marginTop:4}}><summary className="pt-note" style={{marginTop:0}}>Record details</summary><p className="pt-note" style={{marginTop:4}}>ID: {r.id}{r.proof.reference&&r.proof.reference!=='none'&&<><br/>Reference: {isHttps(r.proof.reference)?<a className="pt-link" href={r.proof.reference} target="_blank" rel="noreferrer">Inspect proof reference</a>:r.proof.reference}</>}{r.basisIds.length>0&&<><br/>Based on: {r.basisIds.join(', ')}</>}</p></details></td>
   </tr>)}</tbody></table>}
  {state.plan.capabilities.length>0&&<><p className="pt-label" style={{marginTop:28}}>Capabilities</p><table className="pt-table"><thead><tr><th>Capability</th><th>Availability</th></tr></thead>
   <tbody>{state.plan.capabilities.map(c=><tr key={c.id}><td>{c.id}</td><td><span className="pt-pill">{c.availability.replace('_',' ')}</span></td></tr>)}</tbody></table></>}
 </section>;
}
