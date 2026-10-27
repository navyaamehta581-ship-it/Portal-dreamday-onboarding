import {useEffect,useMemo,useState} from 'react';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import './portal.css';
import {activationClient} from '../activation/client';
import {useActivation} from '../activation/useActivation';
import {currentSession,signOut,type PortalAccount} from './session';
import {navigate,usePath} from './router';
import {Welcome} from './Welcome';
import {Login} from './Login';
import {ALL_NAV,Shell} from './Shell';
import {Home} from './Home';
import {OnboardingPage,TABS,type Tab} from './onboarding/OnboardingPage';

/** Developer surface: reconstructed Spotify Portal with customer-specific onboarding inside it. */
export function PortalApp(){
 const path=usePath();
 const [account,setAccount]=useState<PortalAccount|null|undefined>(undefined);
 useEffect(()=>{document.title='Spotify Portal';currentSession().then(setAccount).catch(()=>setAccount(null));},[]);
 useEffect(()=>{if(path==='/onboarding')navigate('/activation',true);},[path]);
 // Requests go through the local session layer, which holds the developer credential server-side.
 const api=useMemo(()=>account?activationClient(account.customerId,'','','/portal-api'):null,[account]);
 const session=useActivation(api,account?`${account.id}:${account.customerId}`:'signed-out');
 useEffect(()=>{if(api)void session.refresh();},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(session.error==='SIGN_IN_REQUIRED')setAccount(null);},[session.error]);

 async function leave(){await signOut().catch(()=>undefined);setAccount(null);navigate('/');}
 if(path==='/')return <div className="pt"><Welcome onStart={()=>navigate(account?'/portal':'/login')}/></div>;
 if(account===undefined)return <div className="pt" style={{minHeight:'100vh'}} aria-busy="true"/>;
 if(path==='/login'||!account){
  if(account&&path==='/login'){navigate('/portal',true);return null;}
  return <div className="pt"><Login onSignedIn={a=>{setAccount(a);if(path==='/login')navigate('/portal');}} onBack={()=>navigate('/')}/></div>;
 }
 const onboarding=/^\/activation(?:\/([a-z]+))?\/?$/.exec(path);
 const feature=/^\/portal\/x\/([a-z-]+)$/.exec(path);
 const active=onboarding?'onboarding':feature?feature[1]:'home';
 const tab=(TABS.some(([id])=>id===onboarding?.[1])?onboarding![1]:'overview') as Tab;
 const item=feature?ALL_NAV.find(n=>n.slug===feature[1]):null;
 return <div className="pt"><Shell active={active} account={account} onSignOut={()=>void leave()}>
  {onboarding?<OnboardingPage session={session} tab={tab} account={account}/>:
   feature?<div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t available in this demo`:'Page not found'}</h2><p>Only Home and Onboarding are functional here.</p></div></div></div>:
   <Home session={session}/>}
 </Shell></div>;
}
