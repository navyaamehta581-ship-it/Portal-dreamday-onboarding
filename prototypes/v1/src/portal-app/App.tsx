import {Suspense,lazy,useEffect,useState} from 'react';
import './theme';
import {currentSession,homeFor,roleLabel,signOut,surfaceOf,type Persona} from './session';
import {navigate,usePath} from './router';
import {Welcome} from './Welcome';
import {Login} from './Login';
import {PortalApp} from './PortalApp';
import {Shell} from './Shell';

// Chris's workspace is loaded only when an operator opens it.
const OperatorWorkspace=lazy(()=>import('../operator/OperatorWorkspace').then(m=>({default:m.OperatorWorkspace})));

/** One entry for every persona: Welcome → persona sign-in → that persona's Portal.
 * The persona comes from the server session, so a reload or a typed URL never changes who is signed in;
 * only signing out does. Showing or hiding a surface here is presentation: the session layer and the
 * workflow API decide what each persona's requests may access. */
export function App(){
 const path=usePath();
 const [persona,setPersona]=useState<Persona|null|undefined>(undefined);
 const [notice,setNotice]=useState('');
 useEffect(()=>{document.title='Spotify Portal';currentSession().then(setPersona).catch(()=>setPersona(null));},[]);
 const surface=surfaceOf(path);
 // A signed-in persona never sees the sign-in page again; it returns to its own start page.
 useEffect(()=>{if(path==='/onboarding')navigate('/activation',true);else if(path==='/login'&&persona)navigate(homeFor(persona),true);},[path,persona]);

 async function leave(){await signOut().catch(()=>undefined);setPersona(null);setNotice('');navigate('/');}
 // Another tab signed in as someone else: stop, reload who is signed in, and say so instead of switching silently.
 async function personaChanged(){
  const now=await currentSession().catch(()=>null);
  setNotice(now?`You signed in as ${now.name} in another tab, so this tab now shows ${now.name}’s Portal.`:'You were signed out in another tab.');
  setPersona(now);navigate(now?homeFor(now):'/login');
 }
 // Re-check who is signed in when the tab comes back, so a sign-in elsewhere is noticed before any request.
 useEffect(()=>{
  if(!persona)return;
  const check=()=>{if(document.visibilityState==='hidden')return;currentSession().then(now=>{if(now?.id!==persona.id)void personaChanged();}).catch(()=>undefined);};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[persona]); // eslint-disable-line react-hooks/exhaustive-deps

 if(path==='/')return <div className="pt"><Welcome onStart={()=>navigate(persona?homeFor(persona):'/login')}/></div>;
 if(persona===undefined)return <div className="pt" style={{minHeight:'100vh'}} aria-busy="true"/>;
 if(!persona||path==='/login')return <div className="pt"><Login notice={notice} onSignedIn={p=>{setPersona(p);setNotice('');navigate(surface==='entry'||!allowed(p,surface)?homeFor(p):path,true);}} onBack={()=>navigate('/')}/></div>;
 const user={name:persona.name,detail:`${roleLabel[persona.role]} · ${persona.title} · ${persona.customers.map(c=>c.label).join(', ')}`,actionLabel:'Sign out',onAction:()=>void leave()};
 const banner=notice&&<div className="pt-banner warn" role="status" style={{margin:'16px 32px 0'}}>{notice}</div>;

 if(!allowed(persona,surface))return <div className="pt"><Shell active="" user={user} homeHref={homeFor(persona)}>{banner}<NotForPersona persona={persona}/></Shell></div>;
 if(surface==='operator')return <Suspense fallback={<div className="pt" style={{minHeight:'100vh'}} aria-busy="true"/>}><OperatorWorkspace persona={persona} user={user} onPersonaChanged={()=>void personaChanged()} notice={banner||null}/></Suspense>;
 return <PortalApp persona={persona} user={user} onSignedOut={()=>{setPersona(null);navigate('/login');}} onPersonaChanged={()=>void personaChanged()} notice={banner||null}/>;
}

const allowed=(p:Persona,surface:ReturnType<typeof surfaceOf>)=>surface==='operator'?p.role==='operator':surface==='portal'?p.role!=='operator':true;

/** A typed or bookmarked URL for another persona's surface: explain instead of switching persona. */
function NotForPersona({persona}:{persona:Persona}){
 const operator=persona.role==='operator';
 return <div className="pt-page"><div className="pt-pagebar"><h1>{operator?'Customer Portal':'Customer Onboarding'}</h1></div>
  <div className="pt-empty"><div>
   <h2>{operator?'This is the customer’s developer Portal':'This workspace is for the Spotify account operator'}</h2>
   <p>You’re signed in as {persona.name} ({roleLabel[persona.role]}). To use another persona, sign out first.</p>
   <button className="pt-btn" style={{marginTop:20}} onClick={()=>navigate(homeFor(persona))}>{operator?'Go to Customer Onboarding':'Go to your Portal'}</button>
  </div></div>
 </div>;
}
