// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {App} from './App';
import {byLabel,click,fixtureState,flush,mount,type} from '../activation/testing';
import type {Persona} from './session';
import type {ChampionReview,MilestoneDraft,ReviewMilestone} from '../../../../contracts/activation/v1/handoff';

// A fake session layer + workflow API: the persona lives in a "cookie" (server state), never in the page.
const north={id:'north',label:'Aperture (fictional)',customerId:'orbit'};
const PERSONAS:Persona[]=[
 {id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:[north]},
 {id:'maya',name:'Maya Chen',role:'champion',title:'Platform Champion',customers:[north]},
 {id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:[north]},
 {id:'jordan',name:'Jordan Lee',role:'developer',title:'Developer',customers:[north]},
];
const milestone=(id:string,objective:string):MilestoneDraft=>({id,objective,system:{service:'payments-api',repository:null,platform:'GitHub'},why:'',actions:['Inspect the repository','Record findings'],prerequisites:[],requiredInformation:[],destinations:[],expectedOutput:'',completionCriteria:['Each item is marked verified, missing or inaccessible'],dependencies:[],developerUnknowns:[],recommendedRole:'developer',proposedAssignee:null,assignmentStatus:'proposed'});
const published=()=>fixtureState('orbit',{handoff:{version:1,publishedAt:'2026-10-28T00:00:00Z',interpreter:'hosted_model',summary:'s',context:[],unknowns:[],
 milestones:[milestone('m1','Assess payments-api repository readiness'),milestone('m2','Validate payments-api discoverability')],
 team:[{name:'Maya Chen',role:'Champion',status:'reported'},{name:'Alex Rivera',role:'Developer',status:'reported'},{name:'Jordan Lee',role:'Developer',status:'reported'}]}});

