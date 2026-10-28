/** Server-side Ollama client shared by every model task (customer interpretation, milestone planning,
 * and later AiKA). Each call supplies its own system prompt, JSON schema and validator; the client never
 * logs prompts or responses. Only loopback HTTP or HTTPS endpoints are accepted. */

export type ModelErrorCode='MODEL_NOT_CONFIGURED'|'MODEL_UNAVAILABLE'|'MODEL_TIMEOUT'|'INVALID_MODEL_OUTPUT'|'CONTEXT_LIMIT';
export class ModelError extends Error {
 readonly code:ModelErrorCode;
 constructor(code:ModelErrorCode){super(code);this.code=code;}
}

export type OllamaConfig={endpoint:string;model:string;timeoutMs:number;retries:number;numCtx:number};
export function ollamaConfigFromEnv(env:Record<string,string|undefined>=process.env):OllamaConfig|null{
 if(env.PORTAL_LLM_PROVIDER!=='ollama')return null;
 return {endpoint:env.OLLAMA_URL??'http://127.0.0.1:11434',model:env.OLLAMA_MODEL??'qwen3:4b',
  timeoutMs:Number(env.OLLAMA_TIMEOUT_MS??180000),retries:Number(env.OLLAMA_RETRIES??1),numCtx:Number(env.OLLAMA_NUM_CTX??16384)};
}

function baseUrl(endpoint:string){
 try{const u=new URL(endpoint);const loopback=['127.0.0.1','localhost','[::1]'].includes(u.hostname);
  if((u.protocol==='http:'&&loopback)||u.protocol==='https:')if(!u.username&&!u.password&&!u.search&&!u.hash)return u.href.replace(/\/$/,'');}catch{/* invalid */}
 return null;
}

export type JsonTask<T>={name:string;system:string;user:unknown;schema:Record<string,unknown>;validate:(value:unknown)=>T;maxChars?:number};
export type JsonModel={provider:'ollama';model:string;run<T>(task:JsonTask<T>):Promise<{value:T;durationMs:number}>};

export function createOllama(config:OllamaConfig,fetchImpl:typeof fetch=fetch):JsonModel{
 const root=baseUrl(config.endpoint);
 const usable=!!root&&!!config.model&&Number.isInteger(config.timeoutMs)&&config.timeoutMs>=1000&&config.timeoutMs<=600000&&Number.isInteger(config.retries)&&config.retries>=0&&config.retries<=3;
 async function once(task:JsonTask<unknown>,retry:boolean){
  const content=JSON.stringify(task.user);
  if(content.length>(task.maxChars??60000))throw new ModelError('CONTEXT_LIMIT');
  let response:Response;
  try{
   response=await fetchImpl(`${root}/api/chat`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(config.timeoutMs),headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:config.model,stream:false,think:false,format:task.schema,options:{temperature:0,num_ctx:config.numCtx},
     messages:[{role:'system',content:task.system+(retry?'\nYour previous answer did not match the schema or quoted text that is not in the sources. Return only valid JSON and quote exactly.':'')},{role:'user',content}]})});
  }catch(e){throw new ModelError(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'MODEL_TIMEOUT':'MODEL_UNAVAILABLE');}
  if(!response.ok){await response.body?.cancel();throw new ModelError('MODEL_UNAVAILABLE');}
  let payload:{message?:{content?:unknown};done?:boolean};
  try{payload=await response.json();}catch{throw new ModelError('INVALID_MODEL_OUTPUT');}
  const text=payload.message?.content;
  if(typeof text!=='string'||payload.done===false)throw new ModelError('INVALID_MODEL_OUTPUT');
  // Some models still wrap JSON in a thinking block; only the JSON object is accepted.
  const json=text.replace(/^[\s\S]*?<\/think>/,'').trim();
  let parsed:unknown;try{parsed=JSON.parse(json);}catch{throw new ModelError('INVALID_MODEL_OUTPUT');}
  return task.validate(parsed);
 }
 return {provider:'ollama',model:config.model,async run<T>(task:JsonTask<T>){
  if(!usable)throw new ModelError('MODEL_NOT_CONFIGURED');
  const started=Date.now();let last:ModelError=new ModelError('MODEL_UNAVAILABLE');
  for(let attempt=0;attempt<=config.retries;attempt++){
   try{return {value:await once(task as JsonTask<unknown>,attempt>0) as T,durationMs:Date.now()-started};}
   catch(e){last=e instanceof ModelError?e:new ModelError('INVALID_MODEL_OUTPUT');
    // A timeout already used the whole budget, and an oversized prompt will not shrink on retry.
    if(last.code==='MODEL_TIMEOUT'||last.code==='CONTEXT_LIMIT'||last.code==='MODEL_NOT_CONFIGURED')break;}
  }
  throw last;
 }};
}
