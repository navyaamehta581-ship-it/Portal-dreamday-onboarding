import {Check,LoaderCircle,Plus,X} from 'lucide-react';
import type {AnalysisStage} from '../../../../contracts/activation/v1/handoff';
import {navigate} from '../portal-app/router';
import {CATEGORIES,type CustomerWorkspace} from './useCustomerWorkspace';

const STAGES:[AnalysisStage,string][]=[['preparing','Preparing information'],['interpreting','Interpreting customer context'],['planning','Generating technical onboarding plan'],['preparing_review','Preparing review']];
const ERRORS:Record<string,string>={REVISION_CONFLICT:'This information was changed in another tab. Reload to see the latest saved version; your edits here are kept until you do.',
 ALREADY_PUBLISHED:'This customer is already published to developers, so its information can no longer change.',AWAITING_CHAMPION_REVIEW:'A draft is waiting for Champion review in Dream Day. Withdraw it on the Onboarding Draft tab before analyzing again.',ALREADY_APPROVED:'The Champion already approved this plan.',
 INVALID_REQUEST:'Add some text to at least one entry before analyzing.',PAYLOAD_TOO_LARGE:'That’s more text than one customer workspace can hold (120,000 characters). Shorten or split it.',
 ADAPTER_UNAVAILABLE:'Analysis isn’t available on this server.',ANALYSIS_FAILED:'The analysis stopped unexpectedly. Your information is saved; try again.',
 PERSONA_UNAVAILABLE:'Operator access for this customer isn’t configured on the demo server.'};