// Dream Day in the fake API: a submitted plan the Champion can edit, send back or approve. Approval publishes each
// developer only their own milestone, as the real server does.
const reviewMilestone=(id:string,title:string,dependsOn:string[]=[]):ReviewMilestone=>({id,title,description:`${title} for the pilot`,system:'payments-api',actions:[`Start: ${title}`,'Record findings'],completionCriteria:['Each item is marked verified, missing or inaccessible'],assignee:null,role:'developer',dependsOn,origin:'ai'});
function submitted():ChampionReview{
 return {draft:1,status:'submitted',reviewRevision:3,submittedAt:'2026-10-29T09:00:00Z',analysis:'model',history:[{action:'submitted',at:'2026-10-29T09:00:00Z',by:'Chris'}],approval:null,
  plan:{problem:{summary:'Nobody can tell who owns a service.',challenges:[{id:'c1',text:'Service ownership is unclear',origin:'customer',status:'reported',sources:['Conversational Transcript']}],systems:[{id:'s1',text:'payments-api (service)',origin:'customer'}],contradictions:[],unknowns:[]},
   facts:[{id:'f1',text:'payments-api is on GitHub',origin:'customer',status:'reported',sources:['Conversational Transcript']}],goals:[{id:'g1',text:'Establish a readiness baseline for payments-api',origin:'ai'}],
   milestones:[reviewMilestone('m-1','Assess payments-api repository readiness'),reviewMilestone('m-2','Validate payments-api and docs discoverability',['m-1'])],questions:[{id:'q1',text:'Which CI system deploys payments-api?',origin:'ai'}],
   stakeholders:[{id:'p1',name:'Maya Chen',role:'Champion',responsibilities:'Coordinate and approve',basis:'stated',sources:['Conversational Transcript']},{id:'p2',name:'Alex Rivera',role:'Developer',responsibilities:'Repository readiness',basis:'stated',sources:['Conversational Transcript']},{id:'p3',name:'Jordan Lee',role:'Developer',responsibilities:'Discoverability check',basis:'stated',sources:['Conversational Transcript']}],withheld:0}};
}
function approvedFor(persona:Persona){
 const ms=server.review!.plan!.milestones,title=(id:string)=>ms.find(x=>x.id===id)!.title;
 // Every developer sees the whole approved plan; a suggested owner is only a suggestion.
 const all=ms.map(x=>({...milestone(x.id,x.title),proposedAssignee:x.assignee,assignmentStatus:'approved' as const,actions:x.actions,completionCriteria:x.completionCriteria,why:x.description,dependencies:x.dependsOn.map(title)}));
 return fixtureState('orbit',{handoff:{version:1,publishedAt:'2026-10-29T10:00:00Z',interpreter:'hosted_model',summary:'s',context:[],unknowns:[],milestones:all,approval:server.review!.approval!,
  team:[{name:'Maya Chen',role:'Champion',status:'reported'},{name:'Alex Rivera',role:'Developer',status:'reported'},{name:'Jordan Lee',role:'Developer',status:'reported'}]}});
}
type FakeEntry={id:string;at:string;by:string;role:'developer'|'champion';kind:string;text:string;evidence:string|null;replyTo:string|null;resolved:{at:string;by:string}|null};
type FakeWork={revision:number;developerRevision:number;explicit:string|null;actions:{status:string;at:string|null;by:string|null}[];updates:FakeEntry[];updatedAt:string|null;updatedBy:string|null;review:{decision:'reviewed';at:string;by:string;note:string|null;developerRevision:number}|null;workingOn:string[]};
const workOf=(id:string)=>server.work[id]??=({revision:0,developerRevision:0,explicit:null,actions:server.review!.plan!.milestones.find(x=>x.id===id)!.actions.map(()=>({status:'not_started',at:null,by:null})),updates:[],updatedAt:null,updatedBy:null,review:null,workingOn:[]});
const openBlockers=(w:FakeWork)=>w.updates.filter(u=>u.kind==='blocker'&&!u.resolved).length;
const unanswered=(w:FakeWork,kind:string)=>w.updates.filter(u=>u.kind===kind&&!w.updates.some(x=>x.replyTo===u.id)).length;
const statusOf=(id:string)=>{const w=workOf(id);return w.explicit??(openBlockers(w)||w.actions.some(a=>a.status==='blocked')?'blocked':w.actions.some(a=>a.status!=='not_started')||w.updates.some(u=>u.role==='developer')?'in_progress':'not_started');};
const reviewStateOf=(id:string)=>{const w=workOf(id),s=statusOf(id);return w.review?(w.review.developerRevision===w.developerRevision?'reviewed':'reviewed_outdated'):s==='ready_for_review'||s==='completed'?'awaiting_review':'none';};
// As on the server: a milestone is "mine" when the Champion suggested me or I chose it; everyone sees its outline.
const isMine=(me:Persona,x:ReviewMilestone)=>me.role==='developer'&&(x.assignee===me.name||workOf(x.id).workingOn.includes(me.name));
function workView(me:Persona){
 const r=server.review!,ms=r.plan!.milestones,title=(id:string)=>ms.find(x=>x.id===id)!.title;
 const milestones=ms.map(x=>{const w=workOf(x.id),mine=isMine(me,x),s=statusOf(x.id),rs=reviewStateOf(x.id),full=mine||me.role!=='developer',last=w.updates.at(-1);
  return {id:x.id,title:x.title,assignee:x.assignee,status:s,openBlockers:openBlockers(w),mine,workingOn:[...w.workingOn],suggestedForMe:me.role==='developer'&&x.assignee===me.name,revision:w.revision,
   outline:{description:x.description,system:x.system,actions:x.actions,completionCriteria:x.completionCriteria},
   dependsOn:x.dependsOn.map(d=>({id:d,title:title(d),assignee:ms.find(y=>y.id===d)!.assignee,status:statusOf(d)})),
   openQuestions:unanswered(w,'question'),openFollowUps:unanswered(w,'follow_up'),actionsCompleted:w.actions.filter(a=>a.status==='completed').length,actionsTotal:x.actions.length,
   reviewState:rs,review:w.review,attention:[...(s==='blocked'?['blocked']:[]),...(unanswered(w,'question')?['open_question']:[]),...(rs==='awaiting_review'?['awaiting_review']:[]),...(rs==='reviewed_outdated'?['review_outdated']:[])],
   latest:full&&last?{at:last.at,by:last.by,kind:last.kind}:null,
   detail:full?{description:x.description,system:x.system,actions:x.actions.map((text,index)=>({index,text,...w.actions[index]})),completionCriteria:x.completionCriteria,updates:w.updates,revision:w.revision,updatedAt:w.updatedAt,updatedBy:w.updatedBy}:null};});
 // The real server lists the viewer's own milestones first.
 milestones.sort((a,b)=>Number(b.suggestedForMe)-Number(a.suggestedForMe));
 const n=(f:(m:typeof milestones[number])=>number)=>milestones.reduce((a,m)=>a+f(m),0);
 return {viewer:{role:me.role,name:me.name},approval:r.approval,objective:{problem:r.plan!.problem.summary,goals:r.plan!.goals.map(g=>g.text),questions:r.plan!.questions.map(q=>q.text)},milestones,
  summary:{milestones:milestones.length,notStarted:n(m=>+(m.status==='not_started')),inProgress:n(m=>+(m.status==='in_progress')),blocked:n(m=>+(m.status==='blocked')),readyForReview:n(m=>+(m.status==='ready_for_review')),completed:n(m=>+(m.status==='completed')),
   reviewed:n(m=>+(m.reviewState==='reviewed')),awaitingReview:n(m=>+(m.reviewState==='awaiting_review'||m.reviewState==='reviewed_outdated')),openBlockers:n(m=>m.openBlockers),openQuestions:n(m=>m.openQuestions),openFollowUps:n(m=>m.openFollowUps),actionsCompleted:n(m=>m.actionsCompleted),actionsTotal:n(m=>m.actionsTotal),overdue:null}};
}
// Engineering opportunities in the fake API: one backed by sample repository data, one hypothesis from the plan.
// The Champion prioritises and recommends; developers choose; Chris only reads.
const OPPS=[
 {id:'o-owners',kind:'improvement',title:'Record who owns payments-api’s code',why:'Supports your goal: Establish a readiness baseline for payments-api',basis:'sample',evidence:['No CODEOWNERS file in .github/, docs/ or the root (sample data).'],steps:['Add a CODEOWNERS file listing the owning team.','Ask AiKA to check the owner shown in Portal.'],service:'payments-api',goal:'g1'},
 {id:'o-catalog',kind:'integration',title:'Register payments-api in the Catalog',why:'Your team’s plan aims to make ownership discoverable.',basis:'hypothesis',evidence:['From the onboarding plan'],steps:['Add catalog-info.yaml naming an owner, type and lifecycle.'],service:'payments-api',goal:'g1'}] as const;
