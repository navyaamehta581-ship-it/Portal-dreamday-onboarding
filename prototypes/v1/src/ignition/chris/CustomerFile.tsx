import {useState} from 'react';
import {Check,X} from 'lucide-react';
import {navigate} from '../../portal-app/router';
import {routeBase,type Version} from '../api';
import {extract} from '../extract';
import {lineDiff} from '../diff';
import type {IgnitionSession} from '../useIgnition';
import {Adoption,Dialog,EntityHead,HandoffLines} from '../shared';

export type ChrisTab='sources'|'handoff'|'versions'|'adoption';
const TABS:[ChrisTab,string,string][]=[['sources','Customer files',''],['handoff','Handoff','/handoff'],['versions','Versions','/versions'],['adoption','Adoption','/adoption']];
type Draft={briefing:string;uncertainties:string;held:string[];reviewed:boolean};
const SOURCE_TYPES=['Discovery call paste','CRM paste','Technical notes paste','Follow-up email paste'];
const AGENT_IMPORT='Simulated agent summary: Maya prioritizes service ownership and documentation for payments-api. No external agent was contacted.';

/** Chris's customer file: sources → reviewed developer-safe handoff → versions. Raw sources and commercial context stay here. */
export function CustomerFile({session,tab}:{session:IgnitionSession;tab:ChrisTab}){
 const state=session.state!,base=routeBase(session.person);
 const [draft,setDraft]=useState<Draft|null>(null);
 const edit=(patch:Partial<Draft>)=>setDraft(d=>d&&{...d,...patch,reviewed:'reviewed' in patch?!!patch.reviewed:false});
 return <>
  <nav className="pt-subtabs" role="tablist" aria-label="Customer insights">{TABS.map(([id,label,suffix])=><button key={id} role="tab" aria-selected={tab===id} onClick={()=>navigate(base+suffix)}>{label}{id==='handoff'&&draft?' · draft':''}</button>)}</nav>
  <div className="pt-entity" style={{paddingTop:26}}>
   <EntityHead crumb="Customer — 30-day POC" title="Northstar Engineering" meta={[['Champion','Maya'],['Handoff',state.handoff?`v${state.handoff.version} approved`:draft?'Draft in review':'Not approved']]}/>
   {session.error&&<div className="pt-banner error" role="alert"><span>{session.error}{session.conflict&&<> <button className="pt-link" onClick={()=>void session.refresh()}>Refresh now</button></>}</span></div>}
   <div style={{marginTop:24}}>
    {tab==='sources'&&<Sources session={session} onExtract={()=>{const d=extract(state.sources??[]);setDraft({...d,reviewed:false});navigate(base+'/handoff');}}/>}
    {tab==='handoff'&&<Handoff session={session} draft={draft} edit={edit} discard={()=>setDraft(null)} revise={()=>setDraft({briefing:state.handoff!.briefing,uncertainties:state.handoff!.uncertainties,held:[],reviewed:false})}/>}
    {tab==='versions'&&<Versions versions={state.versions??[]}/>}
    {tab==='adoption'&&<><Adoption state={state}/><section className="pt-section"><h3>Next account action</h3><p style={{marginTop:10}}>{Object.values(state.progress).every(p=>p?.ownership&&p?.docs)?'Review POC value with Maya.':'Check in with Maya on team adoption. Technical issues go to technical support first.'}</p></section></>}
   </div>
  </div>
 </>;
}

