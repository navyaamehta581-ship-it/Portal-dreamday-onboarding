import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {MilestoneProgress,WorkUpdate} from '../../../../../contracts/activation/v1/handoff';
import {navigate} from '../router';
import {Thread,when} from './Thread';
import {MilestoneChoices} from '../onboarding/DeveloperOverview';
import {REVIEW_LABEL,STATUS_LABEL,statusTone,workProblem,type MilestoneWorkSession} from './useMilestoneWork';

const ACTION_LABEL={not_started:'Not started',started:'Started',blocked:'Blocked',completed:'Completed'} as const;

/** “My milestones”: the milestones the developer chose (or the Champion suggested for them), where they track their
 * own progress. Nothing here is mandatory reporting: notes and questions to the Champion are optional. Other
 * milestones can be chosen below; another developer's notes and action progress stay theirs. */
export function WorkTab({work}:{work:MilestoneWorkSession}){
 const {progress,loading,error}=work;
 if(!progress)return <section className="pt-card" role={error&&!loading?'alert':'status'}><h3>{loading?'Loading your work…':error?.code==='NO_APPROVED_PLAN'?'No published plan yet':'Your work isn’t available'}</h3>{error&&!loading&&<p className="pt-note">{workProblem(error)}</p>}</section>;
 const mine=progress.milestones.filter(m=>m.mine),others=progress.milestones.filter(m=>!m.mine),o=progress.objective;
 return <div style={{display:'grid',gap:22}}>
  {error&&!error.milestoneId&&<div className="pt-banner error" role="alert" style={{marginTop:0}}>{workProblem(error)}</div>}
  <section className="pt-card" aria-label="Your work">
   <h3>My milestones</h3>
   {mine.length?<p className="pt-note">Track your own progress as you go. Notes are optional; they’re recorded as reported by you and the Portal doesn’t verify them. Stuck? Ask AiKA.</p>
    :<p className="pt-note">{progress.viewer.name?'You haven’t chosen a milestone yet. Choose one below, or pick an engineering opportunity on the Overview.':'Your sign-in isn’t linked to your own developer credential, so you can’t choose milestones.'}</p>}
  </section>
  {mine.map(m=><MilestoneCard key={m.id} m={m} work={work}/>)}
  {o&&<section className="pt-card" aria-label="Engineering objective">
   <h3>The team’s engineering objective</h3>
   {o.problem&&<><p className="pt-label" style={{marginTop:18}}>Problem</p><p style={{marginTop:6}}>{o.problem}</p></>}
   {o.goals.length>0&&<><p className="pt-label" style={{marginTop:18}}>Technical goals</p><ul className="pt-plain-list">{o.goals.map(g=><li key={g}>{g}</li>)}</ul></>}
   {o.questions.length>0&&<><p className="pt-label" style={{marginTop:18}}>Outstanding technical questions</p><ul className="pt-plain-list">{o.questions.map(q=><li key={q}>{q}</li>)}</ul></>}
  </section>}
  {others.length>0&&<MilestoneChoices work={{...work,progress:{...progress,milestones:others}}}/>}
 </div>;
}

