/** Phase 7: repository intelligence. A narrowly scoped, read-only view of repositories the operator configured for a
 * customer, relevant to approved milestones.
 *
 * - Only configured repositories can be inspected: requests name a configured repository id, never a URL or name.
 * - Live mode reads GitHub with GET requests only (repository metadata, the default-branch commit, the file listing at
 *   that commit, and at most a few small files). Nothing is executed, written, opened or triggered.
 * - Fixture mode runs the same analysis on clearly labelled sample data for a fictional repository; its observations
 *   are marked `fixture` everywhere and never presented as live GitHub observations.
 * - Every observation says what was seen, where, at which commit and when; missing, inaccessible and uninspected are
 *   kept apart, with the limits of what each observation proves.
 * - Credentials stay on the server; repository contents and secrets are not logged, and only short extracted fields
 *   (owner handles, catalog fields, a README heading) are stored, never file contents. */
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {dirname,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {DeveloperHandoff,EvidenceMode,MilestoneDraft,ObservationStatus,RepositoryEvidence,RepositoryEvidenceView,RepositoryInspection,RepositoryObservation,RepositorySignal} from '../../../../contracts/activation/v1/handoff.ts';
import {ActivationError,type Principal} from './store.ts';
import type {Viewer} from './handoff/work.ts';

const fail=(code:string,details?:unknown):never=>{throw new ActivationError(code,details);};
const REPO=/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}$/;
const MAX_BLOB=65_536,MAX_RESPONSE=5_000_000,MAX_ENTRIES=50_000,MAX_DETAILS=10;
const FIXTURES=join(dirname(fileURLToPath(import.meta.url)),'../../fixtures/repositories');

export type RepositoryConfig={customerId:string;id:string;label:string;repository:string;mode:EvidenceMode;
 /** The approved milestones' system names this repository serves (matched against milestone service and repository). */
 services:string[];
 /** Fixture mode only: a built-in fixture name or an absolute path to a fixture file. */
 fixture?:string};
export function parseRepositoryConfig(raw:unknown):RepositoryConfig[]{
 if(!Array.isArray(raw))throw Error('Repository configuration must be an array');
 const seen=new Set<string>();
 return raw.map((c:any)=>{
  if(!c||typeof c.customerId!=='string'||!c.customerId||typeof c.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,62}$/.test(c.id)||typeof c.label!=='string'||!c.label.trim()||c.label.length>100)throw Error('Each repository needs customerId, a lowercase id and a label');
  if(typeof c.repository!=='string'||!REPO.test(c.repository))throw Error(`Repository ${c.id} must be owner/name`);
  if(c.mode!=='live'&&c.mode!=='fixture')throw Error(`Repository ${c.id} mode must be live or fixture`);
  if(c.mode==='fixture'&&(typeof c.fixture!=='string'||!(/^[a-z0-9-]{1,80}$/.test(c.fixture)||isAbsolute(c.fixture))))throw Error(`Repository ${c.id} needs a fixture`);
  if(!Array.isArray(c.services)||!c.services.length||!c.services.every((s:unknown)=>typeof s==='string'&&s.trim()&&s.length<=100))throw Error(`Repository ${c.id} needs services`);
  const key=c.customerId+'/'+c.id;if(seen.has(key))throw Error(`Duplicate repository ${key}`);seen.add(key);
  return {customerId:c.customerId,id:c.id,label:c.label.trim(),repository:c.repository,mode:c.mode,services:c.services.map((s:string)=>s.trim()),...(c.mode==='fixture'?{fixture:c.fixture}:{})};
 });
}