function Sources({session,onExtract}:{session:IgnitionSession;onExtract:()=>void}){
 const state=session.state!;
 const [kind,setKind]=useState(SOURCE_TYPES[0]),[raw,setRaw]=useState(''),[importing,setImporting]=useState(false),[open,setOpen]=useState<string|null>(null);
 return <div className="ig-split">
  <div>
   <section className="pt-section" aria-label="Sources">
    <div className="pt-section-head"><h3>Sources ({state.sources?.length??0})</h3><button className="pt-btn outline" onClick={()=>setImporting(true)}>Import with Claude Agent</button></div>
    <p className="pt-note">Raw notes stay in this customer file and are never shown to Maya or developers.</p>
    <table className="pt-table"><thead><tr><th style={{width:'24%'}}>Type</th><th>Content</th><th style={{width:90}}></th></tr></thead>
     <tbody>{(state.sources??[]).map(s=><tr key={s.id}><td>{s.kind.replace(' · SIMULATED','')}{/SIMULATED/.test(s.kind)&&<><br/><span className="pt-tag sim">Simulated import</span></>}<br/><small style={{color:'var(--p-subtle)'}}>{s.id}</small></td>
      <td><span className={open===s.id?'':'pt-clamp'} style={{whiteSpace:'pre-wrap'}}>{s.text}</span></td>
      <td><button className="pt-link" aria-expanded={open===s.id} onClick={()=>setOpen(open===s.id?null:s.id)}>{open===s.id?'Less':'More'}</button></td></tr>)}</tbody></table>
   </section>
   <section className="pt-section" aria-label="Add a source">
    <h3>Add notes</h3>
    <div className="pt-formfield"><label htmlFor="src-kind">Source type</label><select id="src-kind" className="pt-input" aria-label="Source type" value={kind} onChange={e=>setKind(e.target.value)}>{SOURCE_TYPES.map(x=><option key={x}>{x}</option>)}</select></div>
    <div className="pt-formfield"><label htmlFor="src-text">Paste source notes</label><textarea id="src-text" className="pt-textarea" aria-label="Paste source notes" rows={5} maxLength={8000} value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste customer context as written. Omit secrets."/><span className="help">Saved as written with its source type. Treated as data, never as instructions.</span></div>
    <div className="pt-actions"><button className="pt-btn sm" disabled={session.busy||!raw.trim()} onClick={async()=>{if(await session.save({action:'source',kind,text:raw}))setRaw('');}}>Save source</button></div>
   </section>
  </div>
  <aside className="ig-rail">
   <h3>Private account context</h3><p>{state.commercial}</p><p className="pt-note">Only visible to you. Excluded from every handoff.</p>
   <hr/>
   <h3>Developer handoff</h3><p>Extract a developer-safe draft from these sources, then review both fields before approving.</p>
   <button className="pt-btn sm" disabled={!state.sources?.length} onClick={onExtract}>Extract a review draft</button>
   <p className="pt-note">Commercial details are held back where detected. Review every line before approving.</p>
  </aside>
  {importing&&<Dialog title="Import from Claude Agent" onClose={()=>setImporting(false)} footer={<><button className="pt-link" style={{color:'#fff'}} onClick={()=>setImporting(false)}>Close</button><button className="pt-btn sm" disabled={session.busy} onClick={async()=>{if(await session.save({action:'source',kind:'Claude Agent import · SIMULATED',text:AGENT_IMPORT}))setImporting(false);}}>Import</button></>}>
   <p>Adds an agent-prepared summary to this customer file as a new source with its provenance.</p>
   <p><span className="pt-tag sim">Simulated</span> No agent is contacted. This demo adds a fixed sample summary:</p>
   <pre className="pt-code">{AGENT_IMPORT}</pre>
  </Dialog>}
 </div>;
}

