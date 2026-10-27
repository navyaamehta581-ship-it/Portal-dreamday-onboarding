import {useState} from 'react';
import {Copy,Users} from 'lucide-react';
import type {ActivationState} from '../../../../../contracts/activation/v1/state';
import {championPlan} from '../../activation/champion';

const tone=(status:string)=>status.startsWith('Verified')?'green':status.startsWith('Blocked')?'red':status.startsWith('Requested')?'amber':'';

/** “Bring your team along”: a disposable, evidence-grounded proposal. Not an adoption tracker. */
export function TeamTab({state}:{state:ActivationState}){
 const plan=championPlan(state);
 const [message,setMessage]=useState(plan.message),[copied,setCopied]=useState('');
 return <section className="pt-card" aria-label="Bring Your Team Along">
  <div className="pt-card-head"><h3>Bring your team along</h3><Users size={20} aria-hidden="true"/></div>
  <p className="pt-note">Proposed next steps for your team, based on this plan’s requirements. Roles are suggestions, not assigned people; nothing here shows that anyone has adopted Portal.</p>
  <hr/>
  <p className="pt-label">Suggested roles</p>
  {plan.roles.length?<div className="pt-roles">{plan.roles.map(r=><div className="pt-role" key={r.role}><strong>{r.role}</strong><p>Because: {r.reason}</p></div>)}</div>:<p className="pt-note">No additional role is supported by the current requirements.</p>}
  <hr/>
  <p className="pt-label">Kickoff message</p>
  <p className="pt-note" style={{marginTop:6}}>Edit before sharing. This draft stays on this page; it is not saved or sent.</p>
  <textarea className="pt-textarea" style={{marginTop:12}} aria-label="Champion kickoff message" rows={12} value={message} onChange={e=>{setMessage(e.target.value);setCopied('');}}/>
  <div className="pt-actions"><button className="pt-btn sm ghost" onClick={async()=>{try{await navigator.clipboard.writeText(message);setCopied('Message copied.');}catch{setCopied('Copy unavailable. Select and copy the message above.');}}}><Copy size={15} aria-hidden="true"/>Copy kickoff message</button>{copied&&<span className="pt-note" style={{marginTop:0}} role="status">{copied}</span>}</div>
  <hr/>
  <p className="pt-label">Proposed team milestones</p>
  <ol className="pt-milestones">{plan.milestones.map(m=><li key={m.label}><span className={'pt-pill '+tone(m.status)}>{m.status}</span><div><strong>{m.label}</strong><p>{m.detail}</p></div></li>)}</ol>
 </section>;
}
