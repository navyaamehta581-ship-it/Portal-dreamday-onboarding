import type {ActivationState} from '../../../../contracts/activation/v1/state';

/** A disposable projection of one admitted session, never an adoption record. */
export function championPlan(state:ActivationState){
 if(state.customerId!==state.context.customerId||state.customerId!==state.plan.customerId)throw Error('CHAMPION_SCOPE_MISMATCH');
 const evidence=[...state.evidence,...state.plan.evidence.filter(e=>!state.evidence.some(x=>x.id===e.id))];
 const issues=[...state.plan.prerequisites.filter(p=>p.state!=='met').map(p=>`${p.description} (${p.state})`),...state.context.unknowns.map(x=>`${x} (unknown)`)];
 const currentPackets=Object.values(state.githubPreparations??{}).filter(p=>p.planRevision===state.planRevision&&p.actionId===state.plan.suggestedNextAction.id&&p.actionRevision===state.plan.suggestedNextAction.revision);
 const packets=currentPackets.filter(p=>p.status==='prepared'&&!!p.artifactDigest&&!!p.artifact&&p.evidenceIds.length>0&&p.evidenceIds.every(id=>evidence.some(e=>e.id===id&&e.kind==='github_observation')));
 for(const packet of currentPackets)issues.push(...packet.blockers,...(packet.setupProposal?.missingPrerequisites??[]),...(packet.status==='failed'?['GitHub inspection failed; no preparation is established.']:[]));
 const blocked=state.milestone.status==='blocked'||state.plan.blockerIds.length>0||state.replan.status==='pending'||state.replan.status==='failed'||Object.values(state.actions).some(a=>a.planRevision===state.planRevision&&a.blockedByIds.length>0);
 if(state.chrisHelp.status==='requested'&&state.chrisHelp.reason)issues.push(`Chris help request (reported): ${state.chrisHelp.reason}`);
 if(blocked)issues.push('Current path is blocked or awaiting replanning; resolve before continuing.');
 const roles:{role:string;reason:string}[]=[];
 // Only role categories are generated; customer text is displayed as the supporting requirement.
 const rules:[RegExp,string][]=[[/permission|access|security|credential|token/i,'Repository access / security owner'],[/template|skeleton|catalog|portal/i,'Portal / template maintainer'],[/runtime|deploy|pipeline|\bci\b|infrastructure/i,'Runtime / CI owner']];
 const requirements=[...state.plan.prerequisites.map(p=>p.description),...state.context.constraints,...issues];
 for(const [pattern,role] of rules){const reason=requirements.find(x=>pattern.test(x));if(reason)roles.push({role,reason});}
 const reviewReason=issues[0];
 if(reviewReason)roles.unshift({role:'Technical owner',reason:reviewReason});
 if(state.chrisHelp.status==='requested')roles.push({role:'Chris / customer champion',reason:'The saved session explicitly requests Chris’s help.'});
 const verified= !blocked&&state.milestone.status==='reached'&&state.milestone.requiredActions.length>0&&state.milestone.requiredActions.every(required=>{const action=state.actions[required.id];return action?.status==='verified'&&action.revision===required.revision&&action.planRevision===state.planRevision;})&&state.milestone.evidenceIds.some(id=>evidence.some(e=>e.id===id&&e.kind==='verified_outcome'&&e.scope.startsWith('technical:')&&e.proof.type==='verification'&&e.proof.result==='passed'&&!!e.proof.verifier&&e.proof.verifier!==e.producer&&!!e.proof.reference&&state.milestone.requiredActions.some(a=>a.id===e.proof.actionId&&a.revision===e.proof.actionRevision)));
 const milestones=[
  {label:'First developer outcome',status:verified?'Verified technical milestone':blocked?'Blocked — proposed next milestone':'Proposed — not verified',detail:state.plan.selectedMilestone.outcome},
  {label:'Technical owner review',status:'Proposed — not achieved',detail:'Review the current evidence, prepared work and unresolved requirements.'},
  {label:'Repeat onboarding',status:'Proposed — not achieved',detail:'After review and blocker resolution, try the same path with another developer and collect evidence.'},
  {label:'Chris follow-up',status:state.chrisHelp.status==='requested'?'Requested — not completed':'Proposed — not achieved',detail:'Review developer feedback and agree the next action; no team adoption is established.'},
 ];
 const work=packets.length?packets.map(p=>`Local review packet ${p.id}, digest ${p.artifactDigest}, source commit ${p.commit}${p.setupProposal?' with a setup proposal':''}. Prepared for review only; no execution or deployment.`).join('\n'):'No current evidence-backed local review packet is prepared.';
 const reports=evidence.filter(e=>e.kind==='developer_report'||e.kind==='customer_report');
 const prepared=packets.length?`A review packet for ${packets[0].repository} is ready to look at. Nothing has been run or deployed.`:'';
 const open=[...new Set(issues)];
 const message=['Hi team,',
  `We’re onboarding to Spotify Portal. Our first goal: ${state.context.agreedGoal.text}.`,
  `Next step: ${blocked?'Review blockers with the technical owner before we continue. ':''}${state.plan.suggestedNextAction.description}`,
  [verified?'Our first technical milestone is verified, but the team hasn’t adopted Portal yet.':'Our first milestone isn’t verified yet.',prepared].filter(Boolean).join(' '),
  open.length?`Still open:\n${open.map(x=>'- '+x).join('\n')}`:'Nothing is blocking us right now.',
  roles.length?`I’d like help from: ${roles.map(r=>r.role).join(', ')}.`:'',
  'Plan: a technical owner reviews our setup, a second developer repeats the onboarding once blockers are resolved, then we follow up with Chris.',
 ].filter(Boolean).join('\n\n');
 return {roles,milestones,message,issues:[...new Set(issues)],work,verified,blocked};
}
