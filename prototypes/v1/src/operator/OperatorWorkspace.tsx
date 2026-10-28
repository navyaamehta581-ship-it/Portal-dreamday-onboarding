import {useEffect,useMemo,useState} from 'react';
import {Flag,RefreshCw} from 'lucide-react';
import '../portal-app/theme';
import {activationClient} from '../activation/client';
import {useActivation} from '../activation/useActivation';
import type {PortalAccount} from '../portal-app/session';
import {navigate,usePath} from '../portal-app/router';
import {ALL_NAV,PRIMARY_NAV,Shell,type NavItem} from '../portal-app/Shell';
import {milestoneTone} from '../portal-app/onboarding/model';
import {useOperatorDraft} from './useOperatorDraft';
import {planLabel} from './versions';
import {ContextTab} from './ContextTab';
import {GoalTab} from './GoalTab';
import {ProgressTab} from './ProgressTab';
import {IntegrationTools} from './IntegrationTools';

const TABS=[['context','Customer Context',''],['goal','Activation Goal','/goal'],['progress','Developer Progress','/progress']] as const;
// Same Portal navigation; the onboarding entry opens Chris's page and other entries stay within /operator.
const OPERATOR_NAV:NavItem[]=PRIMARY_NAV.map(item=>item.slug==='onboarding'?{...item,slug:'customer-onboarding',label:'Customer Onboarding',to:'/operator'}:{...item,to:undefined});
const operatorHref=(item:NavItem)=>item.to??`/operator/x/${item.slug}`;

/** Chris's workspace: the same Portal shell, with operator-only access via an operator token.
 * It has no developer session and never uses the developer sign-in. */
