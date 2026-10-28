/** Server-side Ollama client shared by every model task (customer interpretation, milestone planning,
 * and later AiKA). Each call supplies its own system prompt, JSON schema and validator; the client never
 * logs prompts or responses. Only loopback HTTP or HTTPS endpoints are accepted. */

export type ModelErrorCode='MODEL_NOT_CONFIGURED'|'MODEL_UNAVAILABLE'|'MODEL_TIMEOUT'|'INVALID_MODEL_OUTPUT'|'CONTEXT_LIMIT';
export class ModelError extends Error {
 readonly code:ModelErrorCode;readonly detail:string|null;
 constructor(code:ModelErrorCode,detail:string|null=null){super(code);this.code=code;this.detail=detail;}
}

export type OllamaConfig={endpoint:string;model:string;timeoutMs:number;retries:number;numCtx:number;keepAlive?:string};
export function ollamaConfigFromEnv(env:Record<string,string|undefined>=process.env):OllamaConfig|null{
 if(env.PORTAL_LLM_PROVIDER!=='ollama')return null;
 return {endpoint:env.OLLAMA_URL??'http://127.0.0.1:11434',model:env.OLLAMA_MODEL??'qwen3:4b',
  timeoutMs:Number(env.OLLAMA_TIMEOUT_MS??180000),retries:Number(env.OLLAMA_RETRIES??1),
  // Upper bound only: each run requests the smallest context that fits its prompt and output.
  numCtx:Number(env.OLLAMA_NUM_CTX??8192),keepAlive:env.OLLAMA_KEEP_ALIVE??'15m'};
}

function baseUrl(endpoint:string){
 try{const u=new URL(endpoint);const loopback=['127.0.0.1','localhost','[::1]'].includes(u.hostname);
  if((u.protocol==='http:'&&loopback)||u.protocol==='https:')if(!u.username&&!u.password&&!u.search&&!u.hash)return u.href.replace(/\/$/,'');}catch{/* invalid */}
 return null;
}

/** Counts only, never content. */
export type StageStats={name:string;ms:number;attempts:number;promptTokens:number|null;outputTokens:number|null;thinkingChars:number;loadMs:number|null;numCtx:number;truncated:boolean};
export type JsonTask<T>={name:string;system:string;user:string|object;schema:Record<string,unknown>;validate:(value:unknown)=>T;maxChars?:number;numCtx?:number;numPredict?:number};
export type JsonModel={provider:'ollama';model:string;maxCtx:number;run<T>(task:JsonTask<T>):Promise<{value:T;durationMs:number;stats:StageStats}>};

const ms=(ns:unknown)=>typeof ns==='number'?Math.round(ns/1e6):null;

export function createOllama(config:OllamaConfig,fetchImpl:typeof fetch=fetch):JsonModel{
 const root=baseUrl(config.endpoint);
 const usable=!!root&&!!config.model&&Number.isInteger(config.timeoutMs)&&config.timeoutMs>=1000&&config.timeoutMs<=600000&&Number.isInteger(config.retries)&&config.retries>=0&&config.retries<=3&&Number.isInteger(config.numCtx)&&config.numCtx>=2048;
 async function once(task:JsonTask<unknown>,retry:boolean,stats:StageStats){
  const content=typeof task.user==='string'?task.user:JSON.stringify(task.user);
  if(content.length>(task.maxChars??60000))throw new ModelError('CONTEXT_LIMIT');
  const numCtx=Math.min(task.numCtx??config.numCtx,config.numCtx);stats.numCtx=numCtx;
  let response:Response;
  try{
   response=await fetchImpl(`${root}/api/chat`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(config.timeoutMs),headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:config.model,stream:false,think:false,format:task.schema,keep_alive:config.keepAlive??'15m',
     options:{temperature:0,num_ctx:numCtx,...(task.numPredict?{num_predict:task.numPredict}:{})},
     messages:[{role:'system',content:task.system+(retry?'\nYour previous answer was rejected. Return only valid JSON for the schema and cite only line ids that exist.':'')},{role:'user',content}]})});
  }catch(e){throw new ModelError(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'MODEL_TIMEOUT':'MODEL_UNAVAILABLE');}
  if(!response.ok){await response.body?.cancel();throw new ModelError('MODEL_UNAVAILABLE');}
  let payload:{message?:{content?:unknown;thinking?:unknown};done?:boolean;done_reason?:string;prompt_eval_count?:number;eval_count?:number;load_duration?:number};
  try{payload=await response.json();}catch{throw new ModelError('INVALID_MODEL_OUTPUT','response_not_json');}
  stats.promptTokens=payload.prompt_eval_count??null;stats.outputTokens=payload.eval_count??null;stats.loadMs=ms(payload.load_duration);
  stats.thinkingChars=typeof payload.message?.thinking==='string'?payload.message.thinking.length:0;
  stats.truncated=payload.done_reason==='length';
  const text=payload.message?.content;
  if(typeof text!=='string'||payload.done===false)throw new ModelError('INVALID_MODEL_OUTPUT','no_content');
  // A model that still emits a thinking block: only the JSON after it is accepted.
  const thinking=/^[\s\S]*?<\/think>/.exec(text);if(thinking)stats.thinkingChars+=thinking[0].length;
  const json=text.slice(thinking?.[0].length??0).trim();
  let parsed:unknown;try{parsed=JSON.parse(json);}catch{throw new ModelError('INVALID_MODEL_OUTPUT',stats.truncated?'output_truncated':'invalid_json');}
  return task.validate(parsed);
 }
 return {provider:'ollama',model:config.model,maxCtx:config.numCtx,async run<T>(task:JsonTask<T>){
  if(!usable)throw new ModelError('MODEL_NOT_CONFIGURED');
  const started=Date.now();let last:ModelError=new ModelError('MODEL_UNAVAILABLE');
  const stats:StageStats={name:task.name,ms:0,attempts:0,promptTokens:null,outputTokens:null,thinkingChars:0,loadMs:null,numCtx:config.numCtx,truncated:false};
  for(let attempt=0;attempt<=config.retries;attempt++){
   stats.attempts=attempt+1;
   try{const value=await once(task as JsonTask<unknown>,attempt>0,stats) as T;stats.ms=Date.now()-started;return {value,durationMs:stats.ms,stats};}
   catch(e){last=e instanceof ModelError?e:new ModelError('INVALID_MODEL_OUTPUT');
    // A timeout already used the whole budget, and an oversized prompt will not shrink on retry.
    if(last.code==='MODEL_TIMEOUT'||last.code==='CONTEXT_LIMIT'||last.code==='MODEL_NOT_CONFIGURED')break;}
  }
  throw last;
 }};
}
