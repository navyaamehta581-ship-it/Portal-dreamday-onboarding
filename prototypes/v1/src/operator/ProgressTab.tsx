import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {activationClient} from '../activation/client';
import {CoordinationView} from '../portal-app/work/Coordination';
import type {MilestoneWorkSession} from '../portal-app/work/useMilestoneWork';
import {useOpportunities} from '../portal-app/adoption/useOpportunities';
import {AdoptionSummary,GoalsList,OpportunityCard,opportunityProblem} from '../portal-app/adoption/Panels';
import {Section} from '../review/Editors';

/** Progress and updates, read-only: Chris can follow how the customer's team adopts the published plan. He doesn't
 * configure anything; technical setup belongs to Spotify's solutions engineers, the work to the customer's team. */
export function ProgressTab({state,work,api}:{state:ActivationState|null;work?:MilestoneWorkSession;api:ReturnType<typeof activationClient>|null}){
 const o=useOpportunities(state?api:null,{adoption:true});
 if(!state)return <section className="pt-card"><h3>Nothing published yet</h3><p className="pt-note">Progress appears here once you finalize the onboarding plan on the Onboarding Draft tab.</p></section>;
 return <div style={{display:'grid',gap:20}}>
  <section className="pt-card" aria-label="Adoption">
   <div className="pt-card-head"><h3>Adoption</h3><span className="pt-note" style={{marginTop:0}}>Read-only</span></div>
   {o.adoption?<AdoptionSummary a={o.adoption}/>:<p className="pt-note" role="status">{o.error?opportunityProblem(o.error):'Loading…'}</p>}
  </section>
  {o.data&&<Section id="progress-goals" title="Company goals" count={o.data.goals.length} defaultOpen summary="Progress toward the goals in the published plan.">
   <GoalsList goals={o.data.goals}/></Section>}
  {o.data&&<Section id="progress-opportunities" title="Engineering opportunities" count={o.data.opportunities.length} summary="What developers can pursue; the Champion sets priorities.">
   <div className="pt-opportunities">{o.data.opportunities.map(x=><OpportunityCard key={x.id} o={x} mode="observer"/>)}</div></Section>}
  {work?.progress&&<Section id="progress-team" title="Milestone progress" count={work.progress.milestones.length} summary="What developers recorded in Portal as they work; nothing is detected automatically. Developers and the Champion make every change.">
   <CoordinationView work={work} mode="observer"/></Section>}
 </div>;
}
