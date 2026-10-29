import {useCallback,useEffect,useRef,useState} from 'react';
import type {AnalysisJob,HandoffOverview,HandoffRecord,ReviewDraft,SourceType} from '../../../../contracts/activation/v1/handoff';
import {ActivationRequestError,type activationClient} from '../activation/client';

/** The seven information categories, in the order Chris sees them. */
export const CATEGORIES:[SourceType,string][]=[['conversation','Conversational Transcript'],['crm','CRM Record'],['chris_notes','My Notes'],['account_prep','Account Preparation'],
 ['technical_requirements','Technical Requirements'],['repository','Repository Observation'],['integration_tools','Integration Tools']];
export type ReviewIssue={path:string;label:string;reason:string};
export type WorkspaceError={scope:'load'|'upload'|'analysis'|'review'|'submit';code:string;issues?:ReviewIssue[];details?:unknown};
/** The server's limit; checked here too so an oversized file fails at once, not after uploading. */
export const PDF_MAX_BYTES=8*1024*1024;
const codeOf=(e:unknown)=>e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE';
const issuesOf=(e:unknown)=>e instanceof ActivationRequestError?((e.details as {issues?:ReviewIssue[]}|null)?.issues):undefined;
const detailsOf=(e:unknown)=>e instanceof ActivationRequestError?e.details:undefined;

/** Drop empty list entries before saving; Chris may leave blank lines while editing. */
export function tidyReview(r:ReviewDraft):ReviewDraft{
 const items=<T extends {text:string}>(xs:T[])=>xs.filter(x=>x.text.trim()).map(x=>({...x,text:x.text.trim()}));
 const lines=(xs:string[])=>xs.map(x=>x.trim()).filter(Boolean);
 return {...r,problem:{...r.problem,summary:r.problem.summary.trim(),challenges:items(r.problem.challenges),systems:items(r.problem.systems),contradictions:items(r.problem.contradictions),unknowns:items(r.problem.unknowns)},
  facts:items(r.facts),goals:items(r.goals),questions:items(r.questions),
  stakeholders:r.stakeholders.filter(s=>s.name.trim()&&s.role.trim()).map(s=>({...s,name:s.name.trim(),role:s.role.trim(),responsibilities:s.responsibilities.trim()})),
  milestones:r.milestones.map(m=>({...m,title:m.title.trim(),description:m.description.trim(),system:m.system.trim(),actions:lines(m.actions),completionCriteria:lines(m.completionCriteria)}))};
}

/** Chris's workspace for one customer: the uploaded PDF's information, the background analysis it starts, and the
 * editable review. Unsaved review edits live only in this tab; everything saved lives on the server and survives a reload. */
