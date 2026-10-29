import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ActivationStore, Principal } from './store.ts';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate } from '../../../../contracts/activation/v1/types.ts';
import type {HandoffService} from './handoff/service.ts';
import {developerState} from './handoff/project.ts';
import {uploadDocument} from './document/upload.ts';
import type {WorkService} from './handoff/work.ts';
import type {AikaService} from './handoff/aika.ts';
import type {RepositoryService} from './repository.ts';
import type {InsightsService} from './insights.ts';
import type {OpportunityService} from './opportunities.ts';
export type ActivationOptions={handoff?:HandoffService;isOperator?:(request:IncomingMessage,principal:Principal)=>boolean;
  /** Dream Day: the customer's authorized Champion (a separate server-held credential). */
  isChampion?:(request:IncomingMessage,principal:Principal)=>boolean;
  /** When set, new developer plans are published only by a Champion approval: direct publication, intake and initialization are refused. */
  championApproval?:boolean;
  /** Phase 5: the developer named by this request's own credential, or null for a shared or non-developer credential. */
  developerName?:(request:IncomingMessage,principal:Principal)=>string|null;
  work?:WorkService;aika?:AikaService;
  /** Phase 7: read-only repository evidence for configured repositories. */
  repositories?:RepositoryService;
  /** Phase 8: onboarding insights computed from stored records. */
  insights?:InsightsService;
  /** Role redesign: engineering opportunities, the Champion's priorities, developers' choices and adoption. */
  opportunities?:OpportunityService;prepareGitHub?:(principal:Principal,input:unknown)=>Promise<import('../../../../contracts/activation/v1/state.ts').ActivationState>;store:ActivationStore; authorize:(request:IncomingMessage,customerId:string)=>Principal|null; reportProgress?:(principal:Principal,input:unknown)=>import('../../../../contracts/activation/v1/state.ts').ActivationState; reportBlocker?:(principal:Principal,input:unknown)=>import('../../../../contracts/activation/v1/state.ts').ActivationState; intake?:(principal:Principal,input:unknown)=>Promise<import('../../../../contracts/activation/v1/state.ts').ActivationState>; initialPlan?:(principal:Principal,context:CustomerContext)=>ActivationPlan|null};
