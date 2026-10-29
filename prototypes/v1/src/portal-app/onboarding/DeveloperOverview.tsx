import {useState} from 'react';
import {ChevronDown,ChevronUp,Sparkles,Target} from 'lucide-react';
import type {MilestoneProgress,Opportunity} from '../../../../../contracts/activation/v1/handoff';
import {navigate} from '../router';
import {GoalsList,OpportunityCard,opportunityProblem} from '../adoption/Panels';
import type {OpportunitiesSession} from '../adoption/useOpportunities';
import {STATUS_LABEL,statusTone,workProblem,type MilestoneWorkSession} from '../work/useMilestoneWork';

export const askAikaAbout=(o:Opportunity)=>navigate(`/aika?opportunity=${encodeURIComponent(o.id)}`);

/** What a developer can build or improve, why it matters and how to start: the team's goals, engineering
 * opportunities (verified findings apart from hypotheses) and milestones to choose from. Nothing is assigned; no
 * setup, upload or reporting is asked of them. Help comes from AiKA and the Guide. */
export function DeveloperOverview({opps,work}:{opps:OpportunitiesSession;work:MilestoneWorkSession}){
 const d=opps.data;
 if(!d)return <section className="pt-card" role={opps.error?'alert':'status'}><h3>{opps.error?opportunityProblem(opps.error):'Loading your engineering goals…'}</h3></section>;
 const recommended=d.opportunities.filter(o=>o.highlighted||o.mine),rest=d.opportunities.filter(o=>!o.highlighted&&!o.mine);
 return <div style={{display:'grid',gap:20}}>
  <section className="pt-card" aria-label="Engineering goals">
   <div className="pt-card-head"><h3><Target size={17} aria-hidden="true" style={{verticalAlign:'-3px',marginRight:8}}/>Your team’s engineering goals</h3></div>
   <GoalsList goals={d.goals}/>
  </section>
  <section className="pt-card" aria-label="Engineering opportunities">
   <div className="pt-card-head"><h3>What you can build or improve</h3><button className="pt-btn sm ghost" onClick={()=>navigate('/activation/guide')}>Step-by-step guides</button></div>
   <p className="pt-note">Integrations, migrations, new builds and improvements for your services. <strong>Verified</strong> ones come from a read-only look at your repositories; <strong>hypotheses</strong> come from your team’s plan and still need checking. Pursue the ones you want; nothing is assigned.</p>
   {opps.error&&<div className="pt-banner error" role="alert">{opportunityProblem(opps.error)}</div>}
   {recommended.length>0&&<><p className="pt-label" style={{marginTop:16}}>Recommended and chosen</p><div className="pt-opportunities">{recommended.map(o=><OpportunityCard key={o.id} o={o} mode="developer" session={opps} onAsk={askAikaAbout}/>)}</div></>}
   {rest.length>0&&<>{recommended.length>0&&<p className="pt-label" style={{marginTop:18}}>More opportunities</p>}<div className="pt-opportunities">{rest.map(o=><OpportunityCard key={o.id} o={o} mode="developer" session={opps} onAsk={askAikaAbout}/>)}</div></>}
   {!d.opportunities.length&&<p className="pt-note">No suggestions yet.</p>}
  </section>
  <MilestoneChoices work={work}/>
 </div>;
}

/** The plan's milestones: meaningful outcomes anyone can choose. Suggested ones first. */
export function MilestoneChoices({work}:{work:MilestoneWorkSession}){
 const p=work.progress;
 if(!p)return null;
 const sorted=[...p.milestones].sort((a,b)=>Number(b.mine)-Number(a.mine)||Number(!!b.suggestedForMe)-Number(!!a.suggestedForMe));
 return <section className="pt-card" aria-label="Milestones to choose from">
  <div className="pt-card-head"><h3>Milestones</h3><button className="pt-btn sm ghost" onClick={()=>navigate('/activation/work')}>Open my milestones</button></div>
  <p className="pt-note">Engineering outcomes from the approved plan. Choose the ones you want to work on; there are no deadlines.</p>
  {work.error&&!work.error.milestoneId&&<div className="pt-banner error" role="alert">{workProblem(work.error)}</div>}
  <div className="pt-opportunities">{sorted.map(m=><MilestoneChoice key={m.id} m={m} work={work}/>)}</div>
 </section>;
}

function MilestoneChoice({m,work}:{m:MilestoneProgress;work:MilestoneWorkSession}){
 const [open,setOpen]=useState(false);
 const o=m.outline,err=work.error?.milestoneId===m.id?work.error:null;
 const working=m.workingOn??[];
 return <article className="pt-opportunity" aria-label={`Milestone: ${m.title}`}>
  <div className="pt-opportunity-head">
   <div className="pt-opportunity-title">
    <p className="pt-opportunity-meta"><span className={'pt-pill '+statusTone(m.status)}>{STATUS_LABEL[m.status]}</span>
     {m.suggestedForMe&&<span className="pt-pill green">Suggested for you</span>}{m.mine&&working.length>0&&<span className="pt-pill blue">You’re working on it</span>}</p>
    <h4>{m.title}</h4>
    <p className="pt-note" style={{marginTop:2}}>{working.length?`Working on it: ${working.join(', ')}`:m.assignee&&!m.suggestedForMe?`Suggested for ${m.assignee}`:'Nobody has picked it up yet'}{m.dependsOn.length?` · after ${m.dependsOn.map(x=>x.title).join(', ')}`:''}</p>
   </div>
   <button className="pt-tool" aria-expanded={open} aria-label={`${open?'Hide':'Show'} details: ${m.title}`} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
  </div>
  <div className="pt-opportunity-actions">
   {m.mine?<button className="pt-btn sm" onClick={()=>navigate('/activation/work')}>Work on it</button>
    :<button className="pt-btn sm ghost" disabled={!!work.busy} onClick={()=>void work.update(m.id,{pursue:true})}>{work.busy===m.id?'Saving…':'Choose this milestone'}</button>}
   <button className="pt-btn sm ghost" onClick={()=>navigate(`/aika?milestone=${encodeURIComponent(m.id)}`)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA</button>
  </div>
  {err&&<div className="pt-banner error" role="alert">{workProblem(err)}</div>}
  {open&&o&&<div className="pt-opportunity-body">
   {o.description&&o.description!==m.title&&<p style={{marginTop:0}}>{o.description}</p>}
   {o.system&&<p className="pt-note">System: {o.system}</p>}
   <p className="pt-label" style={{marginTop:12}}>What it involves</p><ol className="pt-plain-list">{o.actions.map(a=><li key={a}>{a}</li>)}</ol>
   {o.completionCriteria.length>0&&<><p className="pt-label" style={{marginTop:12}}>Done when</p><ul className="pt-plain-list">{o.completionCriteria.map(c=><li key={c}>{c}</li>)}</ul></>}
  </div>}
 </article>;
}
