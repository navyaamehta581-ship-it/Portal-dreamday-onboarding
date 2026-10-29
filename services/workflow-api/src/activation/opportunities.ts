/** Engineering opportunities, the Champion's priorities, developers' choices and adoption.
 *
 * Opportunities are computed on the server from two things only: the approved, privacy-screened plan (goals,
 * milestones, problems) and the repository observations the Portal itself recorded. Each says what backs it:
 * `verified` (a live read-only observation), `sample` (fixture data for the fictional demo) or `hypothesis` (the plan
 * suggests it; nothing has confirmed it). Chris's private notes are never an input. Nobody is assigned anything:
 * the Champion can prioritise and highlight, developers choose what to pursue. */
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import type {Adoption,DeveloperHandoff,GoalView,Opportunities,Opportunity,OpportunityBasis,OpportunityKind,Priority,RepositoryObservation,RepositorySignal,TeamProgress} from '../../../../contracts/activation/v1/handoff.ts';
import {ActivationError,type Principal} from './store.ts';
import type {Viewer,WorkService} from './handoff/work.ts';
import type {RepositoryService} from './repository.ts';

const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};
const PRIORITIES:Priority[]=['high','normal','later'];
type State={priorities:Record<string,Priority>;highlighted:Record<string,boolean>;pursued:Record<string,{name:string;at:string}[]>};
const empty=():State=>({priorities:{},highlighted:{},pursued:{}});

