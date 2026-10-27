import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,Copy,History,Maximize2,Minimize2,Minus,Play} from 'lucide-react';
import type {IgnitionState} from '../api';
import {BLOCKED,aikaAnswer,supportDraft} from '../aika';

/** AiKA mark as seen in the Portal corner (070, 075): outlined triangle with an inner circle. */
export function AikaMark({size=24,filled=false}:{size?:number;filled?:boolean}){
 return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="14.2" r="2.6" fill="none" stroke={filled?'#101010':'currentColor'} strokeWidth="1.8"/></svg>;
}

type Message={from:'user'|'ai';text:string[]};
function useChat(state:IgnitionState,context:string|null){
 const [messages,setMessages]=useState<Message[]>([]),[support,setSupport]=useState(false);
 useEffect(()=>{setMessages([]);setSupport(false);},[context]);
 function ask(q:string){if(!q.trim())return;setMessages(m=>[...m,{from:'user',text:[q.trim()]},{from:'ai',text:aikaAnswer(state,q,context)}]);if(BLOCKED.test(q))setSupport(true);}
 return {messages,ask,support,reset:()=>{setMessages([]);setSupport(false);}};
}

function Conversation({state,messages,support,step}:{state:IgnitionState;messages:Message[];support:boolean;step:string}){
 const [issue,setIssue]=useState(''),[draft,setDraft]=useState(''),[copied,setCopied]=useState('');
 return <>
  {messages.map((m,i)=>m.from==='user'?<div className="msg-user" key={i}>{m.text[0]}</div>:<div className="msg-ai" key={i}>{m.text.map((t,j)=><p key={j}>{t}</p>)}<p><span className="pt-tag sim">Scripted response</span></p></div>)}
  {support&&<div className="msg-ai" aria-label="Technical support request">
   <label className="pt-formfield" style={{marginTop:6}}><span className="lbl">What’s blocking you?</span><textarea className="pt-textarea filled" aria-label="What blocked you?" rows={3} maxLength={1000} value={issue} onChange={e=>{setIssue(e.target.value);setDraft('');}}/></label>
   <div className="pt-actions" style={{marginTop:10}}><button className="pt-btn sm" disabled={!issue.trim()} onClick={()=>{setDraft(supportDraft(state,step,issue));setCopied('');}}>Prepare support request</button></div>
   {draft&&<><pre className="pt-code" aria-label="Support draft">{draft}</pre>
    <div className="pt-actions" style={{marginTop:8}}><button className="pt-btn sm outline" onClick={async()=>{try{await navigator.clipboard.writeText(draft);setCopied('Copied.');}catch{setCopied('Copy unavailable — select the text above.');}}}><Copy size={14} aria-hidden="true"/>Copy</button><span className="pt-tag sim">Not sent</span>{copied&&<span className="pt-note" style={{marginTop:0}} role="status">{copied}</span>}</div></>}
  </div>}
 </>;
}

/** Contextual AiKA docked in the bottom-right of the content area (055, 065/066). */
export function AikaDock({state,context,step}:{state:IgnitionState;context:string|null;step:string}){
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[text,setText]=useState(''),[menu,setMenu]=useState(false);
 const chat=useChat(state,context),body=useRef<HTMLDivElement>(null);
 useEffect(()=>{body.current?.scrollTo?.({top:body.current.scrollHeight});},[chat.messages,chat.support]);
 const suggestions=context==='owner'?['Explain this page','How do I find the owner?','I’m blocked — prepare a support request']:context==='docs'?['Summarize this page','Explain this document to me','I’m blocked — prepare a support request']:context==='setup'?['Explain this step','What goes into catalog-info.yaml?','I’m blocked — prepare a support request']:['What should I do first?','What is still unverified?','I’m blocked — prepare a support request'];
 if(!open)return <button className="pt-aika-launch" aria-label="Open AiKA" onClick={()=>setOpen(true)}><AikaMark size={34}/></button>;
 return <aside className={'pt-aika'+(expanded?' expanded':'')} aria-label="Contextual AiKA">
  <div className="pt-aika-head"><span className="icon"><AikaMark size={16} filled/></span>
   <button style={{display:'flex',alignItems:'center',gap:6}} aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}><strong>New AiKA Chat</strong><ChevronDown size={15}/></button>
   {menu&&<div className="pt-menu" role="menu" style={{left:50,right:'auto',top:52}}><button role="menuitem" onClick={()=>{chat.reset();setMenu(false);}}>New chat</button></div>}
   <div className="ctl"><button aria-label={expanded?'Restore AiKA size':'Expand AiKA'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button><button aria-label="Minimize AiKA" onClick={()=>setOpen(false)}><Minus size={16}/></button></div></div>
  <div className="pt-aika-body" ref={body}><Conversation state={state} messages={chat.messages} support={chat.support} step={step}/></div>
  {chat.messages.length===0&&<div className="pt-aika-suggest">{suggestions.map(s=><button key={s} onClick={()=>chat.ask(s)}><ArrowRight size={15} aria-hidden="true"/>{s}</button>)}</div>}
  <form className="pt-aika-compose" onSubmit={e=>{e.preventDefault();chat.ask(text);setText('');}}>
   <textarea aria-label="Ask AiKA" placeholder="Type your question…" rows={1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chat.ask(text);setText('');}}}/>
   <div className="bar"><button className="pt-send" type="submit" aria-label="Send to AiKA" disabled={!text.trim()} style={{marginLeft:'auto'}}><Play size={16}/></button></div>
  </form>
 </aside>;
}

/** Full AiKA page (053, 058): greeting, composer, suggestion grid, then the conversation. */
export function AikaPage({state,name}:{state:IgnitionState;name:string}){
 const chat=useChat(state,'page'),[text,setText]=useState('');
 const send=(q:string)=>{chat.ask(q);setText('');};
 const composer=<form className="pt-composer" style={{width:'min(674px,100%)'}} onSubmit={e=>{e.preventDefault();send(text);}}><div className="pt-composer-box">
  <textarea aria-label="Ask AiKA" placeholder="Type your question..." rows={2} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(text);}}}/>
  <div className="pt-composer-bar"><button type="submit" className="pt-send" aria-label="Send to AiKA" disabled={!text.trim()}><Play size={18}/></button></div></div></form>;
 return <div className="pt-page"><div className="pt-pagebar"><h1><span className="icon"><AikaMark size={16} filled/></span>AiKA</h1><div className="tools"><button className="pt-tool" disabled title="Not available in this demo"><History size={15} aria-hidden="true"/>History</button></div></div>
  {chat.messages.length===0?<div className="pt-aika-page"><div className="pt-hello" style={{paddingTop:'18vh'}}><p><span style={{color:'#3fae49'}}><AikaMark size={22}/></span>Hello {name},</p><h2>What can I help you with?</h2></div>{composer}
   <div className="pt-aika-grid">{['What should I do first?','How do I register payments-api in the Catalog?','Who owns payments-api?','What is still unverified for Northstar?'].map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div></div>
  :<div className="pt-chat"><div className="pt-chat-scroll pt-aika-body" style={{overflow:'visible'}}><Conversation state={state} messages={chat.messages} support={chat.support} step="AiKA"/></div>{composer}</div>}
 </div>;
}
