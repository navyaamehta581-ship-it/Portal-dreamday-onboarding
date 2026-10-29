import {useEffect,useRef,useState} from 'react';
import {Check,Copy,TriangleAlert} from 'lucide-react';

/** The hosted demo's room for this browser, from the server-verified gate cookie. Local development has no gate,
 * so this stays null there and nothing room-related is shown. */
export type DemoRoom={room:string;expiresAt:string;storage?:'ephemeral'|'persistent';aiProvider?:string};
let cached:Promise<DemoRoom|null>|null=null;
export function loadDemoRoom(refresh=false){
 if(!cached||refresh)cached=fetch('/demo-gate/room',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json() as Promise<DemoRoom>:null).catch(()=>null);
 return cached;
}
/** undefined while loading, null outside the hosted demo. */
export function useDemoRoom(){
 const [room,setRoom]=useState<DemoRoom|null|undefined>(undefined);
 useEffect(()=>{let live=true;void loadDemoRoom().then(r=>{if(live)setRoom(r);});return()=>{live=false;};},[]);
 return room;
}

/** The warnings every visitor sees at entry, kept one click away inside the Portal. */
export function DemoNotices({room}:{room:DemoRoom}){
 return <ul className="pt-demo-notes">
  <li><span className="pt-demo-chip">Fictional</span><span>Every customer, person and repository is invented. Don’t enter real customer information{room.aiProvider==='gemini'?': AI features use Gemini’s free tier, where Google may use submitted text to improve its products':''}.</span></li>
  {room.storage==='ephemeral'&&<li><span className="pt-demo-chip">Temporary</span><span>Work is kept only while the service runs. It’s lost if the service restarts, redeploys or sleeps.</span></li>}
 </ul>;
}

/** Top-bar demo menu (hosted demo only): the room, how to share it, when it ends, a fresh room, and leaving. */
export function DemoMenu(){
 const room=useDemoRoom();
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!ref.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
 if(!room)return null;
 const ends=new Date(room.expiresAt).toLocaleString([], {weekday:'short',hour:'2-digit',minute:'2-digit'});
 async function copy(){try{await navigator.clipboard.writeText(room!.room);setCopied(true);window.setTimeout(()=>setCopied(false),2000);}catch{setError('Copy isn’t available in this browser. Select the code instead.');}}
 async function fresh(){
  setBusy(true);setError('');
  const r=await fetch('/demo-gate/new-room',{method:'POST',credentials:'same-origin'}).catch(()=>null);
  if(r?.ok){window.location.assign('/login');return;}
  setBusy(false);setError(r?.status===503?'The demo is at capacity. Try again later.':r?.status===429?'Too many new rooms. Wait a few minutes, then try again.':'A new room couldn’t be started. Try again.');
 }
 async function leave(){await fetch('/demo-gate/leave',{method:'POST',credentials:'same-origin'}).catch(()=>undefined);window.location.assign('/demo-gate');}
 return <div className="pt-demo" ref={ref}>
  <button className="pt-demo-toggle" aria-haspopup="dialog" aria-expanded={open} aria-controls="pt-demo-panel" onClick={()=>setOpen(!open)}>
   <TriangleAlert size={14} aria-hidden="true"/><span>Fictional demo</span>
  </button>
  {open&&<div className="pt-demo-panel" id="pt-demo-panel" role="dialog" aria-label="Demo room">
   <h2>Demo room</h2>
   <div className="pt-demo-code"><code aria-label="Room code">{room.room}</code>
    <button className="pt-icon" onClick={()=>void copy()} aria-label="Copy room code" title="Copy room code">{copied?<Check size={16}/>:<Copy size={16}/>}</button></div>
   <p className="pt-demo-meta">Share this code so others can join your room. It ends {ends}{room.storage==='ephemeral'?' or sooner':''}.</p>
   {copied&&<p className="pt-sr" role="status">Room code copied</p>}
   <DemoNotices room={room}/>
   {error&&<p className="pt-alert" role="alert">{error}</p>}
   <div className="pt-demo-actions">
    <button className="pt-btn sm ghost" disabled={busy} onClick={()=>void fresh()}>{busy?'Starting…':'Start a new room'}</button>
    <button className="pt-link" onClick={()=>void leave()}>Leave demo</button>
   </div>
   <p className="pt-demo-meta">A new room starts empty and you choose a persona again. People in this room keep their work.</p>
  </div>}
 </div>;
}
