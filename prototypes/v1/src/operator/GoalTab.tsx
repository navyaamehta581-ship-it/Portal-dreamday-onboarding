import type {ActivationSession} from '../activation/useActivation';
import {navigate} from '../portal-app/router';
import type {OperatorDraft} from './useOperatorDraft';

/** Activation Goal: the separately agreed outcome, who agreed, and publication. */
export function GoalTab({draft,session}:{draft:OperatorDraft;session:ActivationSession}){
 const state=session.state;
 if(state)return <section className="pt-card" aria-label="Agreed outcome">
  <h3>Agreed activation outcome</h3>
  <dl className="pt-fields">
   <div className="pt-field wide"><dt>Outcome</dt><dd>{state.context.agreedGoal.text}</dd></div>
   <div className="pt-field"><dt>Agreed by</dt><dd>{state.context.agreedGoal.agreedBy}</dd></div>
   <div className="pt-field"><dt>Recorded</dt><dd>{new Date(state.context.agreedGoal.agreedAt).toLocaleString()}</dd></div>
   <div className="pt-field"><dt>Context</dt><dd>revision {state.contextRevision}</dd></div>
  </dl>
  <p className="pt-note">This is reported agreement, not independent verification.</p>
 </section>;
 if(!draft.organized)return <section className="pt-card"><h3>Organize the customer notes first</h3><p className="pt-note">The outcome is published together with the reviewed context.</p>
  <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator')}>Go to Customer Context</button></div></section>;
 const ready=session.ready&&draft.confirmed&&!!draft.briefing.trim()&&!!draft.outcome.trim()&&!!draft.agreedBy.trim();
 return <section className="pt-card" aria-label="Agreed outcome">
  <h3>Record the separately agreed outcome</h3>
  {draft.organized.outcomeCandidates.length>0&&<><p className="pt-label" style={{marginTop:18}}>From your notes</p>
   <div className="pt-suggest-row">{draft.organized.outcomeCandidates.map(c=><button key={c} className="pt-tool" onClick={()=>draft.setOutcome(c)}>{c}</button>)}</div></>}
  <label className="pt-form-field"><span>Agreed activation outcome</span><textarea className="pt-textarea" style={{minHeight:72}} aria-label="Agreed activation outcome" rows={2} maxLength={1000} value={draft.outcome} onChange={e=>draft.setOutcome(e.target.value)}/></label>
  <label className="pt-form-field"><span>Who agreed, when, and where it was recorded</span><input className="pt-input" aria-label="Agreement attribution" maxLength={200} value={draft.agreedBy} onChange={e=>draft.setAgreedBy(e.target.value)} placeholder="e.g. Platform lead, 14 Oct trial call notes"/></label>
  <label className="pt-check"><input type="checkbox" checked={draft.confirmed} onChange={e=>draft.setConfirmed(e.target.checked)}/>I reviewed this developer-visible context and report a separately agreed outcome. This is reported agreement, not independent verification.</label>
  <div className="pt-actions"><button className="pt-btn sm" disabled={!ready} onClick={()=>void session.intake(draft.briefing,draft.outcome,draft.agreedBy,draft.confirmed)}>Publish to developers</button></div>
  <p className="pt-note">Publishing starts this customer’s onboarding. An existing session is never overwritten; on conflict your draft stays here.</p>
 </section>;
}
