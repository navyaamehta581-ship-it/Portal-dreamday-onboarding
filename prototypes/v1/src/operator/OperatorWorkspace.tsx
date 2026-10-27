import {useEffect,useMemo,useState} from 'react';
import './operator.css';
import {activationClient} from '../activation/client';
import {useActivation} from '../activation/useActivation';
import type {PortalAccount} from '../portal-app/session';
import {PublishFlow} from './PublishFlow';
import {StatusReview} from './StatusReview';
import {IntegrationTools} from './IntegrationTools';

/** Chris’s external workspace. Not part of Spotify Portal; shares only the activation backend. */
export function OperatorWorkspace(){
 const [accounts,setAccounts]=useState<PortalAccount[]>([]);
 const [accountId,setAccountId]=useState(''),[customer,setCustomer]=useState(''),[token,setToken]=useState('');
 const [opened,setOpened]=useState(false);
 useEffect(()=>{document.title='Customer activation workspace';
  fetch('/portal-auth/accounts',{cache:'no-store'}).then(r=>r.ok?r.json():{accounts:[]}).then(d=>{const list=(d.accounts??[]) as PortalAccount[];setAccounts(list);if(list[0]){setAccountId(list[0].id);setCustomer(list[0].customerId);}}).catch(()=>undefined);},[]);
 const account=accounts.find(a=>a.id===accountId);
 // The operator token stays in memory only. Configured accounts route to their own API through the local proxy.
 const api=useMemo(()=>opened&&customer&&token.length>=32?activationClient(customer,token,'',account?`/operator-api/${account.id}`:'/api'):null,[opened,customer,token,account]);
 const session=useActivation(api,`${accountId}:${customer}:${token}`);
 useEffect(()=>{if(api)void session.refresh();},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 const [needsPublish,setNeedsPublish]=useState(false);
 // Once the customer is known to be unpublished, keep the draft mounted through later errors (e.g. conflicts).
 useEffect(()=>{if(session.error==='NOT_FOUND')setNeedsPublish(true);if(session.state)setNeedsPublish(false);},[session.error,session.state]);
 const change=(fn:()=>void)=>{setOpened(false);setNeedsPublish(false);fn();};
 const notPublished=!session.state&&needsPublish;
 return <div className="op"><div className="op-wrap">
  <header className="op-head">
   <div><p className="op-kicker">Customer activation workspace · outside Spotify Portal</p><h1>Prepare and follow a customer’s developer onboarding</h1>
   <p className="op-lede">Paste what you already know, review what developers will see, publish the agreed goal, then follow evidence-backed progress.</p></div>
  </header>

  <section className="op-card" aria-label="Session connection">
   <h2>Customer</h2>
   <div className="op-connect">
    {accounts.length>0?<label className="op-field">Customer account<select aria-label="Customer account" value={accountId} onChange={e=>change(()=>{const a=accounts.find(x=>x.id===e.target.value);setAccountId(e.target.value);setCustomer(a?.customerId??'');})}>{accounts.map(a=><option key={a.id} value={a.id}>{a.label} ({a.customerId})</option>)}</select></label>
     :<label className="op-field">Customer ID<input aria-label="Customer ID" value={customer} onChange={e=>change(()=>setCustomer(e.target.value))} placeholder="e.g. fictional-recommendation-demo"/></label>}
    <label className="op-field">Operator access token<input aria-label="Operator access token" type="password" autoComplete="off" value={token} onChange={e=>change(()=>setToken(e.target.value))} placeholder="Kept in this tab only"/></label>
    <button className="op-btn" disabled={!customer||token.length<32||session.busy} onClick={()=>opened?void session.refresh():setOpened(true)}>{session.busy?'Loading…':opened?'Refresh':'Open workspace'}</button>
   </div>
   {session.state&&<p className="op-muted">Saved session revision {session.state.revision} · plan revision {session.state.planRevision}. Refreshing is safe.</p>}
  </section>

  {session.error&&session.error!=='NOT_FOUND'&&<div className="op-alert" role="alert">{session.error==='FORBIDDEN'?'This token is not authorized for this customer.':session.error}</div>}
  {!opened?<p className="op-empty">Choose the customer and enter your operator token to start.</p>
   :notPublished?<PublishFlow session={session}/>
   :session.state?<StatusReview state={session.state}/>
   :!session.error&&<p className="op-empty" role="status">Loading…</p>}
  {opened&&(session.state||notPublished)&&<IntegrationTools session={session}/>}
 </div></div>;
}