// ---- Sources: GitHub (live) and fixture files. Both give the same shapes to the same analysis.
type Entry={path:string;type:'blob'|'tree'|string;sha:string;size?:number};
type Source={kind:'github_api'|'fixture';
 identity():Promise<{fullName:string;defaultBranch:string;htmlUrl:string|null;pushedAt:string|null;visibility:string|null;archived:boolean}>;
 head(branch:string):Promise<{sha:string;date:string|null;tree:string}>;
 tree(sha:string):Promise<{entries:Entry[];truncated:boolean}>;
 blob(entry:Entry):Promise<string>;
 request(kind:'identity'|'head'|'tree'|'blob',arg?:string):string;
 url(commit:string,path:string|null):string|null};
export const blobSha=(bytes:Buffer)=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

export type GitHubOptions={fetchImpl?:typeof fetch;token?:string;apiOrigin?:string;timeoutMs?:number};
/** GET-only GitHub client for one configured repository. Errors become codes; bodies of errors are never kept. */
function githubSource(repository:string,o:GitHubOptions):Source{
 const origin=o.apiOrigin??'https://api.github.com',root=`${origin}/repos/${repository}`;
 let retryAfter:string|null=null;
 async function get(path:string):Promise<any>{
  let r:Response;
  try{r=await (o.fetchImpl??fetch)(root+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(o.timeoutMs??8000),
   headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'spotify-portal-repository-inspector',...(o.token?{Authorization:`Bearer ${o.token}`}:{})}});}
  catch(e){throw new ActivationError(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'GITHUB_TIMEOUT':'GITHUB_UNAVAILABLE');}
  if(!r.ok){
   await r.body?.cancel().catch(()=>undefined);
   const reset=Number(r.headers.get('x-ratelimit-reset')),after=Number(r.headers.get('retry-after'));
   const limited=r.status===429||(r.status===403&&r.headers.get('x-ratelimit-remaining')==='0');
   if(limited){retryAfter=Number.isFinite(after)&&after>0?new Date(Date.now()+after*1000).toISOString():Number.isFinite(reset)&&reset>0?new Date(reset*1000).toISOString():null;fail('GITHUB_RATE_LIMITED',{retryAfter});}
   // A 404 can mean missing or private; it is reported as not accessible, never as "does not exist".
   fail(r.status===401?'GITHUB_AUTH_FAILED':r.status===403?'GITHUB_FORBIDDEN':r.status===404?'GITHUB_NOT_ACCESSIBLE':r.status>=500?'GITHUB_UNAVAILABLE':'GITHUB_INVALID_RESPONSE');
  }
  if(!r.body)fail('GITHUB_INVALID_RESPONSE');
  const reader=r.body!.getReader(),decoder=new TextDecoder();let text='',bytes=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE)fail('GITHUB_RESPONSE_TOO_LARGE');text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{await reader.cancel().catch(()=>undefined);}
  try{return JSON.parse(text);}catch{return fail('GITHUB_INVALID_RESPONSE');}
 }
 return {kind:'github_api',
  async identity(){const m=await get('');
   if(typeof m?.full_name!=='string'||m.full_name.toLowerCase()!==repository.toLowerCase()||typeof m.default_branch!=='string')fail('GITHUB_INVALID_RESPONSE');
   return {fullName:m.full_name,defaultBranch:m.default_branch,htmlUrl:typeof m.html_url==='string'?m.html_url:null,pushedAt:typeof m.pushed_at==='string'?m.pushed_at:null,visibility:typeof m.visibility==='string'?m.visibility:null,archived:!!m.archived};},
  async head(branch){const c=await get(`/commits/${encodeURIComponent(branch)}`);
   if(!/^[a-f0-9]{40}$/.test(c?.sha)||!/^[a-f0-9]{40}$/.test(c?.commit?.tree?.sha))fail('GITHUB_INVALID_RESPONSE');
   return {sha:c.sha,date:typeof c.commit?.committer?.date==='string'?c.commit.committer.date:null,tree:c.commit.tree.sha};},
  async tree(sha){const t=await get(`/git/trees/${sha}?recursive=1`);
   if(t?.sha!==sha||!Array.isArray(t.tree))fail('GITHUB_INVALID_RESPONSE');
   return {entries:t.tree.slice(0,MAX_ENTRIES).filter((e:any)=>typeof e?.path==='string'&&typeof e.sha==='string').map((e:any)=>({path:e.path,type:e.type,sha:e.sha,size:e.size})),truncated:t.truncated!==false||t.tree.length>MAX_ENTRIES};},
  async blob(entry){
   if(typeof entry.size==='number'&&entry.size>MAX_BLOB)fail('FILE_TOO_LARGE');
   const b=await get(`/git/blobs/${entry.sha}`);
   if(b?.sha!==entry.sha||b.encoding!=='base64'||typeof b.content!=='string'||!Number.isSafeInteger(b.size))fail('GITHUB_INVALID_RESPONSE');
   if(b.size>MAX_BLOB)fail('FILE_TOO_LARGE');
   const bytes=Buffer.from(b.content,'base64');
   if(bytes.length!==b.size||blobSha(bytes)!==entry.sha)fail('GITHUB_BLOB_MISMATCH');
   return bytes.toString('utf8');},
  request:(kind,arg)=>kind==='identity'?`GET /repos/${repository}`:kind==='head'?`GET /repos/${repository}/commits/${arg}`:kind==='tree'?`GET /repos/${repository}/git/trees/${arg}?recursive=1`:`GET /repos/${repository}/git/blobs/${arg}`,
  url:(commit,path)=>`https://github.com/${repository}${path?`/blob/${commit}/${path}`:`/tree/${commit}`}`,
  get retryAfter(){return retryAfter;}} as Source&{retryAfter:string|null};
}

