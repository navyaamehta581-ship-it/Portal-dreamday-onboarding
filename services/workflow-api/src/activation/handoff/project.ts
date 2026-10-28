/** Role projections. The developer handoff is generated from structured fields and templates only,
 * so source wording, commercial and stakeholder findings cannot reach it. developerState() is applied to
 * every state response for non-operator principals, including records created before this pipeline. */
import type {ActivationState} from '../../../../../contracts/activation/v1/state.ts';
import type {DeveloperHandoff,MilestoneDraft,TechnicalNote,Understanding} from '../../../../../contracts/activation/v1/handoff.ts';
import type {EvidenceRecord} from '../../../../../contracts/activation/v1/types.ts';
import {interpretRuleBased} from './interpret.ts';
import {proposeMilestones} from './milestones.ts';

const plain=(s:string)=>s.replace(/\.$/,'');
/** Two or three sentences per topic, written for the developer's current milestone. */
export function technicalNotes(u:Understanding,m:MilestoneDraft|null):TechnicalNote[]{
 const dev=u.findings.filter(f=>f.audience==='developer');
 const pick=(topic:string)=>dev.find(f=>f.topic===topic&&f.status!=='outdated');
 const status=(t:string)=>{const f=pick(t);return f?.status==='verified'?'verified':f?.status==='assumption'||f?.status==='contradicted'?'assumption':'reported';};
 const notes:TechnicalNote[]=[];const name=m?.system.service??u.entities.services[0]??'the service';const Name=name==='the service'?'The service':name;
 const repo=pick('Repository'),scm=pick('Source control');
 if(repo||scm)notes.push({topic:'Repository',status:status(repo?'Repository':'Source control'),text:`${repo?plain(repo.statement):`The repository for ${name} is not identified yet`}${scm?` on ${u.entities.scm}`:''}. Start by inspecting it from the Repository tab; the inspection is read-only and records what it finds as evidence.`});
 const own=pick('Ownership');
 if(own||!m||m.id.startsWith('service_readiness')||m.id.startsWith('techdocs'))notes.push({topic:'Ownership',status:own?status('Ownership'):'assumption',text:own?.status==='contradicted'?`Sources disagree about who owns ${name}. Confirm the owning team with its maintainers before writing it into catalog-info.yaml.`:own&&/reported as/.test(own.statement)?`${plain(own.statement)}, but this hasn't been confirmed by that team. Confirm it before using it in catalog metadata.`:`No confirmed owner for ${name}. Catalog registration needs one, so confirm it with the maintainers rather than inferring it from commit history.`});
 const cat=pick('Catalog metadata');
 if(cat||m?.id.startsWith('service_readiness'))notes.push({topic:'Catalog metadata',status:cat?status('Catalog metadata'):'assumption',text:cat?`${plain(cat.statement).replace(/^Catalog metadata/,`Catalog metadata for ${name}`)}. The repository inspection shows whether catalog-info.yaml exists and which fields are missing.`:`It isn't known whether ${name} has catalog-info.yaml. The repository inspection will show it.`});
 const docs=pick('Documentation');
 if(docs)notes.push({topic:'Documentation',status:status('Documentation'),text:`${plain(docs.statement)}. Note which runbooks are current; they can move next to the code with TechDocs later.`});
 const ci=pick('CI/CD');
 if(ci)notes.push({topic:'CI/CD',status:status('CI/CD'),text:`${plain(ci.statement)}. Check the pipeline configuration in the repository when you inspect it.`});
 const rt=pick('Runtime');
 if(rt)notes.push({topic:'Runtime',status:status('Runtime'),text:`${plain(rt.statement)}. Use this to find the right build and dependency files during inspection.`});
 return notes.slice(0,6);
}

export function developerSummary(m:MilestoneDraft|null,u:Understanding):string{
 if(!m)return u.findings.some(f=>f.audience==='developer')?'Technical context for your first milestone is below.':'Your first milestone is described below.';
 const where=m.system.repository?` in ${m.system.repository}`:'';
 return `Your first milestone: ${m.objective.charAt(0).toLowerCase()+m.objective.slice(1)}${where}. ${m.why.split(/(?<=\.)\s/)[0]}`;
}

