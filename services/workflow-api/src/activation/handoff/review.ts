/** Chris's editable review of one analysis. Built from the analysis once, then edited by Chris and stored with the
 * operator-only record. Every item keeps where it came from (customer sources, analysis suggestion, Chris). Before
 * submission for Champion review the review must be complete and contain nothing the Champion may not see. */
import type {ChampionPlan,Finding,HandoffRecord,MilestoneDraft,ReviewDraft,ReviewItem,ReviewMilestone,ReviewOrigin,ReviewStakeholder,SourceRef,SourceType,Understanding} from '../../../../../contracts/activation/v1/handoff.ts';
import {ActivationError} from '../store.ts';
import {technicalRole,unsafeReason} from './intelligence.ts';

const uniq=<T,>(xs:T[],key:(x:T)=>string)=>xs.filter((x,i)=>xs.findIndex(y=>key(y)===key(x))===i);
const norm=(s:string)=>s.replace(/\s+/g,' ').trim().toLowerCase();
const labels=(refs:SourceRef[])=>[...new Set(refs.map(r=>r.label||r.type))];
const status=(f:Finding):ReviewItem['status']=>f.status==='verified'?'verified':f.status==='reported'?'reported':'unconfirmed';

export function reviewFromAnalysis({understanding:u,proposal}:Pick<HandoffRecord,'understanding'|'proposal'>):ReviewDraft{
 let n=0;const id=(prefix:string)=>`${prefix}-${++n}`;
 const item=(text:string,origin:ReviewOrigin,extra:Partial<ReviewItem>={}):ReviewItem=>({id:id('i'),text,origin,...extra});
 const shared=u.findings.filter(f=>f.audience!=='internal');
 const fromRequirements=(f:Finding)=>f.category==='technical_requirement'||f.sources.some(s=>s.type==='technical_requirements');
 const challenges=shared.filter(f=>f.category==='business_need').map(f=>item(f.statement,'customer',{status:status(f),sources:labels(f.sources)}));
 const e=u.entities;
 const systems=[...e.services.map(s=>`${s} (service)`),...e.repositories.map(r=>`${r} (repository)`),
  ...(e.scm?[`${e.scm} (source control)`]:[]),...(e.ci?[`${e.ci} (CI/CD)`]:[]),...(e.docs?[`${e.docs} (documentation)`]:[]),...(e.sso?[`${e.sso} (sign-in)`]:[])].map(t=>item(t,'customer'));
 const milestoneIds=new Map(proposal.milestones.map(m=>[norm(m.objective),m.id]));
 return {
  problem:{
   summary:u.engineeringProblem??challenges[0]?.text??'',
   challenges,systems,
   contradictions:u.contradictions.map(c=>item(`${c.topic}: ${c.summary}`,'ai')),
   unknowns:u.unknowns.filter(x=>x.audience==='developer').map(x=>item(x.question,'ai')),
  },
  facts:shared.filter(f=>f.category!=='business_need'&&!fromRequirements(f)).map(f=>item(f.statement,'customer',{status:status(f),sources:labels(f.sources)})),
  stakeholders:(u.stakeholders??[]).filter(s=>s.name).map(s=>({id:id('p'),name:s.name!,role:s.role,responsibilities:s.responsibilities.join('; '),
   basis:s.workBasis==='role_default'?'role_default':s.confidence==='inferred'?'inferred':'stated',sources:labels(s.sources),technical:technicalRole(s.role)})),
  goals:uniq([...shared.filter(fromRequirements).map(f=>item(f.statement,'customer',{status:status(f),sources:labels(f.sources)})),
   ...u.goals.map(g=>item(g.technicalGoal,'ai'))],x=>norm(x.text)),
  milestones:proposal.milestones.map(m=>({id:m.id,title:m.objective,description:m.why,system:[m.system.service,m.system.repository].filter(Boolean).join(' · '),
   actions:[...m.actions],completionCriteria:[...m.completionCriteria],assignee:m.proposedAssignee??null,role:m.recommendedRole??'developer',
   dependsOn:m.dependencies.map(d=>milestoneIds.get(norm(d))).filter((x):x is string=>!!x&&x!==m.id),origin:'ai'})),
  questions:uniq([...(u.clarifications??[]),...proposal.missing,...u.unknowns.filter(x=>x.audience==='chris').map(x=>x.question)],norm).map(q=>item(q,'ai')),
 };
}