function Handoff({session,draft,edit,discard,revise}:{session:IgnitionSession;draft:Draft|null;edit:(p:Partial<Draft>)=>void;discard:()=>void;revise:()=>void}){
 const state=session.state!,next=(state.handoff?.version??0)+1;
 if(!draft)return <div className="pt-cols">
  <section className="pt-section" aria-label="Approved developer handoff"><div className="pt-section-head"><h3>Approved developer handoff</h3>{state.handoff&&<span className="pt-pill green">{`Approved handoff v${state.handoff.version}`}</span>}</div>
   {state.handoff?<><HandoffLines text={state.handoff.briefing}/><p className="pt-note">Approved by {state.handoff.approvedBy} · {new Date(state.handoff.at).toLocaleString()}</p>
    <div className="pt-actions"><button className="pt-btn outline" onClick={revise}>Revise approved handoff</button></div></>
    :<><p className="pt-note">Nothing reaches Maya or developers until you review and approve a handoff.</p><div className="pt-actions"><button className="pt-btn outline" onClick={()=>navigate(routeBase(session.person))}>Go to sources</button></div></>}
  </section>
  <section className="pt-section" aria-label="Uncertainty & conflicts"><h3>Uncertainty & conflicts</h3>{state.handoff?<HandoffLines text={state.handoff.uncertainties}/>:<p className="pt-note">Okta readiness conflicts across notes. GitHub access is reported, not verified. Extraction keeps these as uncertainties.</p>}</section>
 </div>;
 const changes=state.handoff?lineDiff(state.handoff.briefing,draft.briefing).filter(l=>l.kind!=='same').length:0;
 return <section className="pt-section" aria-label="Review developer-safe extraction">
  <div className="pt-section-head"><h3>Review handoff v{next}</h3><span className="pt-pill amber">Draft · not published</span></div>
  <p className="pt-note">Only these two fields are published to Maya and developers. Commercial details and raw notes stay private.</p>
  <div className="pt-formfield"><label htmlFor="ho-brief">Developer context</label><textarea id="ho-brief" className="pt-textarea" aria-label="Developer context" rows={8} maxLength={8000} value={draft.briefing} onChange={e=>edit({briefing:e.target.value})}/></div>
  <div className="pt-formfield"><label htmlFor="ho-unc">Uncertainties and conflicts</label><textarea id="ho-unc" className="pt-textarea" aria-label="Uncertainties and conflicts" rows={4} maxLength={2000} value={draft.uncertainties} onChange={e=>edit({uncertainties:e.target.value})}/></div>
  {draft.held.length>0&&<details className="pt-disclosure" style={{marginTop:18}}><summary>Held back from extraction ({draft.held.length})</summary><ul className="pt-list">{draft.held.map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
  {state.handoff&&<details className="pt-disclosure" style={{marginTop:14}}><summary>Changes from v{state.handoff.version} ({changes})</summary><DiffView before={state.handoff.briefing} after={draft.briefing}/></details>}
  <label className="pt-check"><input type="checkbox" checked={draft.reviewed} onChange={e=>edit({reviewed:e.target.checked})}/>I reviewed both fields for privacy, accuracy and unresolved claims.</label>
  <div className="pt-actions">
   <button className="pt-approve" disabled={session.busy||!draft.reviewed||!draft.briefing.trim()||!draft.uncertainties.trim()} onClick={async()=>{if(await session.save({action:'publish',briefing:draft.briefing,uncertainties:draft.uncertainties,reviewed:draft.reviewed}))discard();}}><Check size={15} aria-hidden="true"/>Approve handoff v{next}</button>
   <button className="pt-reject" disabled={session.busy} onClick={discard}><X size={15} aria-hidden="true"/>Discard draft</button>
  </div>
  <p className="pt-note">Approving appends a version. Earlier developer outcomes stay attached to the version they were verified against.</p>
 </section>;
}

function DiffView({before,after}:{before:string;after:string}){
 return <div className="pt-diff" aria-label="Handoff changes">{lineDiff(before,after).map((l,i)=><div key={i} className={l.kind}>{l.kind==='add'?'+ ':l.kind==='del'?'− ':'  '}{l.text}</div>)}</div>;
}

function Versions({versions}:{versions:Version[]}){
 const [selected,setSelected]=useState(versions.at(-1)?.version??0);
 const v=versions.find(x=>x.version===selected),prev=versions.find(x=>x.version===selected-1);
 if(!versions.length)return <section className="pt-section"><h3>No approved versions yet</h3><p className="pt-note">Each approval appends an immutable version here.</p></section>;
 return <div className="pt-cols">
  <section className="pt-section" aria-label="Version history"><h3>Version history ({versions.length})</h3>
   <table className="pt-table"><thead><tr><th>Version</th><th>Approved by</th><th>Approved</th></tr></thead>
    <tbody>{[...versions].reverse().map(x=><tr key={x.version}><td><button className="pt-link" aria-pressed={x.version===selected} onClick={()=>setSelected(x.version)}>v{x.version}</button>{x.version===versions.length&&<> <span className="pt-pill green">Current</span></>}</td><td>{x.approvedBy}</td><td>{new Date(x.at).toLocaleString()}</td></tr>)}</tbody></table></section>
  {v&&<section className="pt-section" aria-label={`Handoff v${v.version}`}><h3>v{v.version}{prev?` compared with v${prev.version}`:''}</h3>
   {prev?<><p className="pt-label" style={{marginTop:18}}>Developer context</p><DiffView before={prev.briefing} after={v.briefing}/><p className="pt-label" style={{marginTop:18}}>Uncertainties</p><DiffView before={prev.uncertainties} after={v.uncertainties}/></>
    :<><HandoffLines text={v.briefing}/><hr/><HandoffLines text={v.uncertainties}/></>}</section>}
 </div>;
}