export function openOpportunityStore(filename:string){
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS activation_opportunity_state (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session)) STRICT;`);
 const key=(p:Principal)=>[p.tenantId,p.customerId,p.sessionId];
 return {
  get(p:Principal):State{const row=db.prepare('SELECT body FROM activation_opportunity_state WHERE tenant=? AND customer=? AND session=?').get(...key(p));return row?{...empty(),...JSON.parse(row.body as string)}:empty();},
  save(p:Principal,s:State){db.prepare('INSERT INTO activation_opportunity_state VALUES (?,?,?,?) ON CONFLICT(tenant,customer,session) DO UPDATE SET body=excluded.body').run(...key(p),JSON.stringify(s));},
  close:()=>db.close()};
}
export type OpportunityStore=ReturnType<typeof openOpportunityStore>;

/** What a repository observation suggests, and how to get started in Portal. `null`: nothing to suggest. */
type Rule={signal:RepositorySignal;when:'missing'|'observed';topic:string;kind:OpportunityKind;title:(s:string)=>string;steps:(s:string,repo:string)=>string[]};
const RULES:Rule[]=[
 {signal:'catalog_info',when:'missing',topic:'catalog',kind:'improvement',title:s=>`Register ${s} in the Catalog with a clear owner`,
  steps:(s,repo)=>[`Add a catalog-info.yaml at the root of ${repo} naming the component (${s}), its owning team and lifecycle.`,'In Portal, open Catalog → Register existing component and paste the file’s URL.',`Open ${s}’s component page and check that the owner and the repository link are right.`]},
 {signal:'codeowners',when:'missing',topic:'owners',kind:'improvement',title:s=>`Record who owns ${s}’s code`,
  steps:(_s,repo)=>[`Add a CODEOWNERS file to ${repo} listing the owning team.`,'Use the same team as the Catalog owner, so ownership agrees everywhere.','Ask AiKA to check that the owner shown in Portal matches.']},
 {signal:'docs',when:'missing',topic:'techdocs',kind:'integration',title:s=>`Publish ${s}’s documentation with TechDocs`,
  steps:(s,repo)=>[`Create a docs/ folder and an mkdocs.yml in ${repo}.`,`Add the backstage.io/techdocs-ref annotation to ${s}’s catalog-info.yaml.`,`Open the Docs tab on ${s}’s component page to see the rendered docs.`]},
 {signal:'docs',when:'observed',topic:'techdocs',kind:'integration',title:s=>`Bring ${s}’s existing docs into TechDocs`,
  steps:(s,repo)=>[`Add an mkdocs.yml next to the existing docs in ${repo}.`,`Add the backstage.io/techdocs-ref annotation to ${s}’s catalog-info.yaml.`,'Open the Docs tab on the component page and check the pages render.']},
 {signal:'runbooks',when:'missing',topic:'runbooks',kind:'improvement',title:s=>`Add runbooks next to ${s}’s code`,
  steps:(s,repo)=>[`Add a runbooks section to ${repo}’s docs (for example docs/runbooks/), one page per common incident.`,`Link it from ${s}’s component page through its TechDocs.`,'Ask AiKA which incidents your team handles most often to decide where to start.']},
 {signal:'ci_config',when:'observed',topic:'ci',kind:'integration',title:s=>`See ${s}’s CI runs in Portal`,
  steps:(s,repo)=>[`Add the CI annotation for ${repo} to ${s}’s catalog-info.yaml.`,`Open the CI/CD tab on ${s}’s component page.`,'Use it to spot failing builds before they reach a release.']},
 {signal:'ci_config',when:'missing',topic:'pipeline',kind:'new_build',title:s=>`Create a standard CI pipeline for ${s}`,
  steps:(s,repo)=>[`In Portal, open Create and choose the CI pipeline template your platform team provides.`,`Point it at ${repo} and review the generated workflow before merging.`,`Add the CI annotation so runs show on ${s}’s component page.`]},
];
/** What the approved plan itself suggests, before anything is observed. */
const PLAN:{topic:string;signal:RepositorySignal|null;kind:OpportunityKind;match:RegExp;title:(s:string)=>string;steps:(s:string)=>string[]}[]=[
 {topic:'catalog',signal:'catalog_info',kind:'improvement',match:/\b(owns|owned|owners?|ownership|catalog|readiness|discoverab\w*)\b/i,title:s=>`Register ${s} in the Catalog with a clear owner`,
  steps:s=>[`Find ${s}’s repository and add a catalog-info.yaml naming its owning team.`,'Register it from Catalog → Register existing component.','Check the owner shown on the component page.']},
 {topic:'techdocs',signal:'docs',kind:'integration',match:/\b(docs|documentation|techdocs|readme|runbooks?)\b/i,title:s=>`Publish ${s}’s documentation with TechDocs`,
  steps:s=>[`Add docs and an mkdocs.yml next to ${s}’s code.`,'Add the TechDocs annotation to its catalog-info.yaml.','Open the Docs tab on the component page.']},
 {topic:'pipeline',signal:'ci_config',kind:'migration',match:/\b(jenkins|github actions|pipelines?|ci\/cd)\b/i,title:s=>`Move ${s} to one standard CI pipeline`,
  steps:s=>[`List where ${s}’s builds run today and what each pipeline does.`,'Create the standard pipeline from a Software Template in Create.','Switch one service first, compare results, then retire the old pipeline.']},
 {topic:'scaffolder',signal:null,kind:'new_build',match:/\b(template|scaffold\w*|new service|next service)\b/i,title:()=>'Create new services from a Software Template',
  steps:()=>['In Portal, open Create and choose the service template.','Fill in the name, owner and repository, then review the generated repository.','Check the new service appears in the Catalog with its owner.']},
];
const words=(t:string)=>new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=4));
const overlap=(a:string,b:string)=>{const x=words(a);return [...words(b)].filter(w=>x.has(w)).length;};
const hash=(t:string)=>createHash('sha256').update(t).digest('hex').slice(0,10);
const RANK:Record<OpportunityBasis,number>={verified:0,sample:1,hypothesis:2};
const PRANK=(p:Priority|null)=>p==='high'?0:p==='normal'?1:p===null?2:3;

export function createOpportunities(deps:{published:(p:Principal)=>DeveloperHandoff|null;work:WorkService;repositories:RepositoryService;store:OpportunityStore;now?:()=>number;observeTimeoutMs?:number}){
 const now=deps.now??(()=>Date.now());
 function plan(p:Principal){const h=deps.published(p);if(!h?.approval)fail('NO_APPROVED_PLAN');return h!;}
 const team=(p:Principal):TeamProgress=>deps.work.view(p,{role:'champion',name:null});

 function goals(p:Principal,h:DeveloperHandoff,s:State,progress:TeamProgress):GoalView[]{
  return (h.objective?.goals??[]).map(text=>{
   const id=`goal-${hash(text)}`;
   // A goal's milestones: those whose wording shares at least two significant words with it.
   const ms=progress.milestones.filter(m=>overlap(text,`${m.title} ${m.outline?.description??''}`)>=2).map(m=>({id:m.id,title:m.title,status:m.status}));
   return {id,text,priority:s.priorities[id]??null,milestones:ms,completed:ms.filter(m=>m.status==='completed').length,total:ms.length};
  });
 }
 function suggestions(p:Principal,h:DeveloperHandoff):Omit<Opportunity,'priority'|'highlighted'|'pursuers'|'pursuedBy'|'mine'>[]{
  const out=new Map<string,Omit<Opportunity,'priority'|'highlighted'|'pursuers'|'pursuedBy'|'mine'>>();
  const goalTexts=h.objective?.goals??[],context=[h.objective?.problem??'',...(h.objective?.problems??[]),...goalTexts,...h.milestones.flatMap(m=>[m.objective,m.why])].join(' \n');
  const goalFor=(topicWords:string)=>goalTexts.find(g=>overlap(g,topicWords)>=1)??null;
  // From what the Portal observed in the configured repositories.
  let repos:ReturnType<RepositoryService['view']>['repositories']=[];
  try{repos=deps.repositories.view(p,{role:'champion',name:null}).repositories;}catch{repos=[];}
  // Signals the Portal actually looked at (found or confirmed missing) for each service: those decide, not the plan.
  const looked=new Set<string>();
  for(const r of repos){
   const obs:RepositoryObservation[]=r.evidence&&!r.stale?r.evidence.observations:[];
   for(const o of obs)if(o.status==='observed'||o.status==='missing')looked.add(`${o.signal}:${r.label}`);
   for(const rule of RULES){
    const o=obs.find(x=>x.signal===rule.signal&&x.status===rule.when);if(!o)continue;
    const id=`${rule.topic}-${r.id}`,svc=r.label;
    if(out.has(`${rule.topic}:${svc}`))continue;
    const why=goalFor(`${rule.title(svc)} ${rule.topic}`);
    out.set(`${rule.topic}:${svc}`,{id,kind:rule.kind,title:rule.title(svc),why:why?`Supports your goal: ${why}`:`Observed in ${r.repository}: ${o.summary}`,basis:o.mode==='fixture'?'sample':'verified',
     evidence:[`${o.mode==='fixture'?'Sample data':'Observed read-only'} · ${r.repository}: ${o.summary}`],steps:rule.steps(svc,r.repository),service:svc,goal:why});
   }
  }
  // From the approved plan: hypotheses until a repository observation confirms them.
  const service=h.milestones.map(m=>m.system.service).find(Boolean)??repos[0]?.label??'your service';
  for(const rule of PLAN){
   if(!rule.match.test(context)||(rule.signal&&looked.has(`${rule.signal}:${service}`)))continue;
   const key=`${rule.topic}:${service}`;
   if(out.has(key)||(rule.topic==='pipeline'&&out.has(`ci:${service}`)))continue;
   const why=goalFor(rule.title(service));
   out.set(key,{id:`${rule.topic}-plan-${hash(service)}`,kind:rule.kind,title:rule.title(service),why:why?`Supports your goal: ${why}`:'Suggested by your team’s onboarding plan.',basis:'hypothesis',
    evidence:['From your team’s onboarding plan; not yet confirmed in a repository.'],steps:rule.steps(service),service,goal:why});
  }
  return [...out.values()];
 }
 function list(p:Principal,viewer:Viewer):Opportunities{
  const h=plan(p),s=deps.store.get(p),progress=team(p);
  const opps=suggestions(p,h).map((o):Opportunity=>{
   const by=(s.pursued[o.id]??[]).map(x=>x.name);
   return {...o,priority:s.priorities[o.id]??null,highlighted:!!s.highlighted[o.id],pursuers:by.length,
    ...(viewer.role==='developer'?{mine:!!viewer.name&&by.includes(viewer.name)}:{pursuedBy:by})};
  }).sort((a,b)=>Number(b.highlighted)-Number(a.highlighted)||PRANK(a.priority)-PRANK(b.priority)||RANK[a.basis]-RANK[b.basis]);
  let observedAt:string|null=null;
  try{observedAt=deps.repositories.view(p,{role:'champion',name:null}).repositories.map(r=>r.evidence?.completedAt??'').sort().at(-1)||null;}catch{observedAt=null;}
  return {viewer,goals:goals(p,h,s,progress),opportunities:opps,observedAt};
 }
 /** The view, after making sure the Portal has observed the plan's repositories (Spotify's integration). */
 async function view(p:Principal,viewer:Viewer){
  plan(p);
  const missing=(()=>{try{return deps.repositories.view(p,{role:'champion',name:null}).repositories.some(r=>!r.evidence||r.stale);}catch{return false;}})();
  if(missing)await Promise.race([deps.repositories.observe(p),new Promise(r=>setTimeout(r,deps.observeTimeoutMs??8000))]);
  return list(p,viewer);
 }
 function known(p:Principal,id:string){const v=list(p,{role:'champion',name:null});return {goal:v.goals.some(g=>g.id===id),opportunity:v.opportunities.some(o=>o.id===id)};}

 /** The Champion: set a priority on a goal or opportunity, and highlight opportunities for developers. */
 function prioritize(p:Principal,viewer:Viewer,input:unknown){
  if(viewer.role!=='champion')fail('CHAMPION_REQUIRED');
  const b=input as {id?:unknown;priority?:unknown;highlighted?:unknown};
  if(!b||typeof b!=='object'||typeof b.id!=='string'||(b.priority===undefined&&b.highlighted===undefined))fail('INVALID_REQUEST');
  if(b.priority!==undefined&&b.priority!==null&&!PRIORITIES.includes(b.priority as Priority))fail('INVALID_REQUEST');
  if(b.highlighted!==undefined&&typeof b.highlighted!=='boolean')fail('INVALID_REQUEST');
  const k=known(p,b.id as string);
  if(!k.goal&&!k.opportunity)fail('NOT_FOUND');
  if(b.highlighted!==undefined&&!k.opportunity)fail('INVALID_REQUEST');
  const s=deps.store.get(p);
  if(b.priority===null)delete s.priorities[b.id as string];else if(b.priority!==undefined)s.priorities[b.id as string]=b.priority as Priority;
  if(b.highlighted!==undefined){if(b.highlighted)s.highlighted[b.id as string]=true;else delete s.highlighted[b.id as string];}
  deps.store.save(p,s);
  return list(p,viewer);
 }
 /** A developer chooses to pursue an opportunity, or stops. Their own identity only. */
 function pursue(p:Principal,viewer:Viewer,input:unknown){
  if(viewer.role!=='developer')fail('FORBIDDEN');
  if(!viewer.name)fail('DEVELOPER_IDENTITY_REQUIRED');
  const b=input as {id?:unknown;pursue?:unknown};
  if(!b||typeof b!=='object'||typeof b.id!=='string'||typeof b.pursue!=='boolean')fail('INVALID_REQUEST');
  if(!known(p,b.id as string).opportunity)fail('NOT_FOUND');
  const s=deps.store.get(p),list0=(s.pursued[b.id as string]??[]).filter(x=>x.name!==viewer.name);
  s.pursued[b.id as string]=b.pursue?[...list0,{name:viewer.name!,at:new Date(now()).toISOString()}]:list0;
  deps.store.save(p,s);
  return list(p,viewer);
 }

 /** Adoption toward the goals, from what was recorded in the Portal. The Champion and Chris only. */
 function adoption(p:Principal,viewer:Viewer):Adoption{
  if(viewer.role==='developer')fail('FORBIDDEN');
  const progress=team(p),v=list(p,{role:'champion',name:null}),s=deps.store.get(p),t=now();
  // Every recorded developer event: action changes, notes, chosen milestones' activity and pursued opportunities.
  const events:{name:string;at:string}[]=[];
  for(const m of progress.milestones){const d=m.detail;if(!d)continue;
   for(const a of d.actions)if(a.by&&a.at)events.push({name:a.by,at:a.at});
   for(const u of d.updates)if(u.role!=='champion')events.push({name:u.by,at:u.at});}
  for(const xs of Object.values(s.pursued))for(const x of xs)events.push(x);
  const names=new Set([...events.map(e=>e.name),...progress.milestones.flatMap(m=>m.workingOn??[])]);
  const week=7*86400_000;
  const developers=[...names].map(name=>{const mine=events.filter(e=>e.name===name).map(e=>e.at).sort();const last=mine.at(-1)??null;
   return {name,lastActiveAt:last,workingOn:progress.milestones.filter(m=>m.workingOn?.includes(name)).length,pursuing:Object.values(s.pursued).filter(xs=>xs.some(x=>x.name===name)).length,
    activeThisWeek:!!last&&t-Date.parse(last)<week};}).sort((a,b)=>(b.lastActiveAt??'').localeCompare(a.lastActiveAt??''));
  // Six calendar weeks, Monday first, oldest first.
  const monday=new Date(t);monday.setUTCHours(0,0,0,0);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
  const weekly=Array.from({length:6},(_,i)=>{const start=monday.getTime()-(5-i)*week,inWeek=events.filter(e=>{const x=Date.parse(e.at);return x>=start&&x<start+week;});
   return {weekStart:new Date(start).toISOString().slice(0,10),events:inWeek.length,activeDevelopers:new Set(inWeek.map(e=>e.name)).size};});
  const ms=progress.milestones,open=ms.filter(m=>!m.assignee&&!(m.workingOn?.length)&&m.status==='not_started');
  const tips:string[]=[];
  if(!names.size)tips.push('No developer has picked up work yet. Highlighting an improvement shows it first on developers’ Home.');
  if(open.length)tips.push(`${open.length} milestone${open.length===1?' has':'s have'} nobody working on ${open.length===1?'it':'them'} yet.`);
  for(const o of v.opportunities.filter(o=>o.highlighted&&!o.pursuers))tips.push(`“${o.title}” is highlighted, but nobody has chosen it yet.`);
  for(const d of developers.filter(d=>d.lastActiveAt&&t-Date.parse(d.lastActiveAt)>2*week))tips.push(`${d.name} hasn’t recorded anything in over two weeks.`);
  return {generatedAt:new Date(t).toISOString(),goals:{total:v.goals.length,withProgress:v.goals.filter(g=>g.milestones.some(m=>m.status!=='not_started')).length},
   milestones:{total:ms.length,completed:ms.filter(m=>m.status==='completed').length,inProgress:ms.filter(m=>m.status!=='completed'&&m.status!=='not_started').length,open:open.length},
   opportunities:{total:v.opportunities.length,pursued:v.opportunities.filter(o=>o.pursuers>0).length,highlighted:v.opportunities.filter(o=>o.highlighted).length},
   developers,weekly,suggestions:tips,scope:'onboarding_activity'};
 }
 return {view,list,prioritize,pursue,adoption};
}
export type OpportunityService=ReturnType<typeof createOpportunities>;
