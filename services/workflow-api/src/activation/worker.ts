import type { ActivationPlan, BlockerUpdate } from '../../../../contracts/activation/v1/types.ts';
import type { ActivationStore, ActivationState, Principal } from './store.ts';
export type Planner = (p:Principal,state:ActivationState,intent:BlockerUpdate)=>Promise<ActivationPlan|null>;
/** Planner must be read-only. CAS makes overlapping workers safe; no external action runs here. */
export function createReplanWorker(store:ActivationStore,planner:Planner,retryMs=5000) {
  if(!Number.isFinite(retryMs)||retryMs<100)throw new Error('Invalid retry delay');
  let running=false, stopped=false;
  const retryAfter=new Map<string,number>();
  async function tick() {
    if(running||stopped)return;
    running=true;
    try {
      for(const p of store.pending()) {
        if(stopped)break;
        const key=JSON.stringify(p);
        if((retryAfter.get(key)??0)>Date.now())continue;
        const state=store.get(p), blockerId=state.replan.blockerId!;
        let plan:ActivationPlan|null=null;
        try {plan=await planner(p,state,store.getEvent(p,blockerId) as BlockerUpdate);}catch {/* Persist a safe failure below. */}
        if(stopped)break;
        const id=`replan:${blockerId}:${state.revision}`;
        try {store.completeReplan(p,id,state.revision,blockerId,plan);}
        catch(error) {
          const code=(error as {code?:string}).code;
          if(!['REVISION_CONFLICT','IDEMPOTENCY_CONFLICT','INVALID_TRANSITION'].includes(code??'')) {
            // Rejected planner records never clear a blocker or expose its exception.
            try {store.completeReplan(p,`${id}:failed`,state.revision,blockerId,null);}catch {/* Another worker won CAS. */}
          }
        }
        retryAfter.set(key,Date.now()+retryMs);
      }
    } finally {running=false;}
  }
  return {tick, start(){const timer=setInterval(()=>void tick(),retryMs);timer.unref();void tick();return async()=>{stopped=true;clearInterval(timer);while(running)await new Promise(resolve=>setTimeout(resolve,10));};}};
}
