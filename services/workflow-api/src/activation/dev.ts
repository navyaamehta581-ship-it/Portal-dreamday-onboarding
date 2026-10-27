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
/** Explicit loopback development mode, not production authentication. */
export function developmentActivation(goalFilename:string) {
  if(process.env.ACTIVATION_DEV!=='1')return null;
  const token=process.env.ACTIVATION_DEV_TOKEN;
  if(!token||token.length<32)throw new Error('ACTIVATION_DEV_TOKEN needs at least 32 characters');
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
  const worker=createReplanWorker(store,async(p,state,intent)=>reports.replacement(state,intent)??bundles.find(b=>isDeepStrictEqual(b.principal,p))?.plans.find(plan=>plan.contextRevision===state.contextRevision&&plan.revision===state.planRevision+1&&plan.supersedesRevision===state.planRevision&&plan.blockerIds.includes(intent.id))??null);
  const stop=worker.start();
  return {options:{store,prepareGitHub:github.prepare,reportProgress:reports.progress,reportBlocker:reports.submit,...(process.env.ACTIVATION_INTAKE==='1'?{intake:async(p:import('./store.ts').Principal,input:unknown)=>{try {const prepared=await intake.prepare(p,input);return store.initialize(p,prepared.context,prepared.plan);}finally{intake.release(p);}}}:{}),initialPlan:(p:import('./store.ts').Principal,context:import('../../../../contracts/activation/v1/types.ts').CustomerContext)=>bundles.find(b=>isDeepStrictEqual(b.principal,p)&&isDeepStrictEqual(b.context,context))?.plans.find(plan=>plan.contextRevision===context.revision&&plan.revision===0&&plan.supersedesRevision===null)??null,authorize:(request:import('node:http').IncomingMessage,customerId:string)=>request.headers.authorization===`Bearer ${token}`&&Date.parse(bundles[0].expiresAt)>Date.now()&&bundles[0].principal.customerId===customerId?bundles[0].principal:null},async close(){await stop();store.close();}};
}