export const describe=(code:string)=>ERRORS[code]??`Something went wrong (${code}). Your saved work is unchanged.`;
export const elapsed=(ms:number)=>{const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const rowsFor=(text:string)=>Math.min(18,Math.max(4,text.split('\n').length+1));

/** Customer Context: Chris's information entries (private to Chris), and the analysis that turns them into a draft. */
export function InformationTab({ws,locked}:{ws:CustomerWorkspace;locked:boolean}){
 const saved=ws.overview?.workspace;
 const filled=ws.sources.some(s=>s.text.trim());
 return <div className="pt-grid">
  <section className="pt-card pt-span" aria-label="Customer information">
   <div className="pt-card-head"><h3>Customer information</h3><SaveState dirty={ws.sourcesDirty} savedAt={saved?.updatedAt??null} saving={ws.busy==='sources'}/></div>
   <p className="pt-note">Add what you know as separate entries: call transcripts, CRM records, your notes, technical requirements. Only you can see these entries. Analysis reads your saved entries; nothing is shared with the customer or developers.</p>
   {locked?<ul className="pt-findings">{ws.sources.filter(s=>s.text.trim()).map(s=><li key={s.id}><span className="pt-pill">{CATEGORIES.find(([v])=>v===s.type)?.[1]}</span><span>{s.label||'Untitled'}<small className="pt-clamp">{s.text}</small></span></li>)}</ul>:<>
    {ws.sources.map((s,i)=><div className="pt-source" key={s.id}>
     <div className="pt-source-head">
      <select className="pt-input" aria-label={`Information ${i+1} category`} value={s.type} onChange={e=>ws.setSource(i,{type:e.target.value as typeof s.type})}>{CATEGORIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <input className="pt-input" aria-label={`Information ${i+1} name`} placeholder="Name, e.g. Discovery call with the platform lead" maxLength={80} value={s.label} onChange={e=>ws.setSource(i,{label:e.target.value})}/>
      <button className="pt-icon" aria-label={`Remove information ${i+1}`} title="Remove this entry" onClick={()=>ws.removeSource(i)}><X size={16}/></button>
     </div>
     <textarea className="pt-textarea" aria-label={`Information ${i+1} text`} rows={rowsFor(s.text)} maxLength={60000} value={s.text} onChange={e=>ws.setSource(i,{text:e.target.value})} placeholder="Paste as-is. Leave out passwords, keys and other secrets."/>
     <p className="pt-note" style={{marginTop:6,textAlign:'right'}}>{s.text.length.toLocaleString()} characters</p>
    </div>)}
    <div className="pt-actions">
     <button className="pt-btn sm ghost" disabled={ws.sources.length>=12} onClick={ws.addSource}><Plus size={15} aria-hidden="true"/>Add information</button>
     <button className="pt-btn sm" disabled={!ws.sourcesDirty||ws.busy==='sources'} onClick={()=>void ws.saveSources()}>{ws.busy==='sources'?'Saving…':'Save information'}</button>
     {ws.sourcesDirty&&<button className="pt-link" onClick={ws.discardSources}>Discard changes</button>}
    </div>
    {ws.error?.scope==='sources'&&<div className="pt-banner error" role="alert">{describe(ws.error.code)}</div>}
   </>}
  </section>
  {!locked&&<AnalysisPanel ws={ws} filled={filled}/>}
 </div>;
}

function SaveState({dirty,savedAt,saving}:{dirty:boolean;savedAt:string|null;saving:boolean}){
 return <span className="pt-savestate" role="status">{saving?'Saving…':dirty?<span className="pt-pill amber">Unsaved changes</span>:savedAt?<><Check size={14} aria-hidden="true"/>Saved {new Date(savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</>:'Not saved yet'}</span>;
}

function AnalysisPanel({ws,filled}:{ws:CustomerWorkspace;filled:boolean}){
 const job=ws.analysis,running=ws.running,current=job?STAGES.findIndex(([s])=>s===job.stage):-1;
 const stale=job&&job.status==='succeeded'&&(ws.sourcesDirty||(ws.overview?.workspace.revision??0)>job.workspaceRevision);
 const waiting=ws.latest?.status==='submitted'||ws.latest?.status==='resubmitted'||ws.latest?.status==='approved';
 return <section className="pt-card pt-span" aria-label="Analysis">
  <div className="pt-card-head"><h3>Analyze customer</h3>
   <button className="pt-btn sm" disabled={running||ws.starting||!filled||waiting} aria-disabled={running||ws.starting} onClick={()=>void ws.analyze()}>{running||ws.starting?'Analyzing…':ws.latest?'Analyze again':'Analyze customer'}</button></div>
  {!running&&<p className="pt-note">Analysis reads your saved information and drafts the engineering problem, stakeholders, goals, milestones and questions for you to review.{ws.sourcesDirty?' Your unsaved changes are saved first.':''} Local analysis may take 1–2 minutes; you can keep working while it runs.</p>}
  {waiting&&<p className="pt-note">{ws.latest?.status==='approved'?'The Champion approved this plan in Dream Day.':'A draft is waiting for Champion review in Dream Day. Withdraw it on the Onboarding Draft tab to analyze again.'}</p>}
  {running&&job&&<div role="status" aria-live="polite" aria-label="Analysis progress">
   <ol className="pt-analysis-stages">{STAGES.map(([id,label],i)=><li key={id} className={i<current?'done':i===current?'current':''}>
    <span className="mark" aria-hidden="true">{i<current?<Check size={14}/>:i===current?<LoaderCircle size={14} className="pt-spin"/>:null}</span>
    <span>{label}{i===current&&job.stageDetail?<small> · {job.stageDetail}</small>:null}<span className="pt-sr">{i<current?' (finished)':i===current?' (in progress)':' (not started)'}</span></span></li>)}</ol>
   <p className="pt-note">Elapsed {elapsed(ws.elapsedMs)}. Local analysis may take 1–2 minutes. The server reports which stage is running; it can’t estimate how much is left. You can keep editing: this run uses the information you saved before starting.</p>
  </div>}
  {!running&&job?.status==='succeeded'&&<>
   {job.modelOk===false?<div className="pt-banner warn" role="status">The AI model wasn’t available ({job.modelError}{job.modelError==='AI_DAILY_LIMIT'?': the demo’s daily AI limit was reached':job.modelError==='MODEL_RATE_LIMITED'?': the AI provider is rate limiting requests':''}), so this draft comes from rule-based analysis, not the model. Your information is saved; analyze again later.</div>
    :<div className="pt-banner" role="status">Analysis ready{job.interpreter==='hosted_model'?' · produced by the AI model':' · rule-based analysis (no model configured)'} · took {elapsed(job.elapsedMs)}.</div>}
   {stale&&<p className="pt-note">Your information changed after this analysis. Analyze again to include the changes.</p>}
   <div className="pt-actions"><button className="pt-btn sm ghost" onClick={()=>navigate('/operator/draft')}>Review the onboarding draft</button></div>
  </>}
  {!running&&job?.status==='failed'&&<div className="pt-banner error" role="alert">{describe(job.error??'ANALYSIS_FAILED')}</div>}
  {ws.error?.scope==='analysis'&&<div className="pt-banner error" role="alert">{describe(ws.error.code)}</div>}
 </section>;
}
