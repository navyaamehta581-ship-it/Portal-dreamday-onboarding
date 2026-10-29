import {useEffect,useState} from 'react';
import {Check,ChevronDown,ChevronUp,Plus,Trash2,X} from 'lucide-react';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {HandoffRecord,ReviewDraft,ReviewProblem,ReviewProblemBody,ReviewStakeholder} from '../../../../contracts/activation/v1/handoff';
import {Items,Milestones,Section,newId,rowsFor} from '../review/Editors';
import {navigate} from '../portal-app/router';
import {accountStatus,type CustomerWorkspace} from './useCustomerWorkspace';
import {describe,modelProblem} from './InformationTab';

const REASONS:Record<string,string>={unassigned:'needs an assignee',missing:'needs content',no_milestone:'add at least one milestone',not_a_technical_stakeholder:'isn’t one of the technical stakeholders',unknown_milestone:'depends on a milestone that no longer exists',
 circular_dependencies:'milestones depend on each other in a loop',commercial_text:'mentions commercial or deal details',company_statistic:'mentions company size figures',private_comment:'contains an executive or private comment',
 deal_stage:'mentions the deal stage or evaluation timeline',internal_text:'restates one of your private notes',private_name:'names someone outside the technical team'};
const SUBMIT_ERRORS:Record<string,string>={ALREADY_APPROVED:'The Champion already approved this plan.',AWAITING_CHAMPION_REVIEW:'This draft is with the Champion. Withdraw it to make changes.',REVIEW_INCOMPLETE:'Some parts of the draft need attention before it can go to the Champion:',CONFIDENTIAL_CONTENT:'The Champion must not receive internal or commercial information. Edit these parts first:',
 REVISION_CONFLICT:'This draft was saved in another tab. Reload to see the latest version.',NOT_LATEST_DRAFT:'A newer analysis exists. Reload to review the latest draft.',INVALID_TRANSITION:'The draft’s status changed in another tab. Reload to see it.'};
const id=newId;

