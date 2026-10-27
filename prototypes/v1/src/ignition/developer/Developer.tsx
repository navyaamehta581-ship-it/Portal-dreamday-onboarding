import {useState} from 'react';
import {BookOpenText,Check,Clock3,Lock,Users} from 'lucide-react';
import {navigate} from '../../portal-app/router';
import {needsRevalidation,routeBase,type IgnitionState} from '../api';
import type {IgnitionSession} from '../useIgnition';
import {HandoffLines} from '../shared';

const order=(state:IgnitionState)=>Object.keys(state.workflows).sort((a,b)=>a===state.preferences.priority?-1:b===state.preferences.priority?1:0);

/** Developer home: "Welcome to Portal" setup guide (011, 036) driven by the approved handoff. */
export function DeveloperHome({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person),mine=state.progress[state.person]??{};
 const ids=order(state),done=ids.filter(id=>mine[id]).length,next=ids.find(id=>!mine[id]||needsRevalidation(mine[id],state));
 return <div className="pt-home">
  <h1>Welcome to Portal</h1>
  <section className="pt-guide" aria-label="Your onboarding">
   <div className="pt-guide-head"><span className="icon"><BookOpenText size={20} aria-hidden="true"/></span><h2>Get started with Northstar Engineering</h2></div>
   <div className="pt-progress" aria-hidden="true"><span style={{width:`${state.handoff?done/ids.length*100:0}%`}}/></div>
   <div className="pt-guide-meta"><span>{done} of {ids.length} completed</span><span className="pt-chip"><Clock3 size={15} aria-hidden="true"/>{state.handoff?`Around 10 mins · handoff v${state.handoff.version}`:'Waiting for your handoff'}</span></div>
   {!state.handoff?<>
    <div className="pt-step"><h3>Your onboarding is being prepared.</h3><p>Your workflows appear here once your organization’s context is approved. Nothing to do yet.</p></div>
    <div className="pt-rows">{ids.map(id=><div className="pt-row locked" key={id}><Lock size={18} aria-hidden="true"/>&nbsp;Approve your organization’s context to unlock “{state.workflows[id].title}”</div>)}</div>
   </>:<>
    {next?<div className="pt-step"><h3>{done===0?'First up':'Next up'}: {state.workflows[next].title.charAt(0).toLowerCase()+state.workflows[next].title.slice(1)}.</h3>
      <p>{state.preferences.goal?`Team goal: ${state.preferences.goal}`:`Prerequisite: ${state.workflows[next].prerequisite}.`}</p>
      <button className="pt-btn" onClick={()=>navigate(`${base}/workflow/${next}`)}>{mine[next]?'Revalidate workflow':'Start workflow'}</button></div>
     :<div className="pt-step"><h3>You’re all done!</h3><p>Both workflows are verified in simulation against handoff v{state.handoff.version}.</p><button className="pt-btn" onClick={()=>navigate(base+'/insights')}>View your progress</button></div>}
    <div className="pt-rows">{ids.map(id=>{const o=mine[id],stale=needsRevalidation(o,state);return <div className="pt-row" key={id}>
     <span className="check" aria-label={o&&!stale?'Verified':'Not verified'}>{o&&!stale&&<Check size={20} strokeWidth={2.6}/>}</span>
     <span className="label">{state.workflows[id].title}<small>{stale?`Verified on handoff v${o!.handoffVersion} · revalidate against v${state.handoff!.version}`:o?`Verified in simulation · handoff v${o.handoffVersion}`:id===state.preferences.priority?'Recommended first':'Ready when you are'}</small></span>
     <button className="pt-btn" onClick={()=>navigate(`${base}/workflow/${id}`)}>{o&&!stale?'Review':'Go to workflow'}</button></div>;})}</div>
   </>}
  </section>
  {state.handoff&&<div className="pt-grid" style={{marginTop:34}}>
   <section className="pt-card" aria-label="Your team’s agreed starting point"><h3>Your organization’s goal</h3><p className="pt-label" style={{marginTop:20}}>Agreed context · handoff v{state.handoff.version}</p><HandoffLines text={state.handoff.briefing}/></section>
   <section className="pt-card" aria-label="Known uncertainties"><h3>Still unverified</h3><p className="pt-label" style={{marginTop:20}}>Known uncertainties and conflicts</p><HandoffLines text={state.handoff.uncertainties}/>
    {state.preferences.goal&&<><hr/><p className="pt-label"><Users size={12} aria-hidden="true"/> Team goal from Maya</p><p style={{marginTop:8}}>{state.preferences.goal}</p></>}</section>
  </div>}
 </div>;
}

