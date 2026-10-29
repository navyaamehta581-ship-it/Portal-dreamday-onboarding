import {useRef,useState,type DragEvent} from 'react';
import {Check,FileText,FileUp,LoaderCircle,TriangleAlert} from 'lucide-react';
import type {AnalysisStage,DocumentReport} from '../../../../contracts/activation/v1/handoff';
import {navigate} from '../portal-app/router';
import {CATEGORIES,PDF_MAX_BYTES,type CustomerWorkspace} from './useCustomerWorkspace';

const STAGES:[AnalysisStage,string][]=[['preparing','Preparing information'],['interpreting','Interpreting customer context'],['planning','Generating technical onboarding plan'],['preparing_review','Preparing review']];
const ERRORS:Record<string,string>={REVISION_CONFLICT:'This information was changed in another tab. Reload to see the latest version.',
 ALREADY_PUBLISHED:'This customer is already published to developers, so its information can no longer change.',AWAITING_CHAMPION_REVIEW:'A draft is waiting for Champion review in Dream Day. Withdraw it on the Onboarding Draft tab before uploading a new PDF.',ALREADY_APPROVED:'The Champion already approved this plan.',
 INVALID_REQUEST:'The information read from the PDF couldn’t be analyzed. Upload the PDF again.',
 ADAPTER_UNAVAILABLE:'Analysis isn’t available on this server.',ANALYSIS_FAILED:'The analysis stopped unexpectedly. The information read from your PDF is saved; try the analysis again.',
 PERSONA_UNAVAILABLE:'Operator access for this customer isn’t configured on the demo server.',
 // PDF upload
 NOT_A_PDF:'That file isn’t a PDF. Save or export the customer information as a PDF, then upload it.',
 PDF_REQUIRED:'Choose a PDF file to upload. The file you chose is empty or isn’t a PDF.',
 PDF_TOO_LARGE:'That PDF is larger than 8 MB. Remove large images or split it, then upload it again.',PAYLOAD_TOO_LARGE:'That PDF is larger than 8 MB. Remove large images or split it, then upload it again.',
 PDF_INVALID:'This PDF looks damaged or incomplete, so it can’t be read. Export it again and upload the new file.',
 PDF_ENCRYPTED:'This PDF is password-protected. Export an unprotected copy, then upload that.',
 PDF_UNREADABLE:'This PDF couldn’t be read. It may use features the reader doesn’t support. Try exporting or printing it to a new PDF.',
 PDF_TIMEOUT:'Reading this PDF took too long and was stopped. Try a smaller or simpler PDF.',
 PDF_BUSY:'Other documents are being read right now. Try again in a minute.',
 ANALYSIS_RUNNING:'An analysis is already running. Wait for it to finish before uploading another PDF.',
 ANALYSIS_LIMIT:'This demo room has reached today’s analysis limit. Start a new room from the Fictional demo menu, or try again tomorrow.',
 RATE_LIMITED:'Too many requests in a short time. Wait a minute, then try again.',
 ACTIVATION_UNAVAILABLE:'The upload didn’t reach the server. Check your connection and try again.',ACTIVATION_API_UNREACHABLE:'The customer’s activation API isn’t reachable. Check that the demo API is running.'};