/** Onboarding Draft: Chris checks what the analysis proposed, edits what he wants, and hands the proposal to the
 * Champion. The page starts with a short overview; every section opens on demand, and a section with something
 * that must be fixed opens by itself. Unknowns may stay: the Champion can complete or change the plan. */
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
 // Sections that hold something the submission check asked Chris to fix open by themselves.
 const issues=ws.error?.scope==='submit'?ws.error.issues??[]:[];
 const has=(prefix:string)=>issues.some(x=>x.path.startsWith(prefix));
 const openMilestones=r.milestones.filter((_,i)=>has(`milestones[${i}]`)).map(m=>m.id);
 const problems=[r.problem,...(r.moreProblems??[])];
 const setProblem=(i:number,next:ReviewProblemBody)=>i===0?set({problem:next}):set({moreProblems:(r.moreProblems??[]).map((x,j)=>j===i-1?{...x,...next}:x)});
 const unknowns=problems.reduce((n,x)=>n+x.unknowns.length,0)+r.questions.length;
 return <div className="pt-review">
  <div className="pt-savebar" role="region" aria-label="Draft status">
   <span className={'pt-pill '+status.tone}>{status.label}</span>
   <span className="pt-note" style={{marginTop:0}}>Draft {record.draft} · {provenance(record)}</span>
   <span className="grow"/>
   {ws.busy==='review'?<span role="status">Saving…</span>:ws.reviewDirty?<span className="pt-pill amber" role="status">Unsaved changes</span>:<span className="pt-savestate" role="status"><Check size={14} aria-hidden="true"/>{record.reviewUpdatedAt?`Saved ${new Date(record.reviewUpdatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Saved'}</span>}
   {ws.reviewDirty&&<button className="pt-link" onClick={ws.discardReview}>Discard</button>}
   <button className="pt-btn sm" disabled={!ws.reviewDirty||ws.busy==='review'||locked} onClick={()=>void ws.saveReview()}>Save draft</button>
  </div>
  {feedback&&<div className="pt-banner warn" role="status" aria-label="Champion feedback"><div><strong>{feedback.by} asked for changes in Dream Day</strong> · {new Date(feedback.at).toLocaleString()}<p style={{marginTop:6,whiteSpace:'pre-wrap'}}>{feedback.comment}</p><p className="pt-note" style={{marginTop:6}}>Revise the draft, save it, then send it back for Champion review.</p></div></div>}
  <ChampionUpdates record={record}/>
  {ws.document&&!ws.document.complete&&record.basedOnWorkspaceRevision===ws.overview?.workspace.revision&&<div className="pt-banner warn" role="status">This draft comes from a partly read PDF ({ws.document.fileName}): some pages or text couldn’t be read. You can still send it; the Champion can fill in what’s missing.</div>}
  {ws.running&&<div className="pt-banner warn" role="status">A new analysis is running. This draft will be replaced by the new one when it finishes, so editing is paused.</div>}
  {record.understanding.model&&!record.understanding.model.ok&&<div className="pt-banner warn" role="status">This draft comes from rule-based analysis: {modelProblem(record.understanding.model.error,record.understanding.model.errorDetail).text} It was not generated by the model.</div>}
  {ws.error?.scope==='review'&&<div className="pt-banner error" role="alert">{SUBMIT_ERRORS[ws.error.code]??describe(ws.error.code)}</div>}
  <DraftOverview r={r} unknowns={unknowns}/>
  <fieldset className="pt-fieldset" disabled={locked}>
   <Section id="draft-problems" title="Engineering problems" count={problems.length} forceOpen={has('problem')||has('moreProblems')}
    summary={problems.length>1?'Each problem the customer described, with its challenges, systems and supporting notes.':'The problem the customer described, with its challenges, systems and supporting notes.'}>
    {problems.map((pr,i)=><ProblemEditor key={i===0?'main':(pr as ReviewProblem).id} index={i} total={problems.length} problem={pr} suggestion={suggestion}
     forceOpen={has(i===0?'problem':`moreProblems[${i-1}]`)} onChange={next=>setProblem(i,next)}
     onRemove={i>0?()=>set({moreProblems:(r.moreProblems??[]).filter((_,j)=>j!==i-1)}):undefined}/>)}
    <button className="pt-link" style={{marginTop:14}} disabled={problems.length>=7} onClick={()=>set({moreProblems:[...(r.moreProblems??[]),{id:id('problem'),summary:'',challenges:[],systems:[],contradictions:[],unknowns:[]}]})}><Plus size={14} aria-hidden="true"/> Add another problem</button>
   </Section>
   <Section id="draft-goals" title="Technical goals" count={r.goals.length} defaultOpen forceOpen={has('goals')} summary="What the onboarding should achieve. Customer requirements come from the customer’s sources.">
    <Items label="Goal" title="" items={r.goals} suggestion={suggestion} customerLabel="Customer requirement" onChange={goals=>set({goals})}/>
   </Section>
   <Section id="draft-milestones" title="Onboarding milestones" count={r.milestones.length} defaultOpen forceOpen={has('milestones')} summary="Proposed outcomes, in order. Owners and dependencies are optional; the Champion can decide them.">
    <Milestones milestones={r.milestones} open={openMilestones} people={r.stakeholders.filter(s=>s.technical&&s.name.trim()).map(s=>s.name.trim())} suggestion={suggestion} onChange={milestones=>set({milestones})}/>
   </Section>
   <Section id="draft-facts" title="Known facts" count={r.facts.length} forceOpen={has('facts')} summary="What the sources state, each with its backing: verified, reported or unconfirmed.">
    <p className="pt-note" style={{marginTop:0}}>Verified means observed in a repository; reported means someone said it; unconfirmed means hedged or disputed. Check the source before relying on a fact.</p>
    <Items label="Fact" title="" items={r.facts} suggestion={suggestion} onChange={facts=>set({facts})}/>
   </Section>
   <Section id="draft-people" title="Stakeholders" count={r.stakeholders.length} forceOpen={has('stakeholders')} summary={peopleSummary(r.stakeholders)}>
    <Stakeholders items={r.stakeholders} onChange={stakeholders=>set({stakeholders})}/>
   </Section>
   <Section id="draft-questions" title="Questions for the customer" count={r.questions.length} forceOpen={has('questions')} summary="Open questions, not facts. They can stay open when you send the plan.">
    <Items label="Question" title="" items={r.questions} suggestion={suggestion} onChange={questions=>set({questions})}/>
   </Section>
  </fieldset>
  <Internal record={record}/>
  <Submission ws={ws} record={record} unknowns={unknowns}/>
 </div>;
}

/** The scannable version: problems, goals and milestones in a few lines each. */
function DraftOverview({r,unknowns}:{r:ReviewDraft;unknowns:number}){
 const problems=[r.problem,...(r.moreProblems??[])].filter(p=>p.summary.trim()||p.challenges.length);
 const first=(t:string)=>t.split(/(?<=[.!?])\s/)[0];
 const title=new Map(r.milestones.map((m,i)=>[m.id,`${i+1}`]));
 return <section className="pt-card pt-overview" aria-label="Draft overview">
  <div className="pt-card-head"><h3>Draft overview</h3>{unknowns>0&&<span className="pt-pill amber">{unknowns} open question{unknowns===1?'':'s'} or unknown{unknowns===1?'':'s'}</span>}</div>
  <div className="pt-overview-grid">
   <div><p className="pt-label">Engineering problems</p>{problems.length?<ol className="pt-plain-list">{problems.map((p,i)=><li key={i}>{first(p.summary||p.challenges[0]?.text||'')}</li>)}</ol>:<p className="pt-note">None identified yet.</p>}</div>
   <div><p className="pt-label">Technical goals</p>{r.goals.length?<ul className="pt-plain-list">{r.goals.map(g=><li key={g.id}>{g.text}</li>)}</ul>:<p className="pt-note">None yet.</p>}</div>
   <div><p className="pt-label">Proposed milestones</p>{r.milestones.length?<ol className="pt-plain-list">{r.milestones.map(m=><li key={m.id}>{m.title||'Untitled'}<small className="pt-sub">{m.assignee??'No suggested owner'}{m.dependsOn.length?` · after ${m.dependsOn.map(d=>title.get(d)).filter(Boolean).join(', ')}`:''}</small></li>)}</ol>:<p className="pt-note">None yet.</p>}</div>
  </div>
 </section>;
}

function ProblemEditor({index,total,problem:p,suggestion,forceOpen,onChange,onRemove}:{index:number;total:number;problem:ReviewProblemBody;suggestion:string;forceOpen:boolean;onChange:(x:ReviewProblemBody)=>void;onRemove?:()=>void}){
 const [open,setOpen]=useState(total===1||forceOpen);
 useEffect(()=>{if(forceOpen)setOpen(true);},[forceOpen]);
 const notes=p.contradictions.length+p.unknowns.length;
 return <article className="pt-problem" aria-label={`Engineering problem ${index+1}`}>
  <div className="pt-problem-head">
   <button className="pt-section-head inline" aria-expanded={open} onClick={()=>setOpen(!open)}>
    <span className="pt-section-title"><strong>Problem {index+1}</strong></span>
    <span className="pt-section-summary">{p.summary.trim()?p.summary.split(/(?<=[.!?])\s/)[0]:'No summary yet'} · {p.challenges.length} challenge{p.challenges.length===1?'':'s'} · {p.systems.length} system{p.systems.length===1?'':'s'}{notes?` · ${notes} note${notes===1?'':'s'}`:''}</span>
    <span className="chev" aria-hidden="true">{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</span>
   </button>
   {onRemove&&<button className="pt-tool" aria-label={`Remove problem ${index+1}`} onClick={onRemove}><Trash2 size={15}/></button>}
  </div>
  {open&&<div className="pt-problem-body">
   <label className="pt-form-field"><span>Summary</span><textarea className="pt-textarea" aria-label={index?`Problem ${index+1} summary`:'Problem summary'} rows={rowsFor(p.summary,2)} value={p.summary} onChange={e=>onChange({...p,summary:e.target.value})}/></label>
   <Items label={index?`Problem ${index+1} challenge`:'Main technical challenge'} title="Challenges" items={p.challenges} suggestion={suggestion} onChange={challenges=>onChange({...p,challenges})}/>
   <Items label={index?`Problem ${index+1} system`:'Relevant system'} title="Relevant systems and workflows" items={p.systems} suggestion={suggestion} single onChange={systems=>onChange({...p,systems})}/>
   <details className="pt-details" open={forceOpen||undefined}><summary>Supporting notes ({notes}): contradictions and unknowns</summary>
    <Items label={index?`Problem ${index+1} contradiction`:'Contradiction'} title="Contradictions" hint="Sources that disagree. The Champion or a developer can resolve them later." items={p.contradictions} suggestion={suggestion} onChange={contradictions=>onChange({...p,contradictions})}/>
    <Items label={index?`Problem ${index+1} unknown`:'Unknown'} title="Unknowns a developer can check" items={p.unknowns} suggestion={suggestion} onChange={unknowns=>onChange({...p,unknowns})}/>
   </details>
  </div>}
 </article>;
}

const peopleSummary=(xs:ReviewStakeholder[])=>{const t=xs.filter(s=>s.technical).length,i=xs.length-t;return `${t} on the customer’s technical team${i?` · ${i} kept with you (not shared)`:''}`;};

const provenance=(rec:HandoffRecord)=>{const m=rec.understanding.model;return m?.ok?`Local model · ${m.model}`:m?`Rule-based fallback · model unavailable (${m.error})`:rec.understanding.interpreter==='hosted_model'?'Model-assisted analysis':'Rule-based analysis · no model';};

const BASIS:Record<ReviewStakeholder['basis'],string>={stated:'Named in sources',inferred:'Inferred from sources',role_default:'Role only',chris:'Added by you'};
/** People, grouped: the customer's technical team (who the Champion sees) and anyone kept with Chris. Each row says
 * who they are and their role; responsibilities appear only where the sources state them. */
function Stakeholders({items,onChange}:{items:ReviewStakeholder[];onChange:(x:ReviewStakeholder[])=>void}){
 const [editing,setEditing]=useState<string[]>([]);
 const edit=(i:number,patch:Partial<ReviewStakeholder>)=>onChange(items.map((s,j)=>j===i?{...s,...patch}:s));
 const rank=(s:ReviewStakeholder)=>/champion/i.test(s.role)?0:/lead|manager|director|head/i.test(s.role)?1:2;
 const groups:[string,ReviewStakeholder[]][]=[['Customer technical team · shared with the Champion',items.filter(s=>s.technical).sort((a,b)=>rank(a)-rank(b))],['Kept with you · not shared',items.filter(s=>!s.technical)]];
 const row=(s:ReviewStakeholder)=>{const i=items.indexOf(s),open=editing.includes(s.id);return <li key={s.id} className="pt-person-row" aria-label={`Stakeholder ${i+1}`}>
  <span className="pt-person-avatar" aria-hidden="true">{(s.name.trim()||'?').charAt(0).toUpperCase()}</span>
  <div className="pt-person-main">
   <p><strong>{s.name||'Unnamed'}</strong> · {s.role||'Role not stated'} <span className={'pt-pill '+(s.basis==='chris'?'green':s.basis==='stated'?'':'amber')}>{BASIS[s.basis]}</span></p>
   <p className="pt-note" style={{marginTop:2}}>{s.responsibilities.trim()||'Responsibility not specified in the sources. The Champion can add it.'}{s.sources.length?` · Source: ${s.sources.join(', ')}`:''}</p>
   {open&&<div className="pt-person-edit">
    <div className="pt-person">
     <input className="pt-input" aria-label={`Stakeholder ${i+1} name`} value={s.name} maxLength={80} onChange={e=>edit(i,{name:e.target.value})}/>
     <input className="pt-input" aria-label={`Stakeholder ${i+1} role`} value={s.role} maxLength={120} onChange={e=>edit(i,{role:e.target.value})}/>
    </div>
    <textarea className="pt-textarea compact" aria-label={`Stakeholder ${i+1} responsibilities`} placeholder="Responsibilities, if known" rows={rowsFor(s.responsibilities)} maxLength={600} value={s.responsibilities} onChange={e=>edit(i,{responsibilities:e.target.value,...(s.basis==='role_default'?{basis:'chris' as const}:{})})}/>
   </div>}
  </div>
  <button className="pt-tool" aria-expanded={open} aria-label={`${open?'Close':'Edit'} stakeholder ${i+1}`} onClick={()=>setEditing(e=>open?e.filter(x=>x!==s.id):[...e,s.id])}>{open?'Close':'Edit'}</button>
  <button className="pt-icon" aria-label={`Remove stakeholder ${i+1}`} onClick={()=>onChange(items.filter((_,j)=>j!==i))}><X size={16}/></button>
 </li>;};
 return <div aria-label="Stakeholder list">
  {items.length===0&&<p className="pt-note">No named people yet.</p>}
  {groups.filter(([,xs])=>xs.length).map(([label,xs])=><div key={label}><p className="pt-label" style={{marginTop:14}}>{label}</p><ul className="pt-people">{xs.map(row)}</ul></div>)}
  <button className="pt-link" style={{marginTop:12}} onClick={()=>{const nid=id('p');setEditing(e=>[...e,nid]);onChange([...items,{id:nid,name:'',role:'',responsibilities:'',basis:'chris',sources:[],technical:true}]);}}><Plus size={14} aria-hidden="true"/> Add stakeholder</button>
 </div>;
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

const ACTION:Record<string,string>={edited:'Changed by the Champion',submitted:'Submitted for Champion review',resubmitted:'Resubmitted for Champion review',withdrawn:'Withdrawn',changes_requested:'Changes requested',approved:'Approved',published:'Published to developers'};
/** What the Champion changed since Chris sent the plan. Information only: Chris doesn't approve these again. */
function ChampionUpdates({record}:{record:HandoffRecord}){
 const history=record.history??[];
 const sent=history.map(e=>e.action).lastIndexOf('submitted')>history.map(e=>e.action).lastIndexOf('resubmitted')?history.map(e=>e.action).lastIndexOf('submitted'):history.map(e=>e.action).lastIndexOf('resubmitted');
 const since=history.slice(sent+1).filter(e=>e.action==='edited'),all=history.filter(e=>e.action==='edited');
 if(!all.length)return null;
 const shown=since.length?since:all;
 return <div className="pt-banner" role="status" aria-label="Champion updates"><div>
  <strong>{shown.at(-1)!.by} updated the plan</strong> · {new Date(shown.at(-1)!.at).toLocaleString()}
  <ul className="pt-plain-list" style={{marginTop:6}}>{shown.map((e,i)=><li key={i}>{e.comment}</li>)}</ul>
  <p className="pt-note" style={{marginTop:6}}>Their changes are marked “Added by Champion” or “edited” below. You don’t need to approve them.</p></div></div>;
}

/** The Dream Day review steps so far, with the Champion's comments. */
export function ReviewHistory({record}:{record:HandoffRecord|null}){
 const history=record?.history??[];
 if(!history.length)return null;
 return <section className="pt-card" aria-label="Dream Day review history">
  <h3>Dream Day review history</h3>
  <ol className="pt-milestones">{history.map((e,i)=><li key={i}><span className={'pt-pill '+(e.action==='changes_requested'?'amber':e.action==='approved'||e.action==='published'||e.action==='edited'?'green':'blue')}>{ACTION[e.action]}</span>
   <div><strong>{e.by}</strong><p>{new Date(e.at).toLocaleString()}</p>{e.comment&&<p style={{whiteSpace:'pre-wrap'}}>“{e.comment}”</p>}</div></li>)}</ol>
 </section>;
}

function Submission({ws,record,unknowns}:{ws:CustomerWorkspace;record:HandoffRecord;unknowns:number}){
 const [confirmed,setConfirmed]=useState(false);
 const err=ws.error?.scope==='submit'?ws.error:null;
 const history=<ReviewHistory record={record}/>;
 if(record.status==='approved')return <>{history}<section className="pt-card" aria-label="Champion review">
  <h3>Champion approval complete</h3>
  <p style={{marginTop:12}}>Approved by {record.approvals?.champion.by} on {record.approvals?.champion.at?new Date(record.approvals.champion.at).toLocaleString():''}. Publishing to developers isn’t enabled on this server, so developers don’t see it yet.</p>
 </section></>;
 if(record.status==='submitted'||record.status==='resubmitted')return <>{history}<section className="pt-card" aria-label="Champion review">
  <h3>{record.status==='resubmitted'?'Resubmitted for Champion review':'Submitted for Champion review'}</h3>
  <p style={{marginTop:12}}>Sent {record.submittedAt?new Date(record.submittedAt).toLocaleString():''}. Your Champion reviews it in Dream Day and can edit, add or remove items, suggest owners and approve it. You’ll see their changes here; you don’t need to approve them. Nothing reaches developers until it’s approved.</p>
  <div className="pt-actions"><button className="pt-btn sm ghost" disabled={ws.busy==='submit'} onClick={()=>void ws.withdraw()}>Withdraw to make changes</button></div>
  {err&&<div className="pt-banner error" role="alert">{SUBMIT_ERRORS[err.code]??describe(err.code)}</div>}
 </section></>;
 const blocked=ws.reviewDirty||ws.running||ws.busy!=='';
 const again=record.status==='changes_requested'||(record.history??[]).some(e=>e.action==='submitted'||e.action==='resubmitted');
 return <>{history}<section className="pt-card" aria-label="Submit for Champion review">
  <h3>{again?'Send the revised plan to your Champion':'Send this proposed plan to your Champion'}</h3>
  <p className="pt-note">You’re sending a <strong>proposed</strong> plan for the Champion to review, not certifying that every stakeholder, responsibility or technical detail is complete. The Champion can edit, add or remove items; you’ll see their changes without approving them again. Technical setup (repositories, wiki, SSO) stays with Spotify’s solutions engineers.</p>
  {unknowns>0&&<p className="pt-note">{unknowns} open question{unknowns===1?'':'s'} or unknown{unknowns===1?'':'s'} can stay open; the Champion can answer them.</p>}
  <label className="pt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked this proposal. It contains no commercial details, internal notes or private comments.</label>
  <div className="pt-actions"><button className="pt-btn sm" disabled={!confirmed||blocked} onClick={()=>void ws.submit()}>{ws.busy==='submit'?'Sending…':again?'Resubmit for Champion review':'Send to Champion for review'}</button>
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
