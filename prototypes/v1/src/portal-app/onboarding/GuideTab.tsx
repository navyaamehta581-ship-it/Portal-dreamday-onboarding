import {useEffect,useRef,useState} from 'react';
import {ChevronRight,Flag,LoaderCircle,MessageSquare,Play,TriangleAlert} from 'lucide-react';
import type {ActivationSession} from '../../activation/useActivation';
import {guideTranscript,type GuideTurn} from '../../activation/guide';
import type {PortalAccount} from '../session';
import {actionProblem} from './model';

type Mode='question'|'blocker';

/** Conversation laid out like the Portal chat (053–061). Replies are rule-based and derived from saved state. */
export function GuideTab({session,account}:{session:ActivationSession;account:PortalAccount}){
 const state=session.state!;
 const turns=guideTranscript(state);
 const [mode,setMode]=useState<Mode>('question'),[text,setText]=useState(''),[needsChris,setNeedsChris]=useState(false);
 const blocker=session.blockerReport,progress=session.progressReport;
 const draft=mode==='blocker'?blocker.draft:progress.draft;
 const end=useRef<HTMLDivElement>(null);
 // A saved report is part of the canonical transcript; free the composer for the next message.
 useEffect(()=>{if(blocker.accepted){blocker.clear();setText('');}},[blocker.accepted]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(progress.accepted&&mode==='question'){progress.clear();setText('');setNeedsChris(false);}},[progress.accepted]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{end.current?.scrollIntoView?.({block:'end'});},[turns.length,session.busy]);
 const replanBlocked=mode==='blocker'&&['pending','failed'].includes(state.replan.status);
 const value=draft?.message??text;
 function send(){if(!value.trim())return;void(mode==='blocker'?blocker.submit(value):progress.submit(value,needsChris));}
 const suggestions=[
  {mode:'question' as Mode,text:'What does my first milestone involve?'},
  {mode:'question' as Mode,text:'What is still unknown about our setup?'},
  {mode:'blocker' as Mode,text:'I don’t have permission to deploy to staging, and I don’t know who owns the service metadata.'},
  {mode:'question' as Mode,text:'Which repository and SSO details were already shared?'},
 ];
 return <div className="pt-chat">
  <div className="pt-chat-scroll" aria-live="polite">
   {turns.length===0&&!draft?<div className="pt-hello"><p><Flag size={22} color="#63d46d" aria-hidden="true"/>Hello {account.user},</p><h2>What can I help you with?</h2></div>:null}
   {turns.length===0&&!draft&&<p className="pt-note" style={{textAlign:'center'}}>Answers come from your team’s published context. Not AiKA.</p>}
   {turns.map(turn=><Turn key={turn.id} turn={turn}/>)}
   {draft&&!(mode==='blocker'?blocker.accepted:progress.accepted)&&<><div className="pt-msg-user"><div>{draft.message}<small>{session.busy?'Sending…':'Not saved yet'}</small></div></div>
    {session.busy?<p style={{marginTop:18}}><span className="pt-running"><ChevronRight size={14} aria-hidden="true"/><LoaderCircle size={14} className="pt-spin" aria-hidden="true"/>Saving…</span></p>:null}</>}
   <div ref={end} style={{scrollMarginBottom:200}}/>
  </div>
  {turns.length===0&&!draft&&<div className="pt-suggest" aria-label="Suggested prompts">{suggestions.map(s=><button key={s.text} onClick={()=>{setMode(s.mode);setText(s.text);}}>{s.text}</button>)}</div>}
  <form className="pt-composer" onSubmit={e=>{e.preventDefault();send();}}>
   {session.error&&<div className="pt-banner error" role="alert" style={{marginBottom:10}}>{actionProblem(session.error)}</div>}
   {mode==='blocker'&&<p className="pt-note" style={{margin:'0 0 8px'}}>Chris is asked to help, and your next step is updated.</p>}
   <div className="pt-composer-box">
    <label className="pt-sr" htmlFor="guide-input">{mode==='blocker'?'Blocker note':'Question or update'}</label>
    <textarea id="guide-input" aria-label={mode==='blocker'?'Blocker note':'Question or update'} rows={2} maxLength={4000} disabled={!!draft} value={value} placeholder={mode==='blocker'?'Describe what is blocking you…':'Type your question…'}
     onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}/>
    <div className="pt-composer-bar">
     <span className="pt-mode">{mode==='blocker'?<TriangleAlert size={14} aria-hidden="true"/>:<MessageSquare size={14} aria-hidden="true"/>}
      <select aria-label="Message type" value={mode} disabled={!!blocker.draft||!!progress.draft} onChange={e=>setMode(e.target.value as Mode)}><option value="question">Question or update</option><option value="blocker">Report a blocker</option></select></span>
     {mode==='question'&&<label className="pt-check" style={{marginTop:0}}><input type="checkbox" aria-label="Ask Chris for help" disabled={!!draft} checked={progress.draft?progress.draft.needsChris:needsChris} onChange={e=>setNeedsChris(e.target.checked)}/>Ask Chris for help</label>}
     {draft&&!session.busy&&<button type="button" className="pt-link" onClick={()=>{(mode==='blocker'?blocker:progress).clear();setText('');}}>Discard</button>}
     <button type="submit" className="pt-send" aria-label={draft?'Retry sending':mode==='blocker'?'Submit blocker':'Send'} disabled={!session.ready||!value.trim()||replanBlocked}><Play size={18} aria-hidden="true"/></button>
    </div>
   </div>
   {replanBlocked&&<p className="pt-note" role="status">Your next step is still being updated. You can report another blocker once it’s ready.</p>}
   {draft&&!session.busy&&session.error&&<p className="pt-note">Your message is kept. Retrying won’t send it twice.</p>}
  </form>
 </div>;
}

function Turn({turn}:{turn:GuideTurn}){
 const r=turn.reply;
 return <>
  <div className="pt-msg-user"><div>{turn.message}<small>{turn.kind==='blocker'?'Blocker':'Question or update'} · {new Date(turn.at).toLocaleString()}</small></div></div>
  <article className="pt-msg-guide" aria-label={turn.kind==='blocker'?'Blocker response':'Guide response'}>
   <h4>{r.status==='pending'&&<LoaderCircle size={16} className="pt-spin" aria-hidden="true"/>}{r.title}</h4>
   {r.lines.map((line,i)=><p key={i}>{line}</p>)}
   {r.matches.length>0?<><p>From your published context:</p><ul>{r.matches.map((m,i)=><li key={i}><span className="src">{m.label}:</span> {m.text}</li>)}</ul></>:turn.kind==='question'?<p>Nothing in your published context answers this directly. Chris can see your message.</p>:null}
  </article>
 </>;
}
