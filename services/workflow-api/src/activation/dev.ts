import type {SetupApprovalGrant} from './approval.ts';
import type {GitHubReadScope} from './github.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdmissionBundle } from './admission.ts';
import { parseRepositoryConfig } from './repository.ts';
import { createActivationServices } from './services.ts';
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
  // PORTAL_LLM_PROVIDER=ollama uses the local model for analysis and AiKA; AIKA_LLM_PROVIDER=ollama for AiKA alone
  // (same OLLAMA_* settings). Otherwise an OpenAI-compatible interpreter if configured, else rules.
  const ollama=ollamaConfigFromEnv();
  const aikaModel=ollama??ollamaConfigFromEnv({...process.env,PORTAL_LLM_PROVIDER:process.env.AIKA_LLM_PROVIDER});
  // Phase 7: repositories the operator configured per customer, live (read-only GitHub) or fixture (labelled sample).
  const repositoryConfig=process.env.ACTIVATION_REPOSITORIES_PATH?parseRepositoryConfig(JSON.parse(readFileSync(process.env.ACTIVATION_REPOSITORIES_PATH,'utf8'))):[];
  const apiOrigin=process.env.ACTIVATION_GITHUB_API_ORIGIN;
  // Only GitHub itself, or a loopback stand-in for tests; never an arbitrary host.
  if(apiOrigin&&apiOrigin!=='https://api.github.com'&&!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(apiOrigin))throw new Error('ACTIVATION_GITHUB_API_ORIGIN must be https://api.github.com or a loopback test origin');
  const services=createActivationServices({filename,bundles,handoffMode:process.env.ACTIVATION_INTAKE==='1',
   analysisModel:ollama?createOllama(ollama):null,aikaModel:aikaModel?createOllama(aikaModel):null,
   repositories:repositoryConfig,github:{token:process.env.ACTIVATION_GITHUB_REPOSITORY_TOKEN||undefined,...(apiOrigin?{apiOrigin}:{})},
   evidenceMaxAgeHours:Number(process.env.ACTIVATION_EVIDENCE_MAX_AGE_HOURS??24),inspectionCooldownMs:Number(process.env.ACTIVATION_INSPECTION_COOLDOWN_SECONDS??30)*1000,
   githubReadScopes:process.env.ACTIVATION_GITHUB_READ_SCOPES?JSON.parse(readFileSync(process.env.ACTIVATION_GITHUB_READ_SCOPES,'utf8')) as GitHubReadScope[]:[],githubReadToken:process.env.GITHUB_READ_TOKEN,
   setupApprovalGrants:process.env.ACTIVATION_SETUP_APPROVAL_GRANTS?JSON.parse(readFileSync(process.env.ACTIVATION_SETUP_APPROVAL_GRANTS,'utf8')) as SetupApprovalGrant[]:[]});
  const {store,intake,reports,github,handoff,work,aika,repositories,insights}=services;
  const bearer=(request:import('node:http').IncomingMessage,t:string|undefined)=>!!t&&request.headers.authorization===`Bearer ${t}`;
  // Dream Day applies whenever the handoff workflow can publish: only a Champion approval publishes new plans.
  const developerName=(request:import('node:http').IncomingMessage)=>developers.find(d=>request.headers.authorization===`Bearer ${d.token}`)?.name??null;
  return {options:{handoff,work,aika,repositories,insights,developerName,championApproval:process.env.ACTIVATION_INTAKE==='1',isChampion:(request:import('node:http').IncomingMessage)=>bearer(request,championToken),isOperator:(request:import('node:http').IncomingMessage)=>!!operatorToken&&request.headers.authorization===`Bearer ${operatorToken}`,store,prepareGitHub:github.prepare,reportProgress:reports.progress,reportBlocker:reports.submit,...(process.env.ACTIVATION_INTAKE==='1'?{intake:async(p:import('./store.ts').Principal,input:unknown)=>{try {const prepared=await intake.prepare(p,input);return store.initialize(p,prepared.context,prepared.plan);}finally{intake.release(p);}}}:{}),initialPlan:services.initialPlan,authorize:(request:import('node:http').IncomingMessage,customerId:string)=>(request.headers.authorization===`Bearer ${token}`||bearer(request,operatorToken)||bearer(request,championToken)||!!developerName(request))&&Date.parse(bundles[0].expiresAt)>Date.now()&&bundles[0].principal.customerId===customerId?bundles[0].principal:null},close:services.close};
}
