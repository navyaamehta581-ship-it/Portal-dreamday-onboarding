import {ChartColumn,RefreshCw} from 'lucide-react';
import '../portal-app/theme';
import './ignition.css';
import {PRIMARY_NAV,SECONDARY_NAV,Shell,type NavItem} from '../portal-app/Shell';
import {navigate,usePath} from '../portal-app/router';
import {Welcome} from '../portal-app/Welcome';
import {ACCOUNTS,routeBase,subPath,type Person} from './api';
import {useIgnition,type IgnitionSession} from './useIgnition';
import {Login} from './Login';
import {Adoption} from './shared';
import {DeveloperHome} from './developer/Developer';
import {Setup} from './developer/Setup';
import {CatalogPage,DocsPage,EntityPage} from './developer/Catalog';
import {AikaDock,AikaPage} from './developer/Aika';
import {ChampionHome,TeamActivation} from './champion/Champion';
import {CustomerFile,type ChrisTab} from './chris/CustomerFile';

const IMPLEMENTED=['home','catalog','docs','aika','insights'];
/** Alex, Jordan and Maya get the full Portal navigation (053). Maya's Insights entry opens Team Activation.
 *  Chris works in Insights only. Each person signs in and out separately; there is no switcher. */
function navFor(person:Person,base:string):{primary:NavItem[];secondary:NavItem[]}{
 if(person==='chris')return {primary:[{...PRIMARY_NAV.find(n=>n.slug==='insights')!,to:base}],secondary:[]};
 const to=(n:NavItem)=>n.slug==='home'?(person==='maya'?base+'/home':base):n.slug==='insights'?(person==='maya'?base:base+'/insights'):IMPLEMENTED.includes(n.slug)?`${base}/${n.slug}`:`${base}/x/${n.slug}`;
 return {primary:PRIMARY_NAV.filter(n=>n.slug!=='onboarding').map(n=>({...n,to:to(n)})),secondary:SECONDARY_NAV.map(n=>({...n,to:to(n)}))};
}
function activeFor(person:Person,sub:string){
 if(person==='chris')return 'insights';
 if(person==='maya'&&(sub===''||sub==='/adoption'))return 'insights';
 const first=sub.split('/')[1]??'';
 if(first==='x')return sub.split('/')[2];
 if(first===''||first==='home'||first==='setup'||first==='welcome')return 'home';
 return first;
}

export function Ignition(){
 const path=usePath(),session=useIgnition(path),person=session.person;
 if(!person)return <div className="pt"><main className="pt-entry"><section className="pt-entry-copy signin"><h1>Welcome to Portal.</h1><p>Open the sign-in link for your workspace.</p></section></main></div>;
 if(!session.checked)return <div className="pt" style={{minHeight:'100vh'}} aria-busy="true"/>;
 if(!session.state||path.endsWith('/login'))return <div className="pt"><Login person={person} busy={session.busy} error={session.error} onSignIn={email=>void session.signIn(email)}/></div>;
 const base=routeBase(person),sub=subPath(path);
 if(sub==='/welcome')return <div className="pt"><Welcome onStart={()=>navigate(base)}/></div>;
 const nav=navFor(person,base),portal=person!=='chris';
 const context=sub.startsWith('/setup')?'setup':sub==='/catalog/payments-api'?'owner':sub==='/docs'?'docs':null;
 return <div className="pt ig"><Shell homeHref={person==='maya'?base+'/home':base} primaryNav={nav.primary} secondaryNav={nav.secondary} active={activeFor(person,sub)} user={{name:ACCOUNTS[person].name,detail:`${person}@northstar.example`,actionLabel:'Sign out',onAction:()=>void session.signOut()}}>
  <Page session={session} person={person} sub={sub} nav={nav}/>
  {portal&&sub!=='/aika'&&<AikaDock state={session.state} context={context} step={context==='setup'?'Catalog registration':context==='owner'?'Verify the service owner':context==='docs'?'Service documentation':'Onboarding'}/>}
 </Shell></div>;
}

function Page({session,person,sub,nav}:{session:IgnitionSession;person:Person;sub:string;nav:{primary:NavItem[];secondary:NavItem[]}}){
 const state=session.state!,base=routeBase(person);
 const feature=/^\/x\/([a-z-]+)$/.exec(sub);
 if(feature){const item=[...nav.primary,...nav.secondary].find(n=>n.slug===feature[1]);return <div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t available in this demo`:'Page not found'}</h2></div></div></div>;}
 if(person==='chris'){
  const tab=(sub==='/handoff'?'handoff':sub==='/versions'?'versions':sub==='/adoption'?'adoption':'sources') as ChrisTab;
  return <div className="pt-page"><InsightsBar session={session}/><CustomerFile session={session} tab={tab}/></div>;
 }
 if(sub==='/catalog')return <CatalogPage session={session}/>;
 if(sub==='/catalog/payments-api')return <EntityPage session={session}/>;
 if(sub==='/docs')return <DocsPage session={session}/>;
 if(sub==='/aika')return <AikaPage state={state} name={ACCOUNTS[person].name}/>;
 const setup=/^\/setup\/(team|components|register)$/.exec(sub);
 if(setup&&person==='alex')return <Setup session={session} stage={setup[1] as 'team'|'components'|'register'}/>;
 if(person==='maya'){
  if(sub==='/home')return <ChampionHome session={session}/>;
  return <div className="pt-page"><InsightsBar session={session}/>
   <nav className="pt-subtabs" role="tablist" aria-label="Insights sections"><button role="tab" aria-selected={sub!=='/adoption'} onClick={()=>navigate(base)}>Team Activation</button><button role="tab" aria-selected={sub==='/adoption'} onClick={()=>navigate(base+'/adoption')}>Adoption</button></nav>
   <div style={{marginTop:24}}>{sub==='/adoption'?<Adoption state={state}/>:<TeamActivation session={session}/>}</div></div>;
 }
 if(sub==='/insights')return <div className="pt-page"><InsightsBar session={session}/><nav className="pt-subtabs" role="tablist" aria-label="Insights sections"><button role="tab" aria-selected="true">My onboarding</button></nav><Adoption state={state}/></div>;
 return <DeveloperHome session={session}/>;
}

function InsightsBar({session}:{session:IgnitionSession}){
 return <div className="pt-pagebar" style={{paddingBottom:0,borderBottom:0}}><h1><span className="icon"><ChartColumn size={16} aria-hidden="true"/></span>Insights</h1><div className="tools"><button className="pt-tool" disabled={session.busy} onClick={()=>void session.refresh()}><RefreshCw size={15} aria-hidden="true"/>Refresh</button></div></div>;
}