type Fixture={repository:string;defaultBranch:string;commit:string;committedAt:string;pushedAt:string;visibility?:string;truncated?:boolean;
 files:Record<string,string|{size:number;inaccessible?:true}>};
/** Sample data for a fictional repository: same shapes as GitHub, labelled fixture throughout. */
function fixtureSource(c:RepositoryConfig):Source{
 const file=isAbsolute(c.fixture!)?c.fixture!:join(FIXTURES,`${c.fixture}.json`);
 const f=JSON.parse(readFileSync(file,'utf8')) as Fixture;
 if(f.repository!==c.repository||!/^[a-f0-9]{40}$/.test(f.commit))throw new ActivationError('FIXTURE_INVALID');
 const entries:Entry[]=[];const dirs=new Set<string>();
 for(const [path,v] of Object.entries(f.files)){
  const content=typeof v==='string'?Buffer.from(v):null;
  entries.push({path,type:'blob',sha:content?blobSha(content):createHash('sha1').update(path).digest('hex'),size:content?content.length:(v as {size:number}).size});
  path.split('/').slice(0,-1).forEach((_,i,a)=>dirs.add(a.slice(0,i+1).join('/')));
 }
 for(const d of dirs)entries.push({path:d,type:'tree',sha:createHash('sha1').update('tree:'+d).digest('hex')});
 const name=isAbsolute(c.fixture!)?'configured fixture file':`fixtures/repositories/${c.fixture}.json`;
 return {kind:'fixture',
  identity:async()=>({fullName:f.repository,defaultBranch:f.defaultBranch,htmlUrl:null,pushedAt:f.pushedAt,visibility:f.visibility??null,archived:false}),
  head:async()=>({sha:f.commit,date:f.committedAt,tree:f.commit}),
  tree:async()=>({entries,truncated:!!f.truncated}),
  async blob(entry){const v=f.files[entry.path];if(typeof v!=='string')return fail('FILE_INACCESSIBLE');if(Buffer.byteLength(v)>MAX_BLOB)return fail('FILE_TOO_LARGE');return v;},
  request:(kind,arg)=>`Sample fixture ${name}${kind==='blob'&&arg?` (${arg})`:''}`,
  url:()=>null};
}

