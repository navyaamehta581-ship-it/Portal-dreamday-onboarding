import {useState} from 'react';
import {Check,Sparkles} from 'lucide-react';
import type {ChampionReview,ReviewItem} from '../../../../../contracts/activation/v1/handoff';
import {Items,Milestones,Origin,STATUS,roleName} from '../../review/Editors';
import type {DreamDaySession} from './useDreamDay';

const STATUS_LABEL:Record<ChampionReview['status'],[string,string]>={not_submitted:['Nothing to review yet',''],revising:['Chris is revising',''],submitted:['Waiting for your review','blue'],
 resubmitted:['Resubmitted · waiting for your review','blue'],changes_requested:['Changes requested','amber'],approved:['Approved','green'],published:['Approved · published to developers','green'],
 published_before_dream_day:['Published before Dream Day','']};
const ACTION:Record<string,string>={submitted:'Submitted by',resubmitted:'Resubmitted by',withdrawn:'Withdrawn by',changes_requested:'Changes requested by',approved:'Approved by',published:'Published to developers ·'};
const ERRORS:Record<string,string>={REVISION_CONFLICT:'Chris changed this plan since you opened it. Reload to review the current version; your unsaved edits are kept until you do.',
 NOT_UNDER_REVIEW:'This plan is no longer waiting for your review: Chris withdrew it or it was already decided. Reload to see where it stands.',
 ALREADY_APPROVED:'This plan is already approved.',COMMENT_REQUIRED:'Tell Chris what to change (at least a few words).',
 REVIEW_INCOMPLETE:'Before you approve, every milestone needs a title, actions, completion criteria and an assignee from the technical team:',
 CONFIDENTIAL_CONTENT:'Developers must not receive commercial or private details. Edit these parts first:',
 CHAMPION_REQUIRED:'Your account can’t review onboarding plans.',INVALID_REQUEST:'Some fields are invalid. Check the milestones and try again.'};
const REASONS:Record<string,string>={missing:'needs content',no_milestone:'add at least one milestone',not_a_technical_stakeholder:'isn’t one of the technical stakeholders',unknown_milestone:'depends on a milestone that no longer exists',
 circular_dependencies:'milestones depend on each other in a loop',unassigned:'needs an assignee',commercial_text:'mentions commercial or deal details',company_statistic:'mentions company size figures',
 private_comment:'contains an executive or private comment',deal_stage:'mentions the deal stage or evaluation timeline',internal_text:'restates a private note',private_name:'names someone outside the technical team'};

/** Dream Day: the Champion reviews Chris's plan, refines it, assigns the work, and approves it or sends it back.
 * Everything shown comes from the server's Champion view; approval is a separate, explicit server transition. */
