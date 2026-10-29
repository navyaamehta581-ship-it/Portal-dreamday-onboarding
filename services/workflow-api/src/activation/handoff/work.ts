/** Phase 5: developers work on their approved milestones. Every change is attributed to the developer identity the
 * server derived from their credential, checked against the milestone's assignee, and revision-checked so one
 * developer can never overwrite another's work. Dependent work is never completed automatically. */
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import type {ActionStatus,DeveloperHandoff,MilestoneDraft,MilestoneProgress,MilestoneWorkRecord,TeamProgress,WorkStatus,WorkUpdate} from '../../../../../contracts/activation/v1/handoff.ts';
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

const blank=(m:MilestoneDraft):MilestoneWorkRecord=>({milestoneId:m.id,revision:0,explicit:null,actions:m.actions.map(()=>({status:'not_started',at:null,by:null})),updates:[],updatedAt:null,updatedBy:null});
const openBlockers=(w:MilestoneWorkRecord)=>w.updates.filter(u=>u.kind==='blocker'&&!u.resolved).length;
/** Explicit statuses win; otherwise blocked if anything is blocked, in progress once anything has started. */
export function statusOf(w:MilestoneWorkRecord):WorkStatus{
 if(w.explicit)return w.explicit;
 if(openBlockers(w)||w.actions.some(a=>a.status==='blocked'))return 'blocked';
 if(w.actions.some(a=>a.status!=='not_started')||w.updates.length)return 'in_progress';
 return 'not_started';
}

