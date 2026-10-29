import {useState} from 'react';
import type {ActivationSession} from '../activation/useActivation';
import type {CustomerWorkspace} from './useCustomerWorkspace';
import {describe} from './InformationTab';

/** Integrator-only paths: exact reviewed commands and initialization from an admitted context. */
export function IntegrationTools({session,ws=null}:{session:ActivationSession;ws?:CustomerWorkspace|null}){
 const [blocker,setBlocker]=useState(''),[progress,setProgress]=useState(''),[initial,setInitial]=useState('');
 const rb=session.reviewedBlocker,rp=session.reviewedProgress;
 return <section className="pt-card pt-span" style={{marginTop:26}}><details className="pt-details" style={{marginTop:0}}><summary>Integration tools</summary>
  {session.state?<>
   <label className="pt-form-field"><span>Reviewed blocker command</span><textarea className="pt-textarea" aria-label="Blocker command" rows={5} value={rb.pending?JSON.stringify(rb.pending):blocker} disabled={!!rb.pending} onChange={e=>setBlocker(e.target.value)} placeholder="Reviewed blocker JSON"/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||(!rb.pending&&!blocker)||rb.accepted} onClick={()=>void rb.submit(blocker)}>Submit / retry reviewed blocker</button><button className="pt-link" disabled={session.busy} onClick={()=>{rb.clear();setBlocker('');}}>Clear</button>{rb.accepted&&<span className="pt-note" style={{marginTop:0}} role="status">Blocker accepted.</span>}</div>
   <label className="pt-form-field"><span>Reviewed progress command</span><textarea className="pt-textarea" aria-label="Progress command" rows={5} value={rp.pending?JSON.stringify(rp.pending):progress} disabled={!!rp.pending} onChange={e=>setProgress(e.target.value)} placeholder="Reviewed progress JSON"/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||(!rp.pending&&!progress)||rp.accepted} onClick={()=>void rp.submit(progress)}>Submit / retry reviewed progress</button><button className="pt-link" disabled={session.busy} onClick={()=>{rp.clear();setProgress('');}}>Clear</button>{rp.accepted&&<span className="pt-note" style={{marginTop:0}} role="status">Reviewed action progress saved.</span>}</div>
  </>:<>
   {ws&&<DirectPublish ws={ws} session={session}/>}
   <label className="pt-form-field"><span>Initialize from an admitted context</span><textarea className="pt-textarea" aria-label="Admitted initialization" rows={5} value={initial} onChange={e=>setInitial(e.target.value)}/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!session.ready||!initial} onClick={()=>void session.initialize(initial)}>Initialize reviewed session</button></div>
  </>}
 </details></section>;
}

const PUBLISH_ERRORS:Record<string,string>={AWAITING_CHAMPION_REVIEW:'This draft is waiting for Champion review. Withdraw it first; nothing is published around that review.',
 CONFIDENTIAL_CONTENT:'A milestone or the outcome mentions commercial or internal details. Edit the draft first.',REVISION_CONFLICT:'This customer is already published.',INVALID_REQUEST:'Each of the first three milestones needs a title, actions and completion criteria.'};
/** The pre-existing developer publication path, kept for demos and integration. It is not Champion approval:
 * it publishes Chris's saved draft (first three milestones) to developers directly, and says so. */
function DirectPublish({ws,session}:{ws:CustomerWorkspace;session:ActivationSession}){
 const [outcome,setOutcome]=useState(''),[agreedBy,setAgreedBy]=useState(''),[confirmed,setConfirmed]=useState(false);
 const record=ws.latest;
 if(!record)return null;
 const ok=record.status==='draft'&&!ws.reviewDirty&&confirmed&&!!outcome.trim()&&!!agreedBy.trim()&&ws.busy==='';
 return <div aria-label="Publish without Champion review">
  <p className="pt-label" style={{marginTop:18}}>Publish to developers without Champion review</p>
  <p className="pt-note">Demo and integration path only. This skips the Champion review and is not an approval. It publishes your saved draft’s first three milestones to developers.</p>
  <label className="pt-form-field"><span>Agreed activation outcome</span><input className="pt-input" aria-label="Agreed activation outcome" maxLength={300} value={outcome} onChange={e=>setOutcome(e.target.value)}/></label>
  <label className="pt-form-field"><span>Who agreed, when, and where it was recorded</span><input className="pt-input" aria-label="Agreement attribution" maxLength={200} value={agreedBy} onChange={e=>setAgreedBy(e.target.value)}/></label>
  <label className="pt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I understand this publishes to developers without Champion review.</label>
  <div className="pt-actions"><button className="pt-btn sm ghost" disabled={!ok} onClick={async()=>{if(await ws.publishReviewed(outcome.trim(),agreedBy.trim()))await session.refresh();}}>{ws.busy==='publish'?'Publishing…':'Publish without Champion review'}</button>
   {record.status==='submitted'&&<span className="pt-note" style={{marginTop:0}}>Waiting for Champion review: withdraw first.</span>}</div>
  {ws.error?.scope==='publish'&&<div className="pt-banner error" role="alert">{PUBLISH_ERRORS[ws.error.code]??describe(ws.error.code)}</div>}
  <hr/>
 </div>;
}
