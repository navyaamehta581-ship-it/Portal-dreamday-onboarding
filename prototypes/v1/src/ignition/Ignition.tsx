import {ChartColumn,FolderOpen,Rocket,RefreshCw} from 'lucide-react';
import '../portal-app/theme';
import './ignition.css';
import {PRIMARY_NAV,SECONDARY_NAV,Shell,type NavItem} from '../portal-app/Shell';
import {usePath} from '../portal-app/router';
import {ACCOUNTS,routeBase,subPath,type Person} from './api';
import {useIgnition,type IgnitionSession} from './useIgnition';
import {Login} from './Login';
import {Adoption} from './shared';
import {DeveloperHome,WorkflowPage} from './developer/Developer';
import {Aika} from './developer/Aika';
import {Champion} from './champion/Champion';
import {CustomerFile,type ChrisTab} from './chris/CustomerFile';

/** Each persona is its own product: own sign-in, session, navigation and sign-out. No switcher. */
function navFor(person:Person,base:string):{primary:NavItem[];secondary:NavItem[]}{
 if(person==='chris')return {primary:[{slug:'home',label:'Customer files',icon:FolderOpen,to:base},{slug:'insights',label:'Insights',icon:ChartColumn,to:base+'/insights'}],secondary:[]};
 if(person==='maya')return {primary:[{slug:'home',label:'Team activation',icon:Rocket,to:base},{slug:'insights',label:'Insights',icon:ChartColumn,to:base+'/insights'}],secondary:[]};
 // Developers get the full Portal navigation (053); only Home and Insights are functional.
 const scoped=(n:NavItem):NavItem=>({...n,to:n.slug==='home'?base:n.slug==='insights'?base+'/insights':`${base}/x/${n.slug}`});
 return {primary:PRIMARY_NAV.filter(n=>n.slug!=='onboarding').map(scoped),secondary:SECONDARY_NAV.map(scoped)};
}

export function Ignition(){
 const path=usePath(),session=useIgnition(path),person=session.person;
 if(!person)return <div className="pt"><main className="pt-entry"><section className="pt-entry-copy signin"><h1>Workspace access</h1><p>Open the sign-in link provided for your workspace.</p></section></main></div>;
 if(!session.checked)return <div className="pt" style={{minHeight:'100vh'}} aria-busy="true"/>;
 if(!session.state||path.endsWith('/login'))return <div className="pt"><Login person={person} busy={session.busy} error={session.error} onSignIn={email=>void session.signIn(email)}/></div>;
 const base=routeBase(person),sub=subPath(path),nav=navFor(person,base);
 const feature=/^\/x\/([a-z-]+)$/.exec(sub),workflow=/^\/workflow\/([a-z]+)$/.exec(sub);
 const active=sub==='/insights'?'insights':feature?feature[1]:'home';
 return <div className="pt ig"><Shell homeHref={base} primaryNav={nav.primary} secondaryNav={nav.secondary} active={active} user={{name:ACCOUNTS[person].name,detail:`${ACCOUNTS[person].product} · Northstar Engineering`,actionLabel:'Sign out',onAction:()=>void session.signOut()}}>
  <Page session={session} sub={sub} feature={feature?.[1]??null} workflow={workflow?.[1]??null} nav={nav}/>
  {session.state.role==='developer'&&<Aika state={session.state} workflowId={workflow?.[1]??null}/>}
 </Shell></div>;
}

function Page({session,sub,feature,workflow,nav}:{session:IgnitionSession;sub:string;feature:string|null;workflow:string|null;nav:{primary:NavItem[];secondary:NavItem[]}}){
 const state=session.state!;
 if(feature){const item=[...nav.primary,...nav.secondary].find(n=>n.slug===feature);return <div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t part of this onboarding`:'Page not found'}</h2><p>Use Home for your onboarding and Insights for your progress.</p></div></div></div>;}
 if(sub==='/insights')return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><ChartColumn size={16} aria-hidden="true"/></span>Insights</h1><Tools session={session}/></div>
  <nav className="pt-subtabs" aria-label="Insights sections"><button aria-selected="true">{state.role==='developer'?'My progress':'Adoption'}</button></nav>
  <Adoption state={state}/>
  {state.role==='operator'&&<section className="pt-card" style={{marginTop:26}}><h3>Next account action</h3><p style={{marginTop:12}}>{Object.values(state.progress).every(p=>p?.ownership&&p?.docs)?'Review POC value with Maya.':'Check in with Maya on cohort adoption. Technical issues go to technical support first.'}</p></section>}
 </div>;
 if(state.role==='developer')return workflow?<WorkflowPage session={session} id={workflow}/>:<DeveloperHome session={session}/>;
 const title=state.role==='operator'?'Customer files':'Team activation';
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon">{state.role==='operator'?<FolderOpen size={16} aria-hidden="true"/>:<Rocket size={16} aria-hidden="true"/>}</span>{title}</h1><Tools session={session}/></div>
  {state.role==='operator'?<CustomerFile session={session} tab={(sub==='/handoff'?'handoff':sub==='/versions'?'versions':'sources') as ChrisTab}/>:<Champion session={session}/>}
 </div>;
}

function Tools({session}:{session:IgnitionSession}){
 return <div className="tools"><button className="pt-tool" disabled={session.busy} onClick={()=>void session.refresh()}><RefreshCw size={15} aria-hidden="true"/>Refresh</button></div>;
}
