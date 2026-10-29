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
 /** Called before every request; throws ModelError('AI_DAILY_LIMIT') when the deployment's budget is spent. */
 admit?:()=>void};
export const GEMINI_ORIGIN='https://generativelanguage.googleapis.com';
export const geminiOriginAllowed=(o:string)=>o===GEMINI_ORIGIN||/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(o);
const MODEL=/^[a-z0-9][a-z0-9.-]{2,79}$/;
const MAX_RESPONSE=2_000_000;

/** Gemini's own error reason, if the body says one; nothing else from the body is kept. */
async function reason(r:Response){
 try{const t=(await r.text()).slice(0,20_000);const j=JSON.parse(t);return String(j?.error?.details?.find((d:any)=>typeof d?.reason==='string')?.reason??j?.error?.status??'');}catch{return '';}
}

export function createGemini(config:GeminiConfig,fetchImpl:typeof fetch=fetch):JsonModel{
 const origin=config.apiOrigin??GEMINI_ORIGIN;
 const usable=!!config.apiKey&&MODEL.test(config.model)&&geminiOriginAllowed(origin)&&Number.isInteger(config.timeoutMs)&&config.timeoutMs>=1000&&config.timeoutMs<=600000
  &&Number.isInteger(config.retries)&&config.retries>=0&&config.retries<=3&&Number.isInteger(config.maxOutputTokens)&&config.maxOutputTokens>=256;
 let schemaSupported=true;
 // Gemini 2.5 Flash models think by default, spending output tokens and time; these tasks don't need it.
 const thinking=/^gemini-2\.5-flash/.test(config.model)?{thinkingConfig:{thinkingBudget:0}}:{};

 async function request(task:JsonTask<unknown>,maxTokens:number,withSchema:boolean){
  config.admit?.();
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
   const why=await reason(r);
   if(/API_KEY_INVALID/.test(why))throw new ModelError('MODEL_NOT_CONFIGURED','invalid_api_key');
   // The model didn't accept the schema: keep plain JSON mode for this process; validation is unchanged.
   schemaSupported=false;r=await request(task,maxTokens,false);
  }
  if(!r.ok){
   const why=await reason(r);
   if(r.status===429)throw new ModelError('MODEL_RATE_LIMITED');
   if(/API_KEY_INVALID/.test(why)||r.status===401||r.status===403)throw new ModelError('MODEL_NOT_CONFIGURED',r.status===403?'permission_denied':'invalid_api_key');
   if(r.status===404)throw new ModelError('MODEL_NOT_CONFIGURED','model_not_found');
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

 return {provider:'gemini',model:config.model,maxCtx:32768,async run<T>(task:JsonTask<T>){
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
