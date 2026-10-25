import {useState, type FormEvent} from 'react';
type Recommendation = {
  version: number; goal: string; repository: string; diagnosis: string;
  observedAt: string; scope: string;
  evidence: {id:string; source:string; observation:string}[];
  actions: {title:string; evidenceIds:string[]; requiresReview:boolean}[];
  limitations: string[];
};
export function RepositoryDiagnosis(){
  const [goal,setGoal]=useState('Check this repository’s CI readiness');
  const [repository,setRepository]=useState('');
  const [result,setResult]=useState<Recommendation|null>(null);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setResult(null);
    try {
      const response=await fetch('/api/diagnose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal,repository}),signal:AbortSignal.timeout(90000)});
      if(!response.ok) throw new Error('Inspection unavailable. Check the backend and input, then retry.');
      const data=await response.json();
      if(data.version!==1 || !Array.isArray(data.evidence) || !Array.isArray(data.actions) || !Array.isArray(data.limitations)) throw new Error('Invalid inspection response.');
      setResult(data);
    }catch(e){setError(e instanceof Error?e.message:'Inspection failed.');}finally{setBusy(false);}
  }
  return <section className="p-card" aria-labelledby="repository-diagnosis-title">
    <h2 id="repository-diagnosis-title">GitHub workflow diagnosis · read only</h2>
    <p>Inspects actual repository evidence. This first slice supports CI readiness only. Other goals remain unassessed. No model or native Spotify Portal connection is configured.</p>
    <form onSubmit={submit}>
      <label className="p-field">Goal<textarea required maxLength={2000} value={goal} onChange={e=>{setGoal(e.target.value);setResult(null);}}/></label>
      <label className="p-field">GitHub repository (owner/name)<input required placeholder="owner/repository" value={repository} onChange={e=>{setRepository(e.target.value);setResult(null);}}/></label>
      <button className="p-button" disabled={busy} type="submit">{busy?'Inspecting repository…':'Inspect and recommend'}</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {result&&<div aria-live="polite"><h3>{result.diagnosis.replaceAll('_',' ')}</h3><p>{result.goal} · {result.observedAt} · {result.scope}</p>
      <h4>Evidence</h4>{result.evidence.map(e=><article key={e.id}><strong>{e.id}</strong><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{e.observation}</p><a href={e.source} target="_blank" rel="noreferrer">Inspect source</a></article>)}
      <h4>Recommended next step</h4>{result.actions.map((a,i)=><p key={i}>{a.title} Evidence: {a.evidenceIds.join(', ')}. Requires review.</p>)}
      <ul>{result.limitations.map(x=><li key={x}>{x}</li>)}</ul>
      <details><summary>Validated structured recommendation</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(result,null,2)}</pre></details>
    </div>}
  </section>;
}
