import {ArrowDown,ArrowUp,Plus,Trash2,X} from 'lucide-react';
import type {ReviewItem,ReviewMilestone} from '../../../../contracts/activation/v1/handoff';

/** Review editors shared by Chris's Onboarding Draft and the Champion's Dream Day review. Each item shows where it
 * came from; `viewer` decides whose additions read "Added by you". */
export type Viewer='chris'|'champion';
const ROLES:[string,string][]=[['developer','Developer'],['service_owner','Service owner'],['devops','DevOps / SRE'],['security','Security'],['platform_lead','Platform lead'],['engineering_manager','Engineering manager'],['evaluator','Evaluator'],['champion','Champion (coordination)'],['unassigned','Not decided']];
export const roleName=(role:string)=>ROLES.find(([v])=>v===role)?.[1]??role.replace('_',' ');
export const newId=(p:string)=>`${p}-${Math.random().toString(36).slice(2,10)}`;
export const rowsFor=(t:string,min=2)=>Math.min(14,Math.max(min,Math.ceil(t.length/90)+t.split('\n').length-1));
const id=newId;

export function Origin({item,suggestion,customerLabel='From customer sources',viewer='chris'}:{item:{origin:string;edited?:boolean};suggestion:string;customerLabel?:string;viewer?:Viewer}){
 const label=item.origin==='customer'?customerLabel:item.origin==='ai'?suggestion:item.origin===viewer?'Added by you':item.origin==='chris'?'Added by Chris':'Added by Champion';
 return <span className={'pt-pill '+(item.origin==='customer'?'':item.origin==='ai'?'blue':'green')}>{label}{item.edited&&item.origin!==viewer?' · edited':''}</span>;
}
export const STATUS:Record<string,[string,string]>={verified:['Verified','green'],reported:['Reported',''],unconfirmed:['Unconfirmed','amber']};

/** A list of short texts. Chris can edit, remove and add; editing a generated item marks it as edited. */
export function Items({label,title,hint,items,suggestion,customerLabel,single,viewer='chris',onChange}:{label:string;title:string;hint?:string;items:ReviewItem[];suggestion:string;customerLabel?:string;single?:boolean;viewer?:Viewer;onChange:(x:ReviewItem[])=>void}){
 const edit=(i:number,text:string)=>onChange(items.map((x,j)=>j===i?{...x,text,...(x.origin!==viewer?{edited:true}:{})}:x));
 return <div className="pt-items">
  {title&&<p className="pt-label" style={{marginTop:22}}>{title}</p>}{hint&&<p className="pt-note" style={{marginTop:4}}>{hint}</p>}
  {items.length===0&&<p className="pt-note">None.</p>}
  {items.map((x,i)=><div className="pt-item" key={x.id}>
   <div className="pt-item-meta"><Origin item={x} suggestion={suggestion} customerLabel={customerLabel} viewer={viewer}/>{x.status&&<span className={'pt-pill '+STATUS[x.status][1]}>{STATUS[x.status][0]}</span>}{x.sources?.length?<span className="pt-note" style={{marginTop:0}}>Source: {x.sources.join(', ')}</span>:null}</div>
   <div className="pt-item-row">
    {single?<input className="pt-input" aria-label={`${label} ${i+1}`} value={x.text} maxLength={600} onChange={e=>edit(i,e.target.value)}/>
     :<textarea className="pt-textarea compact" aria-label={`${label} ${i+1}`} rows={rowsFor(x.text)} maxLength={600} value={x.text} onChange={e=>edit(i,e.target.value)}/>}
    <button className="pt-icon" aria-label={`Remove ${label.toLowerCase()} ${i+1}`} onClick={()=>onChange(items.filter((_,j)=>j!==i))}><X size={16}/></button>
   </div>
  </div>)}
  <button className="pt-link" style={{marginTop:12}} onClick={()=>onChange([...items,{id:id('i'),text:'',origin:viewer}])}><Plus size={14} aria-hidden="true"/> Add {label.toLowerCase()}</button>
 </div>;
}

