import {useCallback,useEffect,useRef,useState} from 'react';
import type {AikaCapability,AikaCapabilityId,AikaJob} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';

const POLL_MS=1000;
/** One exchange in the conversation: what was asked (with any slash-command capabilities) and AiKA's job. */
export type AikaTurn={id:string;question:string;capabilities:AikaCapabilityId[];milestoneId:string|null;job:AikaJob|null;error:string|null};

/** AiKA's conversation for this page view, shared by the AiKA page and the floating panel. The server runs one
 * question at a time per person and keeps the latest; earlier turns stay in this browser tab only (History is not
 * available in this demo). Asking returns at once; the answer is polled until it finishes. */
export function useAika(api:ReturnType<typeof activationClient>|null){
 const [turns,setTurns]=useState<AikaTurn[]>([]),[error,setError]=useState<string|null>(null),[sending,setSending]=useState(false);
 const [capabilities,setCapabilities]=useState<AikaCapability[]>([]),[modelConfigured,setModelConfigured]=useState(true);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const place=(job:AikaJob)=>setTurns(ts=>{const i=ts.findIndex(t=>t.job?.id===job.id);
  if(i>=0)return ts.map((t,k)=>k===i?{...t,job}:t);
  // A question asked before this page loaded (for example before a refresh): show it as the first turn.
  return ts.length?ts:[{id:job.id,question:job.question,capabilities:job.capabilities??[],milestoneId:job.milestoneId,job,error:null}];});
 const poll=useCallback(async()=>{
  if(!api)return;
  try{const r=await api.aikaStatus();if(r.job)place(r.job);setError(null);if(r.job?.status==='running')timer.current=setTimeout(()=>void poll(),POLL_MS);}
  catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');}
 },[api]);
 const loadCapabilities=useCallback(async()=>{
  if(!api)return;
  try{const r=await api.aikaCapabilities();setCapabilities(r.capabilities??[]);setModelConfigured(r.modelConfigured!==false);}catch{setCapabilities([]);}
 },[api]);
 useEffect(()=>{void poll();void loadCapabilities();return()=>{if(timer.current)clearTimeout(timer.current);};},[poll,loadCapabilities]);
 const running=turns.at(-1)?.job?.status==='running';
 async function ask(question:string,milestoneId:string|null,caps:AikaCapabilityId[]=[],opportunityId:string|null=null){
  if(!api||sending||running)return false;
  setSending(true);setError(null);
  try{
   const r=await api.askAika(question,milestoneId,caps,opportunityId);
   setTurns(ts=>[...ts.filter(t=>t.job?.id!==r.job.id),{id:r.job.id,question,capabilities:caps,milestoneId,job:r.job,error:null}]);
   if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void poll(),POLL_MS);return true;
  }catch(e){
   // A refused question isn't a turn: the error shows beside the composer and the typed question stays.
   setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');return false;
  }finally{setSending(false);}
 }
 return {turns,job:turns.at(-1)?.job??null,error,sending,ask,running,capabilities,modelConfigured,reloadCapabilities:loadCapabilities,
  reset:()=>{setTurns([]);setError(null);}};
}
export type AikaSession=ReturnType<typeof useAika>;

/** Plain-language messages for AiKA's failure codes; nothing from the model or the server is shown raw. */
export function aikaProblem(code:string):string{
 switch(code){
  case 'AIKA_UNAVAILABLE':case 'MODEL_NOT_CONFIGURED':return 'AiKA isn’t connected to a model on this Portal. Ask your Portal admin to configure the AI model provider.';
  case 'MODEL_UNAVAILABLE':return 'AiKA couldn’t reach its AI model. Try again in a moment.';
  case 'MODEL_RATE_LIMITED':return 'The AI provider is limiting requests right now. Try again in a minute.';
  case 'AI_DAILY_LIMIT':return 'This demo has reached its daily AI limit. AiKA will be available again tomorrow (UTC).';
  case 'AIKA_QUESTION_LIMIT':return 'This demo room has reached its daily number of AiKA questions.';
  case 'RATE_LIMITED':return 'Too many requests from this demo room. Wait a minute, then try again.';
  case 'DEMO_GATE_REQUIRED':return 'Your demo room has ended. Reload the page to enter the demo again.';
  case 'MODEL_TIMEOUT':return 'AiKA took too long to answer and stopped. Try a shorter or more specific question.';
  case 'INVALID_MODEL_OUTPUT':return 'AiKA’s answer didn’t pass its checks, so it isn’t shown. Try asking again or rephrasing.';
  case 'CONTEXT_LIMIT':return 'There’s too much context for AiKA to answer in one go. Ask about one milestone.';
  case 'NO_APPROVED_PLAN':return 'AiKA helps with your team’s onboarding work. Your team’s onboarding plan isn’t published yet.';
  case 'INVALID_REQUEST':return 'Ask a question between 3 and 500 characters.';
  case 'AIKA_CAPABILITY_FORBIDDEN':return 'That command isn’t available to you. Remove it and ask again.';
  case 'FORBIDDEN':return 'AiKA isn’t available for this account.';
  case 'SIGN_IN_REQUIRED':return 'Your session ended. Sign in again.';
  default:return 'AiKA isn’t available right now. Check that the demo API is running, then try again.';
 }
}
