import {useState} from 'react';
import {Copy as CopyIcon,ExternalLink,Pencil,Star,Users} from 'lucide-react';
import {Link,navigate} from '../../portal-app/router';
import {routeBase,type IgnitionState} from '../api';
import type {IgnitionSession} from '../useIgnition';

/** Catalog list (045) inside the full shell. payments-api appears once the team has registered it. */
export function CatalogPage({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person),rows=state.catalogRegistered?1:0;
 return <div className="pt-home">
  <h1>Northstar Catalog</h1>
  <div className="ig-catalog">
   <aside aria-label="Filters">{[['Kind','Component'],['Type','all'],['Owner',''],['Lifecycle','']].map(([k,v])=><div className="pt-formfield" key={k}><label>{k}</label><select className="pt-input" aria-label={k} defaultValue={v}><option>{v}</option></select></div>)}</aside>
   <section className="pt-tablebox" aria-label="Owned components" style={{marginTop:20}}>
    <h3 style={{fontSize:16,padding:'18px 0 8px'}}>Owned Components ({rows})</h3>
    {rows?<table className="pt-table"><thead><tr><th>Name</th><th>System</th><th>Owner</th><th>Type</th><th>Lifecycle</th><th>Description</th><th>Actions</th></tr></thead>
     <tbody><tr><td><Link className="pt-link" to={base+'/catalog/payments-api'}>payments-api</Link></td><td>payments</td><td><Users size={14} aria-hidden="true"/> team-payments</td><td>service</td><td>production</td><td>Payments API</td><td style={{whiteSpace:'nowrap',color:'#cfcfcf'}}><ExternalLink size={16} aria-hidden="true"/> <Pencil size={16} aria-hidden="true"/> <Star size={16} aria-hidden="true"/></td></tr></tbody></table>
     :<p className="pt-note" style={{padding:'0 0 18px'}}>No components yet. payments-api appears here once it’s registered.{state.person==='alex'&&<> <Link className="pt-link" to={base}>Continue setup</Link></>}</p>}
   </section>
  </div>
 </div>;
}

/** Entity overview (047, 065) with the owner verification step for developers. */
export function EntityPage({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person),dev=state.role==='developer';
 const [answer,setAnswer]=useState(''),o=state.progress?.[state.person]?.ownership,found=state.steps?.[state.person]?.discover;
 return <div className="pt-page"><div className="pt-entity">
  <div className="pt-entity-head"><div><p className="pt-crumb">Component — Service</p><h2>payments-api <Star size={22} aria-hidden="true" style={{verticalAlign:'middle'}}/></h2></div>
   <div className="pt-meta"><div>Owner<span><Users size={13} aria-hidden="true"/> team-payments</span></div><div>Lifecycle<span>production</span></div></div></div>
  <div className="pt-tabs" role="tablist"><button role="tab" aria-selected="true">Overview</button><button role="tab" aria-selected="false" onClick={()=>navigate(base+'/docs')}>Docs</button></div>
  {!state.catalogRegistered&&<div className="pt-banner warn" role="status">payments-api isn’t registered in the Catalog yet. These details come from its catalog-info.yaml in review.</div>}
  <div className="pt-cols" style={{marginTop:30}}>
   <section aria-label="About"><h3 style={{fontSize:17}}>About</h3>
    <dl className="pt-fields"><div className="pt-field wide"><dt>Description</dt><dd className="plain">Payments API</dd></div><div className="pt-field"><dt>Owner</dt><dd>team-payments</dd></div><div className="pt-field"><dt>System</dt><dd>payments</dd></div><div className="pt-field"><dt>Type</dt><dd>service</dd></div><div className="pt-field"><dt>Lifecycle</dt><dd>production</dd></div><div className="pt-field"><dt>Source</dt><dd>github.com/northstar/payments-api</dd></div></dl>
    <pre className="pt-code" style={{marginTop:18}} aria-label="catalog-info.yaml">{`metadata:\n  name: payments-api\nspec:\n  type: service\n  lifecycle: production\n  owner: team-payments`}</pre>
   </section>
   {dev&&<section aria-label="Onboarding">
    {state.person==='jordan'&&<div style={{marginBottom:28}}><h3 style={{fontSize:17}}>Is this your service?</h3>
     {found?<p className="pt-note">Confirmed · {new Date(found.at).toLocaleString()}</p>:<div className="pt-actions"><button className="pt-btn sm gray" disabled={session.busy} onClick={()=>void session.save({action:'step',step:'discover'})}>Yes, this is payments-api</button></div>}</div>}
    <h3 style={{fontSize:17}}>Verify the owner</h3>
    <div className="pt-formfield"><label htmlFor="owner-answer">Which team owns payments-api?</label><input id="owner-answer" className="pt-input" aria-label="Which team owns payments-api?" maxLength={200} value={answer} onChange={e=>setAnswer(e.target.value)}/><span className="help">Checked against the catalog entry. <span className="pt-tag sim">Simulated verification</span></span></div>
    {session.error&&<p className="pt-note" role="alert" style={{color:'#ff9f95'}}>{session.error}</p>}
    <div className="pt-actions"><button className="pt-btn sm" disabled={session.busy||!answer.trim()} onClick={()=>void session.save({action:'verify',workflow:'ownership',answer:answer.trim()})}>Verify</button><Link className="pt-link" to={base}>Back to onboarding</Link></div>
    {o&&<Outcome state={state} workflow="ownership"/>}
   </section>}
  </div>
 </div></div>;
}

