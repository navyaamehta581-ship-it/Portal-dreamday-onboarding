import {useState} from 'react';
import {CONTRACT_VERSION,type AgentState} from './contract';
import {conversationClient} from './client';
export function ConversationPanel(){
 const [state,setState]=useState<AgentState>(),[text,setText]=useState(''),[constraint,setConstraint]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(action:()=>Promise<{state:AgentState}>){setBusy(true);setError('');try{const result=await action();setState(result.state);localStorage.setItem('portal-conversation-v1',result.state.conversationId);}catch(e){setError(e instanceof Error?e.message:'Request failed.');}finally{setBusy(false);}}
 return <section className="p-card" aria-label="Phase A conversation"><h2>Conversation foundation</h2><p>Phase A · read only · deterministic recording · no model connected</p>
 <button disabled={busy} onClick={()=>run(()=>conversationClient.create())}>New conversation</button>{' '}
 <button disabled={busy} onClick={()=>{const id=localStorage.getItem('portal-conversation-v1');if(id)void run(()=>conversationClient.read(id));else setError('No saved conversation on this browser.');}}>Resume saved conversation</button>
 {error&&<p role="alert">{error} Resume to reload after a revision conflict.</p>}
 {state&&<><p role="status">{busy?'Sending message':state.stage.replaceAll('_',' ')} · revision {state.revision}</p><small>Conversation: {state.conversationId}</small>
 <ol aria-label="Messages">{state.messages.map(m=><li key={m.id}><strong>{m.role}</strong>: {m.content}</li>)}</ol>
 <h3>Confirmed constraints</h3><ul>{state.constraints.map(c=><li key={c.id}>{c.text}</li>)}</ul>
 <details><summary>Backend operation history</summary><ol>{state.events.map(e=><li key={e.sequence}>{e.stage}: {e.operation}</li>)}</ol></details>
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{const response=await conversationClient.send(state.conversationId,{contractVersion:CONTRACT_VERSION,expectedRevision:state.revision,content:text,confirmedConstraints:constraint.trim()?[constraint]:[]});setText('');setConstraint('');return response;});}}>
 <label className="p-field">Message<textarea required maxLength={4000} value={text} onChange={e=>setText(e.target.value)}/></label>
 <label className="p-field">Explicitly confirm a constraint (optional)<input maxLength={500} value={constraint} onChange={e=>setConstraint(e.target.value)}/></label>
 <button disabled={busy||!text.trim()} type="submit">Send message</button></form>
 <p>Messages are developer statements, not verified repository evidence. Constraints persist on the local server; the browser stores only the conversation ID.</p></>}
 </section>;
}
