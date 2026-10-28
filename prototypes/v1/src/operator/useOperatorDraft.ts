import {useEffect,useState} from 'react';
import type {HandoffRecord,MilestoneDraft,SourceType} from '../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../activation/client';
import type {ActivationSession} from '../activation/useActivation';

export type SourceDraft={type:SourceType;label:string;text:string};
export const SOURCE_TYPES:[SourceType,string][]=[['conversation','Conversation transcript'],['crm','CRM record'],['chris_notes','My notes'],['account_prep','Account preparation'],['technical_requirements','Technical requirements'],['repository','Repository observation']];
const blank=():SourceDraft=>({type:'conversation',label:'',text:''});
const lines=(t:string)=>t.split('\n').map(x=>x.trim()).filter(Boolean);
export {lines as splitLines};

/** Chris's handoff: sources are analysed on the server; the latest draft or published version is
 * restored on load. Edits to the milestone or agreement withdraw the confirmation. */
export function useOperatorDraft(api:ReturnType<typeof activationClient>|null,session:ActivationSession){
 const [sources,setSources]=useState<SourceDraft[]>([blank()]);
 const [record,setRecord]=useState<HandoffRecord|null>(null),[history,setHistory]=useState<HandoffRecord[]>([]);
 const [milestone,setMilestoneState]=useState<MilestoneDraft|null>(null);
 const [outcome,setOutcomeState]=useState(''),[agreedBy,setAgreedByState]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const adopt=(r:HandoffRecord|null)=>{setRecord(r);const m=r?.proposal.milestones[0]??null;setMilestoneState(m);setOutcomeState(m?.objective??'');setConfirmed(false);if(r)setSources(r.sources.map(s=>({type:s.type,label:s.label,text:s.text})));};
 useEffect(()=>{if(!api)return;let live=true;api.handoffOverview().then(o=>{if(!live)return;setHistory(o.drafts);adopt(o.drafts.at(-1)??null);}).catch(()=>undefined);return()=>{live=false;};},[api]); // eslint-disable-line react-hooks/exhaustive-deps
 const edited=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setConfirmed(false);};
 async function run<T>(work:()=>Promise<T>){setBusy(true);setError('');try{return await work();}catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');return null;}finally{setBusy(false);}}
 return {sources,record,history,milestone,outcome,agreedBy,confirmed,busy,error,setConfirmed,
  published:history.find(r=>r.status==='published')??null,
  setSource:(i:number,patch:Partial<SourceDraft>)=>setSources(list=>list.map((s,j)=>j===i?{...s,...patch}:s)),
  addSource:()=>setSources(list=>list.length<12?[...list,blank()]:list),
  removeSource:(i:number)=>setSources(list=>list.length>1?list.filter((_,j)=>j!==i):list),
  async analyze(){if(!api)return;const r=await run(()=>api.draftHandoff(sources.filter(s=>s.text.trim())));if(r){setHistory(h=>[...h,r]);adopt(r);}},
  setMilestone:edited(setMilestoneState),setOutcome:edited(setOutcomeState),setAgreedBy:edited(setAgreedByState),
  async publish(){if(!api||!record||!milestone)return;const s=await run(()=>api.publishHandoff({draft:record.draft,milestones:[milestone,...record.proposal.milestones.slice(1,3)],outcome,agreedBy,agreementConfirmed:true}));
   if(s){const o=await api.handoffOverview().catch(()=>null);if(o){setHistory(o.drafts);adopt(o.drafts.find(r=>r.draft===record.draft)??null);}await session.refresh();}},
  reset(){setSources([blank()]);adopt(null);setHistory([]);setAgreedByState('');setError('');}};
}
export type OperatorDraft=ReturnType<typeof useOperatorDraft>;