export function createWorkService(deps:{published:(p:Principal)=>DeveloperHandoff|null;work:WorkStore;now?:()=>number}){
 const now=deps.now??(()=>Date.now());
 // Only plans approved in Dream Day can be worked on.
 function plan(p:Principal){
  const h=deps.published(p);
  if(!h?.approval)fail('NO_APPROVED_PLAN');
  const byTitle=new Map(h!.milestones.map(m=>[m.objective,m]));
  return {h:h!,byTitle};
 }
 const record=(p:Principal,m:MilestoneDraft)=>{const w=deps.work.get(p,m.id)??blank(m);
  // Approved actions are fixed; tolerate older records by padding.
  while(w.actions.length<m.actions.length)w.actions.push({status:'not_started',at:null,by:null});return w;};

 function view(p:Principal,viewer:Viewer):TeamProgress{
  const {h,byTitle}=plan(p);
  const status=new Map(h.milestones.map(m=>[m.id,statusOf(record(p,m))]));
  return {viewer,approval:h.approval!,objective:h.objective??null,
   milestones:h.milestones.map(m=>{
    const w=record(p,m),mine=viewer.role==='developer'&&!!viewer.name&&m.proposedAssignee===viewer.name;
    // Another developer's workspace (their notes and action-level progress) stays theirs; the Champion and Chris see all.
    const full=mine||viewer.role!=='developer';
    return {id:m.id,title:m.objective,assignee:m.proposedAssignee??null,status:status.get(m.id)!,openBlockers:openBlockers(w),mine,
     dependsOn:m.dependencies.map(t=>byTitle.get(t)).filter((d):d is MilestoneDraft=>!!d).map(d=>({id:d.id,title:d.objective,assignee:d.proposedAssignee??null,status:status.get(d.id)!})),
     detail:full?{description:m.why,system:[m.system.service,m.system.repository].filter(Boolean).join(' · ')||null,
      actions:m.actions.map((text,index)=>({index,text,...w.actions[index]})),completionCriteria:m.completionCriteria,updates:w.updates,revision:w.revision,updatedAt:w.updatedAt,updatedBy:w.updatedBy}:null} satisfies MilestoneProgress;
   })};
 }

 /** One change per request: an action status, a note, resolving a blocker, or the milestone status. */
 function update(p:Principal,developer:string|null,input:unknown){
  const b=input as {milestoneId?:unknown;expectedRevision?:unknown;action?:{index?:unknown;status?:unknown};note?:{kind?:unknown;text?:unknown;evidence?:unknown};resolve?:unknown;status?:unknown};
  if(!b||typeof b!=='object'||typeof b.milestoneId!=='string'||!Number.isSafeInteger(b.expectedRevision))fail('INVALID_REQUEST');
  // Identity comes from the developer's own credential; a shared or missing identity cannot change work.
  if(!developer)fail('DEVELOPER_IDENTITY_REQUIRED');
  const {h,byTitle}=plan(p);
  const m=h.milestones.find(x=>x.id===b.milestoneId)??fail('NOT_FOUND');
  if(m.proposedAssignee!==developer)fail('NOT_ASSIGNEE');
  const w=record(p,m);
  if(w.revision!==b.expectedRevision)fail('REVISION_CONFLICT');
  const at=new Date(now()).toISOString(),changes=[b.action,b.note,b.resolve,b.status].filter(x=>x!==undefined).length;
  if(changes!==1)fail('INVALID_REQUEST');
  let next:MilestoneWorkRecord={...w,actions:w.actions.map(a=>({...a})),updates:[...w.updates]};
  if(b.action!==undefined){
   const i=b.action?.index,s=b.action?.status as ActionStatus;
   if(!Number.isSafeInteger(i)||(i as number)<0||(i as number)>=m.actions.length||!ACTION.includes(s))fail('INVALID_REQUEST');
   next.actions[i as number]={status:s,at,by:developer!};
   // Changing an action reopens a milestone that was marked ready or complete.
   next.explicit=null;
  }else if(b.note!==undefined){
   const kind=b.note?.kind,text=typeof b.note?.text==='string'?b.note.text.trim():'',evidence=b.note?.evidence;
   if(!['update','blocker','question'].includes(kind as string)||text.length<3||text.length>1000)fail('INVALID_REQUEST');
   if(evidence!==undefined&&evidence!==null&&(typeof evidence!=='string'||!evidence.trim()||evidence.length>300||/\s/.test(evidence.trim())))fail('INVALID_EVIDENCE_REFERENCE');
   next.updates.push({id:randomUUID(),at,by:developer!,kind:kind as WorkUpdate['kind'],text,evidence:typeof evidence==='string'?evidence.trim():null,resolved:null});
   if(kind==='blocker')next.explicit=null;
  }else if(b.resolve!==undefined){
   const u=next.updates.find(x=>x.id===b.resolve&&x.kind==='blocker'&&!x.resolved)??fail('NOT_FOUND');
   next.updates=next.updates.map(x=>x===u?{...x,resolved:{at,by:developer!}}:x);
  }else{
   const target=b.status;
   if(target==='in_progress')next.explicit=null;
   else if(target==='ready_for_review'||target==='completed'){
    const issues:string[]=[];
    if(next.actions.some(a=>a.status!=='completed'))issues.push('actions_incomplete');
    if(openBlockers(next))issues.push('open_blockers');
    // Never complete work ahead of what it depends on; dependent work is never completed automatically either.
    if(target==='completed'){const waiting=m.dependencies.map(t=>byTitle.get(t)).filter((d):d is MilestoneDraft=>!!d).filter(d=>statusOf(record(p,d))!=='completed');
     if(waiting.length)issues.push('dependencies_incomplete');}
    if(issues.length)fail('MILESTONE_NOT_READY',{issues});
    next.explicit=target;
   }else fail('INVALID_REQUEST');
  }
  next={...next,revision:w.revision+1,updatedAt:at,updatedBy:developer!};
  deps.work.save(p,next);
  return view(p,{role:'developer',name:developer});
 }
 return {view,update,
  /** What a viewer's AiKA may know about progress: their own milestones in full, others' titles and statuses. */
  forAika:(p:Principal,viewer:Viewer)=>view(p,viewer)};
}
export type WorkService=ReturnType<typeof createWorkService>;
