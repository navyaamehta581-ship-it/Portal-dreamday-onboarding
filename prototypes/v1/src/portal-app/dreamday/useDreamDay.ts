import {useCallback,useEffect,useState} from 'react';
import type {ChampionReview} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';

export type DreamDayError={code:string};

/** Dream Day for the Champion: the server-built, read-only view of the published plan. Nothing to decide here. */
export function useDreamDay(api:ReturnType<typeof activationClient>|null){
 const [view,setView]=useState<ChampionReview|null>(null),[error,setError]=useState<DreamDayError|null>(null),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  if(!api)return;setLoading(true);
  try{setView(await api.championReview());setError(null);}catch(e){setError({code:e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE'});}
  finally{setLoading(false);}
 },[api]);
 useEffect(()=>{void load();},[load]);
 return {view,error,loading,reload:load};
}
export type DreamDaySession=ReturnType<typeof useDreamDay>;
