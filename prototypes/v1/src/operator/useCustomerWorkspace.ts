import {useCallback,useEffect,useRef,useState} from 'react';
import type {AnalysisJob,HandoffOverview,HandoffRecord,ReviewDraft,SourceInput,SourceType} from '../../../../contracts/activation/v1/handoff';
import {ActivationRequestError,type activationClient} from '../activation/client';

/** The seven information categories, in the order Chris sees them. */
export const CATEGORIES:[SourceType,string][]=[['conversation','Conversational Transcript'],['crm','CRM Record'],['chris_notes','My Notes'],['account_prep','Account Preparation'],
 ['technical_requirements','Technical Requirements'],['repository','Repository Observation'],['integration_tools','Integration Tools']];
export type ReviewIssue={path:string;label:string;reason:string};
export type WorkspaceError={scope:'load'|'sources'|'analysis'|'review'|'submit';code:string;issues?:ReviewIssue[]};
const newId=(prefix:string)=>`${prefix}-${Math.random().toString(36).slice(2,10)}`;
const blank=():SourceInput=>({id:newId('info'),type:'conversation',label:'',text:''});
const codeOf=(e:unknown)=>e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE';
const issuesOf=(e:unknown)=>e instanceof ActivationRequestError?((e.details as {issues?:ReviewIssue[]}|null)?.issues):undefined;

/** Drop empty list entries before saving; Chris may leave blank lines while editing. */
export function tidyReview(r:ReviewDraft):ReviewDraft{
 const items=<T extends {text:string}>(xs:T[])=>xs.filter(x=>x.text.trim()).map(x=>({...x,text:x.text.trim()}));
 const lines=(xs:string[])=>xs.map(x=>x.trim()).filter(Boolean);
 return {...r,problem:{...r.problem,summary:r.problem.summary.trim(),challenges:items(r.problem.challenges),systems:items(r.problem.systems),contradictions:items(r.problem.contradictions),unknowns:items(r.problem.unknowns)},
  facts:items(r.facts),goals:items(r.goals),questions:items(r.questions),
  stakeholders:r.stakeholders.filter(s=>s.name.trim()&&s.role.trim()).map(s=>({...s,name:s.name.trim(),role:s.role.trim(),responsibilities:s.responsibilities.trim()})),
  milestones:r.milestones.map(m=>({...m,title:m.title.trim(),description:m.description.trim(),system:m.system.trim(),actions:lines(m.actions),completionCriteria:lines(m.completionCriteria)}))};
}

/** Chris's workspace for one customer: saved information, the background analysis, and the editable review.
 * Unsaved edits live only in this tab; everything saved lives on the server and survives a reload. */
export function useCustomerWorkspace(api:ReturnType<typeof activationClient>|null){
 const [overview,setOverview]=useState<HandoffOverview|null>(null);
 const [sources,setSourcesState]=useState<SourceInput[]>([]),[sourcesDirty,setSourcesDirty]=useState(false);
 const [review,setReviewState]=useState<ReviewDraft|null>(null),[reviewDirty,setReviewDirty]=useState(false);
 const [busy,setBusy]=useState<''|'load'|'sources'|'analysis'|'review'|'submit'>('load');
 const [error,setError]=useState<WorkspaceError|null>(null);
 const [analysis,setAnalysis]=useState<AnalysisJob|null>(null);
 // Elapsed time comes from the server at each poll and ticks locally in between.
 const [clock,setClock]=useState<{elapsedMs:number;at:number}|null>(null),[,tick]=useState(0);
 const starting=useRef(false),dirty=useRef({sources:false,review:false});
 dirty.current={sources:sourcesDirty,review:reviewDirty};

 const latest=overview?.drafts.at(-1)??null;
 const adopt=useCallback((o:HandoffOverview)=>{
  setOverview(o);setAnalysis(o.analysis);if(o.analysis)setClock({elapsedMs:o.analysis.elapsedMs,at:Date.now()});
  // Never overwrite edits Chris hasn't saved.
  if(!dirty.current.sources)setSourcesState(o.workspace.sources.length?o.workspace.sources:[blank()]);
  if(!dirty.current.review)setReviewState(o.drafts.at(-1)?.review??null);
 },[]);
 const load=useCallback(async()=>{
  if(!api)return;setBusy(b=>b||'load');
  try{adopt(await api.handoffOverview());setError(e=>e?.scope==='load'?null:e);}
  catch(e){setError({scope:'load',code:codeOf(e)});}
  finally{setBusy(b=>b==='load'?'':b);}
 },[api,adopt]);
 useEffect(()=>{setOverview(null);setSourcesState([]);setSourcesDirty(false);setReviewState(null);setReviewDirty(false);setAnalysis(null);setError(null);setBusy('load');void load();},[api]); // eslint-disable-line react-hooks/exhaustive-deps

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
  if(!sourcesDirty&&!reviewDirty)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[sourcesDirty,reviewDirty]);

 const replace=(record:HandoffRecord)=>setOverview(o=>o&&{...o,drafts:o.drafts.map(d=>d.draft===record.draft?record:d)});
 const editSources=(next:SourceInput[])=>{setSourcesState(next);setSourcesDirty(true);};
 async function saveSources():Promise<number|null>{
  if(!api||!overview||busy==='sources')return null;
  setBusy('sources');setError(null);
  try{const w=await api.saveWorkspace(overview.workspace.revision,sources);setOverview({...overview,workspace:w});setSourcesState(w.sources.length?w.sources:[blank()]);setSourcesDirty(false);return w.revision;}
  catch(e){setError({scope:'sources',code:codeOf(e)});return null;}
  finally{setBusy('');}
 }
 async function analyze(){
  // One click, one run: repeated clicks are ignored here and the server returns the run already in progress.
  if(!api||!overview||starting.current||running)return;
  starting.current=true;setError(null);
  try{
   const revision=sourcesDirty?await saveSources():overview.workspace.revision;
   if(revision===null)return;
   setBusy('analysis');
   const {job}=await api.startAnalysis(revision);setAnalysis(job);setClock({elapsedMs:job.elapsedMs,at:Date.now()});
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
 return {overview,latest,sources,sourcesDirty,review,reviewDirty,busy,error,analysis,running,starting:starting.current||busy==='analysis',
  elapsedMs:clock?(running?clock.elapsedMs+Date.now()-clock.at:clock.elapsedMs):0,
  setSource:(i:number,patch:Partial<SourceInput>)=>editSources(sources.map((s,j)=>j===i?{...s,...patch}:s)),
  addSource:()=>editSources([...sources,blank()].slice(0,12)),
  removeSource:(i:number)=>editSources(sources.length>1?sources.filter((_,j)=>j!==i):[blank()]),
  discardSources:()=>{if(overview){setSourcesState(overview.workspace.sources.length?overview.workspace.sources:[blank()]);setSourcesDirty(false);}},
  saveSources,analyze,
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
