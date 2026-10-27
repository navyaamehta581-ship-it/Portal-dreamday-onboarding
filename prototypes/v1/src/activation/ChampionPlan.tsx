import {useState} from 'react';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import {championPlan} from './champion';

export function ChampionPlan({state}:{state:ActivationState}){
 const plan=championPlan(state);
 const [message,setMessage]=useState(plan.message),[copyStatus,setCopyStatus]=useState('');
 return <section className="activation-card" aria-label="Bring Your Team Along"><p className="activation-kicker">After your onboarding decision</p><h2>Bring Your Team Along</h2><p>A lightweight proposed next step for this customer and plan. Suggested roles are not assigned people. Reports and prepared work do not prove adoption.</p>
 <h3>Suggested roles</h3>{plan.roles.length?<ul>{plan.roles.map(r=><li key={r.role}><strong>{r.role}</strong> — requirement: {r.reason}</li>)}</ul>:<p>No additional role is supported by the current requirements.</p>}
 <h3>Champion kickoff message</h3><p>Edit before sharing. This draft is local and is not saved or sent. Refreshing the session regenerates it from current evidence.</p><label className="activation-field">Kickoff message<textarea aria-label="Champion kickoff message" rows={12} value={message} onChange={e=>{setMessage(e.target.value);setCopyStatus('');}}/></label><button className="activation-button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(message);setCopyStatus('Message copied.');}catch{setCopyStatus('Copy unavailable. Select and copy the message above.');}}}>Copy kickoff message</button>{copyStatus&&<p role="status">{copyStatus}</p>}
 <h3>Proposed team milestones</h3><ol>{plan.milestones.map(m=><li key={m.label}><strong>{m.label}</strong> · {m.status}<p>{m.detail}</p></li>)}</ol><p>No adoption tracking or stakeholder assignments are created.</p></section>;
}
export function ChampionSummary({state}:{state:ActivationState}){
 const plan=championPlan(state);
 return <div aria-label="Chris team handoff summary"><hr className="activation-divider"/><h3>Team handoff · proposed</h3><p>{plan.verified?'First technical milestone verified; team adoption unverified.':plan.blocked?'First developer outcome blocked or awaiting replanning.':'First developer outcome not verified.'}</p><p>{plan.work}</p><p>Suggested roles: {plan.roles.map(r=>r.role).join(', ')||'None supported yet'}.</p><p>{plan.issues.length} unresolved requirement(s). Technical review and repeat onboarding remain proposed. Chris follow-up: {state.chrisHelp.status==='requested'?'requested, not completed':'proposed, not achieved'}.</p></div>;
}
