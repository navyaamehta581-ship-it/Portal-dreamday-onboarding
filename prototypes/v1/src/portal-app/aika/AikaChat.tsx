import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {Play,X} from 'lucide-react';
import type {AikaCapability,AikaCapabilityId,AikaSection} from '../../../../../contracts/activation/v1/handoff';
import {SIGNAL_LABEL,type RepositoryEvidenceSession} from '../work/useRepositoryEvidence';
import {aikaProblem,type AikaSession,type AikaTurn} from './useAika';

/** The AiKA mark (070, 075): an outlined triangle with an inner circle. */
export function AikaMark({size=24,filled=false}:{size?:number;filled?:boolean}){
 return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2Z" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="14.2" r="2.6" fill="none" stroke={filled?'#101010':'currentColor'} strokeWidth="1.8"/></svg>;
}

const KIND:Record<AikaSection['kind'],[string,string]>={known:['Known','green'],verified:['Verified · repository','green'],sample:['Sample data','amber'],reported:['Reported','blue'],suggestion:['Suggestion','amber'],unknown:['Unknown','']};

/** A suggestion may start with a command, e.g. "/team How is the team doing?". */
export function parseCommand(text:string,capabilities:AikaCapability[]){
 const m=/^\/([a-z-]+)\s+(.*)$/s.exec(text.trim());
 const cap=m&&capabilities.find(c=>c.id===m[1]&&c.available);
 return cap?{question:m![2],capabilities:[cap.id]}:{question:text,capabilities:[] as AikaCapabilityId[]};
}

/** AiKA's composer: type “/” for the contextual capabilities this person can use (filter by typing, arrows to
 * move, Enter or Tab to pick, Escape to close). Picked capabilities become removable chips; a plain question
 * needs no command. Enter sends, Shift+Enter adds a line. */
export function Composer({aika,onSend,disabled,compact=false,extra}:{aika:AikaSession;onSend:(question:string,caps:AikaCapabilityId[])=>Promise<boolean>;disabled?:boolean;compact?:boolean;extra?:React.ReactNode}){
 const [text,setText]=useState(''),[chips,setChips]=useState<AikaCapabilityId[]>([]),[active,setActive]=useState(0);
 const area=useRef<HTMLTextAreaElement>(null);
 const usable=aika.capabilities.filter(c=>c.available&&!chips.includes(c.id));
 // The command being typed: a "/" at the start or after a space, up to the caret (always the end here).
 const token=/(^|\s)\/([a-z-]*)$/.exec(text);
 const matches=useMemo(()=>token?usable.filter(c=>c.id.startsWith(token[2])):[],[token?.[2],usable.length]); // eslint-disable-line react-hooks/exhaustive-deps
 const open=!!token&&matches.length>0;
 useEffect(()=>{setActive(0);},[token?.[2]]);
 const pick=(c:AikaCapability)=>{setChips([...chips,c.id]);setText(text.slice(0,text.length-token![0].length)+(token![1]||''));area.current?.focus();};
 const valid=text.trim().length>=3&&text.trim().length<=500;
 async function send(){if(!valid||disabled)return;if(await onSend(text.trim(),chips)){setText('');setChips([]);}}
 function keys(e:KeyboardEvent<HTMLTextAreaElement>){
  if(open){
   if(e.key==='ArrowDown'){e.preventDefault();setActive((active+1)%matches.length);return;}
   if(e.key==='ArrowUp'){e.preventDefault();setActive((active-1+matches.length)%matches.length);return;}
   if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();pick(matches[active]);return;}
   if(e.key==='Escape'){e.preventDefault();setText(text.replace(/\/[a-z-]*$/,''));return;}
  }
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}
  if(e.key==='Backspace'&&!text&&chips.length)setChips(chips.slice(0,-1));
 }
 return <form className={'pt-aika-composer'+(compact?' compact':'')} onSubmit={e=>{e.preventDefault();void send();}}>
  {open&&<ul className="pt-aika-commands" role="listbox" aria-label="AiKA commands">{matches.map((c,i)=><li key={c.id} role="option" aria-selected={i===active} id={`aika-cmd-${c.id}`}
   onMouseDown={e=>{e.preventDefault();pick(c);}} onMouseEnter={()=>setActive(i)}><strong>{c.label}</strong><span>{c.description}</span></li>)}</ul>}
  <div className="pt-aika-box">
   {chips.length>0&&<div className="pt-aika-chips">{chips.map(id=>{const c=aika.capabilities.find(x=>x.id===id);return <span key={id} className="pt-aika-chip">{c?.label??'/'+id}
    <button type="button" aria-label={`Remove ${c?.label??'/'+id}`} onClick={()=>setChips(chips.filter(x=>x!==id))}><X size={12}/></button></span>;})}</div>}
   <textarea ref={area} aria-label="Question for AiKA" placeholder={usable.length?'Type your question… or “/” for context':'Type your question…'} rows={compact?1:2} maxLength={500}
    value={text} disabled={disabled} onChange={e=>setText(e.target.value)} onKeyDown={keys}
    role="combobox" aria-expanded={open} aria-controls={open?undefined:undefined} aria-autocomplete="list" aria-activedescendant={open?`aika-cmd-${matches[active]?.id}`:undefined}/>
   <div className="pt-aika-bar">{extra}<button type="submit" className="pt-aika-send" aria-label="Ask AiKA" disabled={!valid||disabled}><Play size={16}/></button></div>
  </div>
 </form>;
}