function oppsView(me:Persona){
 const ms=server.review!.plan!.milestones,o=server.opps;
 return {viewer:{role:me.role,name:me.name},observedAt:'2026-10-29T12:30:00Z',
  goals:server.review!.plan!.goals.map(g=>({id:g.id,text:g.text,priority:o.priority[g.id]??null,milestones:ms.map(x=>({id:x.id,title:x.title,status:statusOf(x.id)})),completed:ms.filter(x=>statusOf(x.id)==='completed').length,total:ms.length})),
  opportunities:OPPS.map(x=>{const by=o.pursuits[x.id]??[];return {...x,evidence:[...x.evidence],steps:[...x.steps],priority:o.priority[x.id]??null,highlighted:!!o.highlighted[x.id],pursuers:by.length,...(me.role==='developer'?{mine:by.includes(me.name)}:{pursuedBy:by})};})};
}
function adoptionView(){
 const ms=server.review!.plan!.milestones,o=server.opps,names=[...new Set([...Object.values(o.pursuits).flat(),...ms.flatMap(x=>workOf(x.id).workingOn)])];
 return {generatedAt:'2026-10-29T13:00:00Z',goals:{total:server.review!.plan!.goals.length,withProgress:0},milestones:{total:ms.length,completed:0,inProgress:0,open:ms.length},
  opportunities:{total:OPPS.length,pursued:Object.values(o.pursuits).filter(x=>x.length).length,highlighted:Object.values(o.highlighted).filter(Boolean).length},
  developers:names.map(name=>({name,lastActiveAt:'2026-10-29T12:00:00Z',workingOn:ms.filter(x=>workOf(x.id).workingOn.includes(name)).length,pursuing:Object.values(o.pursuits).filter(x=>x.includes(name)).length,activeThisWeek:true})),
  weekly:[{weekStart:'2026-10-26',events:names.length,activeDevelopers:names.length}],suggestions:[],scope:'onboarding_activity'};
}
let m:ReturnType<typeof mount>,server:{persona:string|null;review?:ChampionReview;work:Record<string,FakeWork>;opps:{priority:Record<string,string>;highlighted:Record<string,boolean>;pursuits:Record<string,string[]>}},calls:{method:string;url:string;persona:string|null;body?:any}[];
function backend(signedIn:string|null=null,review:ChampionReview|undefined=undefined){
 server={persona:signedIn,review,work:{},opps:{priority:{},highlighted:{},pursuits:{}}};calls=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  const headers=(init?.headers??{}) as Record<string,string>;
  calls.push({method:init?.method??'GET',url,persona:headers['X-Portal-Persona']??null,body:init?.body?JSON.parse(String(init.body)):undefined});
  const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status});
  const me=PERSONAS.find(p=>p.id===server.persona);
  if(url==='/portal-auth/personas')return json({personas:PERSONAS});
  if(url==='/portal-auth/session')return me?json({persona:me}):json({error:{code:'SIGN_IN_REQUIRED'}},401);
  if(url==='/portal-auth/login'){server.persona=JSON.parse(String(init!.body)).personaId;return json({persona:PERSONAS.find(p=>p.id===server.persona)});}
  if(url==='/portal-auth/logout'){server.persona=null;return json({});}
  if(!me)return json({error:{code:'SIGN_IN_REQUIRED'}},401);
  if(headers['X-Portal-Persona']&&headers['X-Portal-Persona']!==me.id)return json({error:{code:'PERSONA_CHANGED'}},409);
  // Same rules as the session layer: customer personas use /portal-api, the operator /operator-api.
  if(url.startsWith('/portal-api/')&&me.role==='operator')return json({error:{code:'WRONG_SURFACE'}},403);
  if(url.includes('/champion-')){
   if(me.role!=='champion')return json({error:{code:'CHAMPION_REQUIRED'}},403);
   const r=server.review;if(!r)return json({draft:null,status:'not_submitted',reviewRevision:0,submittedAt:null,analysis:null,history:[],approval:null,plan:null});
   if(url.endsWith('/champion-review'))return json(r);
   const body=JSON.parse(String(init!.body));
   if((body.expectedRevision??body.reviewRevision)!==r.reviewRevision)return json({error:{code:'REVISION_CONFLICT'}},409);
   if(url.endsWith('/champion-reviews')){server.review={...r,reviewRevision:r.reviewRevision+1,plan:{...r.plan!,...body.plan},history:[...r.history,{action:'edited',at:'2026-10-29T09:30:00Z',by:me.name,comment:'Edited 1 milestone, added 1 question.'}]};return json(server.review);}
   if(body.decision==='request_changes'){server.review={...r,status:'changes_requested',reviewRevision:r.reviewRevision+1,plan:null,history:[...r.history,{action:'changes_requested',at:'2026-10-29T10:00:00Z',by:me.name,comment:body.comment}]};return json(server.review);}
   server.review={...r,status:'published',reviewRevision:r.reviewRevision+1,approval:{by:me.name,at:'2026-10-29T10:00:00Z'},history:[...r.history,{action:'approved',at:'2026-10-29T10:00:00Z',by:me.name},{action:'published',at:'2026-10-29T10:00:00Z',by:me.name}]};
   return json(server.review);
  }
  // Phase 5 routes, with the server's rules: approved plans only, assignee and revision checks, no completing ahead
  // of a dependency, and another developer's workspace reduced to title and status.
  if(/\/(opportunities|opportunity-priorities|opportunity-pursuits|adoption)$/.test(url)){
   if(server.review?.status!=='published')return json({error:{code:'NO_APPROVED_PLAN'}},404);
   if(url.endsWith('/adoption'))return me.role==='developer'?json({error:{code:'FORBIDDEN'}},403):json(adoptionView());
   const body=init?.body?JSON.parse(String(init.body)):null;
   if(url.endsWith('/opportunity-priorities')){
    if(me.role!=='champion')return json({error:{code:'CHAMPION_REQUIRED'}},403);
    if('priority' in body)server.opps.priority[body.id]=body.priority;if('highlighted' in body)server.opps.highlighted[body.id]=body.highlighted;
   }
   if(url.endsWith('/opportunity-pursuits')){
    if(me.role!=='developer')return json({error:{code:'DEVELOPER_IDENTITY_REQUIRED'}},403);
    const by=server.opps.pursuits[body.id]??[];server.opps.pursuits[body.id]=body.pursue?[...new Set([...by,me.name])]:by.filter(x=>x!==me.name);
   }
   return json(oppsView(me));
  }
  if(url.endsWith('/aika-capabilities')){
   // Same rules as the server: nothing before approval; /my-work for developers; /docs never (no documentation source).
   const approved=server.review?.status==='published';
   const cap=(id:string,ok:boolean,reason:string)=>({id,label:'/'+id,description:id,available:ok,reason:ok?null:reason});
   return json({modelConfigured:true,capabilities:[cap('onboarding',approved,'not approved'),cap('my-work',approved&&me.role==='developer','developers only'),cap('repository',false,'no repository'),cap('team',approved,'not approved'),cap('docs',false,'No documentation source is connected to this Portal yet.')]});
  }
  if(/\/(milestone-work|milestone-updates|milestone-coordination|aika-questions)$/.test(url)){
   if(server.review?.status!=='published')return json({error:{code:'NO_APPROVED_PLAN'}},404);
   if(url.endsWith('/aika-questions'))return me.role==='operator'?json({error:{code:'FORBIDDEN'}},403):json({job:null});
   if(url.endsWith('/milestone-coordination')){
    if(me.role!=='champion')return json({error:{code:'CHAMPION_REQUIRED'}},403);
    const body=JSON.parse(String(init!.body)),w=workOf(body.milestoneId),at='2026-10-29T12:00:00Z';
    if(w.revision!==body.expectedRevision)return json({error:{code:'REVISION_CONFLICT'}},409);
    const add=(kind:string,text:string,replyTo:string|null)=>w.updates.push({id:`u${w.updates.length+1}`,at,by:me.name,role:'champion',kind,text,evidence:null,replyTo,resolved:null});
    if(body.note)add('coordination',body.note.text,null);else if(body.followUp)add('follow_up',body.followUp.text,null);
    else if(body.respond){add('response',body.respond.text,body.respond.to);if(body.respond.resolve)w.updates=w.updates.map(u=>u.id===body.respond.to?{...u,resolved:{at,by:me.name}}:u);}
    else{const rs=reviewStateOf(body.milestoneId);if(rs==='none')return json({error:{code:'REVIEW_NOT_READY'}},409);if(rs==='reviewed')return json({error:{code:'ALREADY_REVIEWED'}},409);
     w.review={decision:'reviewed',at,by:me.name,note:body.review.note??null,developerRevision:w.developerRevision};}
    w.revision++;w.updatedBy=me.name;w.updatedAt=at;return json(workView(me));
   }
   if(url.endsWith('/milestone-updates')){
    const body=JSON.parse(String(init!.body)),ms=server.review.plan!.milestones.find(x=>x.id===body.milestoneId);
    if(me.role!=='developer')return json({error:{code:'DEVELOPER_IDENTITY_REQUIRED'}},403);
    if(!ms)return json({error:{code:'NOT_FOUND'}},404);
    const w=workOf(ms.id);if(w.revision!==body.expectedRevision)return json({error:{code:'REVISION_CONFLICT'}},409);
    let dev=true;
    if(body.pursue!==undefined){w.workingOn=body.pursue?[...new Set([...w.workingOn,me.name])]:w.workingOn.filter(x=>x!==me.name);w.revision++;return json(workView(me));}
    if(!isMine(me,ms))return json({error:{code:'NOT_ASSIGNEE'}},403);
    if(body.action){w.actions[body.action.index]={status:body.action.status,at:'2026-10-29T11:00:00Z',by:me.name};w.explicit=null;}
    else if(body.note){w.updates.push({id:`u${w.updates.length+1}`,at:'2026-10-29T11:00:00Z',by:me.name,role:'developer',kind:body.note.kind,text:body.note.text,evidence:body.note.evidence??null,replyTo:body.note.replyTo??null,resolved:null});dev=body.note.kind==='update'||body.note.kind==='blocker';}
    else if(body.resolve)w.updates=w.updates.map(u=>u.id===body.resolve?{...u,resolved:{at:'2026-10-29T11:05:00Z',by:me.name}}:u);
    else{const issues=[...(w.actions.some(a=>a.status!=='completed')?['actions_incomplete']:[]),...(w.updates.some(u=>u.kind==='blocker'&&!u.resolved)?['open_blockers']:[]),
      ...(body.status==='completed'&&ms.dependsOn.some(d=>statusOf(d)!=='completed')?['dependencies_incomplete']:[])];
     if(body.status!=='in_progress'&&issues.length)return json({error:{code:'MILESTONE_NOT_READY',details:{issues}}},409);
     w.explicit=body.status==='in_progress'?null:body.status;}
    w.revision++;if(dev)w.developerRevision++;w.updatedBy=me.name;w.updatedAt='2026-10-29T11:00:00Z';
   }
   return json(workView(me));
  }
  if(url.startsWith('/portal-api/'))return server.review?.status==='published'?json(approvedFor(me)):server.review?json({error:{code:'NOT_FOUND'}},404):json(published());
  if(url.startsWith('/operator-api/'))return me.role!=='operator'?json({error:{code:'FORBIDDEN'}},403):url.endsWith('/handoff')?json({drafts:[]}):json(published());
  return json({error:{code:'NOT_FOUND'}},404);
 }));
}
const text=()=>m.host.textContent??'';
async function render(path:string){window.history.replaceState(null,'',path);m=mount();await m.render(<App/>);await settle();}
async function settle(){const {act}=await import('react');for(let i=0;i<6;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});}
async function choose(name:string){
 const radio=Array.from(m.host.querySelectorAll<HTMLInputElement>('input[name=persona]')).find(r=>r.closest('label')!.textContent!.includes(name))!;
 await (await import('react')).act(async()=>{radio.click();});
 await click(m.host,'Continue');await settle();
}
const apiCalls=()=>calls.filter(c=>c.url.includes('-api/'));
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);});
afterEach(async()=>{await m.unmount();vi.unstubAllGlobals();});

