import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {ActivationError,type ActivationStore,type Principal,type Policy} from './store.ts';
import type {EvidenceRecord} from '../../../../contracts/activation/v1/types.ts';
import type {GitHubPreparation} from '../../../../contracts/activation/v1/state.ts';

/** Operator-owned read scope. This is never GitHub write authorization. */
export type GitHubReadScope={principal:Principal;actionId:string;actionRevision:number;planRevision:number;repository:string;commit:string;templatePath:string;prerequisitePaths:string[];expiresAt:string};
export type PrepareCommand={id:string;expectedRevision:number;planRevision:number;actionId:string;actionRevision:number};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const fail=(code:string):never=>{throw new ActivationError(code);};
const pathOK=(s:string)=>typeof s==='string'&&s.length>0&&s.length<=300&&!s.split('/').some(x=>!x||x==='.'||x==='..')&&/^[A-Za-z0-9_./-]+$/.test(s);
export function createGitHubPreparation(base:Policy,getStore:()=>ActivationStore,scopes:GitHubReadScope[],options:{fetchImpl?:typeof fetch;token?:string;now?:()=>number}={}) {
 const owned=structuredClone(scopes),now=options.now??Date.now;
 for(const x of owned)if(!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(x.repository)||!/^[a-f0-9]{40}$/.test(x.commit)||!pathOK(x.templatePath)||!Array.isArray(x.prerequisitePaths)||x.prerequisitePaths.length>10||!x.prerequisitePaths.every(pathOK)||!Number.isFinite(Date.parse(x.expiresAt)))throw new Error('Invalid operator GitHub read scope');
 let admitted:{principal:Principal;records:EvidenceRecord[]}|null=null;
 const policy:Policy={...base,admit:(p,e,purpose)=>(purpose==='progress'&&isDeepStrictEqual(p,admitted?.principal)&&!!admitted?.records.some(r=>isDeepStrictEqual(r,e)))||base.admit(p,e,purpose)};
 const pending=new Map<string,Promise<ReturnType<ActivationStore['get']>>>();
 function parse(input:unknown):PrepareCommand {
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_REQUEST');
  const b=input as PrepareCommand;
  if(Object.keys(b).sort().join(',')!=='actionId,actionRevision,expectedRevision,id,planRevision'||typeof b.id!=='string'||!/^prepare:[A-Za-z0-9_-]{1,80}$/.test(b.id)||typeof b.actionId!=='string'||!b.actionId||b.actionId.length>200||![b.expectedRevision,b.planRevision,b.actionRevision].every(n=>Number.isSafeInteger(n)&&n>=0))return fail('INVALID_REQUEST');
  return b;
 }
 async function perform(p:Principal,b:PrepareCommand) {
  const store=getStore(),digest=hash(JSON.stringify([b.id,b.expectedRevision,b.planRevision,b.actionId,b.actionRevision]));
  let s=store.get(p),record=s.githubPreparations?.[b.id];
  if(record&&record.commandDigest!==digest)return fail('IDEMPOTENCY_CONFLICT');
  if(record&&record.status!=='inspecting')return s;
  const scope=owned.find(x=>isDeepStrictEqual(x.principal,p)&&x.actionId===b.actionId&&x.actionRevision===b.actionRevision&&x.planRevision===b.planRevision&&Date.parse(x.expiresAt)>now());
  if(!scope)return fail('FORBIDDEN');
  if(record&&record.scopeDigest!==hash(JSON.stringify(scope)))return fail('FORBIDDEN');
  if(record&&(record.repository!==scope.repository||record.commit!==scope.commit||record.templatePath!==scope.templatePath))return fail('FORBIDDEN');
  if(!record) {
   if(s.revision!==b.expectedRevision||s.planRevision!==b.planRevision)return fail('REVISION_CONFLICT');
   record={id:b.id,commandDigest:digest,scopeDigest:hash(JSON.stringify(scope)),actionId:b.actionId,actionRevision:b.actionRevision,planRevision:b.planRevision,startedRevision:s.revision+1,status:'inspecting',repository:scope.repository,commit:scope.commit,templatePath:scope.templatePath,templateBlob:null,observedAt:new Date(now()).toISOString(),completedAt:null,evidenceIds:[],artifact:null,artifactDigest:null,blockers:['Inspection pending; exact retry is safe after interruption.'],errorCode:null,authorization:'inspect_prepare_only',approved:false,executed:false,verified:false,prUrl:null};
   s=store.beginGitHubPreparation(p,b.expectedRevision,record);
  }
  const result=structuredClone(record),records:EvidenceRecord[]=[];
  try {
   if(s.revision!==record.startedRevision||s.planRevision!==b.planRevision)return fail('REVISION_CONFLICT');
   const root=`https://api.github.com/repos/${scope.repository}`;
   const read=async(path:string):Promise<Record<string,any>>=>{
    const response=await (options.fetchImpl??fetch)(root+path,{method:'GET',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(options.token?{Authorization:`Bearer ${options.token}`}:{})},redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return fail(response.status===401?'GITHUB_AUTH_FAILED':response.status===403?'GITHUB_FORBIDDEN':response.status===404?'GITHUB_NOT_FOUND':response.status===429?'GITHUB_RATE_LIMITED':'GITHUB_UNAVAILABLE');
    // Bound streamed response bytes before parsing; never persist API error bodies or credentials.
    if(!response.body)return fail('GITHUB_INVALID_RESPONSE');
    const reader=response.body.getReader();let text='';let bytes=0;const decoder=new TextDecoder();
    try {while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000)return fail('GITHUB_RESPONSE_TOO_LARGE');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
    return JSON.parse(text);
   };
   const meta=await read('');
   if(meta.full_name!==scope.repository||meta.archived||meta.disabled||typeof meta.default_branch!=='string')return fail('GITHUB_INVALID_RESPONSE');
   const head=await read(`/commits/${encodeURIComponent(meta.default_branch)}`);
   if(head.sha!==scope.commit)return fail('GITHUB_STALE_HEAD');
   const commit=await read(`/git/commits/${scope.commit}`);
   if(commit.sha!==scope.commit||!/^[a-f0-9]{40}$/.test(commit.tree?.sha))return fail('GITHUB_INVALID_RESPONSE');
   const tree=await read(`/git/trees/${commit.tree.sha}?recursive=1`);
   if(tree.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree))return fail('GITHUB_INCOMPLETE_TREE');
   for(const path of [...new Set([scope.templatePath,...scope.prerequisitePaths])]) {
    const matches=tree.tree.filter((e:any)=>e.path===path);
    const entry=matches[0];
    if(matches.length!==1||entry.type!=='blob'||entry.mode!=='100644'||!/^[a-f0-9]{40}$/.test(entry.sha))return fail('GITHUB_PREREQUISITE_MISSING');
    const blob=await read(`/git/blobs/${entry.sha}`);
    if(blob.sha!==entry.sha||blob.encoding!=='base64'||typeof blob.content!=='string'||!Number.isSafeInteger(blob.size)||blob.size<0||blob.size>65536)return fail('GITHUB_INVALID_BLOB');
    const bytes=Buffer.from(blob.content,'base64');
    const actual=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
    if(bytes.length!==blob.size||actual!==entry.sha)return fail('GITHUB_BLOB_MISMATCH');
    if(path===scope.templatePath)result.templateBlob=actual;
    records.push({id:`github:${hash(JSON.stringify([p,b.id,path,scope.commit]))}`,kind:'github_observation',claim:`Read-only check: ${path} exists as a regular file (${bytes.length} bytes); Git blob hash independently matched ${actual}. Contents were not executed or semantically validated.`,source:`https://github.com/${scope.repository}/blob/${scope.commit}/${path}`,sourceRevision:scope.commit,observedAt:new Date(now()).toISOString(),scope:`technical:recommendation-service:prepare:${scope.repository}`,producer:'github-preparation-inspector/v1',basisIds:[],proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}});
   }
   // Detect default-branch movement during inspection; immutable evidence remains pinned.
   if((await read(`/commits/${encodeURIComponent(meta.default_branch)}`)).sha!==scope.commit)return fail('GITHUB_STALE_HEAD');
   result.status='prepared';result.evidenceIds=records.map(e=>e.id);
   result.blockers=['Separate explicit authorization for an exact GitHub write is missing.','Template semantics, service configuration, runtime tests and customer adoption remain unverified.'];
   result.artifact=`# Fictional recommendation-service activation review packet\n\nRepository: ${scope.repository}\nCommit: ${scope.commit}\nTemplate: ${scope.templatePath}\nTemplate blob: ${result.templateBlob}\n\nInspected prerequisites:\n${scope.prerequisitePaths.map(path=>`- ${path}`).join('\n')}\n\nReview the pinned template and determine the exact service configuration and proposed diff. No file content was copied or executed. No branch, PR, deployment or customer resource was created.\n\nAuthorization: inspect and prepare only. Approval: absent. Execution: absent. Verification: no action execution or customer outcome verified.\n`;
   result.artifactDigest=hash(result.artifact);
  } catch(e) {
   result.status='failed';result.errorCode=e instanceof ActivationError?e.code:'GITHUB_UNAVAILABLE';result.blockers=[result.errorCode,'Repository readiness is unknown; no external writes were attempted.'];result.artifact=null;result.artifactDigest=null;result.templateBlob=null;result.evidenceIds=[];records.length=0;
  }
  if(Date.parse(scope.expiresAt)<=now()){result.status='failed';result.errorCode='FORBIDDEN';result.blockers=['Read authorization expired during inspection.'];result.artifact=null;result.artifactDigest=null;result.evidenceIds=[];records.length=0;}
  s=store.get(p);
  // Any concurrent mutation invalidates the prepared packet, even if plan IDs still match.
  if(s.revision!==record.startedRevision){result.status='failed';result.errorCode='REVISION_CONFLICT';result.blockers=['Session changed during inspection. Review current state and submit a new preparation.'];result.artifact=null;result.artifactDigest=null;result.evidenceIds=[];records.length=0;}
  const existing=s.githubPreparations?.[b.id];if(existing?.status!=='inspecting')return s;
  result.completedAt=new Date(now()).toISOString();
  admitted={principal:structuredClone(p),records};
  try{return store.finishGitHubPreparation(p,b.id,s.revision,result,records);}finally{admitted=null;}
 }
 async function prepare(p:Principal,input:unknown) {
  const b=parse(input),key=JSON.stringify([p,b.id]);
  // Even concurrent retries must compare exact bytes; do not coalesce a changed command.
  const running=pending.get(key);
  if(running){await running;return perform(p,b);}
  const work=perform(p,b);pending.set(key,work);try{return await work;}finally{pending.delete(key);}
 }
 return {policy,prepare};
}
