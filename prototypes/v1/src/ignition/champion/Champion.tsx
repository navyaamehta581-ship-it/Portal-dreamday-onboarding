import {useState} from 'react';
import {BookOpenText,Check,Clock3} from 'lucide-react';
import {navigate} from '../../portal-app/router';
import {routeBase} from '../api';
import type {IgnitionSession} from '../useIgnition';
import {HandoffLines} from '../shared';

const TEAM=[['alex','Alex'],['jordan','Jordan']] as const;

/** Maya's Portal home (011): a short team checklist pointing into Insights › Team Activation. */
export function ChampionHome({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person),ids=Object.keys(state.workflows);
 const verified=Object.values(state.progress).filter(p=>ids.every(w=>p?.[w])).length;
 const rows:[string,string,boolean,string][]=[
  ['Review Northstar’s approved goals',state.handoff?`Handoff v${state.handoff.version}`:'Waiting for approval',false,base],
  ['Choose your team’s first workflow',`Optional · ${state.workflows[state.preferences.priority].title}`,false,base],
  ['Invite developers',`Optional · ${state.preferences.invites.length} invited`,state.preferences.invites.length>0,base],
  ['Follow your team’s progress',`${verified} of ${TEAM.length} developers completed onboarding`,verified===TEAM.length,base+'/adoption']];
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  <section className="pt-guide" aria-label="Team activation">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Activate your team</h2></div>
   <div className="pt-progress" aria-hidden="true"><span style={{width:`${rows.filter(r=>r[2]).length/rows.length*100}%`}}/></div>
   <div className="pt-guide-meta"><span>{rows.filter(r=>r[2]).length} of {rows.length} completed</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>Around 5 mins</span></div>
   <ol className="pt-acc" style={{listStyle:'none',padding:0}}>{rows.map(([title,sub,done,to],i)=><li key={title} className={'pt-acc-row'+(done?' done':'')}><div className="pt-acc-head">
    <div className="pt-acc-toggle" style={{cursor:'default'}}><span className="icon">{done?<Check size={20} strokeWidth={2.6}/>:i+1}</span><span className="title">{title}<small>{sub}</small></span></div>
    <button className="pt-btn sm" onClick={()=>navigate(to)}>{i===3?'Go to Insights':'Go to Team Activation'}</button></div></li>)}</ol>
  </section>
 </div>;
}

/** Insights › Team Activation: optional priorities, team goal and simulated invitations. */
export function TeamActivation({session}:{session:IgnitionSession}){
 const state=session.state!;
 const [priority,setPriority]=useState(state.preferences.priority),[goal,setGoal]=useState(state.preferences.goal),[invites,setInvites]=useState<string[]>(state.preferences.invites),[saved,setSaved]=useState(false);
 const edit=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setSaved(false);};
 if(!state.handoff)return <section className="pt-section"><h3>Waiting for Northstar’s approved goals</h3><p className="pt-note">Your developers can start as soon as the goals are approved.</p></section>;
 return <>
  <div className="pt-cols">
   <section className="pt-section" aria-label="Approved goals"><h3>Approved goals</h3><p className="pt-label" style={{marginTop:14}}>Handoff v{state.handoff.version}</p><HandoffLines text={state.handoff.briefing}/></section>
   <section className="pt-section" aria-label="Known uncertainties"><h3>Still unverified</h3><HandoffLines text={state.handoff.uncertainties}/></section>
  </div>
  <section className="pt-section" aria-label="Recommended workflows">
   <h3>Recommended workflows <span className="pt-pill" style={{marginLeft:8}}>Optional</span></h3>
   <p className="pt-note">Choose which workflow your developers see first. They can start without this.</p>
   <table className="pt-table" aria-label="First workflow"><thead><tr><th style={{width:70}}>First</th><th>Workflow</th><th>Prerequisite</th><th>Completed</th></tr></thead>
    <tbody>{Object.entries(state.workflows).map(([id,w])=><tr key={id}><td><input type="radio" name="priority" aria-label={`Make “${w.title}” first`} checked={priority===id} onChange={()=>edit(setPriority)(id)} style={{accentColor:'var(--p-green)',width:18,height:18}}/></td><td>{w.title}</td><td>{w.prerequisite}</td><td>{Object.values(state.progress).filter(p=>p?.[id]).length} of {TEAM.length}</td></tr>)}</tbody></table>
   <div className="pt-formfield"><label htmlFor="team-goal">Team goal <span style={{fontWeight:500,color:'var(--p-subtle)'}}>· optional</span></label><input id="team-goal" className="pt-input" aria-label="Optional team goal" maxLength={500} value={goal} onChange={e=>edit(setGoal)(e.target.value)} placeholder="e.g. Both developers find an owner and a runbook this week"/></div>
  </section>
  <section className="pt-section" aria-label="Invite developers">
   <h3>Invite developers</h3>
   <table className="pt-table"><thead><tr><th style={{width:70}}>Invite</th><th>Developer</th><th>Email</th><th>Status</th></tr></thead>
    <tbody>{TEAM.map(([id,name])=><tr key={id}><td><input type="checkbox" aria-label={name} checked={invites.includes(id)} onChange={e=>edit(setInvites)(e.target.checked?[...invites,id]:invites.filter(x=>x!==id))} style={{accentColor:'var(--p-green)',width:18,height:18}}/></td><td>{name}</td><td>{id}@northstar.example</td><td>{state.preferences.invites.includes(id)?<span className="pt-tag sim">Invitation prepared · simulated</span>:<span style={{color:'var(--p-subtle)'}}>Not invited</span>}</td></tr>)}</tbody></table>
   {session.error&&<div className="pt-banner error" role="alert">{session.error}{session.conflict&&<> <button className="pt-link" onClick={()=>void session.refresh()}>Refresh</button></>}</div>}
   <div className="pt-actions"><button className="pt-btn sm" disabled={session.busy} onClick={async()=>setSaved(await session.save({action:'preferences',priority,goal,invites}))}>Save</button><span className="pt-note" style={{marginTop:0}}>Invitations are simulated. No email is sent.</span></div>
   {saved&&<p className="pt-note" role="status">Preferences saved. {invites.length} invitation(s) prepared.</p>}
  </section>
 </>;
}
