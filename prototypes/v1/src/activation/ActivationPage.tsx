import {useRef,useState} from 'react';
import {activationClient} from './client';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {CustomerContext,ActivationPlan,BlockerUpdate} from '../../../../contracts/activation/v1/types';
import {RepositoryDiagnosis} from '../portal/RepositoryDiagnosis';
import '../portal/portal.css';

/** Isolated integration candidate. Credentials stay in memory and never enter URLs/storage. */
export function ActivationPage(){
 const [customer,setCustomer]=useState(''),[token,setToken]=useState('');
 const [state,setState]=useState<ActivationState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [initial,setInitial]=useState(''),[draft,setDraft]=useState('');
 const [briefing,setBriefing]=useState(''),[outcome,setOutcome]=useState(''),[agreedBy,setAgreedBy]=useState(''),[confirmed,setConfirmed]=useState(false);
 const pending=useRef<BlockerUpdate|null>(null);
 const [blockerAccepted,setBlockerAccepted]=useState(false);
 const client=()=>activationClient(customer,token);
 async function run(work:()=>Promise<ActivationState>){setBusy(true);setError('');try{setState(await work());}catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');}finally{setBusy(false);}}
 function changeIdentity(){setState(null);pending.current=null;setDraft('');setBlockerAccepted(false);setError('');}
 async function blocker(){
  if(!state)return;
  try{if(!pending.current)pending.current=JSON.parse(draft) as BlockerUpdate;}catch{setError('Enter a valid admitted blocker command.');return;}
  await run(async()=>{const result=await client().blocker(pending.current!);setBlockerAccepted(true);return result;});
 }
 const ready=!!customer&&token.length>=32&&!busy;
 return <main style={{maxWidth:1000,margin:'auto',padding:32}}>
  <p><a href="/">Portal workspace</a> / Activation integration candidate · freeze HOLD</p>
  <h1>From customer goal to a developer’s next action</h1>
  <p>Local development review. Chris can paste an existing briefing and separately record an agreed outcome in explicitly enabled local intake. Representative Portal capabilities and model inferences are not execution proof.</p>
  <section className="p-card"><h2>Connect to an admitted session</h2>
   <label>Customer ID<input value={customer} disabled={busy} onChange={e=>{changeIdentity();setCustomer(e.target.value);}}/></label>
   <label>Development access token<input type="password" autoComplete="off" value={token} disabled={busy} onChange={e=>{changeIdentity();setToken(e.target.value);}}/></label>
   <button disabled={!ready} onClick={()=>run(()=>client().read())}>Load / refresh saved session</button>
   <details><summary>Chris: paste an existing customer briefing</summary>
    <p>Local intake candidate. This records your report of customer agreement; it does not independently verify it. No CRM or questionnaire.</p>
    <label>Existing briefing<textarea aria-label="Existing customer briefing" rows={6} value={briefing} onChange={e=>setBriefing(e.target.value)}/></label>
    <label>Separately agreed activation outcome<textarea aria-label="Agreed activation outcome" value={outcome} onChange={e=>setOutcome(e.target.value)}/></label>
    <label>Who agreed to the outcome?<input value={agreedBy} onChange={e=>setAgreedBy(e.target.value)}/></label>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I report that this outcome was separately agreed with this customer.</label>
    <button disabled={!ready||!confirmed||!briefing.trim()||!outcome.trim()||!agreedBy.trim()} onClick={()=>run(()=>client().intake(briefing,outcome,agreedBy,confirmed))}>Create suggested activation plan</button>
   </details>
   <details><summary>Initialize from an operator-reviewed context and plan</summary>
    <p>Paste an admitted context wrapper. The server selects its exact reviewed initial plan if plan is omitted. This does not create customer agreement or authorize evidence.</p>
    <textarea aria-label="Admitted initialization" rows={8} value={initial} onChange={e=>setInitial(e.target.value)}/>
    <button disabled={!ready} onClick={()=>run(async()=>{const body=JSON.parse(initial) as {context:CustomerContext;plan?:ActivationPlan};return client().initialize(body.context,body.plan);})}>Initialize session</button>
   </details>
  </section>
  {error&&<p role="alert">{error}. Keep the original command, reload saved state, and review conflicts before retrying.</p>}
  {state&&<>
   <section className="p-card"><h2>Chris’s customer briefing</h2><p>{state.context.briefing}</p><h3>Agreed activation goal</h3><p>{state.context.agreedGoal.text}</p><p>Agreement: {state.context.agreedGoal.agreedBy} · {state.context.agreedGoal.agreedAt}</p><p>Context revision {state.contextRevision} · session revision {state.revision}</p></section>
   <section className="p-card"><h2>Welcome — your next action</h2><p>{state.plan.selectedMilestone.outcome}</p><h3>{state.plan.suggestedNextAction.description}</h3><p>{state.plan.rationale}</p><h3>Prerequisites</h3><ul>{state.plan.prerequisites.map((p,i)=><li key={i}>{p.description}: {p.state}</li>)}</ul><p>Capabilities: {state.plan.capabilities.map(c=>`${c.id} (${c.availability})`).join(", ")}</p><p>Planner: {state.plan.planner} · plan revision {state.planRevision}</p>
    <ul>{Object.entries(state.actions).map(([id,a])=><li key={id}>{id}: {a.status}; blocked by {a.blockedByIds.join(', ')||'none'}; evidence {a.evidenceIds.join(', ')||'none'}</li>)}</ul>
    <p>Replan: {state.replan.status}{state.replan.errorCode&&` (${state.replan.errorCode})`}. Refresh to retrieve worker results.</p>
    <details><summary>Report a blocker using an admitted command</summary><p>The development registry must contain the exact attributed evidence and replacement. Arbitrary new text cannot yet generate an admitted replan.</p>
     <textarea aria-label="Blocker command" rows={8} value={draft} disabled={!!pending.current} onChange={e=>setDraft(e.target.value)}/>
     <button disabled={!ready||!draft||blockerAccepted} onClick={blocker}>Submit / retry exact blocker</button>
     {blockerAccepted&&<p role="status">Blocker accepted. Refresh to retrieve the replan. Clear the reviewed draft before entering another blocker.</p>}
     <button disabled={busy} onClick={()=>{pending.current=null;setDraft('');setBlockerAccepted(false);}}>Clear reviewed command draft</button>
    </details>
   </section>
   <RepositoryDiagnosis/>
   <section className="p-card"><h2>Chris’s evidence-linked outcome view</h2><p>Agreed goal: {state.context.agreedGoal.text}</p><p>Milestone: {state.milestone.status}. Outcome: {state.outcome.status}.</p><p>{state.outcome.summary||'No admitted outcome report.'}</p><p>Scope: {state.outcome.scope}; outcome evidence: {state.outcome.evidenceIds.join(', ')||'none'}.</p><p>Chris help: {state.chrisHelp.status} · {state.chrisHelp.reason}</p><p>The inspector above is a separate read-only result. It is not automatically admitted into this session ledger. No deployment, adoption or ROI is inferred.</p>
    <h3>Persisted evidence ledger</h3>{state.evidence.map(e=><article key={e.id}><h4>{e.id} · {e.kind} · {e.proof.type}</h4><p>{e.claim}</p><p>Source: {e.source} · revision: {e.sourceRevision} · scope: {e.scope}</p><p>Basis: {e.basisIds.join(', ')||'none'} · observed: {e.observedAt}</p></article>)}
    <details><summary>Canonical saved state</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(state,null,2)}</pre></details>
   </section>
  </>}
 </main>;
}
