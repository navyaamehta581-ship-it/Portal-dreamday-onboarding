/** Converts an understanding into specific, reviewable developer milestones. Playbooks describe the
 * engineering work; entities and findings fill in the service, repository and platform. When the sources
 * do not name a concrete service or repository, no milestone is invented: Chris gets the missing items. */
import type {MilestoneDraft,MilestoneProposal,Understanding} from '../../../../../contracts/activation/v1/handoff.ts';

const has=(u:Understanding,topic:string,match?:RegExp)=>u.findings.some(f=>f.audience==='developer'&&f.topic===topic&&(!match||match.test(f.statement)));
const state=(u:Understanding,topic:string,unmet:RegExp)=>has(u,topic,unmet)?'unmet' as const:'unknown' as const;

export function proposeMilestones(u:Understanding):MilestoneProposal{
 const e=u.entities,goal=u.goals[0];
 const blocking=u.unknowns.filter(x=>x.priority==='blocks_first_milestone'&&x.audience==='chris').map(x=>x.question);
 const service=e.services[0]??null,repository=e.repositories.find(r=>!service||r.toLowerCase().endsWith('/'+service))??e.repositories[0]??null;
 if(!goal||(!service&&!repository))return {milestones:[],missing:blocking.length?blocking:['Name the first service or repository in scope.']};
 const name=service??repository!.split('/')[1],repo=repository?`${repository}`:`the ${name} repository`,scm=e.scm??'your source control platform';
 const developerUnknowns=u.unknowns.filter(x=>x.audience==='developer'&&x.priority!=='not_needed_now').map(x=>x.question);
 const ownerUnclear=!has(u,'Ownership',/reported as/)||has(u,'Ownership',/unclear|not confirmed/);
 const base={id:`${goal.playbook}-1`,system:{service:name,repository,platform:e.scm},developerUnknowns};
 const prereqs=[{text:`Read access to ${repo} on ${scm}`,state:'unknown' as const}];
 let m:MilestoneDraft;
 switch(goal.playbook){
  case 'service_readiness':m={...base,
   objective:`Review ${name} repository readiness and prepare it for Catalog registration`,
   why:`A Catalog entry with a confirmed owner lets any engineer find ${name}, see which team is responsible and reach them during an incident. Recording what is missing now gives the platform team a readiness checklist it can reuse for the next services.`,
   actions:[
    `Inspect ${repo} on ${scm}: check for catalog-info.yaml at the root and note README, docs and CI configuration.`,
    ownerUnclear?`Confirm which team owns ${name} with its maintainers; don't infer it from commit history alone.`:`Check that the reported owner is still the team responsible for ${name}.`,
    `Decide the component type, lifecycle and system for ${name}.`,
    `Prepare catalog-info.yaml with owner, type and lifecycle for review. Don't merge it yet.`,
    ...(e.docs?[`List the ${name} runbooks in ${e.docs} that should become TechDocs later.`]:[]),
   ],
   prerequisites:[...prereqs,{text:`Owning team for ${name} confirmed`,state:ownerUnclear?'unmet':'unknown'},{text:'Catalog metadata reviewed',state:state(u,'Catalog metadata',/missing|incomplete/)}],
   requiredInformation:[`Owning team for ${name}`,'Component type, lifecycle and system',...(repository?[]:[`Location of the ${name} repository`])],
   destinations:[{label:'Repository',path:'/activation/repository'},{label:'Catalog',path:'/portal/x/catalog'},{label:'Evidence',path:'/activation/evidence'}],
   expectedOutput:`A catalog-info.yaml for ${name}, ready for review, plus a short list of missing readiness items.`,
   completionCriteria:[
    `A repository inspection of ${repo} is recorded against the current plan.`,
    `catalog-info.yaml for ${name} names an owner, a type and a lifecycle.`,
    'The owner is confirmed by the owning team, not assumed.',
    'Missing readiness items are recorded as evidence.',
   ],
   dependencies:['Repository read access','Confirmation from the owning team'],
  };break;
  case 'techdocs':m={...base,
   objective:`Make ${name} documentation discoverable next to the code with TechDocs`,
   why:`On-call engineers need ${name}'s runbooks where the service is listed, not in a separate wiki. Keeping docs in the repository means they change in the same review as the code.`,
   actions:[`Find the current ${name} runbooks${e.docs?` in ${e.docs}`:''} and list which ones are still accurate.`,`Check ${repo} for a docs/ folder and mkdocs.yml.`,'Draft mkdocs.yml and move the most-used runbook into docs/ for review.','Add the backstage.io/techdocs-ref annotation to catalog-info.yaml.'],
   prerequisites:[...prereqs,{text:`${name} has a Catalog entry`,state:state(u,'Catalog metadata',/missing|incomplete/)}],
   requiredInformation:['Which runbooks are current','Who reviews documentation changes'],
   destinations:[{label:'Repository',path:'/activation/repository'},{label:'Docs',path:'/portal/x/docs'}],
   expectedOutput:'mkdocs.yml and at least one runbook in docs/, plus the TechDocs annotation, ready for review.',
   completionCriteria:['A repository inspection is recorded against the current plan.','mkdocs.yml and docs/ exist in the proposed change.','catalog-info.yaml references the docs with backstage.io/techdocs-ref.'],
   dependencies:['Repository read access','Catalog entry for the service'],
  };break;
  case 'scaffolder':m={...base,
   objective:`Create the next service from an approved Software Template${e.scm?` on ${e.scm}`:''}`,
   why:'Starting from a reviewed template gives every new service the same ownership metadata, CI and docs from day one, instead of copying an older service and its gaps.',
   actions:['List the Software Templates available to your team and their prerequisites.','Confirm which template and runtime are approved for this service.','Run the template in a test location and record which inputs were required.','Note any missing template steps (CI, docs, catalog metadata).'],
   prerequisites:[...prereqs,{text:'An approved template and runtime',state:'unknown'}],
   requiredInformation:['Approved template','Approved runtime','Target repository location'],
   destinations:[{label:'Create',path:'/portal/x/create'},{label:'Repository',path:'/activation/repository'}],
   expectedOutput:'A record of the template run with the inputs it needed and any missing steps.',
   completionCriteria:['The template and runtime are confirmed as approved.','The template run is recorded with its inputs.','Missing template steps are recorded as evidence.'],
   dependencies:['Template access','Runtime approval'],
  };break;
  case 'ci_investigation':m={...base,
   objective:`Find why ${name}'s CI/CD pipeline fails${e.ci?` on ${e.ci}`:''} and record the cause`,
   why:'A pipeline that fails without a recorded cause blocks every change to the service; a written cause lets the owning team fix it once instead of re-running builds.',
   actions:[`Open the pipeline configuration in ${repo}${e.ci?` (${e.ci})`:''}.`,'Find the most recent failing run and the first failing step.','Check whether the failure is in code, configuration or the runner environment.','Record the cause and a proposed fix for review.'],
   prerequisites:[...prereqs,{text:'Access to pipeline logs',state:'unknown'}],
   requiredInformation:['The failing pipeline and run','Who can change pipeline configuration'],
   destinations:[{label:'Repository',path:'/activation/repository'}],
   expectedOutput:'The failing step, its cause and a proposed fix, ready for review.',
   completionCriteria:['A repository inspection is recorded against the current plan.','The failing step and cause are recorded as evidence.','A proposed fix is ready for review; nothing is merged.'],
   dependencies:['Pipeline log access'],
  };break;
 }
 return {milestones:[m],missing:blocking};
}

/** Checks an edited milestone before publication: every developer-facing field must be concrete. */
export function validMilestone(m:unknown):m is MilestoneDraft{
 if(!m||typeof m!=='object')return false;const x=m as MilestoneDraft;
 const str=(v:unknown,max=600)=>typeof v==='string'&&v.trim().length>=3&&v.length<=max;
 const list=(v:unknown,min=1,max=12)=>Array.isArray(v)&&v.length>=min&&v.length<=max&&v.every(i=>str(i));
 return str(x.id,80)&&str(x.objective,200)&&str(x.why,700)&&list(x.actions)&&list(x.completionCriteria)&&str(x.expectedOutput)
  &&Array.isArray(x.prerequisites)&&x.prerequisites.length<=12&&x.prerequisites.every(p=>str(p.text)&&['met','unmet','unknown'].includes(p.state))
  &&list(x.requiredInformation,0)&&list(x.dependencies,0)&&list(x.developerUnknowns,0)
  &&Array.isArray(x.destinations)&&x.destinations.length<=8&&x.destinations.every(d=>str(d.label,40)&&typeof d.path==='string'&&/^\/(?:activation|portal)(?:\/[a-z0-9-]+)*$/.test(d.path))
  &&!!x.system&&typeof x.system==='object';
}
