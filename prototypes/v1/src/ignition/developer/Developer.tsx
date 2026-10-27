import {useState} from 'react';
import {BookOpenText,Check,ChevronDown,ChevronUp,Clock3} from 'lucide-react';
import {navigate} from '../../portal-app/router';
import {routeBase} from '../api';
import type {IgnitionSession} from '../useIgnition';
import {Dialog} from '../shared';
import {stepsFor,type Step} from './steps';

/** Portal home (011/036) with the personalized Northstar setup checklist (023 accordion rows). */
export function DeveloperHome({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person);
 const steps=stepsFor(state.person,base),statuses=steps.map(s=>s.status(state));
 const done=statuses.filter(s=>s.done).length,current=statuses.findIndex(s=>!s.done);
 const [open,setOpen]=useState<string|null>(null),[enabling,setEnabling]=useState(false);
 const expanded=open??(current>=0?steps[current].id:null);
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  {state.handoff&&current<0&&<div className="pt-done-banner"><span aria-hidden="true" style={{fontSize:28}}>🎉</span><h3>You’re all done!</h3><p>Your Northstar onboarding is complete. Keep exploring the Catalog and Docs.</p><button className="pt-btn" onClick={()=>navigate(base+'/catalog')}>Go to Catalog</button></div>}
  <section className="pt-guide" aria-label="Your onboarding">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Get started with Northstar Engineering</h2></div>
   <div className="pt-progress" aria-hidden="true"><span style={{width:`${done/steps.length*100}%`}}/></div>
   <div className="pt-guide-meta"><span>{done} of {steps.length} completed</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>Around {steps.length*5} mins</span></div>
   {state.preferences.goal&&<p style={{marginTop:14,color:'#cfcfcf'}}>Team goal: {state.preferences.goal}</p>}
   {!state.handoff?<div className="pt-acc"><div className="pt-acc-row"><div className="pt-acc-head"><span className="icon">1</span><span className="title">Your onboarding is being prepared<small>Your steps appear here once Northstar’s onboarding goal is approved.</small></span></div></div></div>
   :<ol className="pt-acc" aria-label="Onboarding steps" style={{listStyle:'none',padding:0}}>{steps.map((step,i)=><Row key={step.id} step={step} index={i} status={statuses[i]} expanded={expanded===step.id} toggle={()=>setOpen(expanded===step.id?'':step.id)} session={session} onEnable={()=>setEnabling(true)}/>)}</ol>}
  </section>
  {enabling&&<Dialog title="Enable TechDocs" onClose={()=>setEnabling(false)} footer={<><button className="pt-link" style={{color:'#9a9a9a'}} onClick={()=>setEnabling(false)}>Dismiss</button><button className="pt-btn sm" disabled={session.busy} onClick={async()=>{if(await session.save({action:'step',step:'docs-enable'}))setEnabling(false);}}>Enable</button></>}>
   <p>This will add TechDocs for payments-api to your Portal instance. Would you like to continue?</p><p><span className="pt-tag sim">Simulated</span> No Portal configuration is changed.</p>
  </Dialog>}
 </div>;
}

function Row({step,index,status,expanded,toggle,session,onEnable}:{step:Step;index:number;status:ReturnType<Step['status']>;expanded:boolean;toggle:()=>void;session:IgnitionSession;onEnable:()=>void}){
 const state=session.state!,priority=step.teamPriority?.(state);
 const blocked=step.id==='register'&&!state.steps?.[state.person]?.prepare;
 const sub=status.stale?`${status.evidence} · revalidate against handoff v${state.handoff!.version}`:status.done?status.evidence:priority?'Team priority':blocked?'Prepare the service first':null;
 return <li className={'pt-acc-row'+(status.done?' done':'')}>
  <div className="pt-acc-head">
   <button className="pt-acc-toggle" aria-expanded={expanded} onClick={toggle}>
    <span className="icon" aria-label={status.done?'Completed':`Step ${index+1}`}>{status.done?<Check size={20} strokeWidth={2.6}/>:index+1}</span>
    <span className="title">{step.title}{sub&&<small>{sub}</small>}</span>
   </button>
   {status.done&&!status.stale&&step.doneAction&&<button className="pt-btn sm" onClick={()=>navigate(step.doneAction!.to)}>{step.doneAction.label}</button>}
   <button className="chev" aria-label={expanded?'Collapse step':'Expand step'} onClick={toggle}>{expanded?<ChevronUp size={22}/>:<ChevronDown size={22}/>}</button>
  </div>
  {expanded&&<div className="pt-acc-body">
   {step.body.map(p=><p key={p}>{p}</p>)}
   {step.id==='goal'&&state.handoff&&<ul>{state.handoff.briefing.split('\n').filter(Boolean).slice(0,4).map((l,i)=><li key={i}>{l.replace(/^\[[^\]]*\]\s*/,'')}</li>)}</ul>}
   {step.prerequisites&&<ul>{step.prerequisites.map(p=><li key={p}>{p}</li>)}</ul>}
   {session.error&&<p className="meta" role="alert" style={{color:'#ff9f95'}}>{session.error}</p>}
   {!status.done||status.stale?<div className="pt-actions">
    {step.action.kind==='record'&&<button className="pt-btn sm gray" disabled={session.busy} onClick={()=>void session.save({action:'step',step:step.id})}>{step.action.label}</button>}
    {step.action.kind==='enable'&&<button className="pt-btn sm gray" disabled={session.busy} onClick={onEnable}>{step.action.label}</button>}
    {step.action.kind==='route'&&<button className="pt-btn sm" disabled={blocked} onClick={()=>navigate((step.action as {to:string}).to)}>{step.action.label}</button>}
    {'sim' in step.action&&step.action.sim&&<span className="pt-tag sim">Simulated check</span>}
   </div>:<p className="meta">{status.evidence}</p>}
  </div>}
 </li>;
}
