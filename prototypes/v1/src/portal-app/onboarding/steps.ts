import type {ActivationSession} from '../../activation/useActivation';

export type StepId='goal'|'repository'|'report'|'team';
export type StepStatus='done'|'current'|'upcoming'|'locked';
export type Step={id:StepId;title:string;summary:string;status:StepStatus;attention:string|null;to:string;goLabel:string};

/** The developer's onboarding steps, derived only from recorded state. Team is unlocked by the existing gate and never counts as done. */
export function onboardingSteps(session:ActivationSession):{steps:Step[];done:number;total:number;current:Step|null}{
 const state=session.state!;
 const reports=state.evidence.filter(e=>e.kind==='developer_report').length;
 const packets=Object.values(state.githubPreparations??{});
 const prepared=packets.find(p=>p.status==='prepared'&&p.planRevision===state.planRevision);
 const failed=!prepared&&packets.some(p=>p.status==='failed'&&p.planRevision===state.planRevision);
 const replan=state.replan.status==='pending'?'Your next step is being updated':state.replan.status==='failed'?'Chris has been asked to help with your next step':null;
 const base:Omit<Step,'status'>[]=[
  {id:'goal',title:'Review your goal and first step',summary:session.direction.accepted?'Direction accepted':state.handoff?.milestones[0]?[state.handoff.milestones[0].system.service,state.handoff.milestones[0].system.repository].filter(Boolean).join(' · '):state.context.agreedGoal.text,attention:replan,to:'/activation',goLabel:'Go to Overview'},
  {id:'repository',title:'Inspect your repository',summary:prepared?`Review packet prepared · ${prepared.repository}`:failed?'The last inspection failed':`Read-only. Nothing is written to ${state.handoff?.milestones[0]?.system.platform??'GitHub'}.`,attention:failed?'The last inspection failed':null,to:'/activation/repository',goLabel:'Go to Repository'},
  {id:'report',title:'Share your progress',summary:reports?`${reports} update${reports===1?'':'s'} shared`:'Tell Chris what you reviewed or where you’re stuck.',attention:state.chrisHelp.status==='requested'?'Chris has been asked to help':null,to:'/activation/guide',goLabel:'Go to Guide'},
 ];
 const complete:Record<string,boolean>={goal:session.direction.accepted,repository:!!prepared,report:reports>0};
 const firstOpen=base.findIndex(s=>!complete[s.id]);
 const steps:Step[]=base.map((s,i)=>({...s,status:complete[s.id]?'done':i===firstOpen?'current':'upcoming'}));
 steps.push({id:'team',title:'Bring your team along',summary:'Suggested roles, a kickoff message and team milestones',attention:null,to:'/activation/team',goLabel:'Go to Team',status:session.teamUnlocked?'upcoming':'locked'});
 const done=base.filter(s=>complete[s.id]).length;
 return {steps,done,total:base.length,current:steps.find(s=>s.status==='current')??null};
}