/** One guided workflow in the setup-step layout (012, 014, 018) with a catalog-table fixture (045). */
export function WorkflowPage({session,id}:{session:IgnitionSession;id:string}){
 const state=session.state!,base=routeBase(session.person),w=state.workflows[id];
 const [answer,setAnswer]=useState(''),[shown,setShown]=useState(false);
 if(!w)return <div className="pt-empty"><div><h2>Workflow not found</h2></div></div>;
 if(!state.handoff)return <div className="pt-empty"><div><h2>Your onboarding is being prepared</h2><p>This workflow unlocks once your organization’s context is approved.</p></div></div>;
 const ids=order(state),index=ids.indexOf(id),o=state.progress[state.person]?.[id],stale=needsRevalidation(o,state);
 const question=id==='ownership'?'Which team owns payments-api?':'What is the runbook heading?';
 return <div className="pt-page" style={{paddingTop:40}}><div className="pt-stepper">
  <div className="pt-stepbar" aria-hidden="true"><span style={{width:`${(index+(o&&!stale?1:.5))/ids.length*100}%`}}/></div>
  <p className="step-of">Workflow {index+1} of {ids.length}{id===state.preferences.priority?' · Recommended first':''}</p>
  <h2>{w.title}</h2>
  <p className="lede">Prerequisite: {w.prerequisite}. GitHub access is reported, not verified; Okta is unverified and not needed here.</p>
  <div className="pt-tablebox"><table className="pt-table"><thead><tr><th style={{width:60}}>Step</th><th>What to do</th></tr></thead>
   <tbody>{w.steps.map((s,i)=><tr key={s}><td>{i+1}</td><td>{s}</td></tr>)}</tbody></table></div>
  <div className="pt-actions" style={{justifyContent:'space-between'}}><span className="pt-tag sim">Simulated {id==='ownership'?'catalog':'documentation'}</span>
   <button className="pt-btn outline" aria-expanded={shown} onClick={()=>setShown(!shown)}>{shown?'Hide':'Open'} {id==='ownership'?'catalog entry':'documentation'}</button></div>
  {shown&&(id==='ownership'?<div className="pt-tablebox" aria-label="Catalog entry"><table className="pt-table"><thead><tr><th>Name</th><th>System</th><th>Owner</th><th>Type</th><th>Lifecycle</th></tr></thead>
    <tbody><tr><td>payments-api</td><td>payments</td><td><code>spec.owner: team-payments</code></td><td>service</td><td>production</td></tr></tbody></table><p className="foot">1 component · GitHub · catalog fixture</p></div>
   :<section className="pt-tablebox" aria-label="Documentation" style={{padding:'20px 26px'}}><p className="pt-crumb">payments-api · Documentation</p><h3 style={{fontSize:24,marginTop:8}}>Payments recovery</h3>
    <p style={{marginTop:10,lineHeight:1.6}}>Check payment queue health, review failed transactions, and contact team-payments before replaying requests.</p></section>)}
  <div className="pt-formfield"><label htmlFor="wf-answer">{question}</label><input id="wf-answer" className="pt-input" aria-label={question} maxLength={200} value={answer} onChange={e=>setAnswer(e.target.value)}/>
   <span className="help">The answer is checked against the fixture. It doesn’t establish real repository access.</span></div>
  {session.error&&<div className="pt-banner error" role="alert">{session.error}</div>}
  <div className="pt-actions" style={{justifyContent:'flex-end'}}><button className="pt-btn outline" onClick={()=>navigate(base)}>Back</button>
   <button className="pt-btn sm" disabled={session.busy||!answer.trim()} onClick={()=>void session.save({action:'verify',workflow:id,answer:answer.trim()})}>Verify outcome</button></div>
  {o&&<div className={'pt-banner'+(stale?' warn':'')} role="status"><span><span className="pt-ok">✓</span> {o.status} · handoff v{o.handoffVersion} · {new Date(o.at).toLocaleString()}{stale&&` — your handoff is now v${state.handoff.version}; verify again to revalidate.`}</span></div>}
 </div></div>;
}