export const describe=(code:string)=>ERRORS[code]??`Something went wrong (${code}). Your saved work is unchanged.`;
export const elapsed=(ms:number)=>{const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const label=(type:string)=>CATEGORIES.find(([v])=>v===type)?.[1]??type;
const list=(pages:number[])=>pages.length>6?`${pages.slice(0,6).join(', ')} and ${pages.length-6} more`:pages.join(', ');
const plain=(s:string)=>s.toLowerCase().replace(/\(fictional\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();

/** Customer Context: Chris uploads one PDF; the server reads it into customer information (private to Chris) and
 * starts the analysis that turns it into a draft. */
export function InformationTab({ws,locked,customer=''}:{ws:CustomerWorkspace;locked:boolean;customer?:string}){
 const doc=ws.document;
 const waiting=ws.latest?.status==='submitted'||ws.latest?.status==='resubmitted'||ws.latest?.status==='approved';
 return <div className="pt-grid">
  <section className="pt-card pt-span" aria-label="Customer information">
   <div className="pt-card-head"><h3>Customer information</h3>{doc&&<span className="pt-savestate" role="status"><Check size={14} aria-hidden="true"/>Read {new Date(doc.uploadedAt).toLocaleString([], {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}</div>
   {!locked&&<Dropzone ws={ws} sample={/fictional/i.test(customer)} replacing={!!doc||ws.sources.length>0} disabled={waiting?ws.latest?.status==='approved'?'The Champion approved this plan, so its information can no longer change.':'A draft is waiting for Champion review in Dream Day. Withdraw it on the Onboarding Draft tab to upload a new PDF.':ws.running?'An analysis is running. You can upload a new PDF when it finishes.':null}/>}
   {ws.error?.scope==='upload'&&<div className="pt-banner error" role="alert">{ws.error.code==='PDF_NO_TEXT'?noText(ws.error.details):describe(ws.error.code)}</div>}
   {doc?<DocumentSummary doc={doc} customer={customer} ws={ws}/>:ws.sources.length>0&&<EarlierInformation ws={ws}/>}
  </section>
  {!locked&&<AnalysisPanel ws={ws} waiting={waiting}/>}
 </div>;
}

function noText(details:unknown){
 const pages=(details as {pages?:number}|null)?.pages;
 return `No text could be read from this PDF${pages?` (${pages} page${pages===1?'':'s'})`:''}. It looks like a scan or photos of pages, which can’t be read here. Export the original document as a PDF with selectable text, or run it through OCR first, then upload it again.`;
}

/** A fictional document to try the workflow with, for the fictional demo customers only. */
export const SAMPLE_PDF='/samples/aperture-commerce-discovery-notes-fictional.pdf';
function Dropzone({ws,replacing,disabled,sample}:{ws:CustomerWorkspace;replacing:boolean;disabled:string|null;sample:boolean}){
 const input=useRef<HTMLInputElement>(null);
 const [over,setOver]=useState(false),[name,setName]=useState('');
 const busy=ws.busy==='upload';
 function take(files:FileList|null){const f=files?.[0];if(!f||disabled||busy)return;setName(f.name);void ws.upload(f);}
 const drag=(on:boolean)=>(e:DragEvent)=>{e.preventDefault();if(!disabled&&!busy)setOver(on);};
 return <div className={'pt-drop'+(over?' over':'')+(disabled?' disabled':'')+(replacing?' compact':'')}
  onDragOver={drag(true)} onDragEnter={drag(true)} onDragLeave={drag(false)} onDrop={e=>{e.preventDefault();setOver(false);take(e.dataTransfer.files);}}>
  <input ref={input} type="file" accept="application/pdf,.pdf" className="pt-sr" aria-label="Customer PDF" disabled={!!disabled||busy} onChange={e=>{take(e.target.files);e.target.value='';}}/>
  {busy?<div className="pt-drop-body" role="status" aria-live="polite"><LoaderCircle size={28} className="pt-spin" aria-hidden="true"/><strong>Reading {name||'your PDF'}…</strong><span>Extracting the text and starting the analysis.</span></div>
  :<div className="pt-drop-body">
   <FileUp size={replacing?22:32} aria-hidden="true"/>
   <strong>{replacing?'Upload a new PDF to replace this information':'Drop the customer’s PDF here'}</strong>
   <span>{disabled??<>Call notes, CRM export, account plan, requirements: one PDF with what you know. Analysis starts automatically.</>}</span>
   {!disabled&&<button className={'pt-btn sm'+(replacing?' ghost':'')} onClick={()=>input.current?.click()}>Choose PDF</button>}
   <small>PDF only · up to {PDF_MAX_BYTES/1024/1024} MB · text-based PDFs (scans can’t be read) · the file isn’t kept, only its text, visible to you only</small>
   {sample&&!disabled&&<a className="pt-link" href={SAMPLE_PDF} download>Don’t have one? Download a fictional sample PDF</a>}
  </div>}
 </div>;
}

/** What was read from the PDF, and everything that wasn't: shown before and beside the analysis, never hidden. */
function DocumentSummary({doc,customer,ws}:{doc:DocumentReport;customer:string;ws:CustomerWorkspace}){
 const named=doc.customer.name,mismatch=named&&customer&&!plain(named).includes(plain(customer).split(' ')[0])&&!plain(customer).includes(plain(named).split(' ')[0]);
 const uncertain=doc.sections.filter(s=>s.basis==='default');
 const MISSING:Record<string,string>={customer:'which customer it’s about',people:'people and their roles',systems:'systems, services or repositories',goals:'goals, problems or needs'};
 return <div className="pt-doc">
  <div className="pt-doc-file"><FileText size={20} aria-hidden="true"/><div><strong>{doc.fileName}</strong>
   <span>{doc.pagesRead===doc.pages?`${doc.pages} page${doc.pages===1?'':'s'}`:`${doc.pagesRead} of ${doc.pages} pages read`} · {doc.characters.toLocaleString()} characters · {doc.sections.length} section{doc.sections.length===1?'':'s'}{named?<> · customer: <strong>{named}</strong>{doc.customer.basis==='title'?' (from the title)':''}</>:null}</span></div>
   <span className={'pt-pill '+(doc.complete?'green':'amber')}>{doc.complete?'Fully read':'Partly read'}</span></div>
  {!doc.complete&&<div className="pt-banner warn" role="status"><TriangleAlert size={16} aria-hidden="true"/> <span><strong>Not everything in this PDF was read.</strong>{' '}
   {doc.emptyPages.length>0&&<>Page{doc.emptyPages.length===1?'':'s'} {list(doc.emptyPages)} had no readable text (probably scanned images). </>}
   {doc.unreadablePages.length>0&&<>Page{doc.unreadablePages.length===1?'':'s'} {list(doc.unreadablePages)} couldn’t be read. </>}
   {doc.notRead&&<>Pages {doc.notRead.from}–{doc.notRead.to} are beyond the 60-page limit and weren’t read. </>}
   {doc.truncated&&<>The text was longer than the analysis can take, so the end was left out. </>}
   The analysis only uses what was read. Check the missing parts yourself and add anything important to the draft.</span></div>}
  {mismatch&&<div className="pt-banner warn" role="status">This PDF names <strong>{named}</strong>, but you’re working on <strong>{customer}</strong>. Check it’s the right document before using the analysis.</div>}
  {doc.missing.length>0&&<p className="pt-note"><strong>Not found in the document:</strong> {doc.missing.map(m=>MISSING[m]).join('; ')}. The analysis will list these as unknowns rather than guess.</p>}
  <details className="pt-details"><summary>How the document was read ({doc.sections.length} section{doc.sections.length===1?'':'s'})</summary>
   <ul className="pt-findings">{doc.sections.map((s,i)=><li key={i}><span className="pt-pill">{label(s.type)}</span><span>{s.label}<small>{s.chars.toLocaleString()} characters · {s.basis==='heading'?'category from its heading':s.basis==='content'?'category from its content':'category uncertain: no heading or content clue'}</small></span></li>)}</ul>
   {uncertain.length>0&&<p className="pt-note">Sections marked uncertain were read as account preparation. Internal notes and CRM sections are kept private when their heading says so (for example “Internal notes” or “CRM record”).</p>}
   {doc.removedLines>0&&<p className="pt-note">{doc.removedLines} repeated header, footer or page-number line{doc.removedLines===1?' was':'s were'} left out.</p>}
  </details>
  {ws.sources.length>0&&<details className="pt-details"><summary>Read text</summary>
   <ul className="pt-findings">{ws.sources.map(s=><li key={s.id}><span className="pt-pill">{label(s.type)}</span><span>{s.label||'Untitled'}<small className="pt-clamp">{s.text}</small></span></li>)}</ul></details>}
 </div>;
}

/** Customers whose information was typed in before PDF upload existed: shown read-only. */
function EarlierInformation({ws}:{ws:CustomerWorkspace}){
 return <div className="pt-doc"><p className="pt-note">Information saved before PDF upload. Upload a PDF to replace it.</p>
  <ul className="pt-findings">{ws.sources.filter(s=>s.text.trim()).map(s=><li key={s.id}><span className="pt-pill">{label(s.type)}</span><span>{s.label||'Untitled'}<small className="pt-clamp">{s.text}</small></span></li>)}</ul></div>;
}

function AnalysisPanel({ws,waiting}:{ws:CustomerWorkspace;waiting:boolean}){
 const job=ws.analysis,running=ws.running,current=job?STAGES.findIndex(([s])=>s===job.stage):-1;
 // A retry only where it helps: a failed run, a rule-based fallback, or information saved without a finished run.
 const retry=!running&&!waiting&&ws.sources.length>0&&(job?.status==='failed'||job?.modelOk===false||(!job&&!ws.latest));
 return <section className="pt-card pt-span" aria-label="Analysis">
  <div className="pt-card-head"><h3>Analysis</h3>
   {retry&&<button className="pt-btn sm ghost" disabled={ws.starting} onClick={()=>void ws.analyze()}>{ws.starting?'Starting…':'Analyze again'}</button>}</div>
  {!running&&!job&&!ws.latest&&<p className="pt-note">Analysis starts automatically when you upload a PDF. It drafts the engineering problem, stakeholders, goals, milestones and questions for you to review.</p>}
  {waiting&&<p className="pt-note">{ws.latest?.status==='approved'?'The Champion approved this plan in Dream Day.':'A draft is waiting for Champion review in Dream Day.'}</p>}
  {running&&job&&<div role="status" aria-live="polite" aria-label="Analysis progress">
   <ol className="pt-analysis-stages">{STAGES.map(([id,text],i)=><li key={id} className={i<current?'done':i===current?'current':''}>
    <span className="mark" aria-hidden="true">{i<current?<Check size={14}/>:i===current?<LoaderCircle size={14} className="pt-spin"/>:null}</span>
    <span>{text}{i===current&&job.stageDetail?<small> · {job.stageDetail}</small>:null}<span className="pt-sr">{i<current?' (finished)':i===current?' (in progress)':' (not started)'}</span></span></li>)}</ol>
   <p className="pt-note">Elapsed {elapsed(ws.elapsedMs)}. Analysis can take a minute or two; you can leave this page and come back. The server reports which stage is running; it can’t estimate how much is left.</p>
  </div>}
  {!running&&job?.status==='succeeded'&&<>
   {job.modelOk===false?<div className="pt-banner warn" role="status">The AI model wasn’t available ({job.modelError}{job.modelError==='AI_DAILY_LIMIT'?': the demo’s daily AI limit was reached':job.modelError==='MODEL_RATE_LIMITED'?': the AI provider is rate limiting requests':''}), so this draft comes from rule-based analysis, not the model. The information from your PDF is saved; analyze again later.</div>
    :<div className="pt-banner" role="status">Analysis ready{job.interpreter==='hosted_model'?' · produced by the AI model':' · rule-based analysis (no model configured)'} · took {elapsed(job.elapsedMs)}.</div>}
   {ws.document&&!ws.document.complete&&<p className="pt-note">This analysis is based on a partly read PDF (see above).</p>}
   <div className="pt-actions"><button className="pt-btn sm" onClick={()=>navigate('/operator/draft')}>Review the onboarding draft</button></div>
  </>}
  {!running&&job?.status==='failed'&&<div className="pt-banner error" role="alert">{describe(job.error??'ANALYSIS_FAILED')}</div>}
  {ws.error?.scope==='analysis'&&<div className="pt-banner error" role="alert">{describe(ws.error.code)}</div>}
 </section>;
}