/** Documentation (055) for payments-api, with the runbook verification for developers. */
export function DocsPage({session}:{session:IgnitionSession}){
 const state=session.state!,base=routeBase(session.person),dev=state.role==='developer';
 const [answer,setAnswer]=useState('');
 return <div className="pt-page">
  <div className="pt-pagebar"><h1><span className="icon"><CopyIcon size={15} aria-hidden="true"/></span>Documentation</h1></div>
  <h2 style={{fontSize:28,fontWeight:700,marginTop:34}}>payments-api</h2>
  <div className="ig-docmeta"><span><b>Component:</b> payments-api</span><span><b>Owner:</b> team-payments</span><span><b>Lifecycle:</b> production</span></div>
  <div className="ig-doc">
   <nav aria-label="Pages"><strong>payments-api</strong><a className="pt-link" href="#recovery" style={{textDecoration:'underline'}}>Payments recovery</a></nav>
   <article>
    <h1 id="recovery">Payments recovery</h1>
    <p>Use this runbook when payment requests fail or the payment queue backs up.</p>
    <h2>Before you start</h2><ul><li>Check payment queue health.</li><li>Review failed transactions from the last hour.</li><li>Contact team-payments before replaying requests.</li></ul>
    {dev&&<section aria-label="Verify the runbook" className="pt-section" style={{marginTop:32}}>
     <h3>Verify your first workflow</h3>
     <div className="pt-formfield"><label htmlFor="docs-answer">What is the runbook heading?</label><input id="docs-answer" className="pt-input" aria-label="What is the runbook heading?" maxLength={200} value={answer} onChange={e=>setAnswer(e.target.value)}/><span className="help">Checked against the documentation. <span className="pt-tag sim">Simulated verification</span></span></div>
     {session.error&&<p className="pt-note" role="alert" style={{color:'#ff9f95'}}>{session.error}</p>}
     <div className="pt-actions"><button className="pt-btn sm" disabled={session.busy||!answer.trim()} onClick={()=>void session.save({action:'verify',workflow:'docs',answer:answer.trim()})}>Verify</button><Link className="pt-link" to={base}>Back to onboarding</Link></div>
     {state.progress?.[state.person]?.docs&&<Outcome state={state} workflow="docs"/>}
    </section>}
   </article>
   <aside aria-label="Table of contents"><strong>Table of contents</strong><a href="#recovery">Payments recovery</a></aside>
  </div>
 </div>;
}

function Outcome({state,workflow}:{state:IgnitionState;workflow:string}){
 const o=state.progress[state.person][workflow],stale=!!state.handoff&&o.handoffVersion<state.handoff.version;
 return <p className="pt-note" role="status" style={{color:stale?'#ffd27a':'#cfcfcf'}}><span className="pt-ok">✓</span> {o.status} · handoff v{o.handoffVersion} · {new Date(o.at).toLocaleString()}{stale&&` — verify again for handoff v${state.handoff!.version}`}</p>;
}
