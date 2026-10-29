/** The activation services behind the API routes, shared by local development (dev.ts) and the hosted demo
 * (hosted.ts). Callers decide authorization and configuration; this module only wires the stores and services. */
import {isDeepStrictEqual} from 'node:util';
import {setupApprovalPolicy,type SetupApprovalGrant} from './approval.ts';
import {createGitHubPreparation,type GitHubReadScope} from './github.ts';
import {createBlockerReports} from './reports.ts';
import {createIntake} from './intake.ts';
import {interpreterFromEnv} from './interpretation/provider.mjs';
import {registryPolicy,type AdmissionBundle} from './admission.ts';
import {openActivationStore,type ActivationStore,type Principal} from './store.ts';
import {createReplanWorker} from './worker.ts';
import {openHandoffStore} from './handoff/store.ts';
import {createHandoffService} from './handoff/service.ts';
import {createWorkService,openWorkStore} from './handoff/work.ts';
import {createAika} from './handoff/aika.ts';
import {createRepositoryService,openRepositoryStore,type GitHubOptions,type RepositoryConfig} from './repository.ts';
import {hostedInterpreter} from './handoff/hosted.ts';
import {createInsights} from './insights.ts';
import {analyzeWithModel,type StageListener} from './handoff/intelligence.ts';
import {proposeMilestones} from './handoff/milestones.ts';
import type {JsonModel} from '../llm/ollama.ts';
import type {SourceInput} from '../../../../contracts/activation/v1/handoff.ts';

export type ServiceConfig={
 /** One SQLite file holds every activation store. */
 filename:string;
 /** Operator-owned admission bundles (local development); the hosted demo starts empty and publishes through Dream Day. */
 bundles:AdmissionBundle[];
 /** Handoff mode: Chris's workspace publishes new plans, only through a Champion approval. */
 handoffMode:boolean;
 /** Model for Chris's analysis and AiKA; null uses rule-based analysis (or an OpenAI-compatible interpreter if configured) and AiKA reports it is unavailable. */
 analysisModel:JsonModel|null;aikaModel:JsonModel|null;
 repositories:RepositoryConfig[];github:GitHubOptions;evidenceMaxAgeHours:number;inspectionCooldownMs:number;
 githubReadScopes?:GitHubReadScope[];githubReadToken?:string;setupApprovalGrants?:SetupApprovalGrant[];
};

export function createActivationServices(c:ServiceConfig){
 const intake=createIntake(registryPolicy(c.bundles),interpreterFromEnv());
 let store:ActivationStore;
 const reports=createBlockerReports(intake.policy,()=>store);
 const github=createGitHubPreparation(reports.policy,()=>store,c.githubReadScopes??[],{token:c.githubReadToken});
 store=openActivationStore(c.filename,setupApprovalPolicy(github.policy,c.setupApprovalGrants??[]));
 // Server-built report replacements or exact operator-reviewed plans; both remain suggestions.
 const handoffs=openHandoffStore(c.filename);
 const hosted=hostedInterpreter();
 const analyze=c.analysisModel?(s:SourceInput[],onStage?:StageListener)=>analyzeWithModel(c.analysisModel!,s,onStage)
  :async(s:SourceInput[],onStage?:StageListener)=>{onStage?.('interpreting',null);const understanding=await hosted.interpret(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};};
 const handoff=createHandoffService({handoffs,store:()=>store,analyze,stage:intake.stage,release:intake.release,publishEnabled:c.handoffMode});
 const workStore=openWorkStore(c.filename);
 // Verified evidence is only what the backend itself observed on GitHub; developer references stay "reported".
 const repositoryEvidence=(p:Principal)=>{try{const s=store.get(p);return [...s.evidence,...s.plan.evidence].filter((e,i,all)=>e.kind==='github_observation'&&all.findIndex(x=>x.id===e.id)===i).map(e=>e.claim);}catch{return [];}};
 const work=createWorkService({published:p=>handoffs.published(p),work:workStore,verifiedEvidence:repositoryEvidence});
 // Repositories the operator configured per customer, live (read-only GitHub) or fixture (labelled sample).
 const repositoryStore=openRepositoryStore(c.filename);
 const repositories=createRepositoryService({config:c.repositories,store:repositoryStore,published:p=>handoffs.published(p),github:c.github,maxAgeHours:c.evidenceMaxAgeHours,cooldownMs:c.inspectionCooldownMs});
 const aika=createAika({model:c.aikaModel,work,publishedRecord:p=>handoffs.all(p).filter(r=>r.status==='published').at(-1)??null,
  // Repository observations carry ids AiKA must cite; older inspection-packet evidence is live GitHub evidence too.
  repositoryCount:(p,viewer)=>{try{return repositories.view(p,viewer).repositories.length;}catch{return 0;}},
  repositoryEvidence:(p,viewer)=>{const r=repositories.forAika(p,viewer);let legacy:string[]=[];try{legacy=repositoryEvidence(p);}catch{legacy=[];}
   return {lines:[...r.lines,...legacy.map((claim,i)=>({id:`obs-packet-${i+1}`,mode:'live' as const,status:'observed' as const,line:`[obs-packet-${i+1}] OBSERVED (live, read-only inspection packet): ${claim}`}))],inspected:r.inspected||legacy.length>0};}});
 const insights=createInsights({work,repositories,records:p=>handoffs.all(p),published:p=>handoffs.published(p)});
 const worker=createReplanWorker(store,async(p,state,intent)=>reports.replacement(state,intent)??c.bundles.find(b=>isDeepStrictEqual(b.principal,p))?.plans.find(plan=>plan.contextRevision===state.contextRevision&&plan.revision===state.planRevision+1&&plan.supersedesRevision===state.planRevision&&plan.blockerIds.includes(intent.id))??null);
 const stop=worker.start();
 return {store,intake,reports,github,handoff,handoffs,work,aika,repositories,insights,
  initialPlan:(p:Principal,context:import('../../../../contracts/activation/v1/types.ts').CustomerContext)=>c.bundles.find(b=>isDeepStrictEqual(b.principal,p)&&isDeepStrictEqual(b.context,context))?.plans.find(plan=>plan.contextRevision===context.revision&&plan.revision===0&&plan.supersedesRevision===null)??null,
  async close(){await stop();handoffs.close();workStore.close();repositoryStore.close();store.close();}};
}
export type ActivationServices=ReturnType<typeof createActivationServices>;
