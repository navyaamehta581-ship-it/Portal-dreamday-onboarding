import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronDown,Maximize2,Minimize2,Minus} from 'lucide-react';
import type {Persona} from '../session';
import type {RepositoryEvidenceSession} from '../work/useRepositoryEvidence';
import {AikaMark,Composer,Conversation,parseCommand} from './AikaChat';
import {suggestionsFor} from './AikaPage';
import {aikaProblem,type AikaSession} from './useAika';

/** Contextual AiKA (055): the AiKA mark in the corner opens a “New AiKA Chat” panel over the current page. It
 * shares the conversation with the AiKA page. */
export function AikaDock({aika,repos,persona}:{aika:AikaSession;repos?:RepositoryEvidenceSession;persona:Persona}){
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(false),[menu,setMenu]=useState(false);
 const body=useRef<HTMLDivElement>(null);
 useEffect(()=>{body.current?.scrollTo?.({top:body.current.scrollHeight});},[aika.turns,open]);
 const busy=aika.running||aika.sending;
 if(!open)return <button className="pt-aika-launch" aria-label="Open AiKA" onClick={()=>setOpen(true)}><AikaMark size={30}/></button>;
 return <aside className={'pt-aika-panel'+(expanded?' expanded':'')} aria-label="Contextual AiKA">
  <div className="pt-aika-head"><span className="icon"><AikaMark size={16} filled/></span>
   <button className="title" aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}><strong>New AiKA Chat</strong><ChevronDown size={15}/></button>
   {menu&&<div className="pt-menu" role="menu" style={{left:50,right:'auto',top:48}}><button role="menuitem" disabled={busy} onClick={()=>{aika.reset();setMenu(false);}}>New chat</button></div>}
   <div className="ctl"><button aria-label={expanded?'Restore AiKA size':'Expand AiKA'} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
    <button aria-label="Minimize AiKA" onClick={()=>setOpen(false)}><Minus size={16}/></button></div></div>
  <div className="pt-aika-panel-body" ref={body}>
   {aika.turns.length?<Conversation aika={aika} repos={repos}/>:<p className="pt-note">Ask about your onboarding work. Type “/” for context.</p>}
   {aika.error&&<div className="pt-banner error" role="alert">{aikaProblem(aika.error)}</div>}
  </div>
  {aika.turns.length===0&&<div className="pt-aika-suggest">{suggestionsFor(persona).slice(0,3).map(s=>{const p=parseCommand(s,aika.capabilities);
   return <button key={s} disabled={busy} onClick={()=>void aika.ask(p.question,null,p.capabilities)}><ArrowRight size={15} aria-hidden="true"/>{p.capabilities.length?`/${p.capabilities[0]} `:''}{p.question}</button>;})}</div>}
  <Composer aika={aika} compact disabled={busy} onSend={(q,caps)=>aika.ask(q,null,caps)}/>
 </aside>;
}
