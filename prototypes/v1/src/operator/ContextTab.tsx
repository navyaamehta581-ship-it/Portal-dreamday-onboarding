import type {ActivationState} from '../../../../contracts/activation/v1/state';
import {navigate} from '../portal-app/router';
import {evidenceLabel} from '../portal-app/onboarding/model';
import {PUBLISH_LIMIT,signalsFor} from './notes';
import type {OperatorDraft} from './useOperatorDraft';

/** Customer Context: paste → organize → review before publishing; the published handoff afterwards. */
export function ContextTab({draft,state}:{draft:OperatorDraft;state:ActivationState|null}){
 if(state)return <PublishedContext state={state}/>;
 const signals=signalsFor(draft.briefing);
 return <div className="pt-grid">
  <section className="pt-card pt-span" aria-label="Operator publication">
   <h3>Paste what you already know</h3>
   <p className="pt-note">CRM summaries, discovery and trial notes, technical requirements and who agreed what — all together. Nothing is sent until you publish.</p>
   <textarea className="pt-textarea" style={{marginTop:16}} aria-label="Raw account and call notes" rows={10} maxLength={60000} value={draft.raw} onChange={e=>draft.setRaw(e.target.value)} placeholder="Paste notes here. Omit secrets."/>
   <div className="pt-actions"><button className="pt-btn sm" disabled={!draft.raw.trim()} onClick={draft.organize}>Organize notes</button></div>
  </section>
  {draft.organized&&<>
   <section className="pt-card" aria-label="Review before publishing">
    <h3>Review what developers will see</h3>
    <p className="pt-note">Shown to this customer’s developers in Portal. Lines that look commercial or private were held back — check both lists.</p>
    {draft.organized.truncated&&<div className="pt-banner warn" role="alert">Only the first {PUBLISH_LIMIT.toLocaleString()} characters fit in the published context. Shorten it so nothing important is cut.</div>}
    <textarea className="pt-textarea" style={{marginTop:16}} aria-label="Developer-visible customer context" rows={12} maxLength={PUBLISH_LIMIT} value={draft.briefing} onChange={e=>draft.setBriefing(e.target.value)}/>
    <p className="pt-note">{draft.briefing.length.toLocaleString()} / {PUBLISH_LIMIT.toLocaleString()} characters</p>
    {draft.organized.heldBack.length>0&&<><hr/><p className="pt-label">Held back ({draft.organized.heldBack.length})</p>
     <table className="pt-table" aria-label="Held back"><tbody>{draft.organized.heldBack.map((line,i)=><tr key={i}><td>{line}</td><td style={{width:90,textAlign:'right'}}><button className="pt-link" onClick={()=>draft.setBriefing((draft.briefing+'\n'+line).slice(0,PUBLISH_LIMIT))}>Include</button></td></tr>)}</tbody></table></>}
   </section>
   <section className="pt-card" aria-label="Extracted context">
    <h3>Found in the reviewed context</h3>
    {signals.reported.length?<dl className="pt-fields" style={{gridTemplateColumns:'1fr'}}>{signals.reported.map(s=><div className="pt-field" key={s.label}><dt>{s.label}</dt><dd className="plain">“{s.quote}”</dd></div>)}</dl>:<p className="pt-note">No technical signals found yet.</p>}
    <hr/>
    <div aria-label="Uncertainties"><p className="pt-label">Not stated — developers will see these as unknown</p>
     {signals.unknowns.length?<ul className="pt-list">{signals.unknowns.map(u=><li key={u}>{u.split(':')[0]}</li>)}</ul>:<p className="pt-note">All standard topics are mentioned.</p>}</div>
    <p className="pt-note">Keyword-based extraction that quotes your text; it doesn’t verify anything.</p>
    <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator/goal')}>Continue to Activation Goal</button></div>
   </section>
  </>}
 </div>;
}

function PublishedContext({state}:{state:ActivationState}){
 return <div className="pt-grid">
  <section className="pt-card" aria-label="Published customer handoff">
   <h3>Published context</h3>
   <dl className="pt-fields"><div className="pt-field wide"><dt>Developer-visible context</dt><dd className="plain">{state.context.briefing}</dd></div></dl>
   <p className="pt-note">Context revision {state.contextRevision}. Editing or republishing isn’t supported; a new admission session is needed.</p>
  </section>
  <section className="pt-card" aria-label="Reported constraints">
   <h3>What developers see as known and unknown</h3>
   <p className="pt-label" style={{marginTop:18}}>Reported technical context</p>
   <ul className="pt-list">{state.context.constraints.map((c,i)=><li key={i}>{c}</li>)}</ul>
   <hr/><p className="pt-label">Still unknown</p>
   <ul className="pt-list">{state.context.unknowns.map(u=><li key={u}>{u}</li>)}</ul>
  </section>
  <section className="pt-card pt-span" aria-label="All evidence">
   <h3>Evidence</h3>
   <table className="pt-table"><thead><tr><th style={{width:'20%'}}>Source type</th><th>Claim</th></tr></thead>
    <tbody>{state.evidence.map(e=><tr key={e.id}><td><span className="pt-pill">{evidenceLabel(e.kind)}</span></td><td>{e.claim}</td></tr>)}</tbody></table>
  </section>
 </div>;
}
