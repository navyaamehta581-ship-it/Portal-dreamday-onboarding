import {Sparkles,Star} from 'lucide-react';
import type {Opportunity} from '../../../../../contracts/activation/v1/handoff';
import type {OpportunitiesSession} from '../adoption/useOpportunities';
import {BasisPill,opportunityProblem} from '../adoption/Panels';
import {askAikaAbout} from './DeveloperOverview';
import {navigate} from '../router';

/** Guide: practical, step-by-step instructions for the integrations, migrations and builds a developer pursues (then
 * the ones the Champion recommends, then the rest). Contextual questions go to AiKA. */
export function GuideTab({opps}:{opps:OpportunitiesSession}){
 const d=opps.data;
 if(!d)return <section className="pt-card" role={opps.error?'alert':'status'}><h3>{opps.error?opportunityProblem(opps.error):'Loading guides…'}</h3></section>;
 const rank=(o:Opportunity)=>o.mine?0:o.highlighted?1:2;
 const list=[...d.opportunities].sort((a,b)=>rank(a)-rank(b));
 return <div style={{display:'grid',gap:20}}>
  <section className="pt-card" aria-label="Step-by-step guides">
   <h3>Step-by-step guides</h3>
   <p className="pt-note">How to get started in Portal. The ones you pursue come first. For anything specific to your code or your setup, ask AiKA: it knows your team’s goals, systems and the opportunity you’re asking about.</p>
   <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/aika')}><Sparkles size={15} aria-hidden="true"/>Ask AiKA</button></div>
  </section>
  {list.map(o=><section key={o.id} className="pt-card" aria-label={`Guide: ${o.title}`}>
   <div className="pt-card-head"><h3>{o.title}</h3><span style={{display:'flex',gap:6,flexWrap:'wrap'}}>{o.mine&&<span className="pt-pill blue">You’re pursuing this</span>}{o.highlighted&&<span className="pt-pill green"><Star size={12} aria-hidden="true"/> Recommended</span>}<BasisPill basis={o.basis}/></span></div>
   <p className="pt-note">{o.why}</p>
   <ol className="pt-steps-list">{o.steps.map(s=><li key={s}>{s}</li>)}</ol>
   <div className="pt-actions">
    {!o.mine&&<button className="pt-btn sm ghost" disabled={opps.busy===o.id} onClick={()=>void opps.pursue(o.id,true)}>Pursue this</button>}
    <button className="pt-btn sm ghost" onClick={()=>askAikaAbout(o)}><Sparkles size={15} aria-hidden="true"/>Ask AiKA about this</button>
   </div>
  </section>)}
 </div>;
}