function Answer({turn,repos}:{turn:AikaTurn;repos?:RepositoryEvidenceSession}){
 const job=turn.job;
 if(!job)return <div className="pt-aika-msg" role="alert"><div className="pt-banner error">{aikaProblem(turn.error??'AIKA_FAILED')}</div></div>;
 // Footnotes (061): each cited observation once, numbered in order of first use.
 const notes:string[]=[];const n=(c:string)=>{const i=notes.indexOf(c);if(i>=0)return i+1;notes.push(c);return notes.length;};
 return <div className="pt-aika-msg" aria-label="AiKA answer" aria-busy={job.status==='running'}>
  {job.status==='running'&&<p className="pt-note" role="status">AiKA is working on your question. This can take up to a minute; you can keep using the Portal. <span>Thinking… {Math.round(job.elapsedMs/1000)}s</span></p>}
  {job.status==='failed'&&<div className="pt-banner error" role="alert">{aikaProblem(job.error??'AIKA_FAILED')}</div>}
  {job.answer&&<>
   <ul className="pt-aika-sections">{job.answer.sections.map((s,i)=><li key={i}><span className={'pt-pill '+KIND[s.kind][1]}>{KIND[s.kind][0]}</span><div><p>{s.text}{s.citations?.map(c=><sup key={c} className="pt-aika-ref">[{n(c)}]</sup>)}</p>
    {s.citations?.length?<p className="pt-note" style={{marginTop:4}} data-testid="aika-citations">Based on: {s.citations.map(c=>{const o=repos?.observations.get(c);return o?`${SIGNAL_LABEL[o.signal]} (${o.mode==='fixture'?'sample data':`live, ${o.repository}${o.commit?`@${o.commit.slice(0,12)}`:''}`}, retrieved ${new Date(o.retrievedAt).toLocaleString()})`:`recorded observation ${c}`;}).join('; ')}</p>:null}</div></li>)}</ul>
   {job.answer.nextStep&&<p className="pt-aika-next"><strong>Suggested next step:</strong> {job.answer.nextStep}</p>}
   <p className="pt-note">Answered in {Math.round(job.elapsedMs/1000)}s. {job.answer.removed?`${job.answer.removed} part${job.answer.removed===1?' was':'s were'} removed because ${job.answer.removed===1?'it':'they'} didn’t pass AiKA’s checks. `:''}AiKA can be wrong. “Known” means stated in your approved plan; “Verified” cites a repository observation the Portal recorded (“Sample data” cites sample evidence). AiKA itself inspected nothing.</p>
  </>}
 </div>;
}

/** The conversation so far (this tab only), newest last. */
export function Conversation({aika,repos}:{aika:AikaSession;repos?:RepositoryEvidenceSession}){
 return <div className="pt-aika-conversation">{aika.turns.map(t=><div key={t.id}>
  <div className="pt-aika-user">{t.capabilities.length>0&&<small>{t.capabilities.map(c=>'/'+c).join(' ')}</small>}<div>{t.question}</div></div>
  <Answer turn={t} repos={repos}/>
 </div>)}</div>;
}