it('one entry: Welcome → Get started → clearly labelled demo personas, no credentials collected',async()=>{
 backend();await render('/');
 expect(text()).toContain('Portal is ready for you');
 await click(m.host,'Get started');await settle();
 expect(window.location.pathname).toBe('/login');
 const options=Array.from(m.host.querySelectorAll('label.pt-account')).map(l=>l.textContent);
 expect(options).toEqual([expect.stringMatching(/Chris.*Account operator.*Spotify account operator/),expect.stringMatching(/Maya Chen.*Champion.*Platform Champion/),expect.stringMatching(/Alex Rivera.*Developer/),expect.stringMatching(/Jordan Lee.*Developer/)]);
 expect(text()).toMatch(/simulated sign-in, not authentication/);
 expect(m.host.querySelector('input[type=password],input[type=email]')).toBeNull();
});

it.each([
 ['Alex Rivera','/portal','/portal-api/'],
 ['Jordan Lee','/portal','/portal-api/'],
 ['Maya Chen','/portal','/portal-api/'],
 ['Chris','/operator','/operator-api/'],
])('%s opens their own Portal and only calls their own API surface',async(name,home,prefix)=>{
 backend();await render('/login');await choose(name);
 expect(window.location.pathname).toBe(home);
 // Chris's workspace is a lazily loaded chunk: wait for it rather than assume how many ticks the import takes.
 for(let i=0;i<100&&!m.host.querySelector(`[aria-label="Account: ${name}"]`);i++){await flush();await new Promise(r=>setTimeout(r,10));}
 expect(m.host.querySelector(`[aria-label="Account: ${name}"]`)).not.toBeNull();
 const persona=PERSONAS.find(p=>p.name===name)!;
 expect(apiCalls().length).toBeGreaterThan(0);
 expect(apiCalls().every(c=>c.url.startsWith(prefix)&&c.persona===persona.id)).toBe(true);
 const nav=Array.from(m.host.querySelectorAll('nav.pt-side a')).map(a=>a.getAttribute('href'));
 if(persona.role==='operator'){expect(text()).toContain('Customer Onboarding');expect(nav.some(h=>h?.startsWith('/portal')||h==='/activation')).toBe(false);}
 else{expect(text()).toContain('Welcome to Portal');expect(nav).toContain('/activation');expect(nav.some(h=>h?.startsWith('/operator'))).toBe(false);}
 expect(nav.includes('/champion')).toBe(persona.role==='champion');
});

