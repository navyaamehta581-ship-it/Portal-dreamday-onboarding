import {useEffect,useRef,useState,type FormEvent} from 'react';
import {MessageSquareText,Plus,Send,ShieldCheck} from 'lucide-react';
import {CONTRACT_VERSION,type AgentState} from './contract';
import {conversationClient,ConversationError} from './client';
import {developmentFixtures} from './fixtures';
import {ConversationContext} from './ConversationContext';
import './conversation.css';
const STORAGE_KEY='portal-conversation-v1';
const scenarios=['empty','confirmedConstraint','multiTurn','clarification','investigation','recommendation'] as const;
type Scenario=typeof scenarios[number];
function savedId(){try{return localStorage.getItem(STORAGE_KEY);}catch{return null;}}
export function ConversationPanel(){
 const [state,setState]=useState<AgentState>(),[draft,setDraft]=useState(''),[constraint,setConstraint]=useState('');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState<Scenario|''>('');
 const [recover,setRecover]=useState(false);
 const lock=useRef(false),input=useRef<HTMLTextAreaElement>(null);
 const shown=preview?developmentFixtures.examples[preview]?.state:state;
 const transcript=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[shown?.conversationId,shown?.messages.length,preview]);
 function accept(next:AgentState){setState(next);try{localStorage.setItem(STORAGE_KEY,next.conversationId);}catch{setNotice('Saved on server. Browser storage is unavailable; resume after refresh is unavailable in this browser.');}}
 async function run(label:string,action:()=>Promise<void>){
  if(lock.current)return;lock.current=true;setBusy(label);setError('');setNotice('');
  try{await action();}catch(e){setError(e instanceof Error?e.message:'Request failed. Your draft is preserved.');}finally{lock.current=false;setBusy('');}
 }
 function create(){void run('Creating conversation…',async()=>{accept((await conversationClient.create()).state);setRecover(false);});}
 function reload(){void run('Loading conversation…',async()=>{const id=state?.conversationId??savedId();if(!id)throw new Error('No saved conversation on this browser. Start a new conversation.');accept((await conversationClient.read(id)).state);setRecover(false);setNotice('Latest conversation loaded. Review your draft before sending.');});}
 function submit(event:FormEvent){
  event.preventDefault();if(!state||!draft.trim()||preview||recover)return;
  void run('Waiting for server…',async()=>{
   try{const response=await conversationClient.send(state.conversationId,{contractVersion:CONTRACT_VERSION,expectedRevision:state.revision,content:draft.trim(),confirmedConstraints:constraint.trim()?[constraint.trim()]:[],...(state.pendingQuestion?{answersQuestionId:state.pendingQuestion.id}:{})});accept(response.state);setDraft('');setConstraint('');input.current?.focus();}
   catch(e){setRecover(true);
    if(e instanceof ConversationError&&e.code==='REVISION_CONFLICT'){
     try{accept((await conversationClient.read(state.conversationId)).state);setRecover(false);setNotice('Another tab updated this conversation. Latest messages loaded; draft kept. Review and send again.');return;}
     catch{throw new Error('Conversation changed and could not be reloaded. Your draft is preserved. Reload before sending.');}
    }
    if(e instanceof ConversationError&&e.status&&e.status>=400&&e.status<500)setRecover(false);
    throw e;
   }
  });
 }
 return <section className="cw" aria-labelledby="conversation-title">
  <header className="cw-header"><div><span className="cw-eyebrow">AI WORKFLOW ARCHITECT</span><h2 id="conversation-title"><MessageSquareText size={23}/>Your workflow starts here</h2><p>Describe the outcome. Keep the context. Review the next step.</p></div><span className="cw-boundary"><ShieldCheck size={15}/>Read only</span></header>
  <div className="cw-toolbar"><button className="p-button" disabled={!!busy||!!preview||!!draft.trim()||!!constraint.trim()} onClick={create}><Plus size={16}/>New conversation</button><button className="p-outline" disabled={!!busy||!!preview} onClick={reload}>{state?'Reload latest':'Resume saved conversation'}</button><label>View<select aria-label="Workspace view" disabled={!!busy} value={preview} onChange={e=>{setPreview(e.target.value as Scenario|'');setError('');setNotice('');}}><option value="">Live conversation</option>{scenarios.map(s=><option key={s} value={s}>Example: {s.replace(/([A-Z])/g,' $1').toLowerCase()}</option>)}</select></label></div>
  {preview?<p className="cw-banner">Synthetic example · read-only preview · no model or repository investigation was run. Return to Live conversation to continue your saved chat.</p>:<p className="cw-info">Deterministic recording · no model connected. Live chat saves messages and constraints; it does not investigate or generate workflows yet.</p>}
  {error&&<div className="cw-error" role="alert">{error}{recover&&<button className="p-link" disabled={!!busy} onClick={reload}>Reload latest state</button>}</div>}{notice&&<p className="cw-banner" role="status">{notice}</p>}
  <div className="cw-grid"><div className="cw-conversation"><div ref={transcript} className="cw-transcript" role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text" aria-busy={!!busy}>
   {!shown?.messages.length?<div className="cw-empty"><MessageSquareText size={32}/><h3>What are you trying to accomplish?</h3><p>{shown?'Add your first message below.':'Start a conversation or resume your saved work.'}</p><p>For example: “I want staging deployments to use our existing CI tests.”</p></div>:shown.messages.map(m=><article className={`cw-message cw-${m.role}`} key={m.id}><div><strong>{m.role==='user'?'You':'Portal Assistant'}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.content}</p></article>)}
  </div><p className="cw-status" role="status">{busy||(shown?`Last returned stage: ${shown.stage.replaceAll('_',' ')} · revision ${shown.revision}`:'No conversation selected')}</p>
   {shown?.pendingQuestion&&<div className="cw-question"><strong>Clarification needed</strong><p>{shown.pendingQuestion.question}</p><small>{shown.pendingQuestion.reason}</small></div>}
   <form className="cw-composer" onSubmit={submit}><label htmlFor="cw-message">{shown?.pendingQuestion?'Your answer':'Message'}</label><textarea id="cw-message" ref={input} disabled={!state||!!preview||!!busy} maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Describe your goal, friction, or feedback…" rows={3}/><div className="cw-compose-meta"><small>{draft.length}/4000 · messages are developer statements</small><button className="p-button" disabled={!state||!!preview||!!busy||!draft.trim()||recover} type="submit"><Send size={15}/>Send message</button></div><label htmlFor="cw-constraint">Confirm a constraint with this message <small>(optional)</small></label><input id="cw-constraint" disabled={!state||!!preview||!!busy} maxLength={500} value={constraint} onChange={e=>setConstraint(e.target.value)} placeholder="For example: Keep existing tests unchanged"/>{(draft.trim()||constraint.trim())&&<small>Your draft stays until successfully sent. <button type="button" className="p-link" disabled={!!busy||!!preview} onClick={()=>{setDraft('');setConstraint('');}}>Discard draft</button> to start a new conversation.</small>}</form>
  </div><ConversationContext state={shown} preview={!!preview}/></div>
 </section>;
}