// ---- Analysis: the same for both sources.
const LIMITS:Partial<Record<RepositorySignal,{found?:string;missing?:string}>>={
 codeowners:{found:'CODEOWNERS shows who the file names as owners; it doesn’t show whether those owners are active or agree.',missing:'A missing CODEOWNERS file is not proof that nobody owns the service; ownership may be recorded elsewhere.'},
 ci_config:{found:'A workflow file is not proof that CI runs or passes; run results and required checks were not inspected.',missing:'CI may be configured outside the repository (for example on a Jenkins server).'},
 deployment:{found:'Configuration files show intent, not where or whether the service is deployed.',missing:'Deployment may be defined in another repository or tool.'},
 catalog_info:{found:'Metadata is as written in the file; it may be out of date and was not checked against the Backstage catalog.',missing:'The service may be registered in Backstage from another location.'},
 runbooks:{found:'Found by file name only; the content was not reviewed.',missing:'Runbooks may live outside the repository (for example in Confluence); only file names were checked.'},
 docs:{found:'Counted by file name; the content was not reviewed.',missing:'Documentation may live outside the repository.'},
 readme:{found:'Only the first heading was read.'},
};
const SIGNALS:RepositorySignal[]=['identity','default_branch','readme','docs','codeowners','ci_config','deployment','catalog_info','runbooks','ci_runs'];
const OTHER_CI=['.gitlab-ci.yml','Jenkinsfile','.circleci/config.yml','azure-pipelines.yml','.travis.yml','bitbucket-pipelines.yml','.buildkite/pipeline.yml'];
const DEPLOY=[/(^|\/)Dockerfile$/,/(^|\/)docker-compose[^/]*\.ya?ml$/,/(^|\/)Chart\.yaml$/,/^(k8s|kubernetes|deploy|deployment|manifests|helm)\/.+\.ya?ml$/,/\.tf$/,/(^|\/)(skaffold|serverless|app)\.ya?ml$/,/(^|\/)Procfile$/];
const short=(s:string,n=200)=>s.length>n?s.slice(0,n-1)+'…':s;
const list=(xs:string[])=>xs.slice(0,MAX_DETAILS).map(x=>short(x));