export function OperatorWorkspace(){
 const path=usePath();
 const [accounts,setAccounts]=useState<PortalAccount[]>([]);
 const [accountId,setAccountId]=useState(''),[customer,setCustomer]=useState(''),[token,setToken]=useState('');
 const [opened,setOpened]=useState(false),[needsPublish,setNeedsPublish]=useState(false);
 useEffect(()=>{document.title='Customer Onboarding · Spotify Portal';
  fetch('/portal-auth/accounts',{cache:'no-store'}).then(r=>r.ok?r.json():{accounts:[]}).then(d=>{const list=(d.accounts??[]) as PortalAccount[];setAccounts(list);if(list[0]){setAccountId(list[0].id);setCustomer(list[0].customerId);}}).catch(()=>undefined);},[]);
 const account=accounts.find(a=>a.id===accountId);
 // The operator token stays in memory only. Configured accounts route to their own API through the local proxy.
 const api=useMemo(()=>opened&&customer&&token.length>=32?activationClient(customer,token,'',account?`/operator-api/${account.id}`:'/api'):null,[opened,customer,token,account]);
 const session=useActivation(api,`${accountId}:${customer}:${token}`);
 const draft=useOperatorDraft(api,session);
 useEffect(()=>{if(api)void session.refresh();},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 // Once the customer is known to be unpublished, keep the draft mounted through later errors (e.g. conflicts).
 useEffect(()=>{if(session.error==='NOT_FOUND')setNeedsPublish(true);if(session.state)setNeedsPublish(false);},[session.error,session.state]);
 const change=(fn:()=>void)=>{setOpened(false);setNeedsPublish(false);draft.reset();fn();};
 const {state,busy,error}=session;
 const ready=!!state||needsPublish;

 const feature=/^\/operator\/x\/([a-z-]+)$/.exec(path);
 const tabMatch=/^\/operator(\/goal|\/progress)?\/?$/.exec(path);
 const tab=TABS.find(([,,suffix])=>suffix===(tabMatch?.[1]??''))?.[0]??'context';
 const item=feature?ALL_NAV.find(n=>n.slug===feature[1]):null;
 const user={name:'Chris',detail:'Customer onboarding · operator access',actionLabel:'Lock workspace',onAction:()=>change(()=>setToken(''))};

 return <div className="pt"><Shell active={feature?feature[1]:'customer-onboarding'} user={user} homeHref="/operator" primaryNav={OPERATOR_NAV} href={operatorHref}>
  {feature?<div className="pt-page"><div className="pt-pagebar"><h1>{item?.label??'Not found'}</h1></div><div className="pt-empty"><div><h2>{item?`${item.label} isn’t available in this demo`:'Page not found'}</h2></div></div></div>:
  <div className="pt-page">
   <div className="pt-pagebar"><h1><span className="icon"><Flag size={16} aria-hidden="true"/></span>Customer Onboarding</h1>
    <div className="tools">{opened&&<button className="pt-tool" disabled={busy} onClick={()=>void session.refresh()}><RefreshCw size={15} aria-hidden="true"/>{busy?'Refreshing…':'Refresh'}</button>}</div></div>
   <div className="pt-entity">
    <div className="pt-entity-head">
     <div><p className="pt-crumb">Customer Onboarding — {account?.label??(customer||'Choose a customer')}</p><h2>{state?state.context.agreedGoal.text:ready?'Not published yet':'Choose a customer'}</h2></div>
     {state&&<div className="pt-meta"><div>Milestone<span><span className={'pt-pill '+milestoneTone(state.milestone.status)}>{state.milestone.status.replace('_',' ')}</span></span></div><div>Plan<span>{planLabel(state.planRevision).split(' · ')[0]}</span></div></div>}
    </div>

    <section className="pt-card" style={{marginTop:26}} aria-label="Session connection">
     <h3>Customer</h3>
     <div className="pt-form-row">
      {accounts.length>0?<label className="pt-form-field"><span>Customer account</span><select className="pt-input" aria-label="Customer account" value={accountId} onChange={e=>change(()=>{const a=accounts.find(x=>x.id===e.target.value);setAccountId(e.target.value);setCustomer(a?.customerId??'');})}>{accounts.map(a=><option key={a.id} value={a.id}>{a.label} ({a.customerId})</option>)}</select></label>
       :<label className="pt-form-field"><span>Customer ID</span><input className="pt-input" aria-label="Customer ID" value={customer} onChange={e=>change(()=>setCustomer(e.target.value))} placeholder="e.g. fictional-recommendation-demo"/></label>}
      <label className="pt-form-field"><span>Operator access token</span><input className="pt-input" aria-label="Operator access token" type="password" autoComplete="off" value={token} onChange={e=>change(()=>setToken(e.target.value))} placeholder="Kept in this tab only"/></label>
      <button className="pt-btn sm" style={{height:46}} disabled={!customer||token.length<32||busy} onClick={()=>opened?void session.refresh():setOpened(true)}>{busy?'Loading…':opened?'Reload customer':'Open workspace'}</button>
     </div>
     {!state&&<p className="pt-note">Your token stays in this tab and is never shown to developers.</p>}
    </section>

    {error&&error!=='NOT_FOUND'&&<div className="pt-banner error" role="alert">{error==='FORBIDDEN'?'This token is not authorized for this customer.':error}</div>}
    {opened&&!ready&&!error&&<p className="pt-note" role="status">Loading…</p>}
    {ready&&<>
     <div className="pt-tabs" role="tablist" aria-label="Customer onboarding sections">{TABS.map(([id,label,suffix])=><button key={id} role="tab" id={'op-tab-'+id} aria-selected={tab===id} aria-controls="operator-panel" onClick={()=>navigate('/operator'+suffix)}>{label}</button>)}</div>
     <div className="pt-tabpanel" role="tabpanel" id="operator-panel" aria-labelledby={'op-tab-'+tab}>
      {tab==='context'&&<ContextTab draft={draft} state={state}/>}
      {tab==='goal'&&<GoalTab draft={draft} session={session}/>}
      {tab==='progress'&&<ProgressTab state={state}/>}
      {(tab==='progress'&&state||tab==='context'&&!state)&&<IntegrationTools session={session}/>}
     </div>
    </>}
   </div>
  </div>}
 </Shell></div>;
}
