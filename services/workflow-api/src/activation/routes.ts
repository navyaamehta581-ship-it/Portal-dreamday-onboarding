import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActivationStore, Principal } from './store.ts';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types.ts';
export type ActivationOptions={store:ActivationStore; authorize:(request:IncomingMessage,customerId:string)=>Principal|null};
export async function activationRoute(request:IncomingMessage,response:ServerResponse,path:string,options:ActivationOptions,readJson:(r:IncomingMessage)=>Promise<unknown>) {
  const match=/^\/api\/activation\/v1\/customers\/([A-Za-z0-9_-]{1,200})\/(state|progress|blockers)$/.exec(path);
  if(!match)return false;
  response.setHeader('Access-Control-Expose-Headers','ETag');
  const send=(status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
  try {
    const p=options.authorize(request,match[1]);
    if(!p||p.customerId!==match[1]) {send(403,{error:{code:'FORBIDDEN'}});return true;}
    let state;
    if(match[2]==='state'&&request.method==='GET')state=options.store.get(p);
    else if(request.method==='POST') {
      const body=await readJson(request);
      if(match[2]==='state') {
        if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='context,plan') {send(400,{error:{code:'INVALID_REQUEST'}});return true;}
        const input=body as {context:CustomerContext;plan:ActivationPlan};
        state=options.store.initialize(p,input.context,input.plan);
      } else if(match[2]==='progress')state=options.store.progress(p,body as ProgressUpdate);
      else state=options.store.blocker(p,body as BlockerUpdate);
    } else {response.setHeader('Allow',match[2]==='state'?'GET, POST':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;}
    response.setHeader('ETag',`"activation-${state.revision}"`);
    send(request.method==='POST'&&match[2]==='state'?201:200,state);
  } catch(error) {
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'INTERNAL_ERROR';
    const statuses:Record<string,number>={FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,INVALID_TRANSITION:409,REPLAN_PENDING:409,ADAPTER_UNAVAILABLE:503,INVALID_REQUEST:400,INVALID_EVIDENCE:400,CAPABILITY_UNAVAILABLE:400,UNSUPPORTED_VERSION:400,UNSUPPORTED_MEDIA_TYPE:415,PAYLOAD_TOO_LARGE:413,INVALID_JSON:400};
    send(statuses[code]??500,{error:{code:statuses[code]?code:'INTERNAL_ERROR'}});
  }
  return true;
}