// ---- Validation of an edited review (shape and size only; content checks happen at submission).
const invalid=():never=>{throw new ActivationError('INVALID_REQUEST');};
const ID=/^[A-Za-z0-9_-]{1,60}$/;
const text=(v:unknown,max:number,min=0)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max?v.trim():invalid();
const list=<T,>(v:unknown,max:number,each:(x:unknown)=>T):T[]=>Array.isArray(v)&&v.length<=max?v.map(each):invalid();
const origin=(v:unknown)=>v==='customer'||v==='ai'||v==='chris'||v==='champion'?v:invalid();
function reviewItem(v:unknown):ReviewItem{
 const x=v as Record<string,unknown>;if(!x||typeof x!=='object')invalid();
 return {id:ID.test(String(x.id))?String(x.id):invalid(),text:text(x.text,600),origin:origin(x.origin),
  ...(x.edited===true?{edited:true}:{}),...(x.status!==undefined?{status:['verified','reported','unconfirmed'].includes(x.status as string)?x.status as ReviewItem['status']:invalid()}:{}),
  ...(x.sources!==undefined?{sources:list(x.sources,12,s=>text(s,80))}:{})};
}
export function validateReview(v:unknown):ReviewDraft{
 const r=v as Record<string,any>;if(!r||typeof r!=='object'||!r.problem||typeof r.problem!=='object')invalid();
 const items=(x:unknown,max=40)=>list(x,max,reviewItem);
 const milestones=list(r.milestones,8,(v):ReviewMilestone=>{const m=v as Record<string,unknown>;if(!m||typeof m!=='object')invalid();
  return {id:ID.test(String(m.id))?String(m.id):invalid(),title:text(m.title,200),description:text(m.description,1200),system:text(m.system,200),
   actions:list(m.actions,12,a=>text(a,400)),completionCriteria:list(m.completionCriteria,12,c=>text(c,400)),
   assignee:m.assignee===null?null:text(m.assignee,80,1),role:text(m.role,40,1),dependsOn:list(m.dependsOn,8,d=>ID.test(String(d))?String(d):invalid()),
   origin:origin(m.origin),...(m.edited===true?{edited:true}:{})};});
 if(new Set(milestones.map(m=>m.id)).size!==milestones.length)invalid();
 return {problem:{summary:text(r.problem.summary,2000),challenges:items(r.problem.challenges),systems:items(r.problem.systems),contradictions:items(r.problem.contradictions),unknowns:items(r.problem.unknowns)},
  facts:items(r.facts,60),
  stakeholders:list(r.stakeholders,20,(v):ReviewStakeholder=>{const s=v as Record<string,unknown>;if(!s||typeof s!=='object')invalid();
   const role=text(s.role,120,1);
   return {id:ID.test(String(s.id))?String(s.id):invalid(),name:text(s.name,80,1),role,responsibilities:text(s.responsibilities,600),
    basis:['stated','role_default','inferred','chris'].includes(s.basis as string)?s.basis as ReviewStakeholder['basis']:invalid(),sources:list(s.sources,12,x=>text(x,80)),
    // Recomputed on the server: whether a person may appear in Champion- and developer-facing material.
    technical:technicalRole(role)};}),
  goals:items(r.goals),milestones,questions:items(r.questions)};
}

