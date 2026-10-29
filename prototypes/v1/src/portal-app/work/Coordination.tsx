import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import type {AttentionReason,MilestoneProgress,WorkUpdate} from '../../../../../contracts/activation/v1/handoff';
import {Thread,isOpen,when} from './Thread';
import {REVIEW_LABEL,STATUS_LABEL,statusTone,workProblem,type MilestoneWorkSession} from './useMilestoneWork';

const ACTION_LABEL={not_started:'Not started',started:'Started',blocked:'Blocked',completed:'Completed'} as const;
const REASON:Record<AttentionReason,string>={blocked:'Blocked',open_blocker:'Open blocker',open_question:'Unanswered question',awaiting_review:'Ready for your review',review_outdated:'Changed since your review',waiting_on_dependency:'Waiting on a dependency'};
const reviewTone=(s:MilestoneProgress['reviewState'])=>s==='reviewed'?'green':s==='awaiting_review'?'blue':s==='reviewed_outdated'?'amber':'';

/** Team progress from the server's progress records. The Champion coordinates and reviews here; Chris sees the same
 * view read-only. Every number comes from the server, so this view, Chris's and the developers' always agree. */
export function CoordinationView({work,mode}:{work:MilestoneWorkSession;mode:'champion'|'observer'}){
 const {progress,loading,error}=work,champion=mode==='champion';
 if(!progress)return <p className="pt-note" role={error&&!loading?'alert':'status'}>{loading?'Loading team progress…':error?workProblem(error):''}</p>;
 const s=progress.summary,attention=progress.milestones.filter(m=>m.attention?.length);
 return <div style={{display:'grid',gap:20}}>
  <section className="pt-card" aria-label="Team progress">
   <div className="pt-card-head"><h3>Team progress</h3><button className="pt-tool" disabled={loading} onClick={()=>void work.reload()}><RefreshCw size={15} aria-hidden="true"/>{loading?'Refreshing…':'Refresh progress'}</button></div>
   {s&&<dl className="pt-coord-summary">
    <div><dt>Completed</dt><dd>{s.completed}<small> of {s.milestones} milestones</small></dd></div>
    <div><dt>In progress</dt><dd>{s.inProgress+s.readyForReview}</dd></div>
    <div><dt>Blocked</dt><dd>{s.blocked}</dd></div>
    <div><dt>{champion?'Awaiting your review':'Awaiting Champion review'}</dt><dd>{s.awaitingReview}</dd></div>
    <div><dt>Open blockers</dt><dd>{s.openBlockers}</dd></div>
    <div><dt>Open questions</dt><dd>{s.openQuestions+s.openFollowUps}</dd></div>
    <div><dt>Actions done</dt><dd>{s.actionsCompleted}<small> of {s.actionsTotal}</small></dd></div>
   </dl>}
   <p className="pt-note">Progress is what developers record in Portal as they work; nothing is detected automatically or verified. The plan has no deadlines, so nothing is shown as overdue.</p>
  </section>
  <section className="pt-card" aria-label="Needs attention">
   <h3>{champion?'Needs your attention':'Needs attention'}</h3>
   {attention.length?<ul className="pt-milestones">{attention.map(m=><li key={m.id}><div><strong><a href={`#coord-${m.id}`}>{m.title}</a></strong><p>{m.assignee??'Unassigned'} · {m.attention!.map(r=>REASON[r]).join(' · ')}</p></div></li>)}</ul>
    :<p className="pt-note">Nothing is blocked, waiting for an answer or waiting for review.</p>}
  </section>
  {/* Repository observations are Spotify's integration, not the Champion's job: they reach the team through the
   suggested opportunities and AiKA, not as a panel to check here. */}
  {progress.milestones.map(m=><MilestoneCoordination key={m.id} m={m} work={work} champion={champion}/>)}
 </div>;
}

