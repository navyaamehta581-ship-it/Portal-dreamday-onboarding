import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {MilestoneProgress,WorkUpdate} from '../../../../../contracts/activation/v1/handoff';
import {navigate} from '../router';
import {Thread,when} from './Thread';
import {RepositoryPanel,relatedEvidence} from './RepositoryEvidence';
import type {RepositoryEvidenceSession} from './useRepositoryEvidence';
import {REVIEW_LABEL,STATUS_LABEL,statusTone,workProblem,type MilestoneWorkSession} from './useMilestoneWork';

const ACTION_LABEL={not_started:'Not started',started:'Started',blocked:'Blocked',completed:'Completed'} as const;

/** “My work”: the developer's own approved milestones, prominent and editable, with the team's objective and the
 * rest of the team's milestones by status only. Another developer's notes and action progress stay theirs. */
export function WorkTab({work,repos}:{work:MilestoneWorkSession;repos?:RepositoryEvidenceSession}){
 const {progress,loading,error}=work;
 if(!progress)return <section className="pt-card" role={error&&!loading?'alert':'status'}><h3>{loading?'Loading your work…':error?.code==='NO_APPROVED_PLAN'?'No approved plan yet':'Your work isn’t available'}</h3>{error&&!loading&&<p className="pt-note">{workProblem(error)}</p>}</section>;
 const mine=progress.milestones.filter(m=>m.mine),others=progress.milestones.filter(m=>!m.mine),o=progress.objective;
 return <div style={{display:'grid',gap:22}}>
  {progress.approval&&<div className="pt-banner" role="status" style={{marginTop:0}}>Approved by {progress.approval.by} in Dream Day on {new Date(progress.approval.at).toLocaleString()}. Only approved work appears here.</div>}
  {error&&!error.milestoneId&&<div className="pt-banner error" role="alert" style={{marginTop:0}}>{workProblem(error)}</div>}
  <section className="pt-card" aria-label="Your work">
   <h3>Your milestones</h3>
   {mine.length?<p className="pt-note">Update each action as you go. Notes and references are recorded as reported by you; the Portal doesn’t verify them.</p>
    :<p className="pt-note">{progress.viewer.name?`None of the approved milestones are assigned to ${progress.viewer.name}. Ask your Champion if you expected work.`:'Your sign-in isn’t linked to your own developer credential, so no milestones can be shown as yours.'}</p>}
  </section>
  {mine.map(m=><MilestoneCard key={m.id} m={m} work={work} repos={repos}/>)}
  {o&&<section className="pt-card" aria-label="Engineering objective">
   <h3>The team’s engineering objective</h3>
   {o.problem&&<><p className="pt-label" style={{marginTop:18}}>Problem</p><p style={{marginTop:6}}>{o.problem}</p></>}
   {o.goals.length>0&&<><p className="pt-label" style={{marginTop:18}}>Technical goals</p><ul className="pt-plain-list">{o.goals.map(g=><li key={g}>{g}</li>)}</ul></>}
   {o.questions.length>0&&<><p className="pt-label" style={{marginTop:18}}>Outstanding technical questions</p><ul className="pt-plain-list">{o.questions.map(q=><li key={q}>{q}</li>)}</ul></>}
  </section>}
  {others.length>0&&<section className="pt-card" aria-label="Team milestones">
   <h3>The rest of the team’s milestones</h3>
   <p className="pt-note">Status only. Each developer’s notes stay in their own workspace.</p>
   <ol className="pt-milestones">{others.map(m=><li key={m.id}><span className={'pt-pill '+statusTone(m.status)}>{STATUS_LABEL[m.status]}</span><div><strong>{m.title}</strong><p>{m.assignee??'Unassigned'}{m.openBlockers?` · ${m.openBlockers} open blocker${m.openBlockers===1?'':'s'}`:''}</p></div></li>)}</ol>
  </section>}
 </div>;
}

