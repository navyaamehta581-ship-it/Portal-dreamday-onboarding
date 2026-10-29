import {useEffect,useState} from 'react';

/** Hosted demo only: which demo room this browser is in, how to share it, and how to leave it. Rooms keep each
 * visitor's work apart; the bar doesn't appear in local development (no gate there). */
export function DemoRoomBar(){
 const [room,setRoom]=useState<{room:string;expiresAt:string;storage?:'ephemeral'|'persistent';aiProvider?:string}|null>(null);
 useEffect(()=>{fetch('/demo-gate/room',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(setRoom).catch(()=>undefined);},[]);
 if(!room)return null;
 async function leave(){await fetch('/demo-gate/leave',{method:'POST',credentials:'same-origin'}).catch(()=>undefined);window.location.assign('/demo-gate');}
 return <div role="status" aria-label="Demo room" style={{position:'fixed',left:16,bottom:16,zIndex:50,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',maxWidth:'calc(100vw - 32px)',
  padding:'8px 14px',borderRadius:999,background:'#181818',border:'1px solid #2a2a2a',color:'#e8e8e8',font:'500 13px/1.4 Figtree, system-ui, sans-serif',boxShadow:'0 4px 16px rgba(0,0,0,.4)'}}>
  <span style={{padding:'1px 8px',borderRadius:10,background:'#3d2f12',color:'#ffd27a',fontWeight:700}}>Fictional demo</span>
  <span>Room <strong style={{letterSpacing:.5}}>{room.room}</strong> · share the code to work together · ends {new Date(room.expiresAt).toLocaleString()}{room.storage==='ephemeral'?' or sooner':''}</span>
  {room.storage==='ephemeral'&&<span title="Free hosting keeps demo data only while the service runs." style={{color:'#ffd27a'}}>Temporary data: lost if the service restarts, redeploys or sleeps</span>}
  {room.aiProvider==='gemini'&&<span style={{color:'#b3b3b3'}}>Fictional data only (Gemini free tier)</span>}
  <button onClick={()=>void leave()} style={{background:'none',border:0,color:'#1ed760',font:'inherit',fontWeight:700,cursor:'pointer',padding:0}}>Leave room</button>
 </div>;
}