function MilestoneCoordination({m,work,champion}:{m:MilestoneProgress;work:MilestoneWorkSession;champion:boolean}){
 const d=m.detail,locked=!!work.busy,err=work.error?.milestoneId===m.id?work.error:null;
 const [respondTo,setRespondTo]=useState<string|null>(null),[reply,setReply]=useState(''),[resolve,setResolve]=useState(false);
 const [kind,setKind]=useState<'note'|'followUp'>('note'),[text,setText]=useState(''),[reviewNote,setReviewNote]=useState('');
 const refs=d?.updates.filter(u=>u.evidence)??[];
 async function respond(u:WorkUpdate){if(await work.coordinate(m.id,{respond:{to:u.id,text:reply.trim(),...(resolve?{resolve:true}:{})}})){setRespondTo(null);setReply('');setResolve(false);}}
 async function post(){if(await work.coordinate(m.id,kind==='note'?{note:{text:text.trim()}}:{followUp:{text:text.trim()}}))setText('');}
 return <section className="pt-card" id={`coord-${m.id}`} aria-label={`Coordination: ${m.title}`}>
  <div className="pt-card-head"><h3>{m.title}</h3><span style={{display:'flex',gap:8,flexWrap:'wrap'}}>
   <span className={'pt-pill '+statusTone(m.status)} data-testid="coord-status">{STATUS_LABEL[m.status]}</span>
   {m.reviewState&&m.reviewState!=='none'&&<span className={'pt-pill '+reviewTone(m.reviewState)} data-testid="review-state">{REVIEW_LABEL[m.reviewState]}</span>}</span></div>
  <p className="pt-note" style={{marginTop:6}}>{m.workingOn?.length?`Working on it: ${m.workingOn.join(', ')}`:m.assignee?`Suggested for ${m.assignee}`:'Nobody has picked it up yet'} · {m.actionsCompleted??0} of {m.actionsTotal??0} actions completed
   {m.openBlockers?` · ${m.openBlockers} open blocker${m.openBlockers===1?'':'s'}`:''}{m.openQuestions?` · ${m.openQuestions} open question${m.openQuestions===1?'':'s'}`:''}
   {m.latest?` · latest: ${m.latest.by}, ${when(m.latest.at)}`:' · no updates yet'}</p>
  {err&&<div className="pt-banner error" role="alert">{workProblem(err)}</div>}
  {m.dependsOn.length>0&&<><p className="pt-label" style={{marginTop:18}}>Depends on</p>
   <ul className="pt-plain-list">{m.dependsOn.map(x=><li key={x.id}>{x.title} — {x.assignee??'unassigned'} <span className={'pt-pill '+statusTone(x.status)}>{STATUS_LABEL[x.status]}</span></li>)}</ul></>}
  {d&&<details style={{marginTop:18}}><summary className="pt-label" style={{cursor:'pointer'}}>Actions and completion criteria</summary>
   <ol className="pt-work-actions">{d.actions.map(a=><li key={a.index}><span>{a.text}{a.by&&<small>{ACTION_LABEL[a.status]} by {a.by}, {when(a.at)}</small>}</span><span className={'pt-pill '+(a.status==='completed'?'green':a.status==='blocked'?'red':a.status==='started'?'amber':'')}>{ACTION_LABEL[a.status]}</span></li>)}</ol>
   {d.completionCriteria.length>0&&<><p className="pt-label" style={{marginTop:14}}>Done when</p><ul className="pt-plain-list">{d.completionCriteria.map(c=><li key={c}>{c}</li>)}</ul></>}
  </details>}
  {refs.length>0&&<><p className="pt-label" style={{marginTop:18}}>Evidence references</p><ul className="pt-plain-list">{refs.map(u=><li key={u.id}><span className="pt-pill">Reported</span> <code>{u.evidence}</code> — {u.by}, {when(u.at)}</li>)}</ul></>}
  <p className="pt-label" style={{marginTop:18}}>Review</p>
  {m.review&&<p style={{marginTop:6}}>Reviewed by {m.review.by}, {when(m.review.at)}{m.review.note?`: “${m.review.note}”`:''}{m.reviewState==='reviewed_outdated'?' — the developer changed the work since.':''}</p>}
  {m.reviewState==='none'&&<p className="pt-note" style={{marginTop:6}}>Not ready for review yet. {m.assignee??'The developer'} marks it ready when every action is completed and no blocker is open.</p>}
  {champion&&(m.reviewState==='awaiting_review'||m.reviewState==='reviewed_outdated')&&<>
   <label className="pt-form-field"><span>Review note (optional)</span><textarea className="pt-textarea compact" rows={2} maxLength={1000} aria-label="Review note" value={reviewNote} disabled={locked} onChange={e=>setReviewNote(e.target.value)}/></label>
   <div className="pt-actions"><button className="pt-btn sm" disabled={locked||(reviewNote.trim().length>0&&reviewNote.trim().length<3)} onClick={async()=>{if(await work.coordinate(m.id,{review:{decision:'reviewed',note:reviewNote.trim()||null}}))setReviewNote('');}}>Mark reviewed</button>
    <span className="pt-note" style={{marginTop:0}}>Records your review. It doesn’t complete the milestone; {m.assignee??'the developer'} does that.</span></div></>}
  <hr/>
  <p className="pt-label">Discussion</p>
  {d?<Thread updates={d.updates} empty="No updates, questions or notes yet." actions={u=>champion&&u.role!=='champion'&&<>
   {respondTo!==u.id?<button className="pt-btn sm ghost" style={{marginTop:10}} disabled={locked} onClick={()=>{setRespondTo(u.id);setReply('');setResolve(false);}}>Respond</button>:<div>
    <label className="pt-form-field"><span>Your response to {u.by}</span><textarea className="pt-textarea compact" rows={2} maxLength={1000} aria-label="Response" value={reply} disabled={locked} onChange={e=>setReply(e.target.value)}/></label>
    {u.kind==='blocker'&&isOpen(u,d.updates)&&<label className="pt-check"><input type="checkbox" checked={resolve} disabled={locked} onChange={e=>setResolve(e.target.checked)}/>Also mark this blocker resolved</label>}
    <div className="pt-actions"><button className="pt-btn sm" disabled={locked||reply.trim().length<3} onClick={()=>void respond(u)}>Send response</button><button className="pt-btn sm ghost" disabled={locked} onClick={()=>setRespondTo(null)}>Cancel</button></div>
   </div>}</>}/>:<p className="pt-note">Not visible to you.</p>}
  {champion&&d&&<>
   <div className="pt-form-row two">
    <label className="pt-form-field"><span>Add to the discussion</span><select className="pt-input" aria-label="Coordination type" value={kind} disabled={locked} onChange={e=>setKind(e.target.value as typeof kind)}><option value="note">Coordination note</option><option value="followUp">Request follow-up from {m.assignee??'the developer'}</option></select></label>
   </div>
   <label className="pt-form-field"><span>{kind==='note'?'Note':'What you need'}</span><textarea className="pt-textarea compact" rows={2} maxLength={1000} aria-label="Coordination text" value={text} disabled={locked} onChange={e=>setText(e.target.value)}/></label>
   <div className="pt-actions"><button className="pt-btn sm ghost" disabled={locked||text.trim().length<3} onClick={()=>void post()}>{kind==='note'?'Add note':'Request follow-up'}</button></div>
  </>}
 </section>;
}