function MilestoneCard({m,work}:{m:MilestoneProgress;work:MilestoneWorkSession}){
 const d=m.detail!,busy=work.busy===m.id,locked=!!work.busy;
 const [kind,setKind]=useState<'update'|'blocker'|'question'>('update'),[text,setText]=useState(''),[evidence,setEvidence]=useState(''),[replyTo,setReplyTo]=useState<WorkUpdate|null>(null);
 const err=work.error?.milestoneId===m.id?work.error:null;
 const waiting=m.dependsOn.filter(x=>x.status!=='completed');
 const explicit=m.status==='ready_for_review'||m.status==='completed';
 async function addNote(){if(await work.update(m.id,{note:replyTo?{kind:'response',text:text.trim(),evidence:evidence.trim()||null,replyTo:replyTo.id}:{kind,text:text.trim(),evidence:evidence.trim()||null}})){setText('');setEvidence('');setReplyTo(null);}}
 return <section className="pt-card" aria-label={`Milestone: ${m.title}`}>
  <div className="pt-card-head"><h3>{m.title}</h3><span style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className={'pt-pill '+statusTone(m.status)} data-testid="milestone-status">{STATUS_LABEL[m.status]}</span>
   {m.reviewState&&m.reviewState!=='none'&&<span className={'pt-pill '+(m.reviewState==='reviewed'?'green':m.reviewState==='awaiting_review'?'blue':'amber')} data-testid="review-state" title={m.review?`Reviewed by ${m.review.by}, ${when(m.review.at)}`:undefined}>{m.reviewState==='reviewed'&&m.review?`Reviewed by ${m.review.by}`:REVIEW_LABEL[m.reviewState]}</span>}</span></div>
  <p className="pt-note" style={{marginTop:6}}>{m.suggestedForMe&&!m.workingOn?.length?'Suggested for you':'You chose this'}{(m.workingOn?.length??0)>1?` · also working on it: ${m.workingOn!.filter(x=>x!==work.progress?.viewer.name).join(', ')}`:''}{d.system?` · ${d.system}`:''}{d.updatedBy?` · last updated by ${d.updatedBy}, ${when(d.updatedAt)}`:''}</p>
  {d.description&&d.description!==m.title&&<p style={{marginTop:14}}>{d.description}</p>}
  {err&&<div className="pt-banner error" role="alert">{workProblem(err)}</div>}
  {m.dependsOn.length>0&&<><p className="pt-label" style={{marginTop:20}}>Depends on</p>
   <ul className="pt-plain-list">{m.dependsOn.map(x=><li key={x.id}>{x.title} — {x.assignee??'unassigned'} <span className={'pt-pill '+statusTone(x.status)}>{STATUS_LABEL[x.status]}</span></li>)}</ul>
   {waiting.length>0&&<p className="pt-note">You can start now, but this milestone can only be completed after {waiting.map(x=>x.assignee?`${x.assignee}’s`:'the').join(' and ')} work it depends on is completed. Nothing completes automatically.</p>}</>}
  <p className="pt-label" style={{marginTop:20}}>Actions</p>
  <ol className="pt-work-actions">{d.actions.map(a=><li key={a.index}>
   <span>{a.text}{a.by&&<small>{ACTION_LABEL[a.status]} by {a.by}, {when(a.at)}</small>}</span>
   <select className="pt-input" aria-label={`Status of action ${a.index+1}`} value={a.status} disabled={locked} onChange={e=>void work.update(m.id,{action:{index:a.index,status:e.target.value as keyof typeof ACTION_LABEL}})}>
    {Object.entries(ACTION_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
  </li>)}</ol>
  {d.completionCriteria.length>0&&<><p className="pt-label" style={{marginTop:20}}>Done when</p><ul className="pt-plain-list">{d.completionCriteria.map(c=><li key={c}>{c}</li>)}</ul></>}
  <hr/>
  <p className="pt-label">Notes, blockers and questions (optional)</p>
  <p className="pt-note" style={{marginTop:4}}>Shared with your Champion. Other developers see only the milestone’s status.</p>
  <Thread updates={d.updates} actions={u=><>
   {u.kind==='blocker'&&!u.resolved&&<button className="pt-btn sm ghost" style={{marginTop:10}} disabled={locked} onClick={()=>void work.update(m.id,{resolve:u.id})}>Mark blocker resolved</button>}
   {u.role==='champion'&&<button className="pt-btn sm ghost" style={{marginTop:10}} disabled={locked} onClick={()=>setReplyTo(u)}>Reply to {u.by}</button>}
  </>}/>
  {replyTo&&<div className="pt-banner" role="status">Replying to {replyTo.by}: “{replyTo.text.slice(0,120)}” <button className="pt-btn sm ghost" disabled={locked} onClick={()=>setReplyTo(null)}>Cancel reply</button></div>}
  <div className="pt-form-row two">
   <label className="pt-form-field"><span>Type</span><select className="pt-input" aria-label="Note type" value={replyTo?'response':kind} disabled={locked||!!replyTo} onChange={e=>setKind(e.target.value as typeof kind)}><option value="update">Update</option><option value="blocker">Blocker</option><option value="question">Question for your Champion</option>{replyTo&&<option value="response">Reply</option>}</select></label>
   <label className="pt-form-field"><span>Evidence reference (optional)</span><input className="pt-input" aria-label="Evidence reference" placeholder="PR URL, commit SHA, ticket…" maxLength={300} value={evidence} disabled={locked} onChange={e=>setEvidence(e.target.value)}/></label>
  </div>
  <label className="pt-form-field"><span>Short note</span><textarea className="pt-textarea compact" rows={3} aria-label="Short note" maxLength={1000} value={text} disabled={locked} onChange={e=>setText(e.target.value)}/></label>
  <div className="pt-actions">
   <button className="pt-btn sm ghost" disabled={locked||text.trim().length<3} onClick={()=>void addNote()}>{busy?'Saving…':replyTo?'Send reply':kind==='blocker'?'Record blocker':kind==='question'?'Record question':'Record update'}</button>
   {explicit?<button className="pt-btn sm ghost" disabled={locked} onClick={()=>void work.update(m.id,{status:'in_progress'})}>Reopen</button>:
    <button className="pt-btn sm ghost" disabled={locked} onClick={()=>void work.update(m.id,{status:'ready_for_review'})}>Mark ready for review</button>}
   {m.status!=='completed'&&<button className="pt-btn sm" disabled={locked} onClick={()=>void work.update(m.id,{status:'completed'})}>Mark completed</button>}
   <button className="pt-btn sm ghost" onClick={()=>navigate(`/aika?milestone=${encodeURIComponent(m.id)}`)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA about this milestone</button>
   {m.workingOn?.includes(work.progress?.viewer.name??'')&&<button className="pt-link" disabled={locked} onClick={()=>void work.update(m.id,{pursue:false})}>Stop working on this</button>}
  </div>
 </section>;
}
