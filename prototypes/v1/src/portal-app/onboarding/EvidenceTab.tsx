import {useEffect} from 'react';
import type {ActivationState} from '../../../../../contracts/activation/v1/state';
import {evidenceLabel,isHttps} from './model';

const tone=(kind:string)=>kind==='github_observation'||kind==='verified_outcome'?'green':kind==='ai_inference'||kind==='portal_simulated'?'amber':'blue';

/** Every record with its provenance; reported, inferred and simulated evidence is never shown as verified. */
export function EvidenceTab({state}:{state:ActivationState}){
 const all=[...state.evidence,...state.plan.evidence.filter(r=>!state.evidence.some(e=>e.id===r.id))];
 useEffect(()=>{const id=decodeURIComponent(window.location.hash.slice(1));if(id)document.getElementById(id)?.scrollIntoView?.({block:'start'});},[]);
 return <section className="pt-card" aria-label="Evidence">
  <h3>What the system can actually support</h3>
  <p className="pt-note">GitHub observations are read-only facts. Reported, inferred or simulated records are never a deployment, adoption or outcome result.</p>
  {all.length===0?<p className="pt-note">No evidence recorded yet.</p>:<table className="pt-table"><thead><tr><th style={{width:'18%'}}>Source type</th><th>Claim</th><th style={{width:'24%'}}>Provenance</th></tr></thead><tbody>
   {all.map(r=><tr key={r.id} id={'evidence-'+r.id}>
    <td><span className={'pt-pill '+tone(r.kind)}>{evidenceLabel(r.kind)}</span><p className="pt-note" style={{marginTop:8}}>Proof: {r.proof.type} · {r.proof.result.replace('_',' ')}</p></td>
    <td>{r.claim}{r.proof.type!=='none'&&<details className="pt-details"><summary>Recorded proof</summary><p className="pt-note">Action {r.proof.actionId} · revision {r.proof.actionRevision} · verifier {r.proof.verifier}</p><pre className="pt-pre">{JSON.stringify(r.proof,null,2)}</pre></details>}</td>
    <td><p className="pt-note" style={{marginTop:0}}>{isHttps(r.source)?<a className="pt-link" href={r.source} target="_blank" rel="noreferrer">Open source</a>:r.source}<br/>{new Date(r.observedAt).toLocaleString()}<br/>Scope: {r.scope}<br/>ID: {r.id}{r.proof.reference&&r.proof.reference!=='none'&&<><br/>Reference: {isHttps(r.proof.reference)?<a className="pt-link" href={r.proof.reference} target="_blank" rel="noreferrer">Inspect proof reference</a>:r.proof.reference}</>}{r.basisIds.length>0&&<><br/>Based on: {r.basisIds.join(', ')}</>}</p></td>
   </tr>)}</tbody></table>}
 </section>;
}
