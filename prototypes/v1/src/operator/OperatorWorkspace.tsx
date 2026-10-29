import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {Flag,RefreshCw} from 'lucide-react';
import '../portal-app/theme';
import {activationClient} from '../activation/client';
import {useActivation} from '../activation/useActivation';
import type {Persona} from '../portal-app/session';
import {navigate,usePath} from '../portal-app/router';
import {ALL_NAV,PRIMARY_NAV,Shell,type NavItem,type ShellUser} from '../portal-app/Shell';
import {milestoneTone} from '../portal-app/onboarding/model';
import {accountStatus,useCustomerWorkspace} from './useCustomerWorkspace';
import {planLabel} from './versions';
import {InformationTab} from './InformationTab';
import {ReviewTab} from './ReviewTab';
import {ProgressTab} from './ProgressTab';
import {IntegrationTools} from './IntegrationTools';
import {useMilestoneWork} from '../portal-app/work/useMilestoneWork';
import {useRepositoryEvidence} from '../portal-app/work/useRepositoryEvidence';

const TABS=[['context','Customer Context',''],['draft','Onboarding Draft','/draft'],['progress','Developer Progress','/progress']] as const;
// Same Portal navigation; the onboarding entry opens Chris's page and other entries stay within /operator.
const OPERATOR_NAV:NavItem[]=PRIMARY_NAV.map(item=>item.slug==='onboarding'?{...item,slug:'customer-onboarding',label:'Customer Onboarding',to:'/operator'}:{...item,to:undefined});
const operatorHref=(item:NavItem)=>item.to??`/operator/x/${item.slug}`;

/** Chris's workspace: the same Portal shell, for the operator persona only. Operator access is held by the
 * session layer for the customers listed for Chris; this page never sees a token and has no developer session. */
export function OperatorWorkspace({persona,user,onPersonaChanged,notice}:{persona:Persona;user:ShellUser;onPersonaChanged:()=>void;notice:ReactNode}){
 const path=usePath();
 const [customerId,setCustomerId]=useState(persona.customers[0]?.id??'');
 const [needsPublish,setNeedsPublish]=useState(false);
 useEffect(()=>{document.title='Customer Onboarding · Spotify Portal';},[]);
 const customer=persona.customers.find(c=>c.id===customerId);
 const api=useMemo(()=>customer?activationClient(customer.customerId,'','',`/operator-api/${customer.id}`,persona.id):null,[customer,persona.id]);
 const session=useActivation(api,`${persona.id}:${customerId}`);
 const ws=useCustomerWorkspace(api);
 const work=useMilestoneWork(api),repos=useRepositoryEvidence(api);
 useEffect(()=>{if(api)void session.refresh();},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(session.error==='PERSONA_CHANGED'||session.error==='SIGN_IN_REQUIRED')onPersonaChanged();},[session.error]); // eslint-disable-line react-hooks/exhaustive-deps
 // Once the customer is known to be unpublished, keep the draft mounted through later errors (e.g. conflicts).
 useEffect(()=>{if(session.error==='NOT_FOUND')setNeedsPublish(true);if(session.state)setNeedsPublish(false);},[session.error,session.state]);
 // Choosing the customer already open changes nothing; another customer starts from a clean draft and reloads.
 // Unsaved edits are never dropped silently: switching customer waits until they're saved or discarded.
 const dirty=ws.sourcesDirty||ws.reviewDirty;
 const change=(id:string)=>{if(id===customerId||dirty)return;setNeedsPublish(false);setCustomerId(id);};
 const {state,busy,error}=session;
 const ready=!!state||needsPublish;

 const feature=/^\/operator\/x\/([a-z-]+)$/.exec(path);
 // /operator/goal was the earlier name of the draft tab.
 const tabMatch=/^\/operator(\/draft|\/goal|\/progress)?\/?$/.exec(path);
 const tab=TABS.find(([,,suffix])=>suffix===(tabMatch?.[1]==='/goal'?'/draft':tabMatch?.[1]??''))?.[0]??'context';
 const status=accountStatus(ws,!!state);
 const item=feature?ALL_NAV.find(n=>n.slug===feature[1]):null;

 return <div className="pt"><Shell active={feature?feature[1]:'customer-onboarding'} user={user} homeHref="/operator" primaryNav={OPERATOR_NAV} href={operatorHref}>
  {notice}
  {feature?<div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t available in this demo`:'Page not found'}</h2></div></div></div>:
  <div className="pt-page">
   <div className="pt-pagebar"><h1><span className="icon"><Flag size={16} aria-hidden="true"/></span>Customer Onboarding</h1>
    <div className="tools">{customer&&<button className="pt-tool" disabled={busy} onClick={()=>{void session.refresh();void work.reload();void repos.reload();}}><RefreshCw size={15} aria-hidden="true"/>{busy?'Refreshing…':'Refresh'}</button>}</div></div>
   <div className="pt-entity">
    <div className="pt-entity-head">
     <div><p className="pt-crumb">Customer Onboarding — {customer?.label??'No customer'}</p><h2>{state?state.context.agreedGoal.text:ready?'Not published yet':customer?'Loading…':'No customer is assigned to you'}</h2></div>
     {ready&&<div className="pt-meta"><div>Status<span><span className={'pt-pill '+status.tone}>{status.label}</span></span></div>{state&&<><div>Milestone<span><span className={'pt-pill '+milestoneTone(state.milestone.status)}>{state.milestone.status.replace('_',' ')}</span></span></div><div>Plan<span>{planLabel(state.planRevision).split(' · ')[0]}</span></div></>}</div>}
    </div>

    {persona.customers.length>1&&<section className="pt-card" style={{marginTop:26}} aria-label="Customer">
     <h3>Customer</h3>
     <div className="pt-form-row">
      <label className="pt-form-field"><span>Customer account</span><select className="pt-input" aria-label="Customer account" value={customerId} disabled={dirty} onChange={e=>change(e.target.value)}>{persona.customers.map(c=><option key={c.id} value={c.id}>{c.label} ({c.customerId})</option>)}</select></label>
     </div>
     {dirty&&<p className="pt-note">Save or discard your changes before switching customer.</p>}
    </section>}

    {error&&error!=='NOT_FOUND'&&<div className="pt-banner error" role="alert">{error==='FORBIDDEN'?'Your operator access doesn’t include this customer.':error==='ACTIVATION_API_UNREACHABLE'?'The customer’s activation API isn’t reachable. Check that the demo API is running.':error==='PERSONA_UNAVAILABLE'?'Operator access for this customer isn’t configured on the demo server.':error}</div>}
    {!ready&&!error&&<p className="pt-note" role="status">Loading…</p>}
    {ready&&<>
     <div className="pt-tabs" role="tablist" aria-label="Customer onboarding sections">{TABS.map(([id,label,suffix])=><button key={id} role="tab" id={'op-tab-'+id} aria-selected={tab===id} aria-controls="operator-panel" onClick={()=>navigate('/operator'+suffix)}>{label}</button>)}</div>
     <div className="pt-tabpanel" role="tabpanel" id="operator-panel" aria-labelledby={'op-tab-'+tab}>
      {tab==='context'&&<InformationTab ws={ws} locked={!!state}/>}
      {tab==='draft'&&<ReviewTab ws={ws} state={state}/>}
      {tab==='progress'&&<ProgressTab state={state} work={work} repos={repos}/>}
      {/* Integrator tools only for a published customer: nothing here can publish around Dream Day. */}
      {tab==='progress'&&state&&<IntegrationTools session={session}/>}
     </div>
    </>}
   </div>
  </div>}
 </Shell></div>;
}
