import type { ActivationState } from '../../../../contracts/activation/v1/state';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types';

export class ActivationRequestError extends Error {
  constructor(public readonly code:string, public readonly status:number){super(code);this.name='ActivationRequestError';}
}

/** Separate client: the existing conversation StateResponse remains unchanged. */
export function activationClient(customerId:string,token:string,base='') {
  const root=`${base}/api/activation/v1/customers/${encodeURIComponent(customerId)}`;
  async function request(route:string,body?:unknown):Promise<ActivationState> {
    const response=await fetch(root+route,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(30000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new ActivationRequestError(data?.error?.code??'ACTIVATION_UNAVAILABLE',response.status);
    if(data?.contractVersion!=='1.0.0'||data.customerId!==customerId||!Number.isSafeInteger(data.revision)||!data.context||!data.plan||!data.actions||Array.isArray(data.actions)||!Array.isArray(data.evidence)||!data.replan||!data.outcome)throw new ActivationRequestError('INVALID_ACTIVATION_RESPONSE',response.status);
    return data as ActivationState;
  }
  // On timeout retain the exact command ID/body; GET then retry the same body, never invent progress.
  return {
    intake:(briefing:string,outcome:string,agreedBy:string,agreementConfirmed:boolean)=>request('/intake',{briefing,outcome,agreedBy,agreementConfirmed}),
    read:()=>request('/state'),
    initialize:(context:CustomerContext,plan?:ActivationPlan)=>request('/state',{context,...(plan?{plan}:{})}),
    progress:(event:ProgressUpdate)=>request('/progress',event),
    blocker:(event:BlockerUpdate)=>request('/blockers',event)
  };
}