import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActivationStore, Principal } from './store.ts';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types.ts';
import type {HandoffService} from './handoff/service.ts';
import {developerState} from './handoff/project.ts';
export type ActivationOptions={handoff?:HandoffService;isOperator?:(request:IncomingMessage,principal:Principal)=>boolean;prepareGitHub?:(principal:Principal,input:unknown)=>Promise<import('../../../../contracts/activation/v1/state.ts').ActivationState>;store:ActivationStore; authorize:(request:IncomingMessage,customerId:string)=>Principal|null; reportProgress?:(principal:Principal,input:unknown)=>import('../../../../contracts/activation/v1/state.ts').ActivationState; reportBlocker?:(principal:Principal,input:unknown)=>import('../../../../contracts/activation/v1/state.ts').ActivationState; intake?:(principal:Principal,input:unknown)=>Promise<import('../../../../contracts/activation/v1/state.ts').ActivationState>; initialPlan?:(principal:Principal,context:CustomerContext)=>ActivationPlan|null};
export async function activationRoute(request:IncomingMessage,response:ServerResponse,path:string,options:ActivationOptions,readJson:(r:IncomingMessage)=>Promise<unknown>) {
  const match=/^\/api\/activation\/v1\/customers\/([A-Za-z0-9_-]{1,200})\/(state|progress|blockers|intake|blocker-reports|progress-reports|github-preparations|setup-approvals|handoff|handoff-drafts|handoff-publications)$/.exec(path);
  if(!match)return false;
  response.setHeader('Access-Control-Expose-Headers','ETag');
  const send=(status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
  try {
    const p=options.authorize(request,match[1]);
    if(!p||p.customerId!==match[1]) {send(403,{error:{code:'FORBIDDEN'}});return true;}
    const operator=!!options.isOperator?.(request,p);
    const operatorOnly=match[2]==='intake'||match[2].startsWith('handoff')||(match[2]==='state'&&request.method==='POST');
    if(operatorOnly&&!operator){send(403,{error:{code:'OPERATOR_REQUIRED'}});return true;}
    if(match[2]==='handoff'||match[2]==='handoff-drafts'){
      if(!options.handoff){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      if(match[2]==='handoff'&&request.method==='GET'){send(200,options.handoff.overview(p));return true;}
      if(match[2]==='handoff-drafts'&&request.method==='POST'){send(201,await options.handoff.draft(p,await readJson(request)));return true;}
      response.setHeader('Allow',match[2]==='handoff'?'GET':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    let state;
    if(match[2]==='state'&&request.method==='GET')state=options.store.get(p);
    else if(request.method==='POST') {
      const body=await readJson(request);
      if(match[2]==='setup-approvals') {
        state=options.store.acceptSetupProposal(p,body);
      } else if(match[2]==='github-preparations') {
        if(!options.prepareGitHub){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=await options.prepareGitHub(p,body);
      } else if(match[2]==='progress-reports') {
        if(!options.reportProgress){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=options.reportProgress(p,body);
      } else if(match[2]==='blocker-reports') {
        if(!options.reportBlocker){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=options.reportBlocker(p,body);
      } else if(match[2]==='handoff-publications') {
        if(!options.handoff){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=options.handoff.publish(p,body);
      } else if(match[2]==='intake') {
        if(!options.intake){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=await options.intake(p,body);
      } else if(match[2]==='state') {
        if(!body||typeof body!=='object'||Array.isArray(body)||!['context','context,plan'].includes(Object.keys(body).sort().join(','))) {send(400,{error:{code:'INVALID_REQUEST'}});return true;}
        const input=body as {context:CustomerContext;plan?:ActivationPlan};
        const plan=input.plan??options.initialPlan?.(p,input.context);
        if(!plan){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
        state=options.store.initialize(p,input.context,plan);
      } else if(match[2]==='progress')state=options.store.progress(p,body as ProgressUpdate);
      else state=options.store.blocker(p,body as BlockerUpdate);
    } else {response.setHeader('Allow',match[2]==='state'?'GET, POST':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;}
    response.setHeader('ETag',`"activation-${state.revision}"`);
    // Field-level projection: developers only ever receive the developer-safe view.
    const published=options.handoff?.published(p)??null;
    send(request.method==='POST'&&(match[2]==='state'||match[2]==='handoff-publications')?201:200,operator?{...state,...(published?{handoff:published}:{})}:developerState(state,published));
  } catch(error) {
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'INTERNAL_ERROR';
    const statuses:Record<string,number>={CONFIDENTIAL_CONTENT:400,FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,INVALID_TRANSITION:409,REPLAN_PENDING:409,ADAPTER_UNAVAILABLE:503,INVALID_REQUEST:400,INVALID_EVIDENCE:400,CAPABILITY_UNAVAILABLE:400,UNSUPPORTED_VERSION:400,UNSUPPORTED_MEDIA_TYPE:415,PAYLOAD_TOO_LARGE:413,INVALID_JSON:400};
    send(statuses[code]??500,{error:{code:statuses[code]?code:'INTERNAL_ERROR'}});
  }
  return true;
}