export function DreamDay({dd,customer}:{dd:DreamDaySession;customer:string}){
 const v=dd.view;
 if(!v)return <div className="pt-empty" role={dd.error?'alert':'status'}><div><h2>{dd.error?(ERRORS[dd.error.code]??`Dream Day isn’t available (${dd.error.code}).`):'Loading Dream Day…'}</h2></div></div>;
 const reviewing=v.status==='submitted'||v.status==='resubmitted';
 const suggestion=v.analysis==='model'?'AI suggestion':'Rule-based suggestion';
 const [label,tone]=STATUS_LABEL[v.status];
 return <div className="pt-review" aria-label="Dream Day">
  <section className="pt-card" aria-label="Dream Day review">
   <div className="pt-card-head"><h3><Sparkles size={18} aria-hidden="true" style={{verticalAlign:'-3px',marginRight:8}}/>Plan review</h3><span className={'pt-pill '+tone}>{label}</span></div>
   <p className="pt-note">Review the technical onboarding plan Chris prepared for {customer}, refine it, assign the work, then approve it or send it back. Developers receive only approved work, and each developer sees only what is assigned to them.</p>
   <Status v={v}/>
   {v.history.length>0&&<History v={v}/>}
  </section>
  {v.plan&&dd.plan&&<>
   {reviewing&&<Decide dd={dd}/>}
   {reviewing&&<div className="pt-savebar" role="region" aria-label="Review status">
    <span className={'pt-pill '+tone}>{label}</span><span className="pt-note" style={{marginTop:0}}>Plan {v.draft}{v.submittedAt?` · submitted ${new Date(v.submittedAt).toLocaleString()}`:''}</span><span className="grow"/>
    {dd.busy==='save'?<span role="status">Saving…</span>:dd.dirty?<span className="pt-pill amber" role="status">Unsaved changes</span>:<span className="pt-savestate" role="status"><Check size={14} aria-hidden="true"/>Saved</span>}
    {dd.dirty&&<button className="pt-link" onClick={dd.discard}>Discard</button>}
    <button className="pt-btn sm" disabled={!dd.dirty||dd.busy!==''} onClick={()=>void dd.save()}>Save draft</button>
   </div>}
   {dd.error&&dd.error.code!=='COMMENT_REQUIRED'&&!dd.error.issues&&<div className="pt-banner error" role="alert">{ERRORS[dd.error.code]??`Something went wrong (${dd.error.code}). Your edits are kept.`}{['REVISION_CONFLICT','NOT_UNDER_REVIEW'].includes(dd.error.code)&&<button className="pt-link" style={{marginLeft:12}} onClick={()=>void dd.reload()}>Reload</button>}</div>}
   {v.analysis==='rule_based_fallback'&&<div className="pt-banner warn" role="status">This plan was drafted by rule-based analysis because the AI model wasn’t available. It was not generated by the model.</div>}
   {v.plan.withheld>0&&<div className="pt-banner warn" role="status">{v.plan.withheld} item(s) were left out because they contained information you may not receive. Ask Chris if something seems missing.</div>}
   <section className="pt-card" aria-label="Customer engineering problem">
    <h3>Customer engineering problem</h3>
    {v.plan.problem.summary&&<p style={{marginTop:12,whiteSpace:'pre-wrap'}}>{v.plan.problem.summary}</p>}
    <ReadItems title="Main technical challenges" items={v.plan.problem.challenges} suggestion={suggestion}/>
    <ReadItems title="Relevant systems and workflows" items={v.plan.problem.systems} suggestion={suggestion}/>
    <ReadItems title="Unresolved: contradictions" items={v.plan.problem.contradictions} suggestion={suggestion} empty="No contradictions found."/>
    <ReadItems title="Unresolved: unknowns a developer can check" items={v.plan.problem.unknowns} suggestion={suggestion} empty="None."/>
   </section>
   <section className="pt-card" aria-label="Known facts">
    <h3>Known facts</h3><p className="pt-note">What the sources state, with evidence status and the kind of source. Verified means observed in a repository.</p>
    <ReadItems title="" items={v.plan.facts} suggestion={suggestion} empty="No technical facts recorded."/>
   </section>
   <section className="pt-card" aria-label="Technical stakeholders">
    <h3>Technical stakeholders</h3><p className="pt-note">The people who can be assigned work.</p>
    <ul className="pt-findings">{v.plan.stakeholders.map(s=><li key={s.id}><span className="pt-pill">{s.basis==='stated'?'Named in sources':s.basis==='inferred'?'Inferred':s.basis==='role_default'?'Role default':'Added by Chris'}</span>
     <span><strong>{s.name}</strong> — {s.role}<small>{s.responsibilities||'No responsibilities recorded'}{s.sources.length?` · Source: ${s.sources.join(', ')}`:''}</small></span></li>)}</ul>
   </section>
   <fieldset className="pt-fieldset" disabled={!reviewing||dd.busy!==''}>
    <section className="pt-card" aria-label="Technical goals">
     <h3>Technical goals</h3><p className="pt-note">Customer requirements come from your team’s sources; suggestions are proposals to keep, change or remove.</p>
     <Items label="Goal" title="" items={dd.plan.goals} suggestion={suggestion} customerLabel="Customer requirement" viewer="champion" onChange={goals=>dd.setPlan({...dd.plan!,goals})}/>
    </section>
    <Milestones milestones={dd.plan.milestones} people={v.plan.stakeholders.map(s=>s.name)} suggestion={suggestion} viewer="champion"
     hint="Assign each milestone to the person who will do it. After you approve, each developer sees only the work assigned to them." onChange={milestones=>dd.setPlan({...dd.plan!,milestones})}/>
    <section className="pt-card" aria-label="Clarification questions">
     <h3>Clarification questions</h3><p className="pt-note">Open questions, not facts. Add anything the team should answer.</p>
     <Items label="Question" title="" items={dd.plan.questions} suggestion={suggestion} viewer="champion" onChange={questions=>dd.setPlan({...dd.plan!,questions})}/>
    </section>
   </fieldset>
   {!reviewing&&<Responsibilities v={v}/>}
  </>}
 </div>;
}

function Status({v}:{v:ChampionReview}){
 const last=[...v.history].reverse().find(e=>e.action==='changes_requested');
 const text:Record<ChampionReview['status'],string>={not_submitted:'Nothing to review yet. When Chris submits the onboarding plan, it appears here.',
  revising:'Chris is revising the plan. It appears here again when it is resubmitted.',
  submitted:'Chris submitted this plan for your review.',resubmitted:'Chris revised and resubmitted this plan.',
  changes_requested:`You asked Chris for changes${last?` on ${new Date(last.at).toLocaleString()}`:''}. It comes back here when Chris resubmits it.`,
  approved:`Approved by ${v.approval?.by} on ${v.approval?new Date(v.approval.at).toLocaleString():''}. Publishing isn’t enabled on this server, so developers don’t see it yet.`,
  published:`Approved by ${v.approval?.by} on ${v.approval?new Date(v.approval.at).toLocaleString():''}. Developers have their assigned work.`,
  published_before_dream_day:'Your team’s current onboarding was published before Dream Day. No Champion approval is recorded for it.'};
 return <p style={{marginTop:14}} role="status">{text[v.status]}</p>;
}

