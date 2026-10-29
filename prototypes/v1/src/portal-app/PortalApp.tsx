import {useEffect,useMemo,type ReactNode} from 'react';
import {Users} from 'lucide-react';
import {activationClient} from '../activation/client';
import {useActivation} from '../activation/useActivation';
import {portalAccount,type Persona} from './session';
import {usePath} from './router';
import {ALL_NAV,PRIMARY_NAV,Shell,type NavItem,type ShellUser} from './Shell';
import {Home} from './Home';
import {ChampionPage} from './ChampionPage';
import {OnboardingPage,TABS,type Tab} from './onboarding/OnboardingPage';
import {AikaPage} from './aika/AikaPage';
import {InsightsPage} from './insights/InsightsPage';
import {AikaDock} from './aika/AikaDock';
import {useAika} from './aika/useAika';
import {useMilestoneWork} from './work/useMilestoneWork';
import {useRepositoryEvidence} from './work/useRepositoryEvidence';

// The Champion gets one extra entry beside Onboarding; everything else is the same Portal navigation.
const PORTAL_NAV:NavItem[]=PRIMARY_NAV.map(item=>item.slug==='aika'?{...item,to:'/aika'}:item.slug==='insights'?{...item,to:'/insights'}:item);
const CHAMPION_NAV:NavItem[]=PORTAL_NAV.flatMap(item=>item.slug==='onboarding'?[item,{slug:'champion',label:'Team Coordination',icon:Users,to:'/champion'}]:[item]);

/** Customer Portal for Maya, Alex and Jordan: the reconstructed Spotify Portal with their onboarding inside it.
 * Requests go through the local session layer, which holds the customer's developer credential server-side. */
export function PortalApp({persona,user,onSignedOut,onPersonaChanged,notice}:{persona:Persona;user:ShellUser;onSignedOut:()=>void;onPersonaChanged:()=>void;notice:ReactNode}){
 const path=usePath();
 const account=portalAccount(persona);
 const api=useMemo(()=>activationClient(account.customerId,'','','/portal-api',persona.id),[account.customerId,persona.id]);
 const session=useActivation(api,`${persona.id}:${account.customerId}`);
 const work=useMilestoneWork(api),repos=useRepositoryEvidence(api),aikaChat=useAika(api);
 // Commands depend on the approved plan and assignments: refresh them when the work changes.
 useEffect(()=>{void aikaChat.reloadCapabilities();},[work.progress?.approval?.at,work.progress?.milestones.length]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{void session.refresh();},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(session.error==='DEMO_GATE_REQUIRED')window.location.assign('/demo-gate');if(session.error==='SIGN_IN_REQUIRED')onSignedOut();if(session.error==='PERSONA_CHANGED')onPersonaChanged();},[session.error]); // eslint-disable-line react-hooks/exhaustive-deps

 const champion=persona.role==='champion';
 const onboarding=/^\/activation(?:\/([a-z]+))?\/?$/.exec(path);
 const feature=/^\/portal\/x\/([a-z-]+)$/.exec(path);
 const coordinationPath=path==='/champion'||path==='/champion/team';
 const coordination=coordinationPath&&champion;
 const aika=path==='/aika',insights=path==='/insights';
 const active=onboarding?'onboarding':feature?feature[1]:coordination?'champion':aika?'aika':insights?'insights':'home';
 const tab=(TABS.some(([id])=>id===onboarding?.[1])?onboarding![1]:'overview') as Tab;
 const item=feature?ALL_NAV.find(n=>n.slug===feature[1]):null;
 return <div className="pt"><Shell active={active} user={user} primaryNav={champion?CHAMPION_NAV:PORTAL_NAV}>
  {notice}
  {onboarding?<OnboardingPage session={session} tab={tab} account={account} work={work} repos={repos}/>:
   aika?<AikaPage aika={aikaChat} work={work} repos={repos} persona={persona}/>:
   insights?<InsightsPage api={api} customer={account.label} demo={/fictional/i.test(account.label+account.customerId)}/>:
   coordination?<ChampionPage session={session} account={account} api={api} work={work} repos={repos} tab={path==='/champion/team'?'team':'dream-day'}/>:
   coordinationPath?<div className="pt-page"><div className="pt-pagebar"><h1>Team Coordination</h1></div><div className="pt-empty"><div><h2>Team Coordination is for your team’s Champion</h2><p>You’re signed in as {persona.name}. Your onboarding is under Onboarding.</p></div></div></div>:
   feature?<div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t available in this demo`:'Page not found'}</h2></div></div></div>:
   <Home session={session} persona={persona} work={work}/>}
  {!aika&&<AikaDock aika={aikaChat} repos={repos} persona={persona}/>}
 </Shell></div>;
}