function MilestoneCard({m,work,repos}:{m:MilestoneProgress;work:MilestoneWorkSession;repos?:RepositoryEvidenceSession}){
 // Configured repositories this approved milestone relies on, with the signals its own work points to.
 const linked=(repos?.data?.repositories??[]).flatMap(r=>r.milestones.filter(x=>x.id===m.id).map(x=>({r,x})));
 const d=m.detail!,busy=work.busy===m.id,locked=!!work.busy;
 const [kind,setKind]=useState<'update'|'blocker'|'question'>('update'),[text,setText]=useState(''),[evidence,setEvidence]=useState(''),[replyTo,setReplyTo]=useState<WorkUpdate|null>(null);
 const err=work.error?.milestoneId===m.id?work.error:null;
 const waiting=m.dependsOn.filter(x=>x.status!=='completed');
 const explicit=m.status==='ready_for_review'||m.status==='completed';
 async function addNote(){if(await work.update(m.id,{note:replyTo?{kind:'response',text:text.trim(),evidence:evidence.trim()||null,replyTo:replyTo.id}:{kind,text:text.trim(),evidence:evidence.trim()||null}})){setText('');setEvidence('');setReplyTo(null);}}
 return <section className="pt-card" aria-label={`Milestone: ${m.title}`}>
  <div className="pt-card-head"><h3>{m.title}</h3><span style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className={'pt-pill '+statusTone(m.status)} data-testid="milestone-status">{STATUS_LABEL[m.status]}</span>
   {m.reviewState&&m.reviewState!=='none'&&<span className={'pt-pill '+(m.reviewState==='reviewed'?'green':m.reviewState==='awaiting_review'?'blue':'amber')} data-testid="review-state" title={m.review?`Reviewed by ${m.review.by}, ${when(m.review.at)}`:undefined}>{m.reviewState==='reviewed'&&m.review?`Reviewed by ${m.review.by}`:REVIEW_LABEL[m.reviewState]}</span>}</span></div>
  <p className="pt-note" style={{marginTop:6}}>Assigned to you{d.system?` · ${d.system}`:''}{d.updatedBy?` · last updated by ${d.updatedBy}, ${when(d.updatedAt)}`:''}</p>
  {d.description&&d.description!==m.title&&<p style={{marginTop:14}}>{d.description}</p>}
  {err&&<div className="pt-banner error" role="alert">{workProblem(err)}</div>}
  {m.dependsOn.length>0&&<><p className="pt-label" style={{marginTop:20}}>Depends on</p>
   <ul className="pt-plain-list">{m.dependsOn.map(x=><li key={x.id}>{x.title} — {x.assignee??'unassigned'} <span className={'pt-pill '+statusTone(x.status)}>{STATUS_LABEL[x.status]}</span></li>)}</ul>
   {waiting.length>0&&<p className="pt-note">You can start now, but this milestone can only be completed after {waiting.map(x=>x.assignee?`${x.assignee}’s`:'the').join(' and ')} work it depends on is completed. Nothing completes automatically.</p>}</>}
  <p className="pt-label" style={{marginTop:20}}>Actions</p>
  <ol className="pt-work-actions">{d.actions.map(a=><li key={a.index}>
   <span>{a.text}{a.by&&<small>{ACTION_LABEL[a.status]} by {a.by}, {when(a.at)}</small>}
    {linked.map(({r,x})=>{const l=x.actionLinks.find(y=>y.index===a.index);return l&&<small key={r.id} data-testid="action-evidence">Related evidence ({r.label}{r.mode==='fixture'?', sample':''}): {relatedEvidence(r,l.signals)}</small>;})}</span>
   <select className="pt-input" aria-label={`Status of action ${a.index+1}`} value={a.status} disabled={locked} onChange={e=>void work.update(m.id,{action:{index:a.index,status:e.target.value as keyof typeof ACTION_LABEL}})}>
    {Object.entries(ACTION_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
  </li>)}</ol>
  {d.completionCriteria.length>0&&<><p className="pt-label" style={{marginTop:20}}>Done when</p><ul className="pt-plain-list">{d.completionCriteria.map(c=><li key={c}>{c}</li>)}</ul></>}
  {linked.length>0&&<div style={{marginTop:20,display:'grid',gap:14}}>{linked.map(({r,x})=><RepositoryPanel key={r.id} repo={r} repos={repos!} focus={x.focus}/>)}</div>}
  <hr/>
  <p className="pt-label">Updates, blockers, questions and replies</p>
  <p className="pt-note" style={{marginTop:4}}>Shared with your Champion; Chris can read it. Other developers see only the milestone’s status.</p>
  <Thread updates={d.updates} actions={u=><>
   {u.kind==='blocker'&&!u.resolved&&<button className="pt-btn sm ghost" style={{marginTop:10}} disabled={locked} onClick={()=>void work.update(m.id,{resolve:u.id})}>Mark blocker resolved</button>}
   {u.role==='champion'&&<button className="pt-btn sm ghost" style={{marginTop:10}} disabled={locked} onClick={()=>setReplyTo(u)}>Reply to {u.by}</button>}
  </>}/>
  {replyTo&&<div className="pt-banner" role="status">Replying to {replyTo.by}: “{replyTo.text.slice(0,120)}” <button className="pt-btn sm ghost" disabled={locked} onClick={()=>setReplyTo(null)}>Cancel reply</button></div>}
  <div className="pt-form-row two">
   <label className="pt-form-field"><span>Type</span><select className="pt-input" aria-label="Note type" value={replyTo?'response':kind} disabled={locked||!!replyTo} onChange={e=>setKind(e.target.value as typeof kind)}><option value="update">Update</option><option value="blocker">Blocker</option><option value="question">Question</option>{replyTo&&<option value="response">Reply</option>}</select></label>
   <label className="pt-form-field"><span>Evidence reference (optional)</span><input className="pt-input" aria-label="Evidence reference" placeholder="PR URL, commit SHA, ticket…" maxLength={300} value={evidence} disabled={locked} onChange={e=>setEvidence(e.target.value)}/></label>
  </div>
  <label className="pt-form-field"><span>Short note</span><textarea className="pt-textarea compact" rows={3} aria-label="Short note" maxLength={1000} value={text} disabled={locked} onChange={e=>setText(e.target.value)}/></label>
  <div className="pt-actions">
   <button className="pt-btn sm ghost" disabled={locked||text.trim().length<3} onClick={()=>void addNote()}>{busy?'Saving…':replyTo?'Send reply':kind==='blocker'?'Record blocker':kind==='question'?'Record question':'Record update'}</button>
   {explicit?<button className="pt-btn sm ghost" disabled={locked} onClick={()=>void work.update(m.id,{status:'in_progress'})}>Reopen</button>:
    <button className="pt-btn sm ghost" disabled={locked} onClick={()=>void work.update(m.id,{status:'ready_for_review'})}>Mark ready for review</button>}
   {m.status!=='completed'&&<button className="pt-btn sm" disabled={locked} onClick={()=>void work.update(m.id,{status:'completed'})}>Mark completed</button>}
   <button className="pt-btn sm ghost" onClick={()=>navigate(`/aika?milestone=${encodeURIComponent(m.id)}`)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA about this milestone</button>
  </div>
 </section>;
}
