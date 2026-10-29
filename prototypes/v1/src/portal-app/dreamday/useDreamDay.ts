import {useCallback,useEffect,useRef,useState} from 'react';
import type {ChampionReview,ReviewItem,ReviewMilestone} from '../../../../../contracts/activation/v1/handoff';
import {ActivationRequestError,type activationClient} from '../../activation/client';

export type EditablePlan={goals:ReviewItem[];milestones:ReviewMilestone[];questions:ReviewItem[]};
export type DreamDayError={code:string;issues?:{path:string;label:string;reason:string}[]};
const planOf=(v:ChampionReview|null):EditablePlan|null=>v?.plan?{goals:v.plan.goals,milestones:v.plan.milestones,questions:v.plan.questions}:null;
const tidy=(p:EditablePlan):EditablePlan=>({goals:p.goals.filter(x=>x.text.trim()).map(x=>({...x,text:x.text.trim()})),questions:p.questions.filter(x=>x.text.trim()).map(x=>({...x,text:x.text.trim()})),
 milestones:p.milestones.map(m=>({...m,title:m.title.trim(),description:m.description.trim(),system:m.system.trim(),actions:m.actions.map(a=>a.trim()).filter(Boolean),completionCriteria:m.completionCriteria.map(c=>c.trim()).filter(Boolean)}))});

/** Dream Day for the Champion: the server-built review, Maya's unsaved edits, and her three decisions.
 * Every write names the revision Maya is looking at, so a withdrawn or changed plan can't be approved by mistake. */
export function useDreamDay(api:ReturnType<typeof activationClient>|null,onDecided:()=>void){
 const [view,setView]=useState<ChampionReview|null>(null),[plan,setPlanState]=useState<EditablePlan|null>(null),[dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState<''|'load'|'save'|'decide'>('load'),[error,setError]=useState<DreamDayError|null>(null);
 const dirtyRef=useRef(false);dirtyRef.current=dirty;
 const adopt=useCallback((v:ChampionReview,force=false)=>{setView(v);if(force||!dirtyRef.current){setPlanState(planOf(v));setDirty(false);}},[]);
 const load=useCallback(async(force=false)=>{
  if(!api)return;setBusy('load');
  try{adopt(await api.championReview(),force);setError(null);}catch(e){setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE'});}
  finally{setBusy('');}
 },[api,adopt]);
 useEffect(()=>{void load(true);},[load]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 async function act(work:()=>Promise<ChampionReview>,kind:'save'|'decide'){
  if(!api||!view||busy)return false;setBusy(kind);setError(null);
  try{adopt(await work(),true);if(kind==='decide')onDecided();return true;}
  catch(e){setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE',issues:e instanceof ActivationRequestError?(e.details as {issues?:DreamDayError['issues']}|null)?.issues:undefined});return false;}
  finally{setBusy('');}
 }
 return {view,plan,dirty,busy,error,
  setPlan:(p:EditablePlan)=>{setPlanState(p);setDirty(true);},
  discard:()=>{setPlanState(planOf(view));setDirty(false);},
  reload:()=>load(true),
  save:()=>act(()=>api!.saveChampionReview(view!.draft!,view!.reviewRevision,tidy(plan!)),'save'),
  requestChanges:(comment:string)=>act(()=>api!.requestChanges(view!.draft!,view!.reviewRevision,comment),'decide'),
  approve:()=>act(()=>api!.approvePlan(view!.draft!,view!.reviewRevision),'decide')};
}
export type DreamDaySession=ReturnType<typeof useDreamDay>;