export async function activationRoute(request:IncomingMessage,response:ServerResponse,path:string,options:ActivationOptions,readJson:(r:IncomingMessage)=>Promise<unknown>) {
  const match=/^\/api\/activation\/v1\/customers\/([A-Za-z0-9_-]{1,200})\/(state|progress|blockers|intake|blocker-reports|progress-reports|github-preparations|setup-approvals|handoff|handoff-drafts|handoff-publications|handoff-workspace|handoff-documents|handoff-analyses|handoff-reviews|handoff-submissions|champion-review|champion-reviews|champion-decisions|milestone-work|milestone-updates|milestone-coordination|aika-questions|aika-capabilities|repository-evidence|repository-inspections|insights|opportunities|opportunity-priorities|opportunity-pursuits|adoption)$/.exec(path);
  if(!match)return false;
  response.setHeader('Access-Control-Expose-Headers','ETag');
  const send=(status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
  try {
    const p=options.authorize(request,match[1]);
    if(!p||p.customerId!==match[1]) {send(403,{error:{code:'FORBIDDEN'}});return true;}
    const operator=!!options.isOperator?.(request,p),champion=!operator&&!!options.isChampion?.(request,p);
    // Display name of who is acting, set by the Portal session layer from the signed-in persona; never an authority.
    const header=request.headers['x-portal-actor'];
    const actor=typeof header==='string'&&/^[\p{L}\p{M} .'-]{1,80}$/u.test(header.trim())?header.trim():null;
    const operatorOnly=match[2]==='intake'||match[2].startsWith('handoff')||(match[2]==='state'&&request.method==='POST');
    if(operatorOnly&&!operator){send(403,{error:{code:'OPERATOR_REQUIRED'}});return true;}
    if(match[2].startsWith('champion')&&!champion){send(403,{error:{code:'CHAMPION_REQUIRED'}});return true;}
    // Dream Day: every new developer plan goes through the Champion; older direct paths are closed.
    if(options.championApproval&&(match[2]==='handoff-publications'||match[2]==='intake'||(match[2]==='state'&&request.method==='POST'))){send(403,{error:{code:'CHAMPION_APPROVAL_REQUIRED'}});return true;}
    // Who is reading or acting. A developer's name comes only from their own credential, never from a header.
    const viewer=operator?{role:'operator' as const,name:actor}:champion?{role:'champion' as const,name:actor}:{role:'developer' as const,name:options.developerName?.(request,p)??null};
    if(['opportunities','opportunity-priorities','opportunity-pursuits','adoption'].includes(match[2])){
      const o=options.opportunities;
      if(!o){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      const route=`${request.method} ${match[2]}`;
      if(route==='GET opportunities'){send(200,await o.view(p,viewer));return true;}
      if(route==='POST opportunity-priorities'){send(200,o.prioritize(p,viewer,await readJson(request)));return true;}
      if(route==='POST opportunity-pursuits'){send(200,o.pursue(p,viewer,await readJson(request)));return true;}
      if(route==='GET adoption'){send(200,o.adoption(p,viewer));return true;}
      response.setHeader('Allow',match[2]==='opportunities'||match[2]==='adoption'?'GET':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    if(match[2]==='insights'){
      if(!options.insights){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      if(request.method==='GET'){send(200,options.insights.view(p,viewer));return true;}
      response.setHeader('Allow','GET');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    if(match[2]==='repository-evidence'||match[2]==='repository-inspections'){
      const route=`${request.method} ${match[2]}`;
      if(!options.repositories){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      if(route==='GET repository-evidence'){send(200,options.repositories.view(p,viewer));return true;}
      if(route==='POST repository-inspections'){const r=await options.repositories.inspect(p,viewer,await readJson(request));send(r.reused?200:201,{...r,evidence:options.repositories.view(p,viewer)});return true;}
      response.setHeader('Allow',match[2]==='repository-evidence'?'GET':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    if(match[2]==='milestone-work'||match[2]==='milestone-updates'||match[2]==='milestone-coordination'||match[2]==='aika-questions'||match[2]==='aika-capabilities'){
      const route=`${request.method} ${match[2]}`;
      if(match[2]==='aika-capabilities'){
        if(!options.aika){send(503,{error:{code:'AIKA_UNAVAILABLE'}});return true;}
        if(route==='GET aika-capabilities'){send(200,{capabilities:options.aika.capabilities(p,viewer),modelConfigured:options.aika.modelConfigured});return true;}
        response.setHeader('Allow','GET');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
      }
      if(match[2]==='aika-questions'){
        if(!options.aika){send(503,{error:{code:'AIKA_UNAVAILABLE'}});return true;}
        if(operator){send(403,{error:{code:'FORBIDDEN'}});return true;}
        if(route==='GET aika-questions'){send(200,{job:options.aika.status(p,viewer)});return true;}
        if(route==='POST aika-questions'){const r=options.aika.ask(p,viewer,await readJson(request));send(r.duplicate?200:202,r);return true;}
        response.setHeader('Allow','GET, POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
      }
      if(!options.work){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      if(route==='GET milestone-work'){send(200,options.work.view(p,viewer));return true;}
      // Phase 6: only the Champion coordinates and reviews; Chris observes, developers update their own work.
      if(match[2]==='milestone-coordination'&&!champion){send(403,{error:{code:'CHAMPION_REQUIRED'}});return true;}
      if(route==='POST milestone-coordination'){send(200,options.work.coordinate(p,actor??'Customer Champion',await readJson(request)));return true;}
      if(route==='POST milestone-updates'){send(200,options.work.update(p,viewer.role==='developer'?viewer.name:null,await readJson(request)));return true;}
      response.setHeader('Allow',match[2]==='milestone-work'?'GET':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    if(match[2].startsWith('champion')){
      const h=options.handoff;
      if(!h){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      const route=`${request.method} ${match[2]}`;
      if(route==='GET champion-review'){send(200,h.championView(p));return true;}
      if(route==='POST champion-reviews'){send(200,h.saveChampionReview(p,await readJson(request),actor??undefined));return true;}
      if(route==='POST champion-decisions'){const v=h.championDecision(p,await readJson(request),actor??undefined);
        // Once published, the Portal observes the plan's repositories itself (Spotify's integration); nobody has to.
        if(v.status==='published')void options.repositories?.observe(p).catch(()=>undefined);
        send(200,v);return true;}
      response.setHeader('Allow',match[2]==='champion-review'?'GET':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
    }
    // Operator-only workspace routes: they return operator records, never activation state.
    if(match[2]!=='handoff-publications'&&match[2].startsWith('handoff')){
      const h=options.handoff;
      if(!h){send(503,{error:{code:'ADAPTER_UNAVAILABLE'}});return true;}
      const route=`${request.method} ${match[2]}`;
      if(route==='GET handoff'){send(200,h.overview(p));return true;}
      if(route==='POST handoff-drafts'){send(201,await h.draft(p,await readJson(request)));return true;}
      if(route==='POST handoff-workspace'){send(200,h.saveWorkspace(p,await readJson(request)));return true;}
      if(route==='POST handoff-documents'){send(202,await uploadDocument(h,p,request));return true;}
      if(route==='GET handoff-analyses'){send(200,{job:h.analysisStatus(p)});return true;}
      if(route==='POST handoff-analyses'){const r=h.startAnalysis(p,await readJson(request));send(r.duplicate?200:202,r);return true;}
      if(route==='POST handoff-reviews'){send(200,h.saveReview(p,await readJson(request)));return true;}
      if(route==='POST handoff-submissions'){send(200,h.submission(p,await readJson(request),actor??undefined));return true;}
      response.setHeader('Allow',match[2]==='handoff'?'GET':match[2]==='handoff-analyses'?'GET, POST':'POST');send(405,{error:{code:'METHOD_NOT_ALLOWED'}});return true;
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
    send(request.method==='POST'&&(match[2]==='state'||match[2]==='handoff-publications')?201:200,operator?{...state,...(published?{handoff:published}:{})}:developerState(state,published,champion?{role:'champion',actor}:{role:'developer',actor:viewer.name}));
  } catch(error) {
    const code=error&&typeof error==='object'&&'code' in error?String(error.code):'INTERNAL_ERROR';
    const statuses:Record<string,number>={NO_APPROVED_PLAN:404,AIKA_CAPABILITY_FORBIDDEN:403,REVIEW_NOT_READY:409,ALREADY_REVIEWED:409,NOT_ASSIGNEE:403,DEVELOPER_IDENTITY_REQUIRED:403,MILESTONE_NOT_READY:409,INVALID_EVIDENCE_REFERENCE:400,AIKA_UNAVAILABLE:503,CHAMPION_APPROVAL_REQUIRED:403,CHAMPION_REQUIRED:403,NOT_UNDER_REVIEW:409,ALREADY_APPROVED:409,COMMENT_REQUIRED:400,ALREADY_PUBLISHED:409,AWAITING_CHAMPION_REVIEW:409,NOT_LATEST_DRAFT:409,REVIEW_INCOMPLETE:400,CONFIDENTIAL_CONTENT:400,FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,INVALID_TRANSITION:409,REPLAN_PENDING:409,ADAPTER_UNAVAILABLE:503,INVALID_REQUEST:400,PDF_REQUIRED:415,NOT_A_PDF:415,PDF_TOO_LARGE:413,PDF_INVALID:422,PDF_ENCRYPTED:422,PDF_UNREADABLE:422,PDF_NO_TEXT:422,PDF_TIMEOUT:422,PDF_BUSY:503,ANALYSIS_RUNNING:409,INVALID_EVIDENCE:400,CAPABILITY_UNAVAILABLE:400,UNSUPPORTED_VERSION:400,UNSUPPORTED_MEDIA_TYPE:415,PAYLOAD_TOO_LARGE:413,INVALID_JSON:400};
    const details=statuses[code]&&error&&typeof error==='object'&&'details' in error?{details:(error as {details:unknown}).details}:{};
    send(statuses[code]??500,{error:{code:statuses[code]?code:'INTERNAL_ERROR',...details}});
  }
  return true;
}
