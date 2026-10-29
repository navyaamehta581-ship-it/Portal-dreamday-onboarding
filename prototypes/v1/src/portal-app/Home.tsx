import {BarChart3,ClipboardList,Lightbulb,Sparkles,Target,Users} from 'lucide-react';
import type {ActivationSession} from '../activation/useActivation';
import type {Persona} from './session';
import {navigate} from './router';
import {loadProblem} from './onboarding/model';
import {GoalsList,OpportunityCard} from './adoption/Panels';
import type {OpportunitiesSession} from './adoption/useOpportunities';
import {askAikaAbout} from './onboarding/DeveloperOverview';
import {STATUS_LABEL,statusTone,type MilestoneWorkSession} from './work/useMilestoneWork';

/** “Welcome to Portal” (011, 036). Developers: what they can build or improve, and the milestones they chose. The
 * Champion: the company goals, adoption and the improvements to steer, or the plan waiting for review. */
export function Home({session,persona,work,opps}:{session:ActivationSession;persona:Persona;work:MilestoneWorkSession;opps:OpportunitiesSession}){
 const {state,busy,error}=session;
 const approved=!!state?.handoff?.approval&&!!opps.data;
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  {persona.role==='champion'?<ChampionHome session={session} opps={opps}/>:
   approved?<DeveloperHome opps={opps} work={work}/>:
   <section className="pt-guide" aria-label="Your onboarding">
    <div className="pt-guide-head"><span className="icon"><Target size={20} aria-hidden="true"/></span><h2>Your engineering goals</h2></div>
    <div className="pt-step" role={error&&error!=='NOT_FOUND'?'alert':'status'}>
     <h3>{busy||opps.loading?'Loading…':error&&error!=='NOT_FOUND'?loadProblem(error).title:'Your team’s onboarding plan isn’t published yet'}</h3>
     <p>{error&&error!=='NOT_FOUND'?loadProblem(error).detail:'When it’s published, your team’s goals and what you can build or improve appear here.'}</p>
     <button className="pt-btn" onClick={()=>navigate('/aika')}><Sparkles size={16} aria-hidden="true"/>Ask AiKA</button>
    </div>
   </section>}
 </div>;
}

function DeveloperHome({opps,work}:{opps:OpportunitiesSession;work:MilestoneWorkSession}){
 const d=opps.data!;
 const top=[...d.opportunities].sort((a,b)=>Number(!!b.mine)-Number(!!a.mine)||Number(b.highlighted)-Number(a.highlighted)).slice(0,3);
 const mine=(work.progress?.milestones??[]).filter(m=>m.mine);
 return <>
  <section className="pt-guide" aria-label="Your engineering goals">
   <div className="pt-guide-head"><span className="icon"><Target size={20} aria-hidden="true"/></span><h2>Your team’s engineering goals</h2></div>
   <div className="pt-step panel"><GoalsList goals={d.goals}/></div>
  </section>
  <section className="pt-guide" aria-label="What you can build or improve">
   <div className="pt-guide-head"><span className="icon"><Lightbulb size={20} aria-hidden="true"/></span><h2>What you can build or improve</h2></div>
   <div className="pt-step panel">
    {top.length?<div className="pt-opportunities" style={{marginTop:0}}>{top.map(o=><OpportunityCard key={o.id} o={o} mode="developer" session={opps} onAsk={askAikaAbout}/>)}</div>:<p>No suggestions yet.</p>}
    <div className="pt-actions"><button className="pt-btn" onClick={()=>navigate('/activation')}>See all opportunities and milestones</button></div>
   </div>
  </section>
  <section className="pt-guide" aria-label="Your milestones">
   <div className="pt-guide-head"><span className="icon"><ClipboardList size={20} aria-hidden="true"/></span><h2>Your milestones</h2></div>
   <div className="pt-step panel">
    {mine.length?<ul className="pt-plain-list">{mine.map(m=><li key={m.id}><strong>{m.title}</strong> <span className={'pt-pill '+statusTone(m.status)}>{STATUS_LABEL[m.status]}</span>{m.suggestedForMe&&!m.workingOn?.length?<small className="pt-sub">Suggested for you</small>:null}</li>)}</ul>
     :<p>You haven’t chosen a milestone yet. Pick one when you’re ready; nothing is assigned.</p>}
    <div className="pt-actions"><button className="pt-btn ghost" onClick={()=>navigate(mine.length?'/activation/work':'/activation')}>{mine.length?'Open my milestones':'Choose a milestone'}</button>
     <button className="pt-btn ghost" onClick={()=>navigate('/progress')}><BarChart3 size={16} aria-hidden="true"/>My progress</button></div>
   </div>
  </section>
 </>;
}

function ChampionHome({session,opps}:{session:ActivationSession;opps:OpportunitiesSession}){
 const h=session.state?.handoff;
 if(!h?.approval||!opps.data)return <section className="pt-guide" aria-label="Team coordination">
  <div className="pt-guide-head"><span className="icon"><Users size={20} aria-hidden="true"/></span><h2>Your team’s onboarding plan</h2></div>
  <div className="pt-step"><h3>Your team’s onboarding plan isn’t published yet</h3>
   <p>When Chris publishes it, your company goals, improvement opportunities and adoption appear here, and your developers can start. Technical setup stays with Spotify’s solutions engineers.</p>
   <button className="pt-btn" onClick={()=>navigate('/champion')}>Open Dream Day</button></div>
 </section>;
 const a=opps.adoption,d=opps.data;
 const recommended=d.opportunities.filter(o=>o.highlighted).length;
 return <>
  <section className="pt-guide" aria-label="Company goals">
   <div className="pt-guide-head"><span className="icon"><Target size={20} aria-hidden="true"/></span><h2>Company goals</h2></div>
   <div className="pt-step panel"><GoalsList goals={d.goals}/></div>
  </section>
  <section className="pt-guide" aria-label="Adoption progress">
   <div className="pt-guide-head"><span className="icon"><BarChart3 size={20} aria-hidden="true"/></span><h2>Adoption progress</h2></div>
   <div className="pt-step panel">
    {a?<dl className="pt-coord-summary">
     <div><dt>Milestones completed</dt><dd>{a.milestones.completed}<small> of {a.milestones.total}</small></dd></div>
     <div><dt>Opportunities pursued</dt><dd>{a.opportunities.pursued}<small> of {a.opportunities.total}</small></dd></div>
     <div><dt>Developers with recorded activity this week</dt><dd>{a.developers.filter(x=>x.activeThisWeek).length}<small> of {a.developers.length} engaged</small></dd></div>
    </dl>:<p>Loading…</p>}
    {a?.suggestions[0]&&<p className="pt-note">{a.suggestions[0]}</p>}
   </div>
  </section>
  <section className="pt-guide" aria-label="Recommended improvements">
   <div className="pt-guide-head"><span className="icon"><Lightbulb size={20} aria-hidden="true"/></span><h2>Recommended improvements</h2></div>
   <div className="pt-step panel"><p>{d.opportunities.length} suggestion{d.opportunities.length===1?'':'s'} for your repositories, services, docs and workflows; {recommended?`you recommended ${recommended} to developers`:'none recommended to developers yet'}.</p>
    <div className="pt-actions"><button className="pt-btn" onClick={()=>navigate('/champion/team')}>Prioritise in Team overview</button></div></div>
  </section>
 </>;
}
