import {useState} from 'react';
import type {ActivationSession} from '../activation/useActivation';
import {PUBLISH_LIMIT,organizeNotes,signalsFor,type OrganizedNotes} from './notes';

/** Paste → organize → review → publish. Raw notes stay in this tab; only the reviewed handoff is sent. */
export function PublishFlow({session}:{session:ActivationSession}){
 const [raw,setRaw]=useState(''),[organized,setOrganized]=useState<OrganizedNotes|null>(null);
 const [briefing,setBriefing]=useState(''),[outcome,setOutcome]=useState(''),[agreedBy,setAgreedBy]=useState(''),[confirmed,setConfirmed]=useState(false);
 const signals=signalsFor(briefing);
 const edit=(fn:()=>void)=>{fn();setConfirmed(false);};
 return <>
  <section className="op-card" aria-label="Operator publication">
   <p className="op-step">Step 1</p><h2>Paste what you already know</h2>
   <p className="op-muted">CRM summaries, discovery and trial notes, technical requirements and who agreed what — all together. Nothing is sent until you publish.</p>
   <label className="op-field">Raw account and call notes<textarea aria-label="Raw account and call notes" rows={10} maxLength={60000} value={raw} onChange={e=>{setRaw(e.target.value);setOrganized(null);}} placeholder="Paste notes here. Omit secrets."/></label>
   <button className="op-btn secondary" disabled={!raw.trim()} onClick={()=>{const o=organizeNotes(raw);setOrganized(o);setBriefing(o.publishable);setOutcome('');setConfirmed(false);}}>Organize notes</button>
  </section>

  {organized&&<section className="op-card" aria-label="Review before publishing">
   <p className="op-step">Step 2</p><h2>Review what developers will see</h2>
   <p className="op-muted">This text is shown to this customer’s developers inside Portal. Lines that look commercial or private were held back — check both columns.</p>
   {organized.truncated&&<div className="op-alert" role="alert">Only the first {PUBLISH_LIMIT.toLocaleString()} characters fit in the published context. Shorten it so nothing important is cut.</div>}
   <div className="op-review">
    <div>
     <label className="op-field">Developer-visible customer context<textarea aria-label="Developer-visible customer context" rows={12} maxLength={PUBLISH_LIMIT} value={briefing} onChange={e=>edit(()=>setBriefing(e.target.value))}/></label>
     <p className="op-muted">{briefing.length.toLocaleString()} / {PUBLISH_LIMIT.toLocaleString()} characters</p>
     {organized.heldBack.length>0&&<div className="op-box warn" aria-label="Held back"><strong>Held back ({organized.heldBack.length})</strong><ul>{organized.heldBack.map((line,i)=><li key={i}><span>{line}</span><button className="op-link" onClick={()=>edit(()=>setBriefing(b=>(b+'\n'+line).slice(0,PUBLISH_LIMIT)))}>Include</button></li>)}</ul></div>}
    </div>
    <div>
     <div className="op-box" aria-label="Extracted context"><strong>Found in the reviewed context</strong>
      {signals.reported.length?<ul>{signals.reported.map(s=><li key={s.label}><span><b>{s.label}:</b> “{s.quote}”</span></li>)}</ul>:<p className="op-muted">No technical signals found yet.</p>}
     </div>
     <div className="op-box" aria-label="Uncertainties"><strong>Not stated — developers will see these as unknown</strong>{signals.unknowns.length?<ul>{signals.unknowns.map(u=><li key={u}><span>{u.split(':')[0]}</span></li>)}</ul>:<p className="op-muted">All standard topics are mentioned.</p>}</div>
     <p className="op-muted">Extraction is keyword-based and quotes your text; it doesn’t verify anything.</p>
    </div>
   </div>
  </section>}

  {organized&&<section className="op-card" aria-label="Agreed outcome">
   <p className="op-step">Step 3</p><h2>Record the separately agreed outcome</h2>
   {organized.outcomeCandidates.length>0&&<div className="op-suggest"><span className="op-muted">From your notes:</span>{organized.outcomeCandidates.map(c=><button key={c} className="op-chip" onClick={()=>edit(()=>setOutcome(c))}>{c}</button>)}</div>}
   <label className="op-field">Agreed activation outcome<textarea aria-label="Agreed activation outcome" rows={2} maxLength={1000} value={outcome} onChange={e=>edit(()=>setOutcome(e.target.value))}/></label>
   <label className="op-field">Who agreed, when, and where it was recorded<input aria-label="Agreement attribution" maxLength={200} value={agreedBy} onChange={e=>edit(()=>setAgreedBy(e.target.value))} placeholder="e.g. Platform lead, 14 Oct trial call notes"/></label>
   <label className="op-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this developer-visible context and report a separately agreed outcome. This is reported agreement, not independent verification.</label>
   <div className="op-actions"><button className="op-btn" disabled={!session.ready||!confirmed||!briefing.trim()||!outcome.trim()||!agreedBy.trim()} onClick={()=>void session.intake(briefing,outcome,agreedBy,confirmed)}>Publish to developers</button>
   <span className="op-muted">Publishing starts this customer’s onboarding. An existing session is never overwritten; on conflict your draft stays here.</span></div>
  </section>}
 </>;
}
