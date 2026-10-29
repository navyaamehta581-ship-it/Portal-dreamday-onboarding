import {Sparkles} from 'lucide-react';
import {navigate} from './router';
import type {OpportunitiesSession} from './adoption/useOpportunities';
import {STATUS_LABEL,statusTone,type MilestoneWorkSession} from './work/useMilestoneWork';

/** A developer's own progress: the milestones they're working on and where they stand, and the opportunities they
 * chose with the next step. No team metrics or review counts: those don't help the work. */
export function MyProgress({work,opps}:{work:MilestoneWorkSession;opps:OpportunitiesSession}){
 const mine=(work.progress?.milestones??[]).filter(m=>m.mine);
 const chosen=(opps.data?.opportunities??[]).filter(o=>o.mine);
 return <div className="pt-page">
  <div className="pt-pagebar"><h1>My progress</h1></div>
  <div className="pt-entity" style={{display:'grid',gap:20}}>
   {!work.progress&&<div className="pt-empty" role="status"><div><h2>{work.loading?'Loading…':'Your team’s plan isn’t approved yet'}</h2></div></div>}
   {work.progress&&<section className="pt-card" aria-label="Milestones I’m working on">
    <h3>Milestones I’m working on</h3>
    {mine.length?mine.map(m=>{const done=m.actionsCompleted??0,total=m.actionsTotal??0,next=m.detail?.actions.find(a=>a.status!=='completed');return <div key={m.id} className="pt-progress-item" aria-label={`Progress: ${m.title}`}>
     <div className="pt-goal-head"><strong>{m.title}</strong><span className={'pt-pill '+statusTone(m.status)}>{STATUS_LABEL[m.status]}</span></div>
     <div className="pt-progress" role="img" aria-label={`${done} of ${total} steps done`}><span style={{width:`${total?done/total*100:0}%`}}/></div>
     <p className="pt-note" style={{marginTop:6}}>{done} of {total} steps done{next?` · next: ${next.text}`:total?' · every step is done':''}{m.openBlockers?` · ${m.openBlockers} open blocker${m.openBlockers===1?'':'s'}`:''}{m.dependsOn.some(x=>x.status!=='completed')?` · waits for ${m.dependsOn.filter(x=>x.status!=='completed').map(x=>x.title).join(', ')}`:''}</p>
     <div className="pt-actions"><button className="pt-btn sm ghost" onClick={()=>navigate('/activation/work')}>Update</button><button className="pt-btn sm ghost" onClick={()=>navigate(`/aika?milestone=${encodeURIComponent(m.id)}`)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA</button></div>
    </div>;}):<p className="pt-note">You haven’t chosen a milestone yet. <button className="pt-link" onClick={()=>navigate('/activation')}>Choose one</button></p>}
   </section>}
   {opps.data&&<section className="pt-card" aria-label="Opportunities I’m pursuing">
    <h3>Opportunities I’m pursuing</h3>
    {chosen.length?<ul className="pt-plain-list">{chosen.map(o=><li key={o.id}><strong>{o.title}</strong><small className="pt-sub">First step: {o.steps[0]}</small></li>)}</ul>
     :<p className="pt-note">None yet. <button className="pt-link" onClick={()=>navigate('/activation')}>See what you can build or improve</button></p>}
    {chosen.length>0&&<div className="pt-actions"><button className="pt-btn sm ghost" onClick={()=>navigate('/activation/guide')}>Open the step-by-step guides</button></div>}
   </section>}
  </div>
 </div>;
}