const section=(title:string)=>m.host.querySelector(`section[aria-label="${title}"]`) as HTMLElement;
/** Opens a collapsible section (closed ones only show their header). */
async function openSection(title:string){
 const head=section(title).querySelector<HTMLButtonElement>(':scope > .pt-section-head')!;
 if(head.getAttribute('aria-expanded')!=='true'){const {act}=await import('react');await act(async()=>{head.click();});}
}
// Chris finalized the plan, which published it: nobody approved it.
const approvedReview=(owners:(string|null)[]=['Alex Rivera','Jordan Lee'])=>{const r=submitted();r.plan!.milestones.forEach((x,i)=>{x.assignee=owners[i]??null;});return {...r,status:'published' as const,approval:{by:'Chris',at:'2026-10-29T10:00:00Z'},history:[{action:'published' as const,at:'2026-10-29T10:00:00Z',by:'Chris'}]};};

it('before Chris publishes, developers and the Champion see that the plan isn’t published yet; nothing is assigned',async()=>{
 backend('alex');await render('/portal');
 const home=m.host.querySelector('[aria-label="Your onboarding"]')!.textContent!;
 expect(home).toContain('Your team’s onboarding plan isn’t published yet');expect(home).toMatch(/When it’s published/);
 expect(text()).not.toMatch(/assigned to you|Chris|approv/i);
 await m.unmount();await render('/champion');
 expect(text()).toContain('Team Coordination is for your team’s Champion');
 expect(m.host.querySelector('[aria-label="Dream Day"]')).toBeNull();
 expect(calls.some(c=>c.url.includes('/champion-'))).toBe(false);
 await m.unmount();server.persona='maya';await render('/portal');
 expect(text()).toContain('Your team’s onboarding plan isn’t published yet');expect(text()).not.toMatch(/approv/i);
 await m.unmount();await render('/champion');
 expect(m.host.querySelector('[aria-label="Dream Day review"]')!.textContent).toContain('Chris hasn’t published your team’s onboarding plan yet');
});

it('Dream Day is optional and read-only: Maya sees the published plan at a glance, with no approval, and goes to priorities from there',async()=>{
 backend('maya',approvedReview(['Alex Rivera',null]));await render('/portal');
 // Home leads with goals and adoption; Dream Day is not a step she has to take.
 expect(section('Company goals').textContent).toContain('Establish a readiness baseline for payments-api');
 await m.unmount();await render('/champion');
 const page=()=>m.host.querySelector('[aria-label="Dream Day"]')!.textContent!;
 expect(page()).toContain('Published by Chris');expect(page()).toContain('nothing here needs your approval');
 const glance=section('Plan at a glance').textContent!;
 expect(glance).toContain('Establish a readiness baseline for payments-api');expect(glance).toContain('Assess payments-api repository readiness');
 expect(glance).toContain('Suggested owner: Alex Rivera');expect(glance).toContain('No suggested owner · anyone can pick it up');
 // Supporting context stays collapsed, with its backing one click away.
 expect(m.host.querySelector('#dd-facts-body')).toBeNull();
 await openSection('Known facts');expect(section('Known facts').textContent).toContain('Source: Conversational Transcript');
 // Nothing to approve, send back or save; no checkbox; no repository inspection.
 expect(m.host.querySelector('[aria-label="Dream Day"] input[type=checkbox]')).toBeNull();
 for(const b of ['Approve onboarding plan','Request changes','Save draft'])expect(Array.from(m.host.querySelectorAll('button')).some(x=>x.textContent===b),b).toBe(false);
 expect(text()).not.toMatch(/Inspect repository|approve it|waiting for your review/i);
 await click(m.host,'Set priorities and recommend opportunities');await settle();
 expect(window.location.pathname).toBe('/champion/team');
 expect(section('Company goals')).not.toBeNull();expect(section('Improvement opportunities').textContent).toContain('Record who owns payments-api’s code');
 expect(m.host.querySelector('[role=status]')!.textContent).toContain('Published by Chris');
 expect(calls.filter(c=>c.url.includes('/champion-')&&c.method==='POST')).toEqual([]);
});

