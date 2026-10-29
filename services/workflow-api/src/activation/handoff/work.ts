/** Phase 5–6: developers work on their approved milestones and the Champion coordinates them. Every change is
 * attributed to the identity the server derived from the caller's credential, checked against the caller's role
 * (only the assignee changes the work; only the Champion coordinates and reviews), and revision-checked so nobody
 * overwrites someone else's change. Dependent work is never completed automatically, and a Champion review is
 * recorded beside the developer's status, never instead of it. Counts and states are computed here only. */
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import type {ActionStatus,AttentionReason,DeveloperHandoff,MilestoneDraft,MilestoneProgress,MilestoneWorkRecord,ProgressSummary,ReviewState,TeamProgress,WorkStatus,WorkUpdate} from '../../../../../contracts/activation/v1/handoff.ts';
import {ActivationError,type Principal} from '../store.ts';

const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};
export type Viewer={role:'developer'|'champion'|'operator';name:string|null};
const ACTION:ActionStatus[]=['not_started','started','blocked','completed'];

export function openWorkStore(filename:string){
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS activation_milestone_work (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, milestone TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session,milestone)) STRICT;`);
 const key=(p:Principal)=>[p.tenantId,p.customerId,p.sessionId];
 return {
  get(p:Principal,milestone:string):MilestoneWorkRecord|null{const row=db.prepare('SELECT body FROM activation_milestone_work WHERE tenant=? AND customer=? AND session=? AND milestone=?').get(...key(p),milestone);return row?JSON.parse(row.body as string):null;},
  save(p:Principal,w:MilestoneWorkRecord){db.prepare('INSERT INTO activation_milestone_work VALUES (?,?,?,?,?) ON CONFLICT(tenant,customer,session,milestone) DO UPDATE SET body=excluded.body').run(...key(p),w.milestoneId,JSON.stringify(w));},
  close:()=>db.close(),
 };
}
export type WorkStore=ReturnType<typeof openWorkStore>;

type Work=MilestoneWorkRecord&{developerRevision:number;review:NonNullable<MilestoneWorkRecord['review']>|null;updates:(WorkUpdate&{role:'developer'|'champion';replyTo:string|null})[]};
const blank=(m:MilestoneDraft):MilestoneWorkRecord=>({milestoneId:m.id,revision:0,explicit:null,actions:m.actions.map(()=>({status:'not_started',at:null,by:null})),updates:[],updatedAt:null,updatedBy:null,developerRevision:0,review:null});
// Records written before Phase 6 have no roles, replies, review or developer revision: they were all the developer's.
const normal=(w:MilestoneWorkRecord):Work=>({...w,developerRevision:w.developerRevision??w.revision,review:w.review??null,updates:w.updates.map(u=>({...u,role:u.role??'developer',replyTo:u.replyTo??null}))});
const answered=(w:Work,id:string)=>w.updates.some(u=>u.replyTo===id);
const openBlockers=(w:Work)=>w.updates.filter(u=>u.kind==='blocker'&&!u.resolved).length;
const openQuestions=(w:Work)=>w.updates.filter(u=>u.kind==='question'&&!answered(w,u.id)).length;
const openFollowUps=(w:Work)=>w.updates.filter(u=>u.kind==='follow_up'&&!answered(w,u.id)).length;
/** Explicit statuses win; otherwise blocked if anything is blocked, in progress once the developer started anything. */
export function statusOf(record:MilestoneWorkRecord):WorkStatus{
 const w=normal(record);
 if(w.explicit)return w.explicit;
 if(openBlockers(w)||w.actions.some(a=>a.status==='blocked'))return 'blocked';
 if(w.actions.some(a=>a.status!=='not_started')||w.updates.some(u=>u.role==='developer'))return 'in_progress';
 return 'not_started';
}
export function reviewStateOf(record:MilestoneWorkRecord):ReviewState{
 const w=normal(record),s=statusOf(w);
 if(w.review)return w.review.developerRevision===w.developerRevision?'reviewed':'reviewed_outdated';
 return s==='ready_for_review'||s==='completed'?'awaiting_review':'none';
}
const textOf=(v:unknown)=>{const t=typeof v==='string'?v.trim():'';if(t.length<3||t.length>1000)fail('INVALID_REQUEST');return t;};

export function createWorkService(deps:{published:(p:Principal)=>DeveloperHandoff|null;work:WorkStore;verifiedEvidence?:(p:Principal)=>string[];now?:()=>number}){
 const now=deps.now??(()=>Date.now());
 // Only plans approved in Dream Day can be worked on.
 function plan(p:Principal){
  const h=deps.published(p);
  if(!h?.approval)fail('NO_APPROVED_PLAN');
  const byTitle=new Map(h!.milestones.map(m=>[m.objective,m]));
  return {h:h!,byTitle};
 }
 const record=(p:Principal,m:MilestoneDraft)=>{const w=normal(deps.work.get(p,m.id)??blank(m));
  // Approved actions are fixed; tolerate older records by padding.
  while(w.actions.length<m.actions.length)w.actions.push({status:'not_started',at:null,by:null});return w;};
 const depsOf=(m:MilestoneDraft,byTitle:Map<string,MilestoneDraft>)=>m.dependencies.map(t=>byTitle.get(t)).filter((d):d is MilestoneDraft=>!!d);

 function view(p:Principal,viewer:Viewer):TeamProgress{
  const {h,byTitle}=plan(p);
  const works=new Map(h.milestones.map(m=>[m.id,record(p,m)]));
  const status=new Map(h.milestones.map(m=>[m.id,statusOf(works.get(m.id)!)]));
  const milestones=h.milestones.map(m=>{
   const w=works.get(m.id)!,s=status.get(m.id)!,mine=viewer.role==='developer'&&!!viewer.name&&m.proposedAssignee===viewer.name;
   // Another developer's workspace (their notes and action-level progress) stays theirs; the Champion and Chris see all.
   const full=mine||viewer.role!=='developer';
   const dependsOn=depsOf(m,byTitle).map(d=>({id:d.id,title:d.objective,assignee:d.proposedAssignee??null,status:status.get(d.id)!}));
   const reviewState=reviewStateOf(w),last=w.updates.at(-1);
   const attention:AttentionReason[]=[...(s==='blocked'?['blocked' as const]:[]),...(openBlockers(w)&&s!=='blocked'?['open_blocker' as const]:[]),...(openQuestions(w)?['open_question' as const]:[]),
    ...(reviewState==='awaiting_review'?['awaiting_review' as const]:[]),...(reviewState==='reviewed_outdated'?['review_outdated' as const]:[]),
    ...(s!=='completed'&&s!=='not_started'&&dependsOn.some(d=>d.status!=='completed')?['waiting_on_dependency' as const]:[])];
   return {id:m.id,title:m.objective,assignee:m.proposedAssignee??null,status:s,openBlockers:openBlockers(w),mine,dependsOn,
    openQuestions:openQuestions(w),openFollowUps:openFollowUps(w),actionsCompleted:w.actions.filter(a=>a.status==='completed').length,actionsTotal:m.actions.length,
    reviewState,review:w.review,attention,latest:full&&last?{at:last.at,by:last.by,kind:last.kind}:null,
    detail:full?{description:m.why,system:[m.system.service,m.system.repository].filter(Boolean).join(' · ')||null,
     actions:m.actions.map((text,index)=>({index,text,...w.actions[index]})),completionCriteria:m.completionCriteria,updates:w.updates,revision:w.revision,updatedAt:w.updatedAt,updatedBy:w.updatedBy}:null} satisfies MilestoneProgress;
  });
  const count=(f:(m:MilestoneProgress)=>boolean)=>milestones.filter(f).length,sum=(f:(m:MilestoneProgress)=>number)=>milestones.reduce((n,m)=>n+f(m),0);
  const summary:ProgressSummary={milestones:milestones.length,notStarted:count(m=>m.status==='not_started'),inProgress:count(m=>m.status==='in_progress'),blocked:count(m=>m.status==='blocked'),
   readyForReview:count(m=>m.status==='ready_for_review'),completed:count(m=>m.status==='completed'),reviewed:count(m=>m.reviewState==='reviewed'),awaitingReview:count(m=>m.reviewState==='awaiting_review'||m.reviewState==='reviewed_outdated'),
   openBlockers:sum(m=>m.openBlockers),openQuestions:sum(m=>m.openQuestions??0),openFollowUps:sum(m=>m.openFollowUps??0),actionsCompleted:sum(m=>m.actionsCompleted??0),actionsTotal:sum(m=>m.actionsTotal??0),overdue:null};
  return {viewer,approval:h.approval!,objective:h.objective??null,milestones,summary,
   ...(viewer.role!=='developer'?{verifiedEvidence:deps.verifiedEvidence?.(p)??[]}:{})};
 }

 /** Loads the milestone a write targets and checks the revision the caller was looking at. */
 function target(p:Principal,b:{milestoneId?:unknown;expectedRevision?:unknown}){
  if(!b||typeof b!=='object'||typeof b.milestoneId!=='string'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  const {h,byTitle}=plan(p);
  const m=h.milestones.find(x=>x.id===b.milestoneId)??fail('NOT_FOUND');
  return {m:m!,byTitle,w:record(p,m!)};
 }
 const commit=(p:Principal,w:Work,next:Work,by:string,developerChange:boolean)=>{
  const at=new Date(now()).toISOString();
  deps.work.save(p,{...next,revision:w.revision+1,developerRevision:w.developerRevision+(developerChange?1:0),updatedAt:at,updatedBy:by});
 };
 const copy=(w:Work):Work=>({...w,actions:w.actions.map(a=>({...a})),updates:[...w.updates]});

 /** The assignee's changes. One change per request: an action status, a note or reply, resolving a blocker, or the milestone status. */
 function update(p:Principal,developer:string|null,input:unknown){
  const b=input as {milestoneId?:unknown;expectedRevision?:unknown;action?:{index?:unknown;status?:unknown};note?:{kind?:unknown;text?:unknown;evidence?:unknown;replyTo?:unknown};resolve?:unknown;status?:unknown};
  if(!b||typeof b!=='object'||typeof b.milestoneId!=='string'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  // Identity comes from the developer's own credential; a shared or missing identity cannot change work.
  if(!developer)fail('DEVELOPER_IDENTITY_REQUIRED');
  const {m,byTitle,w}=target(p,b);
  if(m.proposedAssignee!==developer)fail('NOT_ASSIGNEE');
  if(w.revision!==b.expectedRevision)fail('REVISION_CONFLICT');
  const at=new Date(now()).toISOString(),changes=[b.action,b.note,b.resolve,b.status].filter(x=>x!==undefined).length;
  if(changes!==1)fail('INVALID_REQUEST');
  const next=copy(w);let developerChange=true;
  if(b.action!==undefined){
   const i=b.action?.index,s=b.action?.status as ActionStatus;
   if(!Number.isSafeInteger(i)||(i as number)<0||(i as number)>=m.actions.length||!ACTION.includes(s))fail('INVALID_REQUEST');
   next.actions[i as number]={status:s,at,by:developer!};
   // Changing an action reopens a milestone that was marked ready or complete.
   next.explicit=null;
  }else if(b.note!==undefined){
   const kind=b.note?.kind,evidence=b.note?.evidence,replyTo=b.note?.replyTo;
   if(!['update','blocker','question','response'].includes(kind as string))fail('INVALID_REQUEST');
   const text=textOf(b.note?.text);
   // A reply names an entry on this milestone; other notes may not.
   if(kind==='response'?typeof replyTo!=='string'||!w.updates.some(u=>u.id===replyTo):replyTo!==undefined&&replyTo!==null)fail('INVALID_REQUEST');
   if(evidence!==undefined&&evidence!==null&&(typeof evidence!=='string'||!evidence.trim()||evidence.length>300||/\s/.test(evidence.trim())))fail('INVALID_EVIDENCE_REFERENCE');
   next.updates.push({id:randomUUID(),at,by:developer!,role:'developer',kind:kind as WorkUpdate['kind'],text,evidence:typeof evidence==='string'?evidence.trim():null,replyTo:kind==='response'?replyTo as string:null,resolved:null});
   if(kind==='blocker')next.explicit=null;
   // Questions and replies are discussion; they don't change the work a review saw.
   developerChange=kind==='update'||kind==='blocker';
  }else if(b.resolve!==undefined){
   const u=next.updates.find(x=>x.id===b.resolve&&x.kind==='blocker'&&!x.resolved)??fail('NOT_FOUND');
   next.updates=next.updates.map(x=>x===u?{...x,resolved:{at,by:developer!}}:x) as Work['updates'];
  }else{
   const target=b.status;
   if(target==='in_progress')next.explicit=null;
   else if(target==='ready_for_review'||target==='completed'){
    const issues:string[]=[];
    if(next.actions.some(a=>a.status!=='completed'))issues.push('actions_incomplete');
    if(openBlockers(next))issues.push('open_blockers');
    // Never complete work ahead of what it depends on; dependent work is never completed automatically either.
    if(target==='completed'&&depsOf(m,byTitle).some(d=>statusOf(record(p,d))!=='completed'))issues.push('dependencies_incomplete');
    if(issues.length)fail('MILESTONE_NOT_READY',{issues});
    next.explicit=target;
   }else fail('INVALID_REQUEST');
  }
  commit(p,w,next,developer!,developerChange);
  return view(p,{role:'developer',name:developer});
 }

 /** The Champion's coordination. One change per request: a coordination note, a response (optionally resolving a
 * blocker she has unblocked), a follow-up request to the assignee, or a review. None of these change the developer's
 * status: a review is recorded beside it and never completes the milestone. */
 function coordinate(p:Principal,champion:string|null,input:unknown){
  const b=input as {milestoneId?:unknown;expectedRevision?:unknown;note?:{text?:unknown};respond?:{to?:unknown;text?:unknown;resolve?:unknown};followUp?:{text?:unknown};review?:{decision?:unknown;note?:unknown}};
  if(!champion)fail('CHAMPION_REQUIRED');
  const {w}=target(p,b);
  if(w.revision!==b.expectedRevision)fail('REVISION_CONFLICT');
  if([b.note,b.respond,b.followUp,b.review].filter(x=>x!==undefined).length!==1)fail('INVALID_REQUEST');
  const at=new Date(now()).toISOString(),next=copy(w);
  const entry=(kind:WorkUpdate['kind'],text:string,replyTo:string|null)=>next.updates.push({id:randomUUID(),at,by:champion!,role:'champion',kind,text,evidence:null,replyTo,resolved:null});
  if(b.note!==undefined)entry('coordination',textOf(b.note?.text),null);
  else if(b.followUp!==undefined)entry('follow_up',textOf(b.followUp?.text),null);
  else if(b.respond!==undefined){
   const to=next.updates.find(u=>u.id===b.respond?.to)??fail('NOT_FOUND');
   entry('response',textOf(b.respond?.text),to!.id);
   if(b.respond?.resolve===true){
    if(to!.kind!=='blocker'||to!.resolved)fail('INVALID_REQUEST');
    next.updates=next.updates.map(x=>x.id===to!.id?{...x,resolved:{at,by:champion!}}:x) as Work['updates'];
   }else if(b.respond?.resolve!==undefined&&b.respond?.resolve!==false)fail('INVALID_REQUEST');
  }else{
   if(b.review?.decision!=='reviewed')fail('INVALID_REQUEST');
   const note=b.review?.note===undefined||b.review?.note===null||b.review?.note===''?null:textOf(b.review?.note);
   const state=reviewStateOf(w);
   // Only after the assignee marked it ready for review (or completed); a current review isn't repeated.
   if(state==='none')fail('REVIEW_NOT_READY');
   if(state==='reviewed')fail('ALREADY_REVIEWED');
   next.review={decision:'reviewed',at,by:champion!,note,developerRevision:w.developerRevision};
  }
  commit(p,w,next,champion!,false);
  return view(p,{role:'champion',name:champion});
 }
 return {view,update,coordinate,
  /** What a viewer's AiKA may know about progress: their own milestones in full, others' titles and statuses. */
  forAika:(p:Principal,viewer:Viewer)=>view(p,viewer)};
}
export type WorkService=ReturnType<typeof createWorkService>;
