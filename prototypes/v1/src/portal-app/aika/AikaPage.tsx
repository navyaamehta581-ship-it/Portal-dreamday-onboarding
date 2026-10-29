import {useState} from 'react';
import {History} from 'lucide-react';
import type {Opportunity} from '../../../../../contracts/activation/v1/handoff';
import type {Persona} from '../session';
import type {MilestoneWorkSession} from '../work/useMilestoneWork';
import type {RepositoryEvidenceSession} from '../work/useRepositoryEvidence';
import {AikaMark,Composer,Conversation,parseCommand} from './AikaChat';
import {aikaProblem,type AikaSession} from './useAika';

/** Suggestion cards (053), by role. A leading command picks that capability. */
export function suggestionsFor(persona:Persona){
 return persona.role==='champion'
  ?['/team What needs my attention today?','/team Which milestones are blocked, and why?','/onboarding What is the team’s engineering goal?','/repository What does the repository evidence show?']
  :['What could I build or improve first for our goals?','/my-work How do I get started on what I chose?','/onboarding Which suggestions are verified and which are hypotheses?','/repository What does the Portal know about our repositories?'];
}

/** AiKA (053, 057, 058, 061): greeting, composer and suggestions; then the conversation with the composer below.
 * The server builds each answer's context from approved records only (narrowed by any slash command), runs the
 * configured model and checks the answer; the browser never talks to the model. */
export function AikaPage({aika,work,repos,persona,opportunities=[]}:{aika:AikaSession;work:MilestoneWorkSession;repos?:RepositoryEvidenceSession;persona:Persona;opportunities?:Opportunity[]}){
 // What the question is about: a milestone or an engineering opportunity (from a link such as ?opportunity=…).
 const options=(work.progress?.milestones??[]).filter(m=>persona.role!=='developer'||m.mine||!!m.outline);
 const params=new URLSearchParams(window.location.search);
 const [about,setAbout]=useState<string>(params.get('opportunity')?`o:${params.get('opportunity')}`:params.get('milestone')?`m:${params.get('milestone')}`:'');
 const chosen=about.startsWith('m:')&&options.some(m=>`m:${m.id}`===about)||about.startsWith('o:')&&opportunities.some(o=>`o:${o.id}`===about)?about:'';
 const busy=aika.running||aika.sending;
 const send=(question:string,caps:Parameters<typeof aika.ask>[2]=[])=>aika.ask(question,chosen.startsWith('m:')?chosen.slice(2):null,caps,chosen.startsWith('o:')?chosen.slice(2):null);
 const select=(options.length>0||opportunities.length>0)&&<select className="pt-aika-about" aria-label="What AiKA should focus on" value={chosen} onChange={e=>setAbout(e.target.value)}>
  <option value="">About: our goals and my work</option>
  {opportunities.length>0&&<optgroup label="Engineering opportunities">{opportunities.map(o=><option key={o.id} value={`o:${o.id}`}>About: {o.title}</option>)}</optgroup>}
  {options.length>0&&<optgroup label="Milestones">{options.map(m=><option key={m.id} value={`m:${m.id}`}>About: {m.title}</option>)}</optgroup>}</select>;
 const composer=<Composer aika={aika} onSend={send} disabled={busy} extra={select}/>;
 const footer=<p className="pt-note pt-aika-who">{persona.role==='developer'?'You’re asking AiKA, not a person. To ask your Champion, add a question to a milestone you’re working on.':'You’re asking AiKA, not a person. Replies to your developers go through Team overview.'}</p>;
 const first=persona.name.split(' ')[0],empty=aika.turns.length===0;
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><AikaMark size={16} filled/></span>AiKA</h1>
   <div className="tools"><button className="pt-tool" disabled title="Conversation history isn’t available in this demo"><History size={15} aria-hidden="true"/>History</button>
    {aika.turns.length>0&&<button className="pt-tool" disabled={busy} onClick={aika.reset}>New chat</button>}</div></div>
  {!aika.modelConfigured&&<div className="pt-banner warn" role="status" style={{margin:'16px 0 0'}}>{aikaProblem('AIKA_UNAVAILABLE')}</div>}
  {/* One layout for both states, so the composer (and anything typed in it) survives the switch to the conversation. */}
  <div className={empty?'pt-aika-home':'pt-aika-chat'}>
   {empty?<div className="pt-aika-hello"><p><span style={{color:'#3fae49'}}><AikaMark size={22}/></span>Hello {first},</p><h2>What can I help you with?</h2></div>
    :<Conversation aika={aika} repos={repos}/>}
   <div className={empty?'pt-aika-home-composer':'pt-aika-dock-composer'}>
    {aika.error&&<div className="pt-banner error" role="alert" style={{width:'min(674px,100%)',margin:empty?'0 0 10px':'0 0 10px'}}>{aikaProblem(aika.error)}</div>}
    {composer}{footer}
   </div>
   {empty&&<div className="pt-aika-grid">{suggestionsFor(persona).map(s=>{const p=parseCommand(s,aika.capabilities);
    return <button key={s} disabled={busy} onClick={()=>void send(p.question,p.capabilities)}>{p.capabilities.length?<span className="pt-aika-chip static">/{p.capabilities[0]}</span>:null}{p.question}</button>;})}</div>}
  </div>
 </div>;
}
