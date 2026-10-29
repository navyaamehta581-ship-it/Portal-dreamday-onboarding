/** Server-side Gemini client for the hosted demo, behind the same JsonModel contract as the Ollama client, so
 * Chris's analysis and AiKA keep their own prompts, schemas, privacy screens and validators unchanged.
 *
 * - The API key is sent only in the x-goog-api-key header from the server; it never appears in URLs, logs,
 *   errors or responses. Prompts and responses are never logged.
 * - Structured output: JSON with the task's schema; if the model rejects the schema, the same request is retried
 *   once as plain JSON mode and the server-side validator still decides what is kept.
 * - Failures become codes: MODEL_RATE_LIMITED (429), MODEL_NOT_CONFIGURED (missing, invalid or unauthorised key),
 *   MODEL_UNAVAILABLE (network, 5xx), MODEL_TIMEOUT, INVALID_MODEL_OUTPUT (truncated, blocked or invalid JSON),
 *   CONTEXT_LIMIT, AI_DAILY_LIMIT (this deployment's own cap, checked before every request). */
import {ModelError,fit,type JsonModel,type JsonTask,type StageStats} from './ollama.ts';

export type GeminiConfig={apiKey:string|null;model:string;timeoutMs:number;retries:number;maxOutputTokens:number;
 /** https://generativelanguage.googleapis.com, or a loopback stand-in for tests only. */
 apiOrigin?:string;
 /** Called (and awaited) before every request: paces requests and throws AI_DAILY_LIMIT when the budget is spent. */
 admit?:()=>void|Promise<void>;now?:()=>number};
export const GEMINI_ORIGIN='https://generativelanguage.googleapis.com';
export const geminiOriginAllowed=(o:string)=>o===GEMINI_ORIGIN||/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(o);
const MODEL=/^[a-z0-9][a-z0-9.-]{2,79}$/;
const MAX_RESPONSE=2_000_000;

/** Gemini's own error reason and suggested retry delay, if the body says them; nothing else from the body is kept. */
async function problem(r:Response){
 try{const t=(await r.text()).slice(0,20_000);const j=JSON.parse(t),details:any[]=Array.isArray(j?.error?.details)?j.error.details:[];
  const delay=/^(\d+(?:\.\d+)?)s$/.exec(String(details.find(d=>typeof d?.retryDelay==='string')?.retryDelay??''));
  return {reason:String(details.find(d=>typeof d?.reason==='string'&&d.reason)?.reason||j?.error?.status||''),retryMs:delay?Math.ceil(Number(delay[1])*1000):null};}catch{return {reason:'',retryMs:null};}
}
const reason=async(r:Response)=>(await problem(r)).reason;
/** Why Google refused the key or model, as a detail code. Only for refusals that retrying can't fix. */
function refusal(status:number,why:string):string|null{
 if(/API_KEY_INVALID/.test(why)||status===401)return 'invalid_api_key';
 // For example "User location is not supported for the API use", or a model that needs billing on the key's project.
 if(/FAILED_PRECONDITION/.test(why))return 'precondition_failed';
 if(status===403)return 'permission_denied';
 if(status===404)return 'model_not_found';
 return null;
}

