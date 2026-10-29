import {useState} from 'react';
import {Check,Plus,X} from 'lucide-react';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {HandoffRecord,ReviewDraft,ReviewStakeholder} from '../../../../contracts/activation/v1/handoff';
import {Items,Milestones,newId,rowsFor} from '../review/Editors';
import {navigate} from '../portal-app/router';
import {accountStatus,type CustomerWorkspace} from './useCustomerWorkspace';
import {describe,modelProblem} from './InformationTab';

const REASONS:Record<string,string>={unassigned:'needs an assignee',missing:'needs content',no_milestone:'add at least one milestone',not_a_technical_stakeholder:'isn’t one of the technical stakeholders',unknown_milestone:'depends on a milestone that no longer exists',
 circular_dependencies:'milestones depend on each other in a loop',commercial_text:'mentions commercial or deal details',company_statistic:'mentions company size figures',private_comment:'contains an executive or private comment',
 deal_stage:'mentions the deal stage or evaluation timeline',internal_text:'restates one of your private notes',private_name:'names someone outside the technical team'};
const SUBMIT_ERRORS:Record<string,string>={ALREADY_APPROVED:'The Champion already approved this plan.',AWAITING_CHAMPION_REVIEW:'This draft is with the Champion. Withdraw it to make changes.',REVIEW_INCOMPLETE:'Some parts of the draft need attention before it can go to the Champion:',CONFIDENTIAL_CONTENT:'The Champion must not receive internal or commercial information. Edit these parts first:',
 REVISION_CONFLICT:'This draft was saved in another tab. Reload to see the latest version.',NOT_LATEST_DRAFT:'A newer analysis exists. Reload to review the latest draft.',INVALID_TRANSITION:'The draft’s status changed in another tab. Reload to see it.'};
const id=newId;

