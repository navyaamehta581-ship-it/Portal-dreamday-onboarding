import {useEffect,useRef,useState} from 'react';
import {activationClient} from './client';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {CustomerContext,ActivationPlan,BlockerUpdate} from '../../../../contracts/activation/v1/types';
import './activation.css';

/** Isolated activation workspace. Credentials remain in memory and never enter URLs or storage. */
export function ActivationPage(){
 const [customer,setCustomer]=useState(''),[token,setToken]=useState('');
 const [state,setState]=useState<ActivationState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [briefing,setBriefing]=useState(''),[outcome,setOutcome]=useState(''),[agreedBy,setAgreedBy]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [initial,setInitial]=useState(''),[reviewedBlocker,setReviewedBlocker]=useState(''),[blockerNote,setBlockerNote]=useState(''),[blockerAccepted,setBlockerAccepted]=useState(false);
 const pending=useRef<BlockerUpdate|null>(null);
 const client=()=>activationClient(customer,token);
 async function run(work:()=>Promise<ActivationState>){
  setBusy(true);setError('');
  try{setState(await work());}
  catch(e){
   if(typeof e==='object'&&e!==null&&'status' in e&&(e as {status:number}).status===409)setError('This session changed elsewhere. Your draft is still here; refresh the saved session before retrying.');
   else setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');
  }finally{setBusy(false);}
 }
 function changeIdentity(){setState(null);pending.current=null;setReviewedBlocker('');setBlockerAccepted(false);setBlockerNote('');setError('');}
 async function submitReviewedBlocker(){
  if(!state)return;
  try{if(!pending.current)pending.current=JSON.parse(reviewedBlocker) as BlockerUpdate;}catch{setError('The reviewed blocker command is not valid JSON.');return;}
  await run(async()=>{const next=await client().blocker(pending.current!);setBlockerAccepted(true);return next;});
 }
 function submitBlockerNote(){
  if(!blockerNote.trim())return;
  setError('Your blocker note is saved in this workspace only. The current API can submit only an operator-reviewed, evidence-admitted blocker command—so we will not pretend free text changed the plan.');
 }
 useEffect(()=>{
  if(!state||state.replan.status!=='pending'||!customer||token.length<32)return;
  const timer=window.setInterval(()=>{void run(()=>client().read());},5000);
  return()=>window.clearInterval(timer);
 // poll only while server-side recovery is pending; the canonical GET is the source of truth.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[state?.replan.status,customer,token]);
 const ready=!!customer&&token.length>=32&&!busy;
 const evidenceFor=(ids:string[])=>state?.evidence.filter(e=>ids.includes(e.id))??[];
 return <div className="activation-shell"><main className="activation">
  <header className="activation-header"><div><p className="activation-kicker">Spotify Portal · Activation Intelligence</p><h1>Make the first value moment obvious.</h1><p className="activation-lede">A shared activation workspace for Chris and the developer: customer goal in, a grounded next action out, then visible progress when reality inevitably chooses violence.</p></div><span className="activation-chip">PROVISIONAL API · v1.0.0</span></header>

  <section className="activation-card" aria-label="Session connection">
   <h2>Open an activation session</h2><p>Load the durable customer state. The token stays in this browser tab only.</p>
   <div className="activation-connection"><label className="activation-field">Customer ID<input value={customer} disabled={busy} onChange={e=>{changeIdentity();setCustomer(e.target.value);}} placeholder="e.g. acme"/></label><label className="activation-field">Development access token<input type="password" autoComplete="off" value={token} disabled={busy} onChange={e=>{changeIdentity();setToken(e.target.value);}} placeholder="Local development token"/></label><button className="activation-button" disabled={!ready} onClick={()=>run(()=>client().read())}>{busy?'Loading…':'Load / refresh saved session'}</button></div>
   {state&&<p className="activation-refresh">Last canonical state: session revision {state.revision} · plan revision {state.planRevision}. Refresh is safe; local credentials are deliberately not persisted.</p>}
   <details className="activation-intake"><summary>Chris: start from an existing customer briefing</summary><p>Use this only to report an outcome already agreed with the customer. It creates a suggested plan, never a verified customer result.</p><div className="activation-intake-grid"><label className="activation-field">Existing customer briefing<textarea aria-label="Existing customer briefing" rows={4} value={briefing} onChange={e=>setBriefing(e.target.value)}/></label><label className="activation-field">Separately agreed activation outcome<textarea aria-label="Agreed activation outcome" rows={2} value={outcome} onChange={e=>setOutcome(e.target.value)}/></label><label className="activation-field">Who agreed to the outcome?<input value={agreedBy} onChange={e=>setAgreedBy(e.target.value)}/></label><label className="activation-checkbox"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I report that this outcome was separately agreed with this customer.</label><div><button className="activation-button secondary" disabled={!ready||!confirmed||!briefing.trim()||!outcome.trim()||!agreedBy.trim()} onClick={()=>run(()=>client().intake(briefing,outcome,agreedBy,confirmed))}>Create suggested activation plan</button></div></div></details>
  </section>
  {error&&<div className="activation-alert" role="alert">{error}</div>}

  {!state?<section className="activation-empty"><strong>Nothing loaded yet.</strong><p>Enter an admitted customer ID and development token to see the activation plan, developer path, and Chris’s outcome view.</p></section>:<div className="activation-grid">
   <div className="activation-main">
    <section className="activation-card activation-plan"><div className="activation-plan-top"><div><p className="activation-kicker">Customer-specific welcome</p><h2>{state.plan.selectedMilestone.outcome}</h2><p className="activation-goal">Goal: {state.context.agreedGoal.text}</p></div><span className={'activation-status '+state.milestone.status}>{state.milestone.status.replace('_',' ')}</span></div>
     <div className="activation-next"><small>Recommended next action · {state.plan.suggestedNextAction.kind.replace('_',' ')}</small><strong>{state.plan.suggestedNextAction.description}</strong><p>{state.plan.rationale}</p></div>
     <h3>What has to be true first</h3><ul className="activation-list">{state.plan.prerequisites.map((item,i)=><li key={i}>{item.description} <em>({item.state})</em></li>)}</ul>
    </section>

    <section className="activation-card"><p className="activation-kicker">Developer conversation</p><h2>Tell us what changed.</h2><div className="activation-conversation"><div className="activation-bubble"><strong>Activation guide</strong>Your current path is based on the agreed customer outcome. If you hit a blocker, describe it plainly first—then we’ll show whether the system can safely replan.</div><label className="activation-field">What is blocking the next action?<textarea aria-label="Blocker note" rows={3} value={blockerNote} onChange={e=>setBlockerNote(e.target.value)} placeholder="e.g. The team cannot access the expected CI workflow…"/></label><div className="activation-actions"><button className="activation-button secondary" disabled={!blockerNote.trim()||busy} onClick={submitBlockerNote}>Review blocker</button>{state.replan.status==='pending'&&<span className="activation-status pending">Replan in progress · checking every 5 seconds</span>}{state.replan.status==='ready'&&<span className="activation-status ready">A revised action is ready</span>}</div></div>
     <details className="activation-intake"><summary>Integration handoff: submit a reviewed blocker command</summary><p>This path exists for a reviewer using an exact, evidence-admitted command. Free-form blocker text cannot yet create a valid command or new plan.</p><textarea aria-label="Blocker command" rows={7} value={reviewedBlocker} disabled={!!pending.current} onChange={e=>setReviewedBlocker(e.target.value)} placeholder="Reviewed blocker JSON"/><div className="activation-actions"><button className="activation-button secondary" disabled={!ready||!reviewedBlocker||blockerAccepted} onClick={submitReviewedBlocker}>Submit / retry reviewed blocker</button><button className="activation-button link" disabled={busy} onClick={()=>{pending.current=null;setReviewedBlocker('');setBlockerAccepted(false);}}>Clear reviewed draft</button></div>{blockerAccepted&&<p>Blocker accepted. The server will recover the plan; refresh or wait for the next poll.</p>}</details>
    </section>

    <section className="activation-card"><p className="activation-kicker">Evidence, not confetti</p><h2>What the system can actually support</h2><div className="activation-evidence">{[...state.evidence,...state.plan.evidence.filter(record=>!state.evidence.some(existing=>existing.id===record.id))].map(record=><article key={record.id}><small>{record.kind} · {record.proof.type}</small><p>{record.claim}</p><small>{record.source} · observed {new Date(record.observedAt).toLocaleString()}</small></article>)}</div><p className="activation-disclaimer">GitHub observations are read-only facts; inferred, reported, or simulated evidence is never presented as a deployment, adoption, or ROI result.</p></section>
   </div>

   <aside className="activation-side">
    <section className="activation-card"><p className="activation-kicker">Chris’s view</p><h2>Activation at a glance</h2><div className="activation-status-row"><span>Customer</span><span>{state.customerId}</span></div><div className="activation-status-row"><span>Agreement</span><span>{state.context.agreedGoal.agreedBy}</span></div><div className="activation-status-row"><span>Milestone</span><span>{state.milestone.status.replace('_',' ')}</span></div><div className="activation-status-row"><span>Outcome: {state.outcome.status}</span></div><div className="activation-status-row"><span>Chris help</span><span>{state.chrisHelp.status}</span></div>{state.outcome.summary&&<><hr className="activation-divider"/><p>{state.outcome.summary}</p></>}<p className="activation-disclaimer">“Reported” means someone supplied evidence-linked information. It does not mean success was independently verified.</p></section>
    <section className="activation-card"><p className="activation-kicker">Plan health</p><h2>Progress and constraints</h2><div className="activation-status-row"><span>Plan revision</span><span>{state.planRevision}</span></div><div className="activation-status-row"><span>Replan</span><span>{state.replan.status}</span></div><div className="activation-status-row"><span>Capabilities</span><span>{state.plan.capabilities.map(c=>c.id).join(', ')}</span></div>{state.context.unknowns.length>0&&<><h3>Still unknown</h3><ul className="activation-list">{state.context.unknowns.map(x=><li key={x}>{x}</li>)}</ul></>}</section>
   </aside>
  </div>}
  <details className="activation-intake"><summary>Operator-only initialization</summary><p>Initialize a session from an admitted context wrapper. The server selects its reviewed initial plan if a plan is omitted.</p><textarea aria-label="Admitted initialization" rows={7} value={initial} onChange={e=>setInitial(e.target.value)}/><div className="activation-actions"><button className="activation-button secondary" disabled={!ready} onClick={()=>run(async()=>{const body=JSON.parse(initial) as {context:CustomerContext;plan?:ActivationPlan};return client().initialize(body.context,body.plan);})}>Initialize reviewed session</button></div></details>
 </main></div>;
}