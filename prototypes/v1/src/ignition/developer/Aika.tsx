import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Copy,Maximize2,Minimize2,Minus,Play,Triangle} from 'lucide-react';
import type {IgnitionState} from '../api';

type Message={from:'user'|'ai';text:string[];draft?:boolean};
const SCRIPTED='Scripted response · no AI model or external service is used.';

/** Contextual AiKA (references 055, 065/066): docked bottom-right, receives only this developer's permitted context. */
export function Aika({state,workflowId}:{state:IgnitionState;workflowId:string|null}){
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState('');
 const [supportOpen,setSupportOpen]=useState(false),[issue,setIssue]=useState(''),[draft,setDraft]=useState(''),[copied,setCopied]=useState('');
 const body=useRef<HTMLDivElement>(null);
 const workflow=workflowId?state.workflows[workflowId]:null,version=state.handoff?.version;
 useEffect(()=>{body.current?.scrollTo?.({top:body.current.scrollHeight});},[messages,supportOpen,draft]);
 // A new page context starts a new chat, like opening AiKA from a different page.
 useEffect(()=>{setMessages([]);setSupportOpen(false);setDraft('');setIssue('');},[workflowId]);

 function answer(q:string):string[]{
  const s=q.toLowerCase();
  if(/support|blocked|stuck|access|denied|permission/.test(s))return ['If something outside these steps is blocking you, I can prepare a technical support draft for you to send yourself. It includes this workflow and handoff version, but no raw customer notes or secrets.'];
  if(/okta|sso|login|identity/.test(s))return ['Okta readiness is still unverified for Northstar — the notes conflict. It does not block these read-only workflows. Don’t assume SSO is configured.',...(state.handoff?['From your approved handoff:',...state.handoff.uncertainties.split('\n').filter(l=>/okta/i.test(l)).slice(0,2)]:[])];
  if(/owner|ownership|catalog|spec/.test(s)||workflowId==='ownership'&&/how|where|step|explain|summar/.test(s))return ['To find the owner of payments-api, open its catalog entry and read `spec.owner`. The value is a team reference — follow it to the owning team.','Then enter that team name to verify the outcome.'];
  if(/runbook|doc|incident|recover/.test(s)||workflowId==='docs'&&/how|where|step|explain|summar/.test(s))return ['Open the payments-api documentation and look for the incident runbook. Its heading is what you enter to verify the outcome.'];
  if(/first|start|summar|what should/.test(s)){const first=state.workflows[state.preferences.priority];return [`Your team’s first workflow is “${first.title}”.`,`Prerequisite: ${first.prerequisite}.`,...(state.preferences.goal?[`Team goal from Maya: ${state.preferences.goal}`]:[])];}
  return ['I can only help with your approved Northstar onboarding context: finding service ownership, finding the runbook, and what is still unverified. For anything else, ask your team or prepare a support draft.'];
 }
 function ask(q:string){if(!q.trim())return;setMessages(m=>[...m,{from:'user',text:[q.trim()]},{from:'ai',text:answer(q)}]);setText('');if(/support|blocked|stuck|access|denied|permission/i.test(q))setSupportOpen(true);}
 const suggestions=workflow?[`Explain “${workflow.title}”`,'What is still unverified?','I’m blocked — prepare a support draft']:['What should I do first?','What is still unverified?','I’m blocked — prepare a support draft'];

 if(!open)return <button className="pt-aika-launch" aria-label="Open AiKA" onClick={()=>setOpen(true)}><Triangle size={20} strokeWidth={2.6}/></button>;
 return <aside className={'pt-aika'+(expanded?' expanded':'')} aria-label="Contextual AiKA">
  <div className="pt-aika-head"><span className="icon"><Triangle size={15} strokeWidth={2.6} aria-hidden="true"/></span><strong>New AiKA Chat</strong>
   <div className="ctl"><button aria-label={expanded?'Restore AiKA size':'Expand AiKA'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button><button aria-label="Minimize AiKA" onClick={()=>setOpen(false)}><Minus size={16}/></button></div></div>
  <div className="pt-aika-body" ref={body}>
   <p className="pt-note" style={{marginTop:0}}>Context: payments-api{workflow?` · ${workflow.title}`:' · onboarding'} · handoff v{version??'—'}</p>
   {messages.map((m,i)=>m.from==='user'?<div className="msg-user" key={i}>{m.text[0]}</div>:<div className="msg-ai" key={i}>{m.text.map((t,j)=><p key={j}>{t}</p>)}<p><span className="pt-tag sim">Scripted response</span></p></div>)}
   {supportOpen&&<div className="msg-ai" aria-label="Technical support draft">
    <label className="pt-formfield" style={{marginTop:6}}><span className="lbl">What blocked you?</span><textarea className="pt-textarea filled" aria-label="What blocked you?" rows={3} maxLength={1000} value={issue} onChange={e=>{setIssue(e.target.value);setDraft('');}}/></label>
    <div className="pt-actions" style={{marginTop:10}}><button className="pt-btn sm" disabled={!issue.trim()} onClick={()=>{setDraft(`Technical support request (draft)\nDeveloper: ${state.person}\nService: payments-api\nWorkflow: ${workflow?.title??'onboarding'}\nHandoff: v${version??'—'}\nIssue: ${issue.trim()}\nNo secrets or raw customer notes included.`);setCopied('');}}>Prepare support draft</button></div>
    {draft&&<><pre className="pt-code" aria-label="Support draft">{draft}</pre>
     <div className="pt-actions" style={{marginTop:8}}><button className="pt-btn sm outline" onClick={async()=>{try{await navigator.clipboard.writeText(draft);setCopied('Copied.');}catch{setCopied('Copy unavailable — select the text above.');}}}><Copy size={14} aria-hidden="true"/>Copy draft</button><span className="pt-tag sim">Not sent</span>{copied&&<span className="pt-note" style={{marginTop:0}} role="status">{copied}</span>}</div>
     <p className="pt-note">Send it to your support channel yourself. Support can involve Chris for account decisions after triage.</p></>}
   </div>}
  </div>
  {messages.length===0&&!supportOpen&&<div className="pt-aika-suggest">{suggestions.map(s=><button key={s} onClick={()=>ask(s)}><ArrowRight size={15} aria-hidden="true"/>{s}</button>)}</div>}
  <form className="pt-aika-compose" onSubmit={e=>{e.preventDefault();ask(text);}}>
   <textarea aria-label="Ask AiKA" placeholder="Type your question…" rows={1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(text);}}}/>
   <div className="bar"><span className="pt-note" style={{marginTop:0,fontSize:12}}>{SCRIPTED}</span><button className="pt-send" type="submit" aria-label="Send to AiKA" disabled={!text.trim()} style={{marginLeft:'auto'}}><Play size={16}/></button></div>
  </form>
 </aside>;
}
