import {useState} from 'react';
import {ChevronDown,ChevronUp,Sparkles,Star} from 'lucide-react';
import type {Adoption,GoalView,Opportunity,OpportunityBasis,Priority} from '../../../../../contracts/activation/v1/handoff';
import type {OpportunitiesSession} from './useOpportunities';
import {STATUS_LABEL,statusTone} from '../work/useMilestoneWork';

const BASIS:Record<OpportunityBasis,[string,string,string]>={
 verified:['Verified','green','Backed by a live, read-only observation of the repository.'],
 sample:['Sample data','amber','Backed by sample data for this fictional demo, not a live repository.'],
 hypothesis:['Hypothesis','blue','Suggested by the approved plan; nothing has confirmed it yet.']};
const KIND:Record<Opportunity['kind'],string>={integration:'Integration',migration:'Migration',new_build:'New build',improvement:'Improvement'};
const PRIORITY:Record<Priority,string>={high:'High priority',normal:'Normal priority',later:'Later'};
export const opportunityProblem=(code:string)=>code==='NO_APPROVED_PLAN'?'Nothing to show until your team’s plan is approved in Dream Day.':code==='CHAMPION_REQUIRED'||code==='FORBIDDEN'?'Your role can’t change this.':code==='DEVELOPER_IDENTITY_REQUIRED'?'Sign in with your own developer persona to choose work.':`Something went wrong (${code}). Try again.`;

export function BasisPill({basis}:{basis:OpportunityBasis}){
 const [label,tone,title]=BASIS[basis];
 return <span className={'pt-pill '+tone} title={title} data-basis={basis}>{label}</span>;
}

/** One engineering opportunity: what, why, what backs it, and how to start. The Champion prioritises and highlights;
 * a developer chooses to pursue it and can ask AiKA; Chris reads. */