/** What blocks submission: incomplete milestones or text the Champion may not receive. Field labels are for Chris. */
export type ReviewIssue={path:string;label:string;reason:string};
export function reviewIssues(r:ReviewDraft,u:Pick<Understanding,'findings'|'stakeholders'|'privateStems'>):ReviewIssue[]{
 const issues:ReviewIssue[]=[];
 const add=(path:string,label:string,reason:string)=>issues.push({path,label,reason});
 if(!r.milestones.length)add('milestones','Onboarding milestones','no_milestone');
 const ids=new Set(r.milestones.map(m=>m.id)),technical=new Set(r.stakeholders.filter(s=>s.technical).map(s=>s.name));
 r.milestones.forEach((m,i)=>{
  const at=`milestones[${i}]`,name=`Milestone ${i+1}`;
  if(m.title.length<3)add(`${at}.title`,`${name} · title`,'missing');
  if(!m.actions.some(a=>a.trim()))add(`${at}.actions`,`${name} · actions`,'missing');
  if(!m.completionCriteria.some(c=>c.trim()))add(`${at}.completionCriteria`,`${name} · completion criteria`,'missing');
  if(m.assignee&&!technical.has(m.assignee))add(`${at}.assignee`,`${name} · proposed assignee`,'not_a_technical_stakeholder');
  if(m.dependsOn.some(d=>!ids.has(d)||d===m.id))add(`${at}.dependsOn`,`${name} · depends on`,'unknown_milestone');
 });
 if(hasCycle(r.milestones))add('milestones','Onboarding milestones','circular_dependencies');
 // Everything that would reach the Champion is screened; Chris's internal people (non-technical) never do.
 const screen=(path:string,label:string,t:string)=>{const reason=t.trim()?unsafeReason(t,u):null;if(reason)add(path,label,reason);};
 screen('problem.summary','Engineering problem · summary',r.problem.summary);
 for(const [key,name] of [['challenges','Main technical challenges'],['systems','Relevant systems'],['contradictions','Contradictions'],['unknowns','Unknowns']] as const)
  r.problem[key].forEach((x,i)=>screen(`problem.${key}[${i}]`,`${name} · item ${i+1}`,x.text));
 r.facts.forEach((x,i)=>screen(`facts[${i}]`,`Known facts · item ${i+1}`,x.text));
 r.goals.forEach((x,i)=>screen(`goals[${i}]`,`Technical goals · item ${i+1}`,x.text));
 r.questions.forEach((x,i)=>screen(`questions[${i}]`,`Questions for the customer · item ${i+1}`,x.text));
 r.stakeholders.forEach((s,i)=>{if(s.technical){screen(`stakeholders[${i}].role`,`Stakeholder ${s.name} · role`,s.role);screen(`stakeholders[${i}].responsibilities`,`Stakeholder ${s.name} · responsibilities`,s.responsibilities);}});
 r.milestones.forEach((m,i)=>{const at=`milestones[${i}]`,name=`Milestone ${i+1}`;
  screen(`${at}.title`,`${name} · title`,m.title);screen(`${at}.description`,`${name} · description`,m.description);screen(`${at}.system`,`${name} · system`,m.system);
  m.actions.forEach((a,j)=>screen(`${at}.actions[${j}]`,`${name} · action ${j+1}`,a));
  m.completionCriteria.forEach((c,j)=>screen(`${at}.completionCriteria[${j}]`,`${name} · completion criterion ${j+1}`,c));});
 return issues;
}
function hasCycle(ms:ReviewMilestone[]){
 const deps=new Map(ms.map(m=>[m.id,m.dependsOn])),state=new Map<string,number>();
 const visit=(id:string):boolean=>{if(state.get(id)===1)return true;if(state.get(id)===2)return false;state.set(id,1);const cyc=(deps.get(id)??[]).some(d=>deps.has(d)&&visit(d));state.set(id,2);return cyc;};
 return ms.some(m=>visit(m.id));
}

/** Reviewed milestones in the shape the existing developer publication path expects, keeping the analysis
 * details Chris doesn't edit (prerequisites, destinations, developer unknowns) for milestones that came from it. */
export function toMilestoneDrafts(r:ReviewDraft,record:Pick<HandoffRecord,'proposal'|'understanding'>):MilestoneDraft[]{
 const title=new Map(r.milestones.map(m=>[m.id,m.title]));
 return r.milestones.map(m=>{
  const base=record.proposal.milestones.find(x=>x.id===m.id);
  // The publication format needs ids and list entries of at least three characters.
  const useful=(x:string)=>x.trim().length>=3,actions=m.actions.filter(useful),done=m.completionCriteria.filter(useful);
  return {id:m.id.length>=3?m.id:`milestone-${m.id}`,objective:m.title,system:base?.system??{service:null,repository:null,platform:record.understanding.entities.scm},
   why:m.description.trim()||m.title,actions,prerequisites:base?.prerequisites??[],requiredInformation:base?.requiredInformation??[],
   destinations:base?.destinations??[{label:'Evidence',path:'/activation/evidence'}],expectedOutput:base?.expectedOutput||done.join(' '),
   completionCriteria:done,dependencies:m.dependsOn.map(d=>title.get(d)).filter((x):x is string=>!!x),developerUnknowns:base?.developerUnknowns??[],
   recommendedRole:m.role,proposedAssignee:m.assignee,assignmentStatus:'proposed'};
 });
}