it('after approval developers see every milestone, their suggested one first, and choose what to work on; nothing is assigned',async()=>{
 backend('jordan',approvedReview(['Alex Rivera',null]));await render('/activation');
 const choices=()=>m.host.querySelector('[aria-label="Milestones to choose from"]') as HTMLElement;
 const card=(t:string)=>choices().querySelector(`[aria-label="Milestone: ${t}"]`) as HTMLElement;
 expect(Array.from(choices().querySelectorAll('[aria-label^="Milestone: "]')).map(x=>x.getAttribute('aria-label'))).toEqual(['Milestone: Assess payments-api repository readiness','Milestone: Validate payments-api and docs discoverability']);
 expect(card('Assess payments-api repository readiness').textContent).toContain('Suggested for Alex Rivera');
 expect(card('Validate payments-api and docs discoverability').textContent).toContain('Nobody has picked it up yet');
 expect(Array.from(m.host.querySelectorAll('[role=tab]')).map(t=>t.textContent)).toEqual(['Overview','My milestones','Guide']);
 expect(text()).not.toMatch(/Chris|assigned to you|Share your progress|Team & Evidence|Upload|Inspect repository/);
 await click(card('Validate payments-api and docs discoverability'),'Choose this milestone');await settle();
 expect(calls.find(c=>c.url.endsWith('/milestone-updates'))!.body).toEqual({milestoneId:'m-2',expectedRevision:0,pursue:true});
 expect(server.work['m-2'].workingOn).toEqual(['Jordan Lee']);
 await m.unmount();await render('/activation/work');
 const mine=m.host.querySelector('section[aria-label="Milestone: Validate payments-api and docs discoverability"]')!;
 expect(mine.textContent).toContain('You chose this');
 // Alex: the suggested milestone on Home, and who picked up the other one.
 await m.unmount();server.persona='alex';await render('/portal');
 expect(section('Your milestones').textContent).toContain('Assess payments-api repository readiness');expect(section('Your milestones').textContent).toContain('Suggested for you');
 await m.unmount();await render('/activation');
 expect(card('Validate payments-api and docs discoverability').textContent).toContain('Working on it: Jordan Lee');
});

it('Phase 5: Alex and Jordan each work on their own milestone, attributed; dependencies and blockers hold',async()=>{
 backend('alex',approvedReview());await render('/portal');
 await click(m.host,'Open my milestones');await settle();
 expect(window.location.pathname).toBe('/activation/work');
 const card=()=>m.host.querySelector('section[aria-label="Milestone: Assess payments-api repository readiness"]')!;
 expect(m.host.querySelector('section[aria-label="Milestone: Validate payments-api and docs discoverability"]')).toBeNull();
 expect(m.host.querySelector('[aria-label="Milestones to choose from"]')!.textContent).toContain('Suggested for Jordan Lee');
 expect(text()).toContain('Nobody can tell who owns a service.');expect(text()).toContain('Which CI system deploys payments-api?');
 await type(byLabel<HTMLSelectElement>(card() as HTMLElement,'Status of action 1')!,'completed');await settle();
 expect(calls.at(-1)!.body).toEqual({milestoneId:'m-1',expectedRevision:0,action:{index:0,status:'completed'}});
 expect(card().textContent).toContain('Completed by Alex Rivera');
 await type(byLabel<HTMLSelectElement>(card() as HTMLElement,'Note type')!,'blocker');
 await type(byLabel<HTMLTextAreaElement>(card() as HTMLElement,'Short note')!,'No read access to payments-api');
 await type(byLabel(card() as HTMLElement,'Evidence reference')!,'https://example.test/ticket/42');
 await click(card() as HTMLElement,'Record blocker');await settle();
 expect(card().querySelector('[data-testid=milestone-status]')!.textContent).toBe('Blocked');
 expect(card().textContent).toContain('Reference (reported, not verified)');
 await click(card() as HTMLElement,'Mark ready for review');await settle();
 expect(card().textContent).toMatch(/every action is completed, and open blockers are resolved/);
 await click(card() as HTMLElement,'Mark blocker resolved');await settle();
 expect(card().querySelector('[data-testid=milestone-status]')!.textContent).toBe('In progress');

 // Jordan: Alex's milestone by status only; can't complete ahead of it.
 await m.unmount();server.persona='jordan';calls=[];await render('/activation/work');
 const other=m.host.querySelector('[aria-label="Milestones to choose from"]')!.textContent!;
 expect(other).toContain('Assess payments-api repository readiness');expect(other).toContain('In progress');
 expect(text()).not.toContain('No read access to payments-api');
 const jcard=()=>m.host.querySelector('section[aria-label="Milestone: Validate payments-api and docs discoverability"]') as HTMLElement;
 expect(jcard().textContent).toContain('can only be completed after Alex Rivera’s work');
 for(const i of [1,2]){await type(byLabel<HTMLSelectElement>(jcard(),`Status of action ${i}`)!,'completed');await settle();}
 await click(jcard(),'Mark completed');await settle();
 expect(jcard().textContent).toContain('the work it depends on is completed by its owner');
 expect(jcard().querySelector('[data-testid=milestone-status]')!.textContent).toBe('In progress');
 expect(server.work['m-1'].updates[0].by).toBe('Alex Rivera');expect(server.work['m-2'].actions.every(a=>a.by==='Jordan Lee')).toBe(true);

 // Maya sees consolidated, attributed progress.
 await m.unmount();server.persona='maya';await render('/champion/team');
 await openSection('Milestone progress and discussion');
 const coord=(t:string)=>m.host.querySelector(`[aria-label="Coordination: ${t}"]`)!.textContent!;
 expect(coord('Assess payments-api repository readiness')).toContain('Suggested for Alex Rivera · 1 of 2 actions completed');expect(coord('Validate payments-api and docs discoverability')).toContain('Suggested for Jordan Lee · 2 of 2 actions completed');
 expect(m.host.querySelector('[aria-label="Team progress"]')!.textContent).toContain('Actions done3 of 4');
});