export function OpportunityCard({o,mode,session,onAsk}:{o:Opportunity;mode:'champion'|'developer'|'observer';session?:OpportunitiesSession;onAsk?:(o:Opportunity)=>void}){
 const [open,setOpen]=useState(false);
 const busy=session?.busy===o.id;
 return <article className={'pt-opportunity'+(o.highlighted?' highlighted':'')} aria-label={`Opportunity: ${o.title}`} data-opportunity={o.id}>
  <div className="pt-opportunity-head">
   <div className="pt-opportunity-title">
    <p className="pt-opportunity-meta"><span className="pt-pill">{KIND[o.kind]}</span><BasisPill basis={o.basis}/>
     {o.highlighted&&<span className="pt-pill green"><Star size={12} aria-hidden="true"/> Recommended by your Champion</span>}
     {o.priority&&mode!=='champion'&&<span className="pt-pill">{PRIORITY[o.priority]}</span>}</p>
    <h4>{o.title}</h4>
    <p className="pt-note" style={{marginTop:2}}>{o.why}</p>
   </div>
   <button className="pt-tool" aria-expanded={open} aria-label={`${open?'Hide':'Show'} details: ${o.title}`} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
  </div>
  <div className="pt-opportunity-actions">
   {mode==='developer'&&session&&<button className={'pt-btn sm'+(o.mine?' ghost':'')} disabled={busy} onClick={()=>void session.pursue(o.id,!o.mine)}>{busy?'Saving…':o.mine?'Stop pursuing':'Pursue this'}</button>}
   {mode==='developer'&&onAsk&&<button className="pt-btn sm ghost" onClick={()=>onAsk(o)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA</button>}
   {mode==='champion'&&session&&<>
    <label className="pt-inline-field"><span>Priority</span><select className="pt-input" aria-label={`Priority: ${o.title}`} value={o.priority??''} disabled={busy} onChange={e=>void session.prioritize(o.id,{priority:(e.target.value||null) as Priority|null})}>
     <option value="">Not set</option><option value="high">High</option><option value="normal">Normal</option><option value="later">Later</option></select></label>
    <label className="pt-check" style={{marginTop:0}}><input type="checkbox" checked={o.highlighted} disabled={busy} onChange={e=>void session.prioritize(o.id,{highlighted:e.target.checked})}/>Recommend to developers</label>
   </>}
   <span className="pt-note" style={{marginTop:0}}>{mode==='developer'?(o.pursuers?`${o.pursuers} developer${o.pursuers===1?'':'s'} pursuing${o.mine?' (including you)':''}`:'Nobody is pursuing this yet'):(o.pursuedBy?.length?`Pursued by ${o.pursuedBy.join(', ')}`:'Nobody is pursuing this yet')}</span>
  </div>
  {open&&<div className="pt-opportunity-body">
   <p className="pt-label">What backs it</p><ul className="pt-plain-list">{o.evidence.map(e=><li key={e}>{e}</li>)}</ul>
   {mode!=='observer'&&<><p className="pt-label" style={{marginTop:14}}>How to get started</p><ol className="pt-plain-list">{o.steps.map(s=><li key={s}>{s}</li>)}</ol></>}
  </div>}
 </article>;
}

/** Company goals with progress from the milestones that serve them; the Champion can set priorities. */
export function GoalsList({goals,session,champion}:{goals:GoalView[];session?:OpportunitiesSession;champion?:boolean}){
 if(!goals.length)return <p className="pt-note">No technical goals in the approved plan yet.</p>;
 return <ul className="pt-goals">{goals.map(g=>{const pct=g.total?Math.round(g.completed/g.total*100):0;return <li key={g.id} aria-label={`Goal: ${g.text}`}>
  <div className="pt-goal-head"><strong>{g.text}</strong>
   {champion&&session?<select className="pt-input" aria-label={`Priority: ${g.text}`} value={g.priority??''} disabled={session.busy===g.id} onChange={e=>void session.prioritize(g.id,{priority:(e.target.value||null) as Priority|null})}>
    <option value="">No priority</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="later">Later</option></select>
    :g.priority&&<span className="pt-pill">{PRIORITY[g.priority]}</span>}</div>
  {g.total?<><div className="pt-progress" role="img" aria-label={`${g.completed} of ${g.total} related milestones completed`}><span style={{width:`${pct}%`}}/></div>
   <p className="pt-note" style={{marginTop:6}}>{g.completed} of {g.total} related milestone{g.total===1?'':'s'} completed · {g.milestones.map(m=><span key={m.id} className={'pt-pill '+statusTone(m.status)} style={{marginRight:6}}>{m.title}: {STATUS_LABEL[m.status]}</span>)}</p></>
   :<p className="pt-note" style={{marginTop:6}}>No milestone is linked to this goal yet; progress shows once one is.</p>}
 </li>;})}</ul>;
}

/** Adoption toward the goals, from activity recorded in this Portal. A stat row, a weekly trend and plain observations. */
export function AdoptionSummary({a}:{a:Adoption}){
 const active=a.developers.filter(d=>d.activeThisWeek).length,max=Math.max(1,...a.weekly.map(w=>w.events));
 const week=(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString([], {day:'numeric',month:'short',timeZone:'UTC'});
 return <div aria-label="Adoption summary">
  <dl className="pt-coord-summary">
   <div><dt>Goals with progress</dt><dd>{a.goals.withProgress}<small> of {a.goals.total}</small></dd></div>
   <div><dt>Milestones completed</dt><dd>{a.milestones.completed}<small> of {a.milestones.total}</small></dd></div>
   <div><dt>Opportunities pursued</dt><dd>{a.opportunities.pursued}<small> of {a.opportunities.total}</small></dd></div>
   <div><dt>Developers active this week</dt><dd>{active}<small> of {a.developers.length} engaged</small></dd></div>
  </dl>
  <p className="pt-label" style={{marginTop:20}}>Developer activity per week</p>
  <div className="pt-trend" role="img" aria-label={`Developer activity per week, last ${a.weekly.length} weeks`}>
   {a.weekly.map(w=><div key={w.weekStart} className="pt-trend-col" title={`Week of ${week(w.weekStart)}: ${w.events} recorded action${w.events===1?'':'s'} by ${w.activeDevelopers} developer${w.activeDevelopers===1?'':'s'}`}>
    <span className="pt-trend-bar" style={{height:`${Math.max(w.events?6:0,w.events/max*100)}%`}}/><small>{week(w.weekStart)}</small></div>)}
  </div>
  <table className="pt-sr"><caption>Developer activity per week</caption><thead><tr><th>Week of</th><th>Recorded actions</th><th>Active developers</th></tr></thead>
   <tbody>{a.weekly.map(w=><tr key={w.weekStart}><td>{week(w.weekStart)}</td><td>{w.events}</td><td>{w.activeDevelopers}</td></tr>)}</tbody></table>
  {a.developers.length>0&&<><p className="pt-label" style={{marginTop:18}}>Who is engaged</p>
   <ul className="pt-plain-list">{a.developers.map(d=><li key={d.name}><strong>{d.name}</strong> · {d.workingOn} milestone{d.workingOn===1?'':'s'}, {d.pursuing} opportunit{d.pursuing===1?'y':'ies'}{d.lastActiveAt?` · last active ${new Date(d.lastActiveAt).toLocaleDateString()}`:''}{d.activeThisWeek?'':' · not active this week'}</li>)}</ul></>}
  {a.suggestions.length>0&&<><p className="pt-label" style={{marginTop:18}}>Where engagement could improve</p><ul className="pt-plain-list">{a.suggestions.map(s=><li key={s}>{s}</li>)}</ul></>}
  <p className="pt-note">From activity recorded in this onboarding (chosen milestones, recorded work and pursued opportunities). No wider Portal usage data is connected in this demo, so team-level usage isn’t shown.</p>
 </div>;
}