/** Minimal reading of the few catalog-info.yaml fields onboarding needs; nothing else is kept. */
export function catalogFields(text:string){
 const out:Record<string,string>={};let section='';
 for(const line of text.split('\n').slice(0,400)){
  if(/^---\s*$/.test(line)&&Object.keys(out).length)break;
  const top=/^([A-Za-z]+):\s*(.*)$/.exec(line);if(top){section=top[1];if(top[1]==='kind'&&top[2])out.kind=top[2].trim();continue;}
  const sub=/^\s{2}([A-Za-z]+):\s*(.+)$/.exec(line);
  if(sub&&((section==='metadata'&&sub[1]==='name')||(section==='spec'&&['owner','lifecycle','type','system'].includes(sub[1]))))out[`${section==='metadata'?'name':sub[1]}`]=sub[2].trim().replace(/^["']|["']$/g,'').slice(0,100);
 }
 return out;
}
export function codeownerHandles(text:string){
 const rules=text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
 return {rules:rules.length,owners:[...new Set(rules.flatMap(l=>l.split(/\s+/).slice(1).filter(t=>/^@[A-Za-z0-9_.\/-]{1,100}$/.test(t))))]};
}

async function analyse(source:Source,c:RepositoryConfig,mode:EvidenceMode,at:()=>string,by:string):Promise<RepositoryInspection>{
 const startedAt=at(),inspectionId=randomUUID(),obs:RepositoryObservation[]=[];
 let commit:string|null=null,branch:string|null=null,errorCode:string|null=null,status:RepositoryInspection['status']='succeeded';
 const id=(signal:string)=>'obs-'+createHash('sha256').update(inspectionId+signal).digest('hex').slice(0,10);
 const add=(signal:RepositorySignal,st:ObservationStatus,summary:string,o:{details?:string[];limitation?:string|null;request:string;path?:string|null}={request:''})=>
  obs.push({id:id(signal),signal,status:st,mode,summary:short(summary,400),details:list(o.details??[]),limitation:o.limitation??null,
   source:{kind:source.kind,request:o.request,path:o.path??null,url:o.path!==undefined&&commit&&st==='observed'?source.url(commit,o.path):null},repository:c.repository,commit,retrievedAt:at()});
 try{
  const who=await source.identity();branch=who.defaultBranch;
  add('identity','observed',`Repository ${who.fullName} is readable with the configured access${who.visibility?` (${who.visibility})`:''}${who.archived?'; it is archived':''}${who.pushedAt?`; last pushed ${who.pushedAt}`:''}.`,{request:source.request('identity')});
  const head=await source.head(who.defaultBranch);commit=head.sha;
  add('default_branch','observed',`Default branch ${who.defaultBranch} is at commit ${head.sha.slice(0,12)}${head.date?`, committed ${head.date}`:''}.`,{request:source.request('head',who.defaultBranch),path:null});
  const tree=await source.tree(head.tree),blobs=tree.entries.filter(e=>e.type==='blob'),paths=blobs.map(e=>e.path),treeReq=source.request('tree',head.tree);
  const absent=(signal:RepositorySignal,what:string)=>tree.truncated
   ?add(signal,'not_inspected',`Not established: the file listing was incomplete, so the absence of ${what} can’t be confirmed.`,{request:treeReq,limitation:'GitHub returned a truncated file listing.'})
   :add(signal,'missing',`No ${what} found at commit ${commit!.slice(0,12)}.`,{request:treeReq,limitation:LIMITS[signal]?.missing??null});
  // Reads one small file; an unreadable file is "inaccessible", never "missing".
  const read=async(signal:RepositorySignal,entry:Entry,ok:(text:string)=>{summary:string;details?:string[]})=>{
   try{const r=ok(await source.blob(entry));add(signal,'observed',r.summary,{details:r.details,request:source.request('blob',entry.sha),path:entry.path,limitation:LIMITS[signal]?.found??null});}
   catch(e){status='partial';add(signal,'inaccessible',`${entry.path} is listed but couldn’t be read (${e instanceof ActivationError?e.code:'READ_FAILED'}).`,{request:source.request('blob',entry.sha),path:entry.path,limitation:'Its contents are unknown.'});}
  };
  const entry=(p:string)=>blobs.find(e=>e.path===p)!;
  const readme=paths.find(p=>/^README(\.[A-Za-z]+)?$/i.test(p));
  if(readme)await read('readme',entry(readme),t=>{const h=/^#\s+(.+)$/m.exec(t)?.[1]?.trim();return {summary:`README found at ${readme} (${Buffer.byteLength(t)} bytes)${h?`; first heading “${short(h,80)}”`:''}.`};});
  else absent('readme','README at the repository root');
  const docs=paths.filter(p=>/^docs\/.+\.(md|mdx|rst)$/i.test(p)),mk=paths.find(p=>/^mkdocs\.ya?ml$/.test(p));
  if(docs.length||mk)add('docs','observed',`${docs.length} documentation file${docs.length===1?'':'s'} under docs/${mk?`; ${mk} (MkDocs/TechDocs configuration) present`:''}.`,{details:[...(mk?[mk]:[]),...docs],request:treeReq,path:mk??docs[0],limitation:LIMITS.docs!.found});
  else absent('docs','docs/ directory or mkdocs.yml');
  const owners=['.github/CODEOWNERS','CODEOWNERS','docs/CODEOWNERS'].find(p=>paths.includes(p));
  if(owners)await read('codeowners',entry(owners),t=>{const r=codeownerHandles(t);return {summary:`CODEOWNERS at ${owners} with ${r.rules} rule${r.rules===1?'':'s'}${r.owners.length?` naming ${r.owners.slice(0,5).join(', ')}${r.owners.length>5?' and others':''}`:' and no @-handles'}.`,details:r.owners};});
  else absent('codeowners','CODEOWNERS file in .github/, docs/ or the root');
  const workflows=paths.filter(p=>/^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)),other=OTHER_CI.filter(p=>paths.includes(p));
  if(workflows.length||other.length)add('ci_config','observed',[workflows.length?`${workflows.length} GitHub Actions workflow file${workflows.length===1?'':'s'}`:'',other.length?`other CI configuration: ${other.join(', ')}`:''].filter(Boolean).join('; ')+'.',{details:[...workflows,...other],request:treeReq,path:workflows[0]??other[0],limitation:LIMITS.ci_config!.found});
  else absent('ci_config','GitHub Actions workflow or other recognised CI configuration');
  const deploy=paths.filter(p=>DEPLOY.some(r=>r.test(p)));
  if(deploy.length)add('deployment','observed',`${deploy.length} deployment-related file${deploy.length===1?'':'s'} (for example ${deploy.slice(0,3).join(', ')}).`,{details:deploy,request:treeReq,path:deploy[0],limitation:LIMITS.deployment!.found});
  else absent('deployment','recognised deployment configuration (Dockerfile, Helm chart, Kubernetes manifests, Terraform)');
  const catalog=paths.filter(p=>/(^|\/)catalog-info\.ya?ml$/.test(p)&&p.split('/').length<=3).sort((a,b)=>a.split('/').length-b.split('/').length)[0];
  if(catalog)await read('catalog_info',entry(catalog),t=>{const f=catalogFields(t);const d=Object.entries(f).map(([k,v])=>`${k}: ${v}`);return {summary:`Backstage metadata at ${catalog}${d.length?`: ${d.join(', ')}`:' (no kind, name or owner fields could be read)'}.`,details:d};});
  else absent('catalog_info','catalog-info.yaml (Backstage metadata)');
  const runbooks=paths.filter(p=>/(runbook|playbook|on-?call|incident)/i.test(p));
  if(runbooks.length)add('runbooks','observed',`${runbooks.length} runbook or operational file${runbooks.length===1?'':'s'} found by name.`,{details:runbooks,request:treeReq,path:runbooks[0],limitation:LIMITS.runbooks!.found});
  else absent('runbooks','runbook or operational documentation (by file name)');
 }catch(e){
  status=obs.length?'partial':'failed';errorCode=e instanceof ActivationError?e.code:'INSPECTION_FAILED';
 }
 // Anything not reached is explicitly uninspected; CI results are never inspected here.
 for(const s of SIGNALS)if(!obs.some(o=>o.signal===s))add(s,'not_inspected',s==='ci_runs'?'CI run results, required checks and branch protection were not inspected.':`Not inspected${errorCode?` because the inspection stopped (${errorCode})`:''}.`,{request:'none',limitation:s==='ci_runs'?'Whether CI runs or passes is unknown.':null});
 if(errorCode)status=obs.some(o=>o.status==='observed')?'partial':'failed';
 const retryAfter=(source as {retryAfter?:string|null}).retryAfter??null;
 return {id:inspectionId,repositoryId:c.id,repository:c.repository,mode,status,errorCode,retryAfter,defaultBranch:branch,commit,startedAt,completedAt:at(),requestedBy:by,observations:obs};
}

// ---- Relevance to approved milestones: which signals matter for which work. Derived from the milestone's own words.
const FOCUS:[RegExp,RepositorySignal[]][]=[
 [/readiness|ready|repository|repo\b/i,['readme','codeowners','ci_config']],[/owner|ownership|maintainer|codeowners/i,['codeowners','catalog_info']],
 [/\bci\b|workflow|pipeline|build|github actions|jenkins|test/i,['ci_config','ci_runs']],[/deploy|release|helm|kubernetes|docker/i,['deployment']],
 [/discover|catalog|backstage|metadata|register/i,['catalog_info','docs']],[/docs|documentation|techdocs|readme/i,['readme','docs']],[/runbook|incident|on-?call|operat/i,['runbooks']]];
const focusOf=(text:string)=>SIGNALS.filter(s=>FOCUS.some(([r,ss])=>r.test(text)&&ss.includes(s)));
const norm=(s:string|null|undefined)=>(s??'').trim().toLowerCase();
export const relevant=(c:RepositoryConfig,m:MilestoneDraft)=>{const names=[norm(m.system.service),norm(m.system.repository)].filter(Boolean);
 return c.services.some(s=>names.includes(norm(s)))||names.includes(norm(c.repository));};

export function openRepositoryStore(filename:string){
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS activation_repository_inspections (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, repository TEXT NOT NULL, id TEXT NOT NULL, completed TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session,repository,id)) STRICT;`);
 const key=(p:Principal)=>[p.tenantId,p.customerId,p.sessionId];
 return {
  list(p:Principal,repository:string,limit=10):RepositoryInspection[]{return (db.prepare('SELECT body FROM activation_repository_inspections WHERE tenant=? AND customer=? AND session=? AND repository=? ORDER BY completed DESC, rowid DESC LIMIT ?').all(...key(p),repository,limit) as {body:string}[]).map(r=>JSON.parse(r.body));},
  save(p:Principal,i:RepositoryInspection){
   db.prepare('INSERT INTO activation_repository_inspections VALUES (?,?,?,?,?,?,?)').run(...key(p),i.repositoryId,i.id,i.completedAt,JSON.stringify(i));
   // Keep a short history per repository.
   db.prepare('DELETE FROM activation_repository_inspections WHERE tenant=? AND customer=? AND session=? AND repository=? AND id NOT IN (SELECT id FROM activation_repository_inspections WHERE tenant=? AND customer=? AND session=? AND repository=? ORDER BY completed DESC, rowid DESC LIMIT 10)').run(...key(p),i.repositoryId,...key(p),i.repositoryId);
  },
  close:()=>db.close()};
}
export type RepositoryStore=ReturnType<typeof openRepositoryStore>;

export function createRepositoryService(deps:{config:RepositoryConfig[];store:RepositoryStore;published:(p:Principal)=>DeveloperHandoff|null;github?:GitHubOptions;
 maxAgeHours?:number;cooldownMs?:number;now?:()=>number}){
 const now=deps.now??(()=>Date.now()),maxAgeHours=deps.maxAgeHours??24,cooldown=deps.cooldownMs??30_000;
 const running=new Map<string,Promise<RepositoryInspection>>();
 function plan(p:Principal){const h=deps.published(p);if(!h?.approval)fail('NO_APPROVED_PLAN');return h!;}
 const mine=(m:MilestoneDraft,v:Viewer)=>v.role!=='developer'||(!!v.name&&m.proposedAssignee===v.name);
 // Everyone on the team may see observations of the repositories the approved plan relies on: developers choose
 // their work, so evidence isn't limited to milestones someone was assigned.
 function views(p:Principal,_v:Viewer){
  const h=plan(p);
  return deps.config.filter(c=>c.customerId===p.customerId).map(c=>({c,ms:h.milestones.filter(m=>relevant(c,m))})).filter(({ms})=>ms.length>0);
 }
 function view(p:Principal,v:Viewer):RepositoryEvidence{
  return {repositories:views(p,v).map(({c,ms}):RepositoryEvidenceView=>{
   const history=deps.store.list(p,c.id),latest=history[0]??null,evidence=history.find(i=>i.status!=='failed')??null;
   // Nobody inspects by hand: the Portal observes configured repositories itself (Spotify's integration).
   return {id:c.id,label:c.label,repository:c.repository,mode:c.mode,canInspect:false,
    milestones:ms.filter(m=>mine(m,v)).map(m=>({id:m.id,title:m.objective,assignee:m.proposedAssignee??null,
     focus:focusOf([m.objective,m.why,...m.actions,...m.completionCriteria].join(' ')),
     actionLinks:m.actions.map((a,index)=>({index,signals:focusOf(a)})).filter(x=>x.signals.length)})),
    latest,evidence,stale:!!evidence&&now()-Date.parse(evidence.completedAt)>maxAgeHours*3600_000,maxAgeHours};
  })};
 }
 async function inspect(p:Principal,v:Viewer,input:unknown){
  const b=input as {repositoryId?:unknown};
  if(!b||typeof b!=='object'||typeof b.repositoryId!=='string')fail('INVALID_REQUEST');
  // Chris observes; a developer needs their own identity and an approved milestone this repository serves.
  if(v.role==='operator')fail('FORBIDDEN');
  if(v.role==='developer'&&!v.name)fail('DEVELOPER_IDENTITY_REQUIRED');
  const found=views(p,v).find(x=>x.c.id===b.repositoryId)??fail('NOT_FOUND');
  return inspectAs(p,found!.c,v.name??v.role);
 }
 async function inspectAs(p:Principal,c:RepositoryConfig,by:string){
  const key=JSON.stringify([p.tenantId,p.customerId,p.sessionId,c.id]);
  const last=deps.store.list(p,c.id,1)[0];
  if(running.has(key))return {inspection:await running.get(key)!,reused:true};
  // A recent inspection is returned instead of asking GitHub again.
  if(last&&now()-Date.parse(last.completedAt)<cooldown)return {inspection:last,reused:true};
  const source=c.mode==='live'?githubSource(c.repository,deps.github??{}):fixtureSource(c);
  const job=analyse(source,c,c.mode,()=>new Date(now()).toISOString(),by).then(i=>{deps.store.save(p,i);return i;}).finally(()=>running.delete(key));
  running.set(key,job);
  return {inspection:await job,reused:false};
 }
 /** Observations a viewer's AiKA may use: from the latest successful inspection of each repository they may see. */
 function forAika(p:Principal,v:Viewer){
  let list:RepositoryEvidenceView[]=[];try{list=view(p,v).repositories;}catch{return {lines:[] as {id:string;mode:EvidenceMode;status:ObservationStatus;line:string}[],inspected:false};}
  const lines=list.flatMap(r=>r.evidence&&!r.stale?r.evidence.observations.map(o=>({id:o.id,mode:o.mode,status:o.status,
   line:`[${o.id}] ${o.mode==='fixture'?'SAMPLE (fixture data for a fictional repository, not a live observation)':o.status==='observed'?'OBSERVED (live, read-only)':o.status==='missing'?'NOT FOUND (live listing)':o.status==='inaccessible'?'NOT READABLE':'NOT INSPECTED'} ${r.repository}${o.commit?`@${o.commit.slice(0,12)}`:''} ${o.signal}: ${o.summary}${o.limitation?` Limitation: ${o.limitation}`:''}`})):[]);
  return {lines,inspected:list.some(r=>r.evidence&&!r.stale&&r.mode==='live'&&r.evidence.observations.some(o=>o.status==='observed'))};
 }
 /** Spotify's side: observe every configured repository the approved plan relies on, read-only, without anyone
  * having to connect or inspect anything. Recent observations are reused (cooldown); failures are recorded, not thrown. */
 async function observe(p:Principal){
  let found:{c:RepositoryConfig}[]=[];try{found=views(p,{role:'champion',name:null});}catch{return [];}
  return Promise.all(found.map(({c})=>inspectAs(p,c,'Spotify integration').then(r=>r.inspection).catch(()=>null)));
 }
 return {view,inspect,forAika,observe};
}
export type RepositoryService=ReturnType<typeof createRepositoryService>;