it('Phase 6: Maya answers, reviews and asks for follow-up; review is separate from completion; Alex replies; Chris only reads',async()=>{
 backend('alex',approvedReview());await render('/activation/work');
 const card=()=>m.host.querySelector('section[aria-label="Milestone: Assess payments-api repository readiness"]') as HTMLElement;
 for(const i of [1,2]){await type(byLabel<HTMLSelectElement>(card(),`Status of action ${i}`)!,'completed');await settle();}
 await type(byLabel<HTMLSelectElement>(card(),'Note type')!,'question');
 await type(byLabel<HTMLTextAreaElement>(card(),'Short note')!,'Who owns the payments-api runbook?');
 await click(card(),'Record question');await settle();
 await click(card(),'Mark ready for review');await settle();
 expect(card().querySelector('[data-testid=review-state]')!.textContent).toBe('Awaiting Champion review');

 await m.unmount();server.persona='maya';calls=[];await render('/champion/team');
 await openSection('Milestone progress and discussion');
 expect(m.host.querySelector('[aria-label="Needs attention"]')!.textContent).toMatch(/Unanswered question.*Ready for your review/);
 expect(m.host.querySelector('[aria-label="Team progress"]')!.textContent).toContain('Awaiting your review1');
 const coord=()=>m.host.querySelector('[aria-label="Coordination: Assess payments-api repository readiness"]') as HTMLElement;
 await click(coord(),'Respond');
 await type(byLabel<HTMLTextAreaElement>(coord(),'Response')!,'The platform team owns it.');
 await click(coord(),'Send response');await settle();
 expect(calls.at(-1)!.body).toEqual({milestoneId:'m-1',expectedRevision:4,respond:{to:'u1',text:'The platform team owns it.'}});
 expect(coord().textContent).toContain('Maya Chen (Champion)');expect(coord().textContent).toContain('answered');
 await click(coord(),'Mark reviewed');await settle();
 expect(calls.at(-1)!.body).toEqual({milestoneId:'m-1',expectedRevision:5,review:{decision:'reviewed',note:null}});
 expect(coord().querySelector('[data-testid=review-state]')!.textContent).toBe('Reviewed');
 expect(coord().querySelector('[data-testid=coord-status]')!.textContent).toBe('Ready for review');
 await type(byLabel<HTMLSelectElement>(coord(),'Coordination type')!,'followUp');
 await type(byLabel<HTMLTextAreaElement>(coord(),'Coordination text')!,'Please link the readiness checklist.');
 await click(coord(),'Request follow-up');await settle();
 expect(server.work['m-1'].updates.map(u=>[u.kind,u.by,u.role])).toEqual([['question','Alex Rivera','developer'],['response','Maya Chen','champion'],['follow_up','Maya Chen','champion']]);
 expect(server.work['m-1'].explicit).toBe('ready_for_review');

 await m.unmount();server.persona='alex';calls=[];await render('/activation/work');
 expect(card().querySelector('[data-testid=review-state]')!.textContent).toBe('Reviewed by Maya Chen');
 const {act}=await import('react');
 await act(async()=>{(card().querySelector('[data-entry-kind=follow_up] button') as HTMLButtonElement).click();});
 await type(byLabel<HTMLTextAreaElement>(card(),'Short note')!,'Linked in the repository README.');
 await click(card(),'Send reply');await settle();
 expect(calls.at(-1)!.body).toEqual({milestoneId:'m-1',expectedRevision:7,note:{kind:'response',text:'Linked in the repository README.',evidence:null,replyTo:'u3'}});

 await m.unmount();server.persona='chris';calls=[];await render('/operator/progress');
 for(let i=0;i<100&&!m.host.querySelector('section[aria-label="Milestone progress"]');i++){await flush();await new Promise(r=>setTimeout(r,10));}
 await openSection('Milestone progress');
 const view=section('Milestone progress').querySelector('.pt-section-body') as HTMLElement;
 expect(view.textContent).toContain('Reviewed by Maya Chen');expect(view.textContent).toContain('Linked in the repository README.');
 expect(Array.from(view.querySelectorAll('button')).map(b=>b.textContent)).toEqual(['Refresh progress']);
 expect(calls.filter(c=>c.method==='POST')).toEqual([]);
});

