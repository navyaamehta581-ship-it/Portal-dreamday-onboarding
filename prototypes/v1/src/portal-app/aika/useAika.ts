import {useCallback,useEffect,useRef,useState} from 'react';
import type {AikaJob} from '../../../../../contracts/activation/v1/handoff';
import type {activationClient} from '../../activation/client';

const POLL_MS=1000;
/** AiKA's latest question for this viewer. Asking returns at once; the answer is polled until it finishes. */
export function useAika(api:ReturnType<typeof activationClient>|null){
 const [job,setJob]=useState<AikaJob|null>(null),[error,setError]=useState<string|null>(null),[sending,setSending]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const poll=useCallback(async()=>{
  if(!api)return;
  try{const r=await api.aikaStatus();setJob(r.job);setError(null);if(r.job?.status==='running')timer.current=setTimeout(()=>void poll(),POLL_MS);}
  catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');}
 },[api]);
 useEffect(()=>{void poll();return()=>{if(timer.current)clearTimeout(timer.current);};},[poll]);
 async function ask(question:string,milestoneId:string|null){
  if(!api||sending||job?.status==='running')return false;
  setSending(true);setError(null);
  try{const r=await api.askAika(question,milestoneId);setJob(r.job);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void poll(),POLL_MS);return true;}
  catch(e){setError(e instanceof Error?e.message:'ACTIVATION_UNAVAILABLE');return false;}
  finally{setSending(false);}
 }
 return {job,error,sending,ask,running:job?.status==='running'};
}

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
  case 'NO_APPROVED_PLAN':return 'AiKA helps with approved onboarding work. Your team’s plan hasn’t been approved in Dream Day yet.';
  case 'INVALID_REQUEST':return 'Ask a question between 3 and 500 characters.';
  case 'FORBIDDEN':return 'AiKA isn’t available for this account.';
  case 'SIGN_IN_REQUIRED':return 'Your session ended. Sign in again.';
  default:return 'AiKA isn’t available right now. Check that the demo API is running, then try again.';
 }
}