export function createGemini(config:GeminiConfig,fetchImpl:typeof fetch=fetch):JsonModel{
 const origin=config.apiOrigin??GEMINI_ORIGIN;
 const usable=!!config.apiKey&&MODEL.test(config.model)&&geminiOriginAllowed(origin)&&Number.isInteger(config.timeoutMs)&&config.timeoutMs>=1000&&config.timeoutMs<=600000
  &&Number.isInteger(config.retries)&&config.retries>=0&&config.retries<=3&&Number.isInteger(config.maxOutputTokens)&&config.maxOutputTokens>=256;
 let schemaSupported=true;
 // After a 429 the provider asked us to wait; nothing is sent until then (Gemini's free tier enforces per-minute and per-day quotas).
 const clock=config.now??(()=>Date.now());let blockedUntil=0;
 // Gemini 2.5 Flash models think by default, spending output tokens and time; these tasks don't need it.
 const thinking=/^gemini-2\.5-flash/.test(config.model)?{thinkingConfig:{thinkingBudget:0}}:{};

 async function request(task:JsonTask<unknown>,maxTokens:number,withSchema:boolean){
  if(clock()<blockedUntil)throw new ModelError('MODEL_RATE_LIMITED','provider_backoff');
  await config.admit?.();
  const content=typeof task.user==='string'?task.user:JSON.stringify(task.user);
  const system=task.system+(withSchema?'':`\nReturn only one JSON object that follows this JSON Schema:\n${JSON.stringify(task.schema)}`);
  let r:Response;
  try{
   r=await fetchImpl(`${origin}/v1beta/models/${config.model}:generateContent`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(config.timeoutMs),
    headers:{'Content-Type':'application/json','x-goog-api-key':config.apiKey!},
    body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:content}]}],
     generationConfig:{temperature:0,maxOutputTokens:maxTokens,responseMimeType:'application/json',...(withSchema?{responseJsonSchema:task.schema}:{}),...thinking}})});
  }catch(e){throw new ModelError(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'MODEL_TIMEOUT':'MODEL_UNAVAILABLE');}
  return r;
 }

 async function once(task:JsonTask<unknown>,attempt:number,stats:StageStats,maxTokens:number){
  const content=typeof task.user==='string'?task.user:JSON.stringify(task.user);
  if(content.length>(task.maxChars??60000))throw new ModelError('CONTEXT_LIMIT');
  let r=await request(task,maxTokens,schemaSupported);
  if(r.status===400&&schemaSupported){
   const why=await reason(r),refused=refusal(400,why);
   if(refused)throw new ModelError('MODEL_NOT_CONFIGURED',refused);
   // The model didn't accept the schema: keep plain JSON mode for this process; validation is unchanged.
   schemaSupported=false;r=await request(task,maxTokens,false);
  }
  if(!r.ok){
   const {reason:why,retryMs}=await problem(r);
   if(r.status===429){blockedUntil=clock()+Math.min(retryMs??60_000,15*60_000);throw new ModelError('MODEL_RATE_LIMITED');}
   const refused=refusal(r.status,why);
   if(refused&&(r.status===400||r.status===401||r.status===403||r.status===404))throw new ModelError('MODEL_NOT_CONFIGURED',refused);
   throw new ModelError(r.status>=500?'MODEL_UNAVAILABLE':'INVALID_MODEL_OUTPUT',r.status>=500?null:'request_rejected');
  }
  const text=await r.text();
  if(text.length>MAX_RESPONSE)throw new ModelError('INVALID_MODEL_OUTPUT','response_too_large');
  let payload:any;try{payload=JSON.parse(text);}catch{throw new ModelError('INVALID_MODEL_OUTPUT','response_not_json');}
  const u=payload?.usageMetadata??{};
  stats.promptTokens=(stats.promptTokens??0)+(Number(u.promptTokenCount)||0);stats.outputTokens=(stats.outputTokens??0)+(Number(u.candidatesTokenCount)||0);
  stats.thinkingChars+=Number(u.thoughtsTokenCount)||0;
  if(payload?.promptFeedback?.blockReason)throw new ModelError('INVALID_MODEL_OUTPUT','blocked');
  const c=payload?.candidates?.[0],finish=c?.finishReason;
  stats.truncated=finish==='MAX_TOKENS';
  if(finish==='MAX_TOKENS')throw new ModelError('INVALID_MODEL_OUTPUT','output_truncated');
  if(finish&&finish!=='STOP')throw new ModelError('INVALID_MODEL_OUTPUT','blocked');
  const out=Array.isArray(c?.content?.parts)?c.content.parts.filter((p:any)=>!p.thought&&typeof p.text==='string').map((p:any)=>p.text).join(''):'';
  if(!out.trim())throw new ModelError('INVALID_MODEL_OUTPUT','no_content');
  const json=out.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed:unknown;try{parsed=JSON.parse(json);}catch{throw new ModelError('INVALID_MODEL_OUTPUT','invalid_json');}
  void attempt;
  return task.validate(fit(parsed,task.schema));
 }

 return {provider:'gemini',model:config.model,maxCtx:32768,
  /** GET models/{model}: confirms the key and the model without generating text, so no tokens are spent. */
  async check(){
   if(!usable)return {ok:false,code:'MODEL_NOT_CONFIGURED',detail:config.apiKey?'invalid_settings':'missing_api_key'};
   let r:Response;
   try{r=await fetchImpl(`${origin}/v1beta/models/${config.model}`,{redirect:'error',signal:AbortSignal.timeout(Math.min(config.timeoutMs,15_000)),headers:{'x-goog-api-key':config.apiKey!}});}
   catch{return {ok:false,code:'MODEL_UNAVAILABLE',detail:'unreachable'};}
   if(r.ok){await r.body?.cancel();return {ok:true};}
   const {reason:why}=await problem(r);
   if(r.status===429)return {ok:false,code:'MODEL_RATE_LIMITED',detail:null};
   const refused=refusal(r.status,why);
   return refused?{ok:false,code:'MODEL_NOT_CONFIGURED',detail:refused}:{ok:false,code:'MODEL_UNAVAILABLE',detail:`http_${r.status}`};
  },
  async run<T>(task:JsonTask<T>){
  if(!usable)throw new ModelError('MODEL_NOT_CONFIGURED');
  const started=Date.now();let last:ModelError=new ModelError('MODEL_UNAVAILABLE');
  const stats:StageStats={name:task.name,ms:0,attempts:0,attemptErrors:[],promptTokens:null,outputTokens:null,promptEvalMs:null,evalMs:null,loadMs:null,tokensPerSecond:null,thinkingChars:0,numCtx:0,truncated:false};
  // Output budget: the task's own limit, raised once if the answer was cut off, never above the configured maximum.
  let maxTokens=Math.min(config.maxOutputTokens,Math.max(1024,(task.numPredict??1024)*2));
  for(let attempt=0;attempt<=config.retries;attempt++){
   stats.attempts=attempt+1;
   try{const value=await once(task as JsonTask<unknown>,attempt,stats,maxTokens) as T;stats.ms=Date.now()-started;return {value,durationMs:stats.ms,stats};}
   catch(e){last=e instanceof ModelError?e:new ModelError('INVALID_MODEL_OUTPUT');stats.attemptErrors.push(last.detail?`${last.code}:${last.detail}`:last.code);
    if(last.detail==='output_truncated')maxTokens=Math.min(config.maxOutputTokens,maxTokens*2);
    // No retry where it can't help: limits, timeouts, configuration and oversized prompts.
    if(['MODEL_TIMEOUT','CONTEXT_LIMIT','MODEL_NOT_CONFIGURED','MODEL_RATE_LIMITED','AI_DAILY_LIMIT'].includes(last.code))break;}
  }
  stats.ms=Date.now()-started;throw Object.assign(last,{stats});
 }};
}