it('opportunities: labelled by what backs them; developers pursue, Maya prioritises and recommends, Chris only reads; nobody inspects repositories',async()=>{
 backend('alex',approvedReview());await render('/activation');
 const opp=(t:string)=>m.host.querySelector(`[aria-label="Opportunity: ${t}"]`) as HTMLElement;
 expect(opp('Record who owns payments-api’s code').querySelector('[data-basis]')!.textContent).toBe('Sample data');
 expect(opp('Register payments-api in the Catalog').querySelector('[data-basis]')!.textContent).toBe('Hypothesis');
 await click(opp('Record who owns payments-api’s code'),'Pursue this');await settle();
 expect(calls.find(c=>c.url.endsWith('/opportunity-pursuits'))!.body).toEqual({id:'o-owners',pursue:true});
 expect(opp('Record who owns payments-api’s code').textContent).toContain('1 developer pursuing (including you)');
 expect(calls.some(c=>c.url.endsWith('/repository-inspections'))).toBe(false);
 await click(m.host,'Guide');await settle();
 expect(m.host.querySelector('[aria-label="Guide: Record who owns payments-api’s code"]')!.textContent).toContain('Add a CODEOWNERS file listing the owning team.');
 await m.unmount();await render('/progress');
 expect(section('Opportunities I’m pursuing').textContent).toContain('First step: Add a CODEOWNERS file listing the owning team.');

 await m.unmount();server.persona='maya';calls=[];await render('/champion/team');
 const card=()=>section('Improvement opportunities').querySelector('[aria-label="Opportunity: Register payments-api in the Catalog"]') as HTMLElement;
 await type(byLabel<HTMLSelectElement>(card(),'Priority: Register payments-api in the Catalog')!,'high');await settle();
 expect(calls.find(c=>c.url.endsWith('/opportunity-priorities'))!.body).toEqual({id:'o-catalog',priority:'high'});
 const {act}=await import('react');
 await act(async()=>{card().querySelector<HTMLInputElement>('.pt-check input')!.click();});await settle();
 expect(server.opps).toMatchObject({priority:{'o-catalog':'high'},highlighted:{'o-catalog':true}});
 expect(section('Improvement opportunities').textContent).toContain('Pursued by Alex Rivera');
 expect(section('Developer engagement').textContent).toContain('Alex Rivera');
 expect(text()).not.toMatch(/Inspect repository/);

 await m.unmount();server.persona='alex';await render('/portal');
 expect(section('What you can build or improve').textContent).toContain('Recommended by your Champion');

 await m.unmount();server.persona='chris';calls=[];await render('/operator/progress');
 for(let i=0;i<100&&!m.host.querySelector('section[aria-label="Engineering opportunities"]');i++){await flush();await new Promise(r=>setTimeout(r,10));}
 await openSection('Engineering opportunities');
 const chris=section('Engineering opportunities');
 expect(chris.textContent).toContain('Pursued by Alex Rivera');expect(chris.textContent).toContain('High priority');
 expect(chris.querySelector('select,input')).toBeNull();
 expect(calls.filter(c=>c.method==='POST')).toEqual([]);
});

it('Phase 5: before approval there is no My work tab, and AiKA is in the Portal navigation',async()=>{
 backend('alex',submitted());await render('/activation/work');
 expect(m.host.querySelector('[role=tab]#tab-work')).toBeNull();
 expect(m.host.querySelector('a[href="/aika"]')).not.toBeNull();
 await m.unmount();await render('/aika');
 expect(text()).toContain('What can I help you with?');expect(text()).toContain('Hello Alex,');
 expect(calls.some(c=>/11434|ollama/i.test(c.url))).toBe(false);
});

it('a reload keeps the persona; typed URLs for another surface explain instead of switching persona',async()=>{
 backend();await render('/login');await choose('Maya Chen');await m.unmount();
 await render('/champion');
 expect(window.location.pathname).toBe('/champion');expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 await m.unmount();calls=[];await render('/operator');
 expect(text()).toContain('This workspace is for the Spotify account operator');
 expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 expect(apiCalls().filter(c=>c.url.startsWith('/operator-api/'))).toEqual([]);
 await m.unmount();await render('/login');
 expect(window.location.pathname).toBe('/portal');expect(server.persona).toBe('maya');
 await m.unmount();server.persona='chris';calls=[];await render('/activation');
 expect(text()).toContain('This is the customer’s developer Portal');
 expect(apiCalls().filter(c=>c.url.startsWith('/portal-api/'))).toEqual([]);
});

it('signing in at a deep link lands there when the persona may use it, else at the persona’s start page',async()=>{
 backend();await render('/activation/guide');
 expect(text()).toContain('Sign in to Portal');expect(apiCalls()).toEqual([]);
 await choose('Jordan Lee');expect(window.location.pathname).toBe('/activation/guide');
 await m.unmount();backend();await render('/activation');await choose('Chris');
 expect(window.location.pathname).toBe('/operator');
});

it('when another tab signs in as someone else, this tab stops and says so instead of acting for the new persona',async()=>{
 const {act}=await import('react');
 // Detected by the API on the next request…
 backend('alex');await render('/activation');
 server.persona='maya';
 await click(m.host,'Refresh');await settle();
 const portal=calls.filter(c=>c.url.startsWith('/portal-api/')).map(c=>c.persona);
 expect(portal.lastIndexOf('alex')).toBeLessThan(portal.indexOf('maya'));
 expect(text()).toContain('You signed in as Maya Chen in another tab');
 expect(m.host.querySelector('[aria-label="Account: Maya Chen"]')).not.toBeNull();
 await m.unmount();
 // …and when the tab regains focus, before any request.
 backend('jordan');await render('/portal');
 server.persona=null;calls=[];
 await act(async()=>{window.dispatchEvent(new Event('focus'));});await settle();
 expect(text()).toContain('You were signed out in another tab');
 expect(apiCalls()).toEqual([]);
});

it('signing out returns to the entry and the next sign-in can choose any persona',async()=>{
 backend('jordan');await render('/portal');
 await click(m.host,'Account: Jordan Lee');await click(m.host,'Sign out');await settle();
 expect(window.location.pathname).toBe('/');expect(server.persona).toBeNull();
 expect(text()).toContain('Portal is ready for you');
});
