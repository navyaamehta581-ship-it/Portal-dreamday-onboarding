import {capabilities} from '../data/catalog';
import {environments} from '../data/environments';
import type {Capability,Plan,Request,Step,Team} from '../domain/models';
export function resolveCapability(team:Team,r:Request,id:string):Capability|undefined {
 const original=capabilities.find(c=>c.id===id);if(!original)return;
 const c={...original,configuration:[...original.configuration],dependencies:[...original.dependencies]};
 if(id==='onboard'){c.template=`./skeletons/onboarding-${r.stack}`;c.configuration=['existingService','runtime','setupProcedure'];c.description=`Prepare a ${r.stack} local setup guide, service ownership, and an ordered first-contribution path. No repository is modified.`;}
 if(id==='ci'){c.template=`./skeletons/ci-${r.stack}`;c.description=`Prepare ${environments[team.id].tools[1]} configuration for the ${r.stack} stack; no pipeline is activated.`;}
 if(id==='monitoring'){c.description=`Prepare a ${environments[team.id].tools[2]} baseline for review; no telemetry or dashboards are created.`;}
 return c;
}
export function recommend(team:Team,request:Request):Plan {
 const blocked:string[]=[],rejected:string[]=[],steps:Step[]=[];
 if(!team.allowed.includes(request.stack)) blocked.push(`${team.name} does not permit ${request.stack}. Select an allowed stack.`);
 if(!request.needs.length) blocked.push('Select at least one requirement.');
 if(request.needs.includes('service')&&request.needs.includes('onboarding')) blocked.push('Choose either a new service or existing-service onboarding.');
 if(request.needs.includes('service')&&!team.canPublish) blocked.push('New services require publishing; this team prohibits new repositories. Use existing-service onboarding.');
 const base=request.needs.includes('service')?request.stack:'onboard';
 const add=(id:string)=>{
  if(steps.some(s=>s.id===id))return;
  const c=resolveCapability(team,request,id);
  if(!c){blocked.push(`Missing capability ${id}.`);return;}
  if(!environments[team.id].capabilities.includes(id)||request.unavailableCapabilities?.includes(id)){blocked.push(`${c.title} is unavailable. Restore the capability or remove its requirement; no unsupported substitute will be used.`);return;}
  if(!environments[team.id].actions.includes(c.action)){blocked.push(`${c.action} is not supported by this team's simulated environment.`);return;}
  if(!c.stacks.includes(request.stack)){rejected.push(`${c.title}: incompatible stack.`);return;}
  if(c.publish&&!team.canPublish){blocked.push(`${c.title}: repository creation prohibited.`);return;}
  const dependencyIds=c.dependencies.filter(d=>d!=='artifacts').map(d=>d==='base'?base:d);
  dependencyIds.forEach(add);
  if(dependencyIds.some(d=>!steps.some(s=>s.id===d))){blocked.push(`${c.title}: a required dependency is unavailable.`);return;}
  const defaults:Record<string,string>={runtime:request.stack==='node'?'Node.js 22 LTS':request.stack==='java'?'Java 21':'Python 3.12',existingService:request.targetService||team.existing[0],setupProcedure:request.stack==='java'?'Approved Maven wrapper setup':request.stack==='python'?'Approved virtual environment setup':'Approved npm setup',testCommand:request.stack==='node'?'npm test':request.stack==='java'?'./mvnw verify':'pytest',alertOwner:team.id,docOwner:team.id};
  steps.push({id:c.id,capability:c,title:c.title,justification:c.provides.length?`Satisfies ${c.provides.join(', ')} for the ${request.stack} stack. ${c.description}`:c.description,config:Object.fromEntries(c.configuration.map(k=>[k,defaults[k]]))});
 };
 if(!blocked.length){request.needs.forEach(n=>{const candidate=capabilities.find(c=>c.provides.includes(n)&&c.stacks.includes(request.stack));if(candidate)add(candidate.id);});if(request.needs.includes('service')){add('publish');add('register');}}
 const uncovered=request.needs.filter(n=>!steps.some(s=>s.capability.provides.includes(n)));
 capabilities.filter(c=>!c.stacks.includes(request.stack)).forEach(c=>rejected.push(`${c.title}: ${request.stack} is not supported.`));
 return {steps,blocked,rejected,uncovered};
}
export function validate(team:Team,r:Request,steps:Step[]):string[]{
 const errors=[...recommend(team,r).blocked];
 if(!/^[a-z][a-z0-9-]{2,39}$/.test(r.name))errors.push('Service name must be 3–40 lowercase letters, digits or hyphens, starting with a letter.');
 if(!steps.length)errors.push('The workflow has no steps.');
 if(new Set(steps.map(s=>s.id)).size!==steps.length)errors.push('Duplicate step IDs.');
 for(const [i,s] of steps.entries()){
  const canonical=resolveCapability(team,r,s.id);
  if(!canonical){errors.push(`Unsupported capability: ${s.id}`);continue;}
  if(canonical.action!==s.capability.action)errors.push(`Unsupported action for ${s.id}.`);
  if(!environments[team.id].actions.includes(canonical.action))errors.push(`${canonical.action} is not declared as supported for this team.`);
  if(!environments[team.id].capabilities.includes(s.id)||r.unavailableCapabilities?.includes(s.id))errors.push(`${s.id} is unavailable for this environment.`);
  if(!s.title.trim())errors.push(`${s.id}: title is required.`);
  if(!canonical.stacks.includes(r.stack))errors.push(`${s.id}: stack is incompatible.`);
  if(canonical.publish&&!team.canPublish)errors.push('Publishing is prohibited for this team.');
  canonical.configuration.forEach(k=>{if(!s.config[k]?.trim())errors.push(`${s.id}: ${k} is required.`);});
  if(s.config.runtime&&s.config.runtime!==({node:'Node.js 22 LTS',java:'Java 21',python:'Python 3.12'}[r.stack]))errors.push(`${s.id}: runtime must match the approved ${r.stack} runtime.`);
  if(s.id==='onboard'&&!team.existing.includes(s.config.existingService))errors.push('Choose a service owned by this team.');
  canonical.dependencies.forEach(d=>{const ids=d==='base'?[r.needs.includes('service')?r.stack:'onboard']:d==='artifacts'?steps.filter(x=>x.capability.action==='fetch:template').map(x=>x.id):[d];if(ids.some(id=>!steps.slice(0,i).some(p=>p.id===id)))errors.push(`${s.title}: required dependency ${d} is missing or out of order.`);});
 }
 r.needs.forEach(n=>{if(!steps.some(s=>resolveCapability(team,r,s.id)?.provides.includes(n)))errors.push(`Requirement not covered: ${n}.`);});
 if(r.needs.includes('service')&&!steps.some(s=>s.id==='register'))errors.push('New service requires publishing and registration.');
 if(steps.some(s=>s.id==='publish')&&!/^github\.com\?owner=[a-zA-Z0-9-]+&repo=[a-zA-Z0-9_.-]+$/.test(r.repo))errors.push('Repository must use github.com?owner=example-org&repo=service-name.');
 return [...new Set(errors)];
}