export function useCustomerWorkspace(api:ReturnType<typeof activationClient>|null){
 const [overview,setOverview]=useState<HandoffOverview|null>(null);
 const [review,setReviewState]=useState<ReviewDraft|null>(null),[reviewDirty,setReviewDirty]=useState(false);
 const [busy,setBusy]=useState<''|'load'|'upload'|'analysis'|'review'|'submit'>('load');
 const [error,setError]=useState<WorkspaceError|null>(null);
 const [analysis,setAnalysis]=useState<AnalysisJob|null>(null);
 // Elapsed time comes from the server at each poll and ticks locally in between.
 const [clock,setClock]=useState<{elapsedMs:number;at:number}|null>(null),[,tick]=useState(0);
 const starting=useRef(false),dirty=useRef({review:false});
 dirty.current={review:reviewDirty};

 const latest=overview?.drafts.at(-1)??null;
 const adopt=useCallback((o:HandoffOverview)=>{
  setOverview(o);setAnalysis(o.analysis);if(o.analysis)setClock({elapsedMs:o.analysis.elapsedMs,at:Date.now()});
  // Never overwrite review edits Chris hasn't saved.
  if(!dirty.current.review)setReviewState(o.drafts.at(-1)?.review??null);
 },[]);
 const load=useCallback(async()=>{
  if(!api)return;setBusy(b=>b||'load');
  try{adopt(await api.handoffOverview());setError(e=>e?.scope==='load'?null:e);}
  catch(e){setError({scope:'load',code:codeOf(e)});}
  finally{setBusy(b=>b==='load'?'':b);}
 },[api,adopt]);
 useEffect(()=>{setOverview(null);setReviewState(null);setReviewDirty(false);setAnalysis(null);setError(null);setBusy('load');void load();},[api]); // eslint-disable-line react-hooks/exhaustive-deps

 const running=analysis?.status==='running';
 useEffect(()=>{
  if(!api||!running)return;
  const poll=window.setInterval(async()=>{
   try{const {job}=await api.analysisStatus();setAnalysis(job);if(job)setClock({elapsedMs:job.elapsedMs,at:Date.now()});
    if(job&&job.status!=='running'){setReviewDirty(false);dirty.current.review=false;await load();}}
   catch{/* keep polling; a transient failure is not an analysis failure */}
  },1500);
  const second=window.setInterval(()=>tick(n=>n+1),1000);
  return()=>{window.clearInterval(poll);window.clearInterval(second);};
 },[api,running,load]);
 // Leaving with unsaved edits asks first; saved work is never lost.
 useEffect(()=>{
  if(!reviewDirty)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[reviewDirty]);

 const replace=(record:HandoffRecord)=>setOverview(o=>o&&{...o,drafts:o.drafts.map(d=>d.draft===record.draft?record:d)});
 /** Chris's one way in: a PDF. The server reads it, saves what it found and starts the analysis in one step. */
 async function upload(file:File){
  if(!api||!overview||busy==='upload'||running)return;
  setError(null);
  const pdf=file.type==='application/pdf'||(!file.type&&/\.pdf$/i.test(file.name));
  if(!pdf){setError({scope:'upload',code:'NOT_A_PDF'});return;}
  if(!file.size){setError({scope:'upload',code:'PDF_REQUIRED'});return;}
  if(file.size>PDF_MAX_BYTES){setError({scope:'upload',code:'PDF_TOO_LARGE'});return;}
  setBusy('upload');
  try{
   const r=await api.uploadDocument(file,file.name);
   setOverview(o=>o&&{...o,workspace:r.workspace,analysis:r.job});setAnalysis(r.job);setClock({elapsedMs:r.job.elapsedMs,at:Date.now()});
  }catch(e){setError({scope:'upload',code:codeOf(e),details:detailsOf(e)});}
  finally{setBusy(b=>b==='upload'?'':b);}
 }
 /** Runs the analysis again on the information already read from the PDF (after a failure or a model fallback). */
 async function analyze(){
  // One click, one run: repeated clicks are ignored here and the server returns the run already in progress.
  if(!api||!overview||starting.current||running)return;
  starting.current=true;setError(null);
  try{
   setBusy('analysis');
   const {job}=await api.startAnalysis(overview.workspace.revision);setAnalysis(job);setClock({elapsedMs:job.elapsedMs,at:Date.now()});
  }catch(e){setError({scope:'analysis',code:codeOf(e)});}
  finally{starting.current=false;setBusy(b=>b==='analysis'?'':b);}
 }
 async function saveReview(){
  if(!api||!latest||!review||busy==='review')return;
  setBusy('review');setError(null);
  try{const saved=await api.saveReview(latest.draft,latest.reviewRevision??0,tidyReview(review));replace(saved);setReviewState(saved.review??null);setReviewDirty(false);}
  catch(e){setError({scope:'review',code:codeOf(e)});}
  finally{setBusy('');}
 }
 async function transition(work:()=>Promise<HandoffRecord>){
  setBusy('submit');setError(null);
  try{replace(await work());}
  catch(e){setError({scope:'submit',code:codeOf(e),issues:issuesOf(e)});}
  finally{setBusy('');}
 }
 return {overview,latest,sources:overview?.workspace?.sources??[],document:overview?.workspace?.document??null,review,reviewDirty,busy,error,analysis,running,starting:starting.current||busy==='analysis',
  elapsedMs:clock?(running?clock.elapsedMs+Date.now()-clock.at:clock.elapsedMs):0,
  upload,analyze,
  setReview:(next:ReviewDraft)=>{setReviewState(next);setReviewDirty(true);},
  discardReview:()=>{setReviewState(latest?.review??null);setReviewDirty(false);},
  saveReview,
  submit:()=>latest&&!reviewDirty?transition(()=>api!.submitReview(latest.draft,latest.reviewRevision??0)):Promise.resolve(),
  withdraw:()=>latest?transition(()=>api!.withdrawReview(latest.draft)):Promise.resolve(),
  reload:load,
  clearError:()=>setError(null)};
}
export type CustomerWorkspace=ReturnType<typeof useCustomerWorkspace>;

/** Account status through the Dream Day review. A plan published before Dream Day is labelled as such, never as approved. */
export function accountStatus(w:CustomerWorkspace,published:boolean):{label:string;tone:string}{
 const r=w.latest,approved=r?.approvals?.champion.status==='approved';
 if(published)return approved?{label:'Approved · Published to developers',tone:'green'}:{label:'Published before Dream Day',tone:''};
 if(w.running)return {label:'Analyzing',tone:'blue'};
 if(r?.status==='approved')return {label:'Approved',tone:'green'};
 if(r?.status==='submitted')return {label:'Submitted for Champion review',tone:'blue'};
 if(r?.status==='resubmitted')return {label:'Resubmitted for Champion review',tone:'blue'};
 if(r?.status==='changes_requested')return {label:'Changes requested',tone:'amber'};
 if(r)return {label:'Analysis ready',tone:'amber'};
 if(w.overview?.workspace.revision)return {label:'Draft',tone:''};
 return {label:'Not started',tone:''};
}