export function Milestones({milestones:ms,people,suggestion,viewer='chris',hint='In the order the team should work. Proposed assignees stay proposals until the Champion approves them.',onChange}:{milestones:ReviewMilestone[];people:string[];suggestion:string;viewer?:Viewer;hint?:string;onChange:(x:ReviewMilestone[])=>void}){
 const edit=(i:number,patch:Partial<ReviewMilestone>)=>onChange(ms.map((m,j)=>j===i?{...m,...patch,...(m.origin!==viewer?{edited:true}:{})}:m));
 const move=(i:number,by:number)=>{const next=[...ms];[next[i],next[i+by]]=[next[i+by],next[i]];onChange(next);};
 const remove=(i:number)=>onChange(ms.filter((_,j)=>j!==i).map(m=>({...m,dependsOn:m.dependsOn.filter(d=>d!==ms[i].id)})));
 return <section className="pt-card" aria-label="Onboarding milestones">
  <h3>Onboarding milestones</h3><p className="pt-note">{hint}</p>
  {ms.length===0&&<p className="pt-note">No milestones yet. Add one, or analyze again with more technical detail.</p>}
  {ms.map((m,i)=><article className="pt-milestone" key={m.id} aria-label={`Milestone ${i+1}`}>
   <div className="pt-milestone-head">
    <strong>Milestone {i+1}</strong><Origin item={m} suggestion={suggestion} viewer={viewer}/>
    <span className="grow"/>
    <button className="pt-tool" aria-label={`Move milestone ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={15}/></button>
    <button className="pt-tool" aria-label={`Move milestone ${i+1} down`} disabled={i===ms.length-1} onClick={()=>move(i,1)}><ArrowDown size={15}/></button>
    <button className="pt-tool" aria-label={`Remove milestone ${i+1}`} onClick={()=>remove(i)}><Trash2 size={15}/></button>
   </div>
   <label className="pt-form-field"><span>Title</span><input className="pt-input" aria-label={`Milestone ${i+1} title`} maxLength={200} value={m.title} onChange={e=>edit(i,{title:e.target.value})}/></label>
   <label className="pt-form-field"><span>Description</span><textarea className="pt-textarea compact" aria-label={`Milestone ${i+1} description`} rows={rowsFor(m.description,3)} maxLength={1200} value={m.description} onChange={e=>edit(i,{description:e.target.value})}/></label>
   <label className="pt-form-field"><span>System</span><input className="pt-input" aria-label={`Milestone ${i+1} system`} maxLength={200} value={m.system} placeholder="e.g. payments-api · northstar/payments" onChange={e=>edit(i,{system:e.target.value})}/></label>
   <label className="pt-form-field"><span>Actions · one per line</span><textarea className="pt-textarea compact" aria-label={`Milestone ${i+1} actions`} rows={Math.max(3,m.actions.length+1)} value={m.actions.join('\n')} onChange={e=>edit(i,{actions:e.target.value.split('\n')})}/></label>
   <label className="pt-form-field"><span>Completion criteria · one per line</span><textarea className="pt-textarea compact" aria-label={`Milestone ${i+1} completion criteria`} rows={Math.max(2,m.completionCriteria.length+1)} value={m.completionCriteria.join('\n')} onChange={e=>edit(i,{completionCriteria:e.target.value.split('\n')})}/></label>
   <div className="pt-form-row two">
    <label className="pt-form-field"><span>Proposed assignee</span><select className="pt-input" aria-label={`Milestone ${i+1} proposed assignee`} value={m.assignee??''} onChange={e=>edit(i,{assignee:e.target.value||null})}>
     <option value="">Not decided</option>{[...new Set([...people,...(m.assignee?[m.assignee]:[])])].map(n=><option key={n} value={n}>{n}{people.includes(n)?'':' (not a technical stakeholder)'}</option>)}</select></label>
    <label className="pt-form-field"><span>Role</span><select className="pt-input" aria-label={`Milestone ${i+1} role`} value={m.role} onChange={e=>edit(i,{role:e.target.value})}>{ROLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   </div>
   {ms.length>1&&<fieldset className="pt-depends"><legend>Depends on</legend>{ms.filter(o=>o.id!==m.id).map(o=><label className="pt-check" key={o.id}>
    <input type="checkbox" checked={m.dependsOn.includes(o.id)} onChange={e=>edit(i,{dependsOn:e.target.checked?[...m.dependsOn,o.id]:m.dependsOn.filter(d=>d!==o.id)})}/>Milestone {ms.indexOf(o)+1}: {o.title||'Untitled'}</label>)}</fieldset>}
  </article>)}
  <button className="pt-btn sm ghost" style={{marginTop:18}} disabled={ms.length>=8} onClick={()=>onChange([...ms,{id:id('chris'),title:'',description:'',system:'',actions:[''],completionCriteria:[''],assignee:null,role:'developer',dependsOn:[],origin:viewer}])}><Plus size={15} aria-hidden="true"/>Add milestone</button>
 </section>;
}

