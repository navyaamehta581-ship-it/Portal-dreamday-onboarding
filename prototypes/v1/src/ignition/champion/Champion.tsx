import {useState} from 'react';
import type {IgnitionSession} from '../useIgnition';
import {EntityHead,HandoffLines} from '../shared';

const TEAM=[['alex','Alex'],['jordan','Jordan']] as const;

/** Maya's optional Team Activation. Prefilled from Chris's approved handoff; no discovery questionnaire. */
export function Champion({session}:{session:IgnitionSession}){
 const state=session.state!;
 const [priority,setPriority]=useState(state.preferences.priority),[goal,setGoal]=useState(state.preferences.goal),[invites,setInvites]=useState<string[]>(state.preferences.invites),[saved,setSaved]=useState(false);
 const edit=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setSaved(false);};
 return <div className="pt-entity" style={{paddingTop:26}}>
  <EntityHead crumb="Team activation — Northstar Engineering" title="Bring your team to its first workflow" meta={[['Handoff',state.handoff?`v${state.handoff.version}`:'Not approved'],['Participation',<span className="pt-pill">Optional</span>]]}/>
  {!state.handoff?<section className="pt-card" style={{marginTop:30}}><h3>Waiting for the approved customer context</h3><p className="pt-note">Chris approves the handoff first. Your developers can start as soon as it’s approved — this page stays optional.</p></section>:<>
   <div className="pt-grid" style={{marginTop:30}}>
    <section className="pt-card" aria-label="Your team’s agreed starting point"><h3>Approved customer goals</h3><p className="pt-label" style={{marginTop:20}}>From handoff v{state.handoff.version}</p><HandoffLines text={state.handoff.briefing}/></section>
    <section className="pt-card" aria-label="Known uncertainties"><h3>Still unverified</h3><p className="pt-label" style={{marginTop:20}}>Known uncertainties and conflicts</p><HandoffLines text={state.handoff.uncertainties}/></section>
   </div>
   <section className="pt-card" style={{marginTop:26}} aria-label="Team Activation">
    <div className="pt-card-head"><h3>Recommended workflows</h3><span className="pt-pill">Prefilled from Chris</span></div>
    <p className="pt-note">Choose which workflow your developers see first. Developers can start without this step.</p>
    <div className="pt-tablebox"><table className="pt-table" aria-label="First workflow"><thead><tr><th style={{width:70}}>First</th><th>Workflow</th><th>Prerequisite</th><th>Verified</th></tr></thead>
     <tbody>{Object.entries(state.workflows).map(([id,w])=><tr key={id}><td><input type="radio" name="priority" aria-label={`Make “${w.title}” first`} checked={priority===id} onChange={()=>edit(setPriority)(id)} style={{accentColor:'var(--p-green)',width:18,height:18}}/></td><td>{w.title}</td><td>{w.prerequisite}</td><td>{Object.values(state.progress).filter(p=>p?.[id]).length} of {TEAM.length}</td></tr>)}</tbody></table></div>
    <div className="pt-formfield"><label htmlFor="team-goal">Optional team goal</label><input id="team-goal" className="pt-input" aria-label="Optional team goal" maxLength={500} value={goal} onChange={e=>edit(setGoal)(e.target.value)} placeholder="e.g. Both developers find an owner and a runbook this week"/><span className="help">Shown to your developers. It never replaces the approved customer goals.</span></div>
    <div className="pt-formfield"><span className="lbl">Invite developers</span>
     <div className="pt-tablebox" style={{marginTop:0}}><table className="pt-table"><thead><tr><th style={{width:70}}>Invite</th><th>Developer</th><th>Account</th><th>Status</th></tr></thead>
      <tbody>{TEAM.map(([id,name])=><tr key={id}><td><input type="checkbox" aria-label={name} checked={invites.includes(id)} onChange={e=>edit(setInvites)(e.target.checked?[...invites,id]:invites.filter(x=>x!==id))} style={{accentColor:'var(--p-green)',width:18,height:18}}/></td><td>{name}</td><td>{id}@northstar.example</td><td>{state.preferences.invites.includes(id)?<span className="pt-tag sim">Simulated invitation prepared</span>:<span style={{color:'var(--p-subtle)'}}>Not invited</span>}</td></tr>)}</tbody></table></div></div>
    {session.error&&<div className="pt-banner error" role="alert">{session.error}{session.conflict&&<> <button className="pt-link" onClick={()=>void session.refresh()}>Refresh</button></>}</div>}
    <div className="pt-actions"><button className="pt-btn sm" disabled={session.busy} onClick={async()=>setSaved(await session.save({action:'preferences',priority,goal,invites}))}>Save team preferences</button><span className="pt-tag sim">Invitations are simulated · no email is sent</span></div>
    {saved&&<p className="pt-note" role="status">Preferences saved. {invites.length} simulated invitation(s) prepared; no email sent.</p>}
   </section>
  </>}
 </div>;
}