/** Onboarding Draft: Chris reviews and edits the analysis, saves it, and marks it ready for Champion review. */
export function ReviewTab({ws,state}:{ws:CustomerWorkspace;state:ActivationState|null}){
 if(state)return <PublishedSummary state={state} record={ws.latest}/>;
 const record=ws.latest,r=ws.review;
 if(!record||!r)return <section className="pt-card"><h3>{ws.running?'Analysis is running':'Upload the customer’s PDF first'}</h3>
  <p className="pt-note">{ws.running?'The draft appears here when the analysis finishes.':'The onboarding draft is generated from your saved customer information, then you review and edit it here.'}</p>
  <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator')}>Go to Customer Context</button></div></section>;
 // Chris edits while drafting and after the Champion requested changes; under review or approved, the draft is locked.
 const submitted=record.status==='submitted'||record.status==='resubmitted'||record.status==='approved',locked=submitted||ws.running;
 const feedback=record.status==='changes_requested'?[...(record.history??[])].reverse().find(e=>e.action==='changes_requested'):null;
 const set=(next:Partial<ReviewDraft>)=>ws.setReview({...r,...next});
 const status=accountStatus(ws,false);
 const suggestion=record.understanding.model?.ok?'AI suggestion':record.understanding.interpreter==='hosted_model'?'AI suggestion':'Rule-based suggestion';
 return <div className="pt-review">
  <div className="pt-savebar" role="region" aria-label="Draft status">
   <span className={'pt-pill '+status.tone}>{status.label}</span>
   <span className="pt-note" style={{marginTop:0}}>Draft {record.draft} · {provenance(record)}</span>
   <span className="grow"/>
   {ws.busy==='review'?<span role="status">Saving…</span>:ws.reviewDirty?<span className="pt-pill amber" role="status">Unsaved changes</span>:<span className="pt-savestate" role="status"><Check size={14} aria-hidden="true"/>{record.reviewUpdatedAt?`Saved ${new Date(record.reviewUpdatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Saved'}</span>}
   {ws.reviewDirty&&<button className="pt-link" onClick={ws.discardReview}>Discard</button>}
   <button className="pt-btn sm" disabled={!ws.reviewDirty||ws.busy==='review'||locked} onClick={()=>void ws.saveReview()}>Save draft</button>
  </div>
  {feedback&&<div className="pt-banner warn" role="status" aria-label="Champion feedback"><div><strong>{feedback.by} requested changes in Dream Day</strong> · {new Date(feedback.at).toLocaleString()}<p style={{marginTop:6,whiteSpace:'pre-wrap'}}>{feedback.comment}</p><p className="pt-note" style={{marginTop:6}}>Revise the draft, save it, then resubmit it for Champion review.</p></div></div>}
  {ws.document&&!ws.document.complete&&record.basedOnWorkspaceRevision===ws.overview?.workspace.revision&&<div className="pt-banner warn" role="status">This draft comes from a partly read PDF ({ws.document.fileName}): some pages or text couldn’t be read. Check the Customer Context tab for what’s missing before you submit.</div>}
  {ws.running&&<div className="pt-banner warn" role="status">A new analysis is running. This draft will be replaced by the new one when it finishes, so editing is paused.</div>}
  {record.understanding.model&&!record.understanding.model.ok&&<div className="pt-banner warn" role="status">This draft comes from rule-based analysis: {modelProblem(record.understanding.model.error,record.understanding.model.errorDetail).text} It was not generated by the model.</div>}
  {ws.error?.scope==='review'&&<div className="pt-banner error" role="alert">{SUBMIT_ERRORS[ws.error.code]??describe(ws.error.code)}</div>}
  <fieldset className="pt-fieldset" disabled={locked}>
   <section className="pt-card" aria-label="Customer engineering problem">
    <h3>Customer engineering problem</h3>
    <label className="pt-form-field"><span>Summary</span><textarea className="pt-textarea" aria-label="Problem summary" rows={rowsFor(r.problem.summary,3)} value={r.problem.summary} onChange={e=>set({problem:{...r.problem,summary:e.target.value}})}/></label>
    <Items label="Main technical challenge" title="Main technical challenges" items={r.problem.challenges} suggestion={suggestion} onChange={challenges=>set({problem:{...r.problem,challenges}})}/>
    <Items label="Relevant system" title="Relevant systems and workflows" items={r.problem.systems} suggestion={suggestion} single onChange={systems=>set({problem:{...r.problem,systems}})}/>
    <Items label="Contradiction" title="Contradictions" hint="Sources that disagree. Resolve them with the customer before relying on either." items={r.problem.contradictions} suggestion={suggestion} onChange={contradictions=>set({problem:{...r.problem,contradictions}})}/>
    <Items label="Unknown" title="Unknowns a developer can check" items={r.problem.unknowns} suggestion={suggestion} onChange={unknowns=>set({problem:{...r.problem,unknowns}})}/>
   </section>
   <section className="pt-card" aria-label="Known facts">
    <h3>Known facts</h3><p className="pt-note">What the sources state. Verified means observed in a repository; reported means someone said it; unconfirmed means hedged or disputed.</p>
    <Items label="Fact" title="" items={r.facts} suggestion={suggestion} onChange={facts=>set({facts})}/>
   </section>
   <Stakeholders items={r.stakeholders} onChange={stakeholders=>set({stakeholders})}/>
   <section className="pt-card" aria-label="Technical goals">
    <h3>Technical goals</h3><p className="pt-note">Customer requirements come from the customer’s sources. Suggestions are proposals for you to keep, change or remove.</p>
    <Items label="Goal" title="" items={r.goals} suggestion={suggestion} customerLabel="Customer requirement" onChange={goals=>set({goals})}/>
   </section>
   <Milestones milestones={r.milestones} people={r.stakeholders.filter(s=>s.technical&&s.name.trim()).map(s=>s.name.trim())} suggestion={suggestion} onChange={milestones=>set({milestones})}/>
   <section className="pt-card" aria-label="Questions for the customer">
    <h3>Questions for the customer</h3><p className="pt-note">Unanswered. These are open questions, not facts; confirmed and reported facts are listed under Known facts.</p>
    <Items label="Question" title="" items={r.questions} suggestion={suggestion} onChange={questions=>set({questions})}/>
   </section>
  </fieldset>
  <Internal record={record}/>
  <Submission ws={ws} record={record}/>
 </div>;
}

const provenance=(rec:HandoffRecord)=>{const m=rec.understanding.model;return m?.ok?`Local model · ${m.model}`:m?`Rule-based fallback · model unavailable (${m.error})`:rec.understanding.interpreter==='hosted_model'?'Model-assisted analysis':'Rule-based analysis · no model';};

const BASIS:Record<ReviewStakeholder['basis'],string>={stated:'Named in sources',inferred:'Inferred from sources',role_default:'Role default responsibilities',chris:'Added by you'};
function Stakeholders({items,onChange}:{items:ReviewStakeholder[];onChange:(x:ReviewStakeholder[])=>void}){
 const edit=(i:number,patch:Partial<ReviewStakeholder>)=>onChange(items.map((s,j)=>j===i?{...s,...patch}:s));
 return <section className="pt-card" aria-label="Stakeholders">
  <h3>Stakeholders</h3><p className="pt-note">People named in the customer’s sources. Commercial and executive roles stay with you and are never shared with the Champion or developers.</p>
  {items.length===0&&<p className="pt-note">No named people yet.</p>}
  {items.map((s,i)=><div className="pt-item" key={s.id}>
   <div className="pt-item-meta"><span className={'pt-pill '+(s.basis==='chris'?'green':s.basis==='stated'?'':'amber')}>{BASIS[s.basis]}</span>{!s.technical&&<span className="pt-pill red">Internal · not shared</span>}{s.sources.length?<span className="pt-note" style={{marginTop:0}}>Source: {s.sources.join(', ')}</span>:null}</div>
   <div className="pt-person">
    <input className="pt-input" aria-label={`Stakeholder ${i+1} name`} value={s.name} maxLength={80} onChange={e=>edit(i,{name:e.target.value})}/>
    <input className="pt-input" aria-label={`Stakeholder ${i+1} role`} value={s.role} maxLength={120} onChange={e=>edit(i,{role:e.target.value})}/>
    <button className="pt-icon" aria-label={`Remove stakeholder ${i+1}`} onClick={()=>onChange(items.filter((_,j)=>j!==i))}><X size={16}/></button>
   </div>
   <textarea className="pt-textarea compact" aria-label={`Stakeholder ${i+1} responsibilities`} placeholder="Responsibilities" rows={rowsFor(s.responsibilities)} maxLength={600} value={s.responsibilities} onChange={e=>edit(i,{responsibilities:e.target.value,...(s.basis==='role_default'?{basis:'chris' as const}:{})})}/>
  </div>)}
  <button className="pt-link" style={{marginTop:12}} onClick={()=>onChange([...items,{id:id('p'),name:'',role:'',responsibilities:'',basis:'chris',sources:[],technical:true}])}><Plus size={14} aria-hidden="true"/> Add stakeholder</button>
 </section>;
}

const INTERNAL_LABEL:Record<string,string>={commercial:'Commercial',stakeholder:'People',evaluation:'Evaluation',internal_note:'Note',business_need:'Need'};
/** What the analysis kept internal. Only Chris sees it; it is never part of the submission. */
function Internal({record}:{record:HandoffRecord}){
 const internal=record.understanding.findings.filter(f=>f.audience==='internal');
 return <section className="pt-card" aria-label="Kept internal">
  <details className="pt-details" style={{marginTop:0}}><summary>Kept internal ({internal.length}) · only you see this</summary>
   <p className="pt-note">Commercial details, people notes and your private notes found in the information. They are never submitted for Champion review or shown to developers.</p>
   <ul className="pt-findings compact">{internal.map(f=><li key={f.id}><span className="pt-pill">{INTERNAL_LABEL[f.category]??'Note'}</span><span className="pt-clamp">{f.statement}</span></li>)}</ul>
  </details>
 </section>;
}

const ACTION:Record<string,string>={submitted:'Submitted for Champion review',resubmitted:'Resubmitted for Champion review',withdrawn:'Withdrawn',changes_requested:'Changes requested',approved:'Approved',published:'Published to developers'};
/** The Dream Day review steps so far, with the Champion's comments. */
export function ReviewHistory({record}:{record:HandoffRecord|null}){
 const history=record?.history??[];
 if(!history.length)return null;
 return <section className="pt-card" aria-label="Dream Day review history">
  <h3>Dream Day review history</h3>
  <ol className="pt-milestones">{history.map((e,i)=><li key={i}><span className={'pt-pill '+(e.action==='changes_requested'?'amber':e.action==='approved'||e.action==='published'?'green':'blue')}>{ACTION[e.action]}</span>
   <div><strong>{e.by}</strong><p>{new Date(e.at).toLocaleString()}</p>{e.comment&&<p style={{whiteSpace:'pre-wrap'}}>“{e.comment}”</p>}</div></li>)}</ol>
 </section>;
}

function Submission({ws,record}:{ws:CustomerWorkspace;record:HandoffRecord}){
 const [confirmed,setConfirmed]=useState(false);
 const err=ws.error?.scope==='submit'?ws.error:null;
 const history=<ReviewHistory record={record}/>;
 if(record.status==='approved')return <>{history}<section className="pt-card" aria-label="Champion review">
  <h3>Champion approval complete</h3>
  <p style={{marginTop:12}}>Approved by {record.approvals?.champion.by} on {record.approvals?.champion.at?new Date(record.approvals.champion.at).toLocaleString():''}. Publishing to developers isn’t enabled on this server, so developers don’t see it yet.</p>
 </section></>;
 if(record.status==='submitted'||record.status==='resubmitted')return <>{history}<section className="pt-card" aria-label="Champion review">
  <h3>{record.status==='resubmitted'?'Resubmitted for Champion review':'Submitted for Champion review'}</h3>
  <p style={{marginTop:12}}>Submitted {record.submittedAt?new Date(record.submittedAt).toLocaleString():''}. Your Champion reviews it in Dream Day and can edit it, assign the work, ask for changes or approve it. Nothing is visible to developers until it is approved.</p>
  <div className="pt-actions"><button className="pt-btn sm ghost" disabled={ws.busy==='submit'} onClick={()=>void ws.withdraw()}>Withdraw to make changes</button></div>
  {err&&<div className="pt-banner error" role="alert">{SUBMIT_ERRORS[err.code]??describe(err.code)}</div>}
 </section></>;
 const blocked=ws.reviewDirty||ws.running||ws.busy!=='';
 const again=record.status==='changes_requested'||(record.history??[]).some(e=>e.action==='submitted'||e.action==='resubmitted');
 return <>{history}<section className="pt-card" aria-label="Submit for Champion review">
  <h3>{again?'Ready to resubmit?':'Ready for Champion review?'}</h3>
  <p className="pt-note">Submitting sends this draft to your Champion’s Dream Day review. It does not publish anything: developers see onboarding only after the Champion approves it.</p>
  <label className="pt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this draft. It contains no commercial details, internal notes or private comments.</label>
  <div className="pt-actions"><button className="pt-btn sm" disabled={!confirmed||blocked} onClick={()=>void ws.submit()}>{ws.busy==='submit'?'Submitting…':again?'Resubmit for Champion review':'Mark ready for Champion review'}</button>
   {ws.reviewDirty&&<span className="pt-note" style={{marginTop:0}}>Save your changes first.</span>}</div>
  {err&&<div className="pt-banner error" role="alert"><div>{SUBMIT_ERRORS[err.code]??describe(err.code)}{err.issues?.length?<ul className="pt-list">{err.issues.map(x=><li key={x.path}>{x.label}: {REASONS[x.reason]??x.reason}</li>)}</ul>:null}</div></div>}
 </section></>;
}

function PublishedSummary({state,record}:{state:ActivationState;record:HandoffRecord|null}){
 const approval=record?.approvals?.champion.status==='approved'?record.approvals.champion:null;
 const team=(record?.review?.milestones??[]).filter(m=>m.assignee);
 return <><section className="pt-card" aria-label="Agreed outcome">
  <div className="pt-card-head"><h3>Agreed activation outcome</h3><span className={'pt-pill '+(approval?'green':'')}>{approval?'Approved · Published to developers':'Published before Dream Day'}</span></div>
  {approval?<div className="pt-banner" role="status">Champion approval complete: approved by {approval.by} in Dream Day on {new Date(approval.at!).toLocaleString()}.</div>
   :<div className="pt-banner warn" role="status">This plan was published before Dream Day. No Champion approval is recorded for it.</div>}
  <dl className="pt-fields">
   <div className="pt-field wide"><dt>Outcome</dt><dd>{state.context.agreedGoal.text}</dd></div>
   <div className="pt-field"><dt>Agreed by</dt><dd>{state.context.agreedGoal.agreedBy}</dd></div>
   <div className="pt-field"><dt>Recorded</dt><dd>{new Date(state.context.agreedGoal.agreedAt).toLocaleString()}</dd></div>
   <div className="pt-field wide"><dt>First milestone</dt><dd>{state.plan.selectedMilestone.outcome}</dd></div>
  </dl>
  {approval&&team.length>0&&<><p className="pt-label" style={{marginTop:22}}>Approved responsibilities</p>
   <ul className="pt-list" aria-label="Approved responsibilities">{team.map(m=><li key={m.id}><span><strong>{m.assignee}</strong> · {m.title}</span></li>)}</ul></>}
  <p className="pt-label" style={{marginTop:22}}>Completion criteria</p>
  <ul className="pt-list">{state.plan.selectedMilestone.successCriteria.map(c=><li key={c}>{c}</li>)}</ul>
 </section><ReviewHistory record={record}/></>;
}