function History({v}:{v:ChampionReview}){
 return <details className="pt-details" open={v.status==='changes_requested'||v.status==='resubmitted'}><summary>Review history ({v.history.length})</summary>
  <ol className="pt-milestones">{v.history.map((e,i)=><li key={i}><span className={'pt-pill '+(e.action==='changes_requested'?'amber':e.action==='approved'||e.action==='published'?'green':'blue')}>{e.action.replace('_',' ')}</span>
   <div><strong>{ACTION[e.action]} {e.by}</strong><p>{new Date(e.at).toLocaleString()}</p>{e.comment&&<p style={{whiteSpace:'pre-wrap'}}>“{e.comment}”</p>}</div></li>)}</ol></details>;
}

function ReadItems({title,items,suggestion,empty}:{title:string;items:ReviewItem[];suggestion:string;empty?:string}){
 return <>{title&&<p className="pt-label" style={{marginTop:20}}>{title}</p>}
  {items.length===0?<p className="pt-note">{empty??'None.'}</p>:<ul className="pt-findings">{items.map(x=><li key={x.id}>
   <span style={{display:'flex',gap:6,flexWrap:'wrap'}}><Origin item={x} suggestion={suggestion} viewer="champion"/>{x.status&&<span className={'pt-pill '+STATUS[x.status][1]}>{STATUS[x.status][0]}</span>}</span>
   <span>{x.text}{x.sources?.length?<small>Source: {x.sources.join(', ')}</small>:null}</span></li>)}</ul>}</>;
}

/** What remains to decide, from the current (possibly unsaved) plan. */
function Decide({dd}:{dd:DreamDaySession}){
 const [comment,setComment]=useState(''),[confirmed,setConfirmed]=useState(false);
 const p=dd.plan!,v=dd.view!;
 const unassigned=p.milestones.filter(m=>!m.assignee).length;
 const open=[unassigned?`${unassigned} milestone${unassigned>1?'s':''} without an assignee`:null,p.questions.length?`${p.questions.length} open clarification question${p.questions.length>1?'s':''}`:null,
  v.plan!.problem.contradictions.length?`${v.plan!.problem.contradictions.length} contradiction${v.plan!.problem.contradictions.length>1?'s':''} to keep in mind`:null].filter(Boolean) as string[];
 const err=dd.error;
 return <section className="pt-card" aria-label="Your decision">
  <h3>Your decision</h3>
  {open.length?<ul className="pt-list" aria-label="Still to decide">{open.map(x=><li key={x}>{x}</li>)}</ul>:<p className="pt-note">Every milestone has an assignee.</p>}
  <div className="pt-decisions">
   <div>
    <p className="pt-label">Approve onboarding plan</p>
    <p className="pt-note">Approving publishes the approved milestones to developers. Each developer sees only the work assigned to them.</p>
    <label className="pt-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm the technical goals, milestones, assignments and dependencies.</label>
    <div className="pt-actions"><button className="pt-btn sm" disabled={!confirmed||dd.dirty||dd.busy!==''} onClick={()=>void dd.approve()}>{dd.busy==='decide'?'Working…':'Approve onboarding plan'}</button>
     {dd.dirty&&<span className="pt-note" style={{marginTop:0}}>Save your changes first.</span>}</div>
   </div>
   <div>
    <p className="pt-label">Request changes</p>
    <label className="pt-form-field" style={{marginTop:8}}><span className="pt-sr">What should Chris change?</span><textarea className="pt-textarea compact" aria-label="What should Chris change?" rows={3} maxLength={2000} placeholder="What should Chris change?" value={comment} onChange={e=>setComment(e.target.value)}/></label>
    <div className="pt-actions"><button className="pt-btn sm ghost" disabled={comment.trim().length<3||dd.busy!==''} onClick={async()=>{if(await dd.requestChanges(comment.trim()))setComment('');}}>Request changes</button>
     {dd.dirty&&<span className="pt-note" style={{marginTop:0}}>Your unsaved edits aren’t sent; save them first if Chris should see them.</span>}</div>
   </div>
  </div>
  {err&&(err.issues||err.code==='COMMENT_REQUIRED')&&<div className="pt-banner error" role="alert"><div>{ERRORS[err.code]??err.code}{err.issues?.length?<ul className="pt-list">{err.issues.map(x=><li key={x.path}>{x.label}: {REASONS[x.reason]??x.reason}</li>)}</ul>:null}</div></div>}
 </section>;
}

/** After approval: who does what, as approved. */
function Responsibilities({v}:{v:ChampionReview}){
 if(!v.plan||!(v.status==='approved'||v.status==='published'))return null;
 const title=new Map(v.plan.milestones.map(m=>[m.id,m.title]));
 return <section className="pt-card" aria-label="Approved responsibilities">
  <h3>Approved responsibilities</h3>
  <table className="pt-table"><thead><tr><th>Milestone</th><th style={{width:'20%'}}>Assigned to</th><th style={{width:'18%'}}>Role</th><th style={{width:'24%'}}>After</th></tr></thead>
   <tbody>{v.plan.milestones.map(m=><tr key={m.id}><td>{m.title}</td><td>{m.assignee}</td><td>{roleName(m.role)}</td><td>{m.dependsOn.map(d=>title.get(d)).filter(Boolean).join(', ')||'—'}</td></tr>)}</tbody></table>
 </section>;
}
