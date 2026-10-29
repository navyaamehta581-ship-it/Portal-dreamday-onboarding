import {setupApprovalPolicy,type SetupApprovalGrant} from './approval.ts';
import {createGitHubPreparation,type GitHubReadScope} from './github.ts';
import {createBlockerReports} from './reports.ts';
import type {ActivationStore} from './store.ts';
import { createIntake } from './intake.ts';
import { interpreterFromEnv } from './interpretation/provider.mjs';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registryPolicy, type AdmissionBundle } from './admission.ts';
import { openActivationStore } from './store.ts';
import { createReplanWorker } from './worker.ts';
import { openHandoffStore } from './handoff/store.ts';
import { createHandoffService } from './handoff/service.ts';
import { createWorkService, openWorkStore } from './handoff/work.ts';
import { createAika } from './handoff/aika.ts';
import { hostedInterpreter } from './handoff/hosted.ts';
import { analyzeWithModel } from './handoff/intelligence.ts';
import { proposeMilestones } from './handoff/milestones.ts';
import { createOllama, ollamaConfigFromEnv } from '../llm/ollama.ts';
/** Explicit loopback development mode, not production authentication. */
export function developmentActivation(goalFilename:string) {
  if(process.env.ACTIVATION_DEV!=='1')return null;
  const token=process.env.ACTIVATION_DEV_TOKEN;
  if(!token||token.length<32)throw new Error('ACTIVATION_DEV_TOKEN needs at least 32 characters');
  const operatorToken=process.env.ACTIVATION_OPERATOR_TOKEN;
  if(operatorToken&&(operatorToken.length<32||operatorToken===token))throw new Error('ACTIVATION_OPERATOR_TOKEN must be distinct and at least 32 characters');
  // Phase 5: one credential per developer, so each developer's work is attributed to them on the server.
  const developers=process.env.ACTIVATION_DEVELOPERS_PATH?JSON.parse(readFileSync(process.env.ACTIVATION_DEVELOPERS_PATH,'utf8')) as {name:string;token:string}[]:[];
  if(!Array.isArray(developers)||developers.some(d=>typeof d?.name!=='string'||!d.name.trim()||typeof d.token!=='string'||d.token.length<32||d.token===token||d.token===operatorToken)||new Set(developers.map(d=>d.token)).size!==developers.length)throw new Error('ACTIVATION_DEVELOPERS_PATH must list distinct developer names and tokens of at least 32 characters');
  const championToken=process.env.ACTIVATION_CHAMPION_TOKEN;
  if(championToken&&(championToken.length<32||championToken===token||championToken===operatorToken))throw new Error('ACTIVATION_CHAMPION_TOKEN must be distinct and at least 32 characters');
  const path=process.env.ACTIVATION_ADMISSION_PATH;
  if(!path)throw new Error('ACTIVATION_ADMISSION_PATH must name an operator-owned admission bundle file');
  const bundles=JSON.parse(readFileSync(path,'utf8')) as AdmissionBundle[];
  if(!Array.isArray(bundles)||bundles.length!==1)throw new Error('Development mode requires exactly one scoped bundle');
  const filename=resolve(process.env.ACTIVATION_DATABASE_PATH||'data/activation-dev.sqlite');
  if(filename===resolve(goalFilename))throw new Error('Activation and Goal databases must differ');
  const intake=createIntake(registryPolicy(bundles),interpreterFromEnv());
  let store:ActivationStore;
  const reports=createBlockerReports(intake.policy,()=>store);
  const github=createGitHubPreparation(reports.policy,()=>store,process.env.ACTIVATION_GITHUB_READ_SCOPES?JSON.parse(readFileSync(process.env.ACTIVATION_GITHUB_READ_SCOPES,'utf8')) as GitHubReadScope[]:[],{token:process.env.GITHUB_READ_TOKEN});
  store=openActivationStore(filename,setupApprovalPolicy(github.policy,process.env.ACTIVATION_SETUP_APPROVAL_GRANTS?JSON.parse(readFileSync(process.env.ACTIVATION_SETUP_APPROVAL_GRANTS,'utf8')) as SetupApprovalGrant[]:[]));
  // Server-built report replacements or exact operator-reviewed plans; both remain suggestions.
  const handoffs=openHandoffStore(filename);
  // PORTAL_LLM_PROVIDER=ollama uses the local model; otherwise an OpenAI-compatible endpoint if configured, else rules.
  const ollama=ollamaConfigFromEnv();
  const hosted=hostedInterpreter();
  type Sources=import('../../../../contracts/activation/v1/handoff.ts').SourceInput[];type OnStage=import('./handoff/intelligence.ts').StageListener;
  const analyze=ollama?(s:Sources,onStage?:OnStage)=>analyzeWithModel(createOllama(ollama),s,onStage):async(s:Sources,onStage?:OnStage)=>{onStage?.('interpreting',null);const understanding=await hosted.interpret(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};};
  const handoff=createHandoffService({handoffs,store:()=>store,analyze,stage:intake.stage,release:intake.release,publishEnabled:process.env.ACTIVATION_INTAKE==='1'});
  const workStore=openWorkStore(filename);
  // Verified evidence is only what the backend itself observed on GitHub; developer references stay "reported".
  const repositoryEvidence=(p:import('./store.ts').Principal)=>{try{const s=store.get(p);return [...s.evidence,...s.plan.evidence].filter((e,i,all)=>e.kind==='github_observation'&&all.findIndex(x=>x.id===e.id)===i).map(e=>e.claim);}catch{return [];}};
  const work=createWorkService({published:p=>handoffs.published(p),work:workStore,verifiedEvidence:repositoryEvidence});
  // AiKA uses the local model when PORTAL_LLM_PROVIDER=ollama, or AIKA_LLM_PROVIDER=ollama for AiKA alone (same
  // OLLAMA_* settings); without either AiKA reports it is unavailable. The browser never reaches the model.
  const aikaModel=ollama??ollamaConfigFromEnv({...process.env,PORTAL_LLM_PROVIDER:process.env.AIKA_LLM_PROVIDER});
  const aika=createAika({model:aikaModel?createOllama(aikaModel):null,work,publishedRecord:p=>handoffs.all(p).filter(r=>r.status==='published').at(-1)??null,
   repositoryEvidence});
  const worker=createReplanWorker(store,async(p,state,intent)=>reports.replacement(state,intent)??bundles.find(b=>isDeepStrictEqual(b.principal,p))?.plans.find(plan=>plan.contextRevision===state.contextRevision&&plan.revision===state.planRevision+1&&plan.supersedesRevision===state.planRevision&&plan.blockerIds.includes(intent.id))??null);
  const stop=worker.start();
  const bearer=(request:import('node:http').IncomingMessage,t:string|undefined)=>!!t&&request.headers.authorization===`Bearer ${t}`;
  // Dream Day applies whenever the handoff workflow can publish: only a Champion approval publishes new plans.
  const developerName=(request:import('node:http').IncomingMessage)=>developers.find(d=>request.headers.authorization===`Bearer ${d.token}`)?.name??null;
  return {options:{handoff,work,aika,developerName,championApproval:process.env.ACTIVATION_INTAKE==='1',isChampion:(request:import('node:http').IncomingMessage)=>bearer(request,championToken),isOperator:(request:import('node:http').IncomingMessage)=>!!operatorToken&&request.headers.authorization===`Bearer ${operatorToken}`,store,prepareGitHub:github.prepare,reportProgress:reports.progress,reportBlocker:reports.submit,...(process.env.ACTIVATION_INTAKE==='1'?{intake:async(p:import('./store.ts').Principal,input:unknown)=>{try {const prepared=await intake.prepare(p,input);return store.initialize(p,prepared.context,prepared.plan);}finally{intake.release(p);}}}:{}),initialPlan:(p:import('./store.ts').Principal,context:import('../../../../contracts/activation/v1/types.ts').CustomerContext)=>bundles.find(b=>isDeepStrictEqual(b.principal,p)&&isDeepStrictEqual(b.context,context))?.plans.find(plan=>plan.contextRevision===context.revision&&plan.revision===0&&plan.supersedesRevision===null)??null,authorize:(request:import('node:http').IncomingMessage,customerId:string)=>(request.headers.authorization===`Bearer ${token}`||bearer(request,operatorToken)||bearer(request,championToken)||!!developerName(request))&&Date.parse(bundles[0].expiresAt)>Date.now()&&bundles[0].principal.customerId===customerId?bundles[0].principal:null},async close(){await stop();handoffs.close();workStore.close();store.close();}};
}
