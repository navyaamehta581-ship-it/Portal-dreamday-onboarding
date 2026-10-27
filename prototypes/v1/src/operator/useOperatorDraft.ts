import {useState} from 'react';
import {organizeNotes,type OrganizedNotes} from './notes';

/** Chris's unpublished handoff draft. Lives in this tab only; nothing is sent until publish. */
export function useOperatorDraft(){
 const [raw,setRawState]=useState(''),[organized,setOrganized]=useState<OrganizedNotes|null>(null);
 const [briefing,setBriefingState]=useState(''),[outcome,setOutcomeState]=useState(''),[agreedBy,setAgreedByState]=useState(''),[confirmed,setConfirmed]=useState(false);
 // Any edit to what will be published withdraws the confirmation.
 const edited=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setConfirmed(false);};
 return {raw,organized,briefing,outcome,agreedBy,confirmed,setConfirmed,
  setRaw:(v:string)=>{setRawState(v);setOrganized(null);},
  organize(){const o=organizeNotes(raw);setOrganized(o);setBriefingState(o.publishable);setOutcomeState('');setConfirmed(false);},
  setBriefing:edited(setBriefingState),setOutcome:edited(setOutcomeState),setAgreedBy:edited(setAgreedByState),
  reset(){setRawState('');setOrganized(null);setBriefingState('');setOutcomeState('');setAgreedByState('');setConfirmed(false);}};
}
export type OperatorDraft=ReturnType<typeof useOperatorDraft>;
