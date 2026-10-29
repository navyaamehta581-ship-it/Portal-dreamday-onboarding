import {useCallback,useEffect,useState} from 'react';
import type {Adoption,Opportunities,Priority} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';

const codeOf=(e:unknown)=>e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE';
/** Goals and engineering opportunities for the signed-in person, and (Champion, Chris) adoption. Every change is the
 * server's answer: priorities by the Champion, choices by a developer. */
export function useOpportunities(api:ReturnType<typeof activationClient>|null,{adoption:withAdoption=false}:{adoption?:boolean}={}){
 const [data,setData]=useState<Opportunities|null>(null),[adoption,setAdoption]=useState<Adoption|null>(null);
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const reload=useCallback(async()=>{
  if(!api)return;setLoading(true);
  try{setData(await api.opportunities());if(withAdoption)setAdoption(await api.adoption());setError(null);}
  catch(e){setError(codeOf(e));}
  finally{setLoading(false);}
 },[api,withAdoption]);
 useEffect(()=>{setData(null);setAdoption(null);void reload();},[reload]);
 async function act(id:string,run:()=>Promise<Opportunities>){
  setBusy(id);
  try{setData(await run());if(withAdoption&&api)setAdoption(await api.adoption());setError(null);return true;}
  catch(e){setError(codeOf(e));return false;}
  finally{setBusy(null);}
 }
 return {data,adoption,error,busy,loading,reload,
  prioritize:(id:string,change:{priority?:Priority|null;highlighted?:boolean})=>act(id,()=>api!.prioritize(id,change)),
  pursue:(id:string,pursue:boolean)=>act(id,()=>api!.pursueOpportunity(id,pursue))};
}
export type OpportunitiesSession=ReturnType<typeof useOpportunities>;
