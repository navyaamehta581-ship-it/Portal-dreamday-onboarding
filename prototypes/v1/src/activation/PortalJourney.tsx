import {useState} from 'react';
import {ActivationPage} from './ActivationPage';
import './journey.css';
/** Visual shell only. Simulated login is never API authorization. */
export function PortalJourney(){
 const [stage,setStage]=useState<'welcome'|'login'|'activation'>('welcome');
 return <div className="pj"><div className="pj-disclosure">PORTAL SIMULATION · No Spotify authentication, live Portal or AiKA connection</div>
 {stage==='activation'?<><header className="pj-top"><span>Portal / Contextual onboarding</span><button onClick={()=>setStage('welcome')}>Restart demo journey</button></header><ActivationPage surface="developer"/></>:<main className="pj-entry"><div className="pj-brand">◉ Spotify <span>Portal</span></div><h1>{stage==='welcome'?'Hi, welcome to Portal.':'Continue to your onboarding.'}</h1><p>{stage==='welcome'?'Your customer-specific path to a useful first outcome.':'This is a simulated login. No email, password, or Spotify account is collected. Developer API access is separate.'}</p><button onClick={()=>setStage(stage==='welcome'?'login':'activation')}>{stage==='welcome'?'Get started':'Continue with simulated login'} →</button>{stage==='login'&&<button onClick={()=>setStage('welcome')}>Back to welcome</button>}</main>}</div>;
}
