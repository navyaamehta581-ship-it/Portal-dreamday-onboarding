import {useState} from 'react';
import {Plus,X} from 'lucide-react';
import type {ActivationState} from '../../../../contracts/activation/v1/state';
import type {Finding,HandoffRecord,SourceRef,Unknown} from '../../../../contracts/activation/v1/handoff';
import {navigate} from '../portal-app/router';
import {SOURCE_TYPES,type OperatorDraft} from './useOperatorDraft';
import {versionLabel} from './versions';

const STATUS:Record<Finding['status'],[string,string]>={verified:['Verified','green'],reported:['Reported',''],assumption:['Unconfirmed','amber'],contradicted:['Conflicting','red'],outdated:['Outdated','']};
const PRIORITY:[Unknown['priority'],string][]=[['blocks_first_milestone','Blocks the first milestone'],['needed_later','Needed later'],['not_needed_now','Not needed now']];
const INTERNAL_LABEL:Record<string,string>={commercial:'Commercial',stakeholder:'People',evaluation:'Evaluation',internal_note:'Note',business_need:'Need'};

/** Customer Context: sources in, structured understanding out. Developers never receive this page's data. */
export function ContextTab({draft,state}:{draft:OperatorDraft;state:ActivationState|null}){
 const [viewing,setViewing]=useState<string|null>(null);
 const record=draft.record,locked=!!state;
 const source=record?.sources.find(s=>s.id===viewing);
 return <div className="pt-grid">
  {!locked&&<section className="pt-card pt-span" aria-label="Customer sources">
   <div className="pt-card-head"><h3>Customer sources</h3>{record&&<span className="pt-pill">{versionLabel(record)}</span>}</div>
   <p className="pt-note">Paste CRM records, call transcripts, your notes and technical details as they are. Nothing is shared until you publish.</p>
   {draft.sources.map((s,i)=><div className="pt-source" key={i}>
    <div className="pt-source-head">
     <select className="pt-input" aria-label={`Source ${i+1} type`} value={s.type} onChange={e=>draft.setSource(i,{type:e.target.value as typeof s.type})}>{SOURCE_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
     <input className="pt-input" aria-label={`Source ${i+1} name`} placeholder="Name, e.g. Discovery call with the platform lead" maxLength={80} value={s.label} onChange={e=>draft.setSource(i,{label:e.target.value})}/>
     {draft.sources.length>1&&<button className="pt-icon" aria-label={`Remove source ${i+1}`} onClick={()=>draft.removeSource(i)}><X size={16}/></button>}
    </div>
    <textarea className="pt-textarea" aria-label={i===0?'Raw account and call notes':`Source ${i+1} text`} rows={i===0?8:5} maxLength={60000} value={s.text} onChange={e=>draft.setSource(i,{text:e.target.value})} placeholder="Paste as-is. Omit secrets."/>
   </div>)}
   <div className="pt-actions">
    <button className="pt-btn sm" disabled={draft.busy||!draft.sources.some(s=>s.text.trim())} onClick={()=>void draft.analyze()}>{draft.busy?'Analyzing…':record?'Analyze again':'Analyze sources'}</button>
    <button className="pt-link" disabled={draft.sources.length>=12} onClick={draft.addSource}><Plus size={14} aria-hidden="true"/> Add another source</button>
   </div>
   {draft.error&&<div className="pt-banner error" role="alert">{draft.error==='ADAPTER_UNAVAILABLE'?'Analysis isn’t available on this server.':`Analysis failed (${draft.error}). Your sources are kept here.`}</div>}
  </section>}
  {record?<Analysis record={record} onView={setViewing} onContinue={locked?null:()=>navigate('/operator/goal')}/>:locked&&<LegacyContext state={state!}/>}
  {source&&<div className="pt-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setViewing(null);}}>
   <div className="pt-dialog" role="dialog" aria-modal="true" aria-label={source.label||'Source'}>
    <div className="pt-dialog-head"><span><strong>{source.label||SOURCE_TYPES.find(([v])=>v===source.type)?.[1]}</strong><small>{SOURCE_TYPES.find(([v])=>v===source.type)?.[1]}</small></span><button aria-label="Close source" onClick={()=>setViewing(null)}><X size={16}/></button></div>
    <pre className="pt-pre pt-dialog-body">{source.text}</pre>
   </div></div>}
 </div>;
}

function Refs({refs,onView}:{refs:SourceRef[];onView:(id:string)=>void}){
 return <span className="pt-refs">{refs.map(r=><button key={r.sourceId} className="pt-ref" title={`“${r.excerpt}”`} onClick={()=>onView(r.sourceId)}>{r.label||r.type}</button>)}</span>;
}

function Analysis({record,onView,onContinue}:{record:HandoffRecord;onView:(id:string)=>void;onContinue:(()=>void)|null}){
 const u=record.understanding,known=u.findings.filter(f=>f.audience!=='internal'),internal=u.findings.filter(f=>f.audience==='internal');
 const m=record.proposal.milestones[0];
 return <>
  <section className="pt-card" aria-label="Known and unknown">
   <div className="pt-card-head"><h3>What we know</h3><span className="pt-note" style={{marginTop:0}}>{u.interpreter==='hosted_model'?'Model-assisted analysis':'Rule-based analysis'}</span></div>
   {u.contradictions.map(c=><div key={c.topic} className="pt-banner warn" role="status"><strong>{c.topic}:</strong>&nbsp;{c.summary}</div>)}
   <ul className="pt-findings">{known.map(f=><li key={f.id}><span className={'pt-pill '+STATUS[f.status][1]}>{STATUS[f.status][0]}</span><span>{f.statement}<Refs refs={f.sources} onView={onView}/></span></li>)}</ul>
   {u.goals.length>0&&<><p className="pt-label" style={{marginTop:22}}>Technical goal</p><p style={{marginTop:6}}>{u.goals[0].technicalGoal}</p></>}
   <hr/>
   <h3>Still unknown</h3>
   {PRIORITY.map(([p,label])=>{const items=u.unknowns.filter(x=>x.priority===p);return items.length?<div key={p} aria-label={label}><p className="pt-label" style={{marginTop:16}}>{label}</p>
    <ul className="pt-findings">{items.map(x=><li key={x.id}><span className="pt-pill">{x.audience==='developer'?'Developer can check':'Ask the customer'}</span><span>{x.question}<small>{x.reason}</small></span></li>)}</ul></div>:null;})}
  </section>
  <section className="pt-card" aria-label="Review before publishing">
   <h3>What developers will see</h3>
   {m?<><p className="pt-label" style={{marginTop:18}}>First milestone</p><p style={{marginTop:6,fontWeight:600}}>{m.objective}</p>
    <p className="pt-note">{m.why}</p></>:<div className="pt-banner warn" role="status">No technical milestone yet. Missing: {record.proposal.missing.join(' ')}</div>}
   <p className="pt-note">Developers get the milestone, technical facts and the unknowns they can check. Everything below stays with you.</p>
   <hr/>
   <p className="pt-label">Kept internal ({internal.length})</p>
   <ul className="pt-findings compact">{internal.map(f=><li key={f.id}><span className="pt-pill">{INTERNAL_LABEL[f.category]??'Note'}</span><span className="pt-clamp">{f.statement}<Refs refs={f.sources} onView={onView}/></span></li>)}</ul>
   {onContinue&&<div className="pt-actions"><button className="pt-btn sm" onClick={onContinue}>Continue to Activation Goal</button></div>}
  </section>
 </>;
}

/** Customers published before source analysis existed: show what developers see, nothing private. */
function LegacyContext({state}:{state:ActivationState}){
 return <section className="pt-card pt-span" aria-label="Published customer handoff">
  <h3>Published context</h3>
  <p style={{marginTop:14,whiteSpace:'pre-wrap'}}>{state.context.briefing}</p>
  <hr/><p className="pt-label">Still unknown</p><ul className="pt-list">{state.context.unknowns.map(u=><li key={u}>{u}</li>)}</ul>
 </section>;
}