// ---- Dream Day: the Champion's view and edits.
const CATEGORY:Record<SourceType,string>={conversation:'Conversational Transcript',crm:'CRM Record',chris_notes:'My Notes',account_prep:'Account Preparation',
 technical_requirements:'Technical Requirements',repository:'Repository Observation',integration_tools:'Integration Tools'};
const SPOTIFY_SIDE:SourceType[]=['crm','chris_notes','account_prep'];
/** Source attribution for the Champion: the kind of source, never Chris's own names for it. Spotify-side sources
 * (CRM, Chris's notes, account preparation) are attributed to the account team as a whole. */
function championSources(labels:string[]|undefined,sources:HandoffRecord['sources']){
 const out=new Set<string>();
 for(const l of labels??[]){const src=sources.find(x=>(x.label||x.type)===l||x.label===l);if(src)out.add(SPOTIFY_SIDE.includes(src.type)?'Spotify account team':CATEGORY[src.type]);}
 return [...out];
}
/** The plan as the Champion may see it. Built on the server from the operator record: technical stakeholders only,
 * every text screened again (anything unsafe is left out and counted), source names replaced by categories. */
export function championPlan(record:Pick<HandoffRecord,'review'|'understanding'|'proposal'|'sources'>):ChampionPlan{
 const r=record.review??reviewFromAnalysis(record),u=record.understanding;
 let withheld=0;
 const safe=(t:string)=>{if(!t.trim()||!unsafeReason(t,u))return true;withheld++;return false;};
 const items=(xs:ReviewItem[])=>xs.filter(x=>safe(x.text)).map(x=>({id:x.id,text:x.text,origin:x.origin,...(x.edited?{edited:true}:{}),...(x.status?{status:x.status}:{}),...(x.sources?{sources:championSources(x.sources,record.sources)}:{})}));
 const milestones=r.milestones.filter(m=>[m.title,m.description,m.system,...m.actions,...m.completionCriteria].every(safe));
 const ids=new Set(milestones.map(m=>m.id));
 return {problem:{summary:safe(r.problem.summary)?r.problem.summary:'',challenges:items(r.problem.challenges),systems:items(r.problem.systems),contradictions:items(r.problem.contradictions),unknowns:items(r.problem.unknowns)},
  facts:items(r.facts),goals:items(r.goals),questions:items(r.questions),
  milestones:milestones.map(m=>({...m,dependsOn:m.dependsOn.filter(d=>ids.has(d))})),
  stakeholders:r.stakeholders.filter(s=>s.technical&&[s.name,s.role,s.responsibilities].every(safe)).map(s=>({id:s.id,name:s.name,role:s.role,responsibilities:s.responsibilities,basis:s.basis,sources:championSources(s.sources,record.sources)})),
  withheld};
}
/** Apply the Champion's edits (goals, milestones, questions) to the record's review; everything else is kept. */
export function applyChampionEdits(review:ReviewDraft,input:unknown):ReviewDraft{
 const x=input as {goals?:unknown;milestones?:unknown;questions?:unknown};
 if(!x||typeof x!=='object')invalid();
 return validateReview({...review,goals:x.goals,milestones:x.milestones,questions:x.questions});
}
/** Approval needs an explicit assignee on every milestone, in addition to the submission checks. */
export function approvalIssues(r:ReviewDraft,u:Pick<Understanding,'findings'|'stakeholders'|'privateStems'>):ReviewIssue[]{
 return [...reviewIssues(r,u),...r.milestones.flatMap((m,i)=>m.assignee?[]:[{path:`milestones[${i}].assignee`,label:`Milestone ${i+1} · assignee`,reason:'unassigned'}])];
}