export function developerHandoff(version:number,publishedAt:string,u:Understanding,milestones:MilestoneDraft[]):DeveloperHandoff{
 const m=milestones[0]??null;
 return {version,publishedAt,interpreter:u.interpreter,summary:developerSummary(m,u),context:technicalNotes(u,m),
  unknowns:u.unknowns.filter(x=>x.audience==='developer'&&x.priority!=='not_needed_now').map(x=>({question:x.question,reason:x.reason})),milestones};
}

const SAFE_KINDS=new Set(['github_observation','developer_report','action_record','verified_outcome']);
/** Developer-safe evidence: Chris's reports become a source category plus a technical conclusion. */
function safeEvidence(e:EvidenceRecord,h:DeveloperHandoff):EvidenceRecord{
 if(SAFE_KINDS.has(e.kind))return e;
 const claim=e.kind==='ai_inference'?`Milestone generated from the reviewed plan (${h.interpreter==='hosted_model'?'model-assisted interpretation':'rule-based interpretation'}).`:/agreement/i.test(e.id)?`Agreed outcome: ${h.milestones[0]?.objective??'first milestone'}.`:'Customer context reviewed and approved by Chris.';
 return {...e,claim,source:e.kind==='ai_inference'?'Plan generation':'Customer context (reviewed by Chris)',producer:e.kind==='ai_inference'?'Plan generation':'Chris',scope:h.milestones[0]?.objective??'First milestone'};
}

/** Legacy records have no stored handoff: derive one from the stored briefing on the server. */
export function legacyHandoff(state:ActivationState):DeveloperHandoff{
 const u=interpretRuleBased([{id:'legacy',type:'chris_notes',label:'Published context',text:state.context.briefing}]);
 const p=proposeMilestones(u);
 return developerHandoff(state.contextRevision+1,state.context.agreedGoal.agreedAt,u,p.milestones);
}

/** Field-level projection for developer principals. Applied server-side to every state response. */
export function developerState(state:ActivationState,stored:DeveloperHandoff|null):ActivationState&{handoff:DeveloperHandoff}{
 const h=stored??legacyHandoff(state),m=h.milestones[0]??null;
 const s=structuredClone(state) as ActivationState&{handoff:DeveloperHandoff};
 s.context.briefing=h.summary;
 s.context.constraints=h.context.map(n=>`${n.topic}: ${n.text}`);
 s.context.unknowns=h.unknowns.map(u=>u.question);
 const money=/[$€£]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m)\b(?!\w)|\b(?:arr|acv|discount|pricing|renewal|opportunity|contract)\b/i;
 s.context.agreedGoal={...s.context.agreedGoal,text:m?.objective??(money.test(state.context.agreedGoal.text)?'First milestone':state.context.agreedGoal.text),agreedBy:'Customer team (via Chris)'};
 s.context.evidence=s.context.evidence.map(e=>safeEvidence(e,h));
 s.evidence=s.evidence.map(e=>safeEvidence(e,h));
 s.plan.evidence=s.plan.evidence.map(e=>safeEvidence(e,h));
 // Plan text comes from the approved milestone only. Replacement plans after a blocker keep the
 // developer's own blocker wording, which they wrote.
 if(m){
  s.plan.selectedMilestone={...s.plan.selectedMilestone,outcome:m.objective,successCriteria:m.completionCriteria};
  const added=state.plan.prerequisites.filter(p=>p.description.startsWith('Confirm the attributed blocker'));
  s.plan.prerequisites=[...m.prerequisites.map(p=>({description:p.text,state:p.state,evidenceIds:[]})),...added];
  if(state.planRevision===0){s.plan.rationale=m.why;s.plan.suggestedNextAction={...s.plan.suggestedNextAction,description:m.actions[0]};}
 } else {
  // Older plans embedded the briefing in their text; keep the instruction, drop the copied notes.
  const strip=(t:string)=>t.replace(/\s*Use this briefing:[\s\S]*?(?=Target:|$)/,' ').replace(/\s*Target:[\s\S]*?(?=Review original constraints|$)/,' ').replace(/\s*Basis:[\s\S]*$/,'').replace(/\s+/g,' ').trim();
  s.plan.rationale=strip(s.plan.rationale);s.plan.suggestedNextAction={...s.plan.suggestedNextAction,description:strip(s.plan.suggestedNextAction.description)};
  if(money.test(s.plan.selectedMilestone.outcome))s.plan.selectedMilestone={...s.plan.selectedMilestone,outcome:'First milestone'};
 }
 s.outcome={...s.outcome,scope:m?.objective??'First milestone'};
 s.handoff=h;
 return s;
}
