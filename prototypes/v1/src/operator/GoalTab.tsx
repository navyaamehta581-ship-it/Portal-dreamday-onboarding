import type {MilestoneDraft} from '../../../../contracts/activation/v1/handoff';
import type {ActivationSession} from '../activation/useActivation';
import {navigate} from '../portal-app/router';
import {splitLines,type OperatorDraft} from './useOperatorDraft';
import {versionLabel} from './versions';

const ERRORS:Record<string,string>={CONFIDENTIAL_CONTENT:'The milestone or outcome mentions commercial or internal details. Remove them before publishing.',REVISION_CONFLICT:'This customer is already published. A published plan is never overwritten.',ADAPTER_UNAVAILABLE:'Publishing isn’t enabled on this server.',INVALID_REQUEST:'Every milestone field needs content before publishing.'};

/** Activation Goal: review and edit the proposed technical milestone, then publish. */
export function GoalTab({draft,session}:{draft:OperatorDraft;session:ActivationSession}){
 const state=session.state,published=draft.published;
 if(state)return <section className="pt-card" aria-label="Agreed outcome">
  <div className="pt-card-head"><h3>Agreed activation outcome</h3>{published&&<span className="pt-pill green">{versionLabel(published)}</span>}</div>
  <dl className="pt-fields">
   <div className="pt-field wide"><dt>Outcome</dt><dd>{state.context.agreedGoal.text}</dd></div>
   <div className="pt-field"><dt>Agreed by</dt><dd>{state.context.agreedGoal.agreedBy}</dd></div>
   <div className="pt-field"><dt>Recorded</dt><dd>{new Date(state.context.agreedGoal.agreedAt).toLocaleString()}</dd></div>
   <div className="pt-field wide"><dt>First milestone</dt><dd>{state.plan.selectedMilestone.outcome}</dd></div>
  </dl>
  <p className="pt-label" style={{marginTop:22}}>Completion criteria</p>
  <ul className="pt-list">{state.plan.selectedMilestone.successCriteria.map(c=><li key={c}>{c}</li>)}</ul>
 </section>;
 if(!draft.record)return <section className="pt-card"><h3>Analyze the customer sources first</h3><p className="pt-note">The milestone is proposed from your sources and published with your agreement.</p>
  <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator')}>Go to Customer Context</button></div></section>;
 const m=draft.milestone,set=(patch:Partial<MilestoneDraft>)=>m&&draft.setMilestone({...m,...patch});
 const ready=session.ready&&!draft.busy&&draft.confirmed&&!!m&&!!draft.outcome.trim()&&!!draft.agreedBy.trim()&&m.actions.length>0&&m.completionCriteria.length>0;
 return <section className="pt-card" aria-label="Agreed outcome">
  <div className="pt-card-head"><h3>Proposed first milestone</h3><span className="pt-pill">{versionLabel(draft.record)}</span></div>
  {!m?<><div className="pt-banner warn" role="status">There isn’t enough technical information for a milestone yet.</div>
   <p className="pt-label" style={{marginTop:18}}>Collect from the customer</p><ul className="pt-list">{draft.record.proposal.missing.map(x=><li key={x}>{x}</li>)}</ul>
   <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator')}>Add a source</button></div></>:<>
   <p className="pt-note">Proposed from your sources. Edit anything before publishing; developers see exactly this.</p>
   <label className="pt-form-field"><span>Objective</span><input className="pt-input" aria-label="Milestone objective" maxLength={200} value={m.objective} onChange={e=>set({objective:e.target.value})}/></label>
   <dl className="pt-fields">
    <div className="pt-field"><dt>Service</dt><dd>{m.system.service??'Not identified'}</dd></div>
    <div className="pt-field"><dt>Repository</dt><dd>{m.system.repository??'Not identified'}</dd></div>
    <div className="pt-field"><dt>Platform</dt><dd>{m.system.platform??'Not identified'}</dd></div>
   </dl>
   <label className="pt-form-field"><span>Why it matters</span><textarea className="pt-textarea" aria-label="Why it matters" rows={3} maxLength={700} value={m.why} onChange={e=>set({why:e.target.value})}/></label>
   <label className="pt-form-field"><span>Actions · one per line</span><textarea className="pt-textarea" aria-label="Milestone actions" rows={5} value={m.actions.join('\n')} onChange={e=>set({actions:splitLines(e.target.value)})}/></label>
   <label className="pt-form-field"><span>Expected output</span><input className="pt-input" aria-label="Expected output" maxLength={600} value={m.expectedOutput} onChange={e=>set({expectedOutput:e.target.value})}/></label>
   <label className="pt-form-field"><span>Completion criteria · one per line</span><textarea className="pt-textarea" aria-label="Completion criteria" rows={4} value={m.completionCriteria.join('\n')} onChange={e=>set({completionCriteria:splitLines(e.target.value)})}/></label>
   <p className="pt-label" style={{marginTop:18}}>Before starting</p>
   <ul className="pt-list">{m.prerequisites.map(p=><li key={p.text}>{p.text} <span className={'pt-pill '+(p.state==='met'?'green':p.state==='unmet'?'red':'amber')}>{p.state}</span></li>)}</ul>
   <hr/>
   <label className="pt-form-field"><span>Agreed activation outcome</span><textarea className="pt-textarea" style={{minHeight:72}} aria-label="Agreed activation outcome" rows={2} maxLength={300} value={draft.outcome} onChange={e=>draft.setOutcome(e.target.value)}/></label>
   <label className="pt-form-field"><span>Who agreed, when, and where it was recorded</span><input className="pt-input" aria-label="Agreement attribution" maxLength={200} value={draft.agreedBy} onChange={e=>draft.setAgreedBy(e.target.value)} placeholder="e.g. Platform lead, 14 Oct discovery call"/></label>
   <label className="pt-check"><input type="checkbox" checked={draft.confirmed} onChange={e=>draft.setConfirmed(e.target.checked)}/>I reviewed this developer-visible milestone, and this outcome was agreed with the customer.</label>
   <div className="pt-actions"><button className="pt-btn sm" disabled={!ready} onClick={()=>void draft.publish()}>{draft.busy?'Publishing…':'Publish to developers'}</button></div>
   {draft.error&&<div className="pt-banner error" role="alert">{ERRORS[draft.error]??`Publishing failed (${draft.error}). Your edits are kept.`}</div>}
   <p className="pt-note">Publishing starts this customer’s onboarding. The agreement attribution stays with you.</p>
  </>}
 </section>;
}
