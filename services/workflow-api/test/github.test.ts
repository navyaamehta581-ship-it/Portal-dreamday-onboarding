import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import fixtures from '../../../contracts/activation/v1/fixtures.json' with {type:'json'};
import {openActivationStore,type ActivationStore,type Principal} from '../src/activation/store.ts';
import {createGitHubPreparation,type GitHubReadScope} from '../src/activation/github.ts';
import type {CustomerContext,ActivationPlan} from '../../../contracts/activation/v1/types.ts';
const p:Principal={tenantId:'fictional',customerId:'orbit',sessionId:'fictional-session'};
const sha='a'.repeat(40),tree='b'.repeat(40),content=Buffer.from('fictional template; never executed\n');
const blob=createHash('sha1').update(Buffer.from(`blob ${content.length}\0`)).update(content).digest('hex');
const plan=fixtures.orbit.plan as ActivationPlan,action=plan.suggestedNextAction;
const command={id:'prepare:first',expectedRevision:0,planRevision:0,actionId:action.id,actionRevision:action.revision};
const scope:GitHubReadScope={principal:p,actionId:action.id,actionRevision:action.revision,planRevision:0,repository:'example/fictional',commit:sha,templatePath:'template.yaml',prerequisitePaths:['package.json'],expiresAt:'2099-01-01T00:00:00Z'};
function setup(overrides:{fetchImpl?:typeof fetch;scopes?:GitHubReadScope[];now?:()=>number}={}) {
 let calls:string[]=[];
 const fetchImpl:typeof fetch=async(url,opts)=>{
  calls.push(String(url));assert.equal(opts?.method,'GET');assert.equal(opts?.redirect,'error');
  const path=String(url).replace('https://api.github.com/repos/example/fictional','');
  const data=path===''?{full_name:scope.repository,default_branch:'main'}:path==='/commits/main'?{sha}:path===`/git/commits/${sha}`?{sha,tree:{sha:tree}}:path.startsWith('/git/trees/')?{sha:tree,truncated:false,tree:['template.yaml','package.json'].map(path=>({path,type:'blob',mode:'100644',sha:blob}))}:{sha:blob,encoding:'base64',size:content.length,content:content.toString('base64')};
  return Response.json(data);
 };
 const file=join(mkdtempSync(join(tmpdir(),'phase2-')),'state.sqlite');let store:ActivationStore;
 const fixtureIds=new Set([...fixtures.orbit.context.evidence,...fixtures.orbit.plan.evidence].map(e=>e.id));
 const base={admitContext:()=>true,admitPlan:()=>true,admit:(_p:Principal,e:{id:string})=>fixtureIds.has(e.id)||e.id==='concurrent'};
 let adapter=createGitHubPreparation(base,()=>store,overrides.scopes??[scope],{fetchImpl:overrides.fetchImpl??fetchImpl,now:overrides.now});
 const context=structuredClone(fixtures.orbit.context) as CustomerContext;const initialPlan=structuredClone(plan);
 for(const item of [context,initialPlan])for(const e of item.evidence){e.source='test-adapter';e.sourceRevision='a'.repeat(40);e.producer='test-adapter';e.proof.reference='none';}
 store=openActivationStore(file,adapter.policy);store.initialize(p,context,initialPlan);
 return {get store(){return store;},get adapter(){return adapter;},calls,reopen(){store.close();adapter=createGitHubPreparation(base,()=>store,overrides.scopes??[scope],{fetchImpl:overrides.fetchImpl??fetchImpl,now:overrides.now});store=openActivationStore(file,adapter.policy);}};
}
test('pinned GitHub inspection independently hashes blobs, persists packet/evidence and never grants approval or execution',async()=>{
 const x=setup(),before=x.store.get(p);const s=await x.adapter.prepare(p,command),packet=s.githubPreparations![command.id];
 assert.equal(packet.status,'prepared');assert.equal(packet.templateBlob,blob);assert.equal(packet.approved,false);assert.equal(packet.executed,false);assert.equal(packet.verified,false);assert.equal(packet.prUrl,null);assert.match(packet.artifact!,/Fictional recommendation-service/);assert.equal(packet.artifactDigest,createHash('sha256').update(packet.artifact!).digest('hex'));
 assert.equal(packet.evidenceIds.length,2);assert.equal(s.evidence.length,before.evidence.length+2);for(const id of packet.evidenceIds){const e=s.evidence.find(e=>e.id===id)!;assert.equal(e.sourceRevision,sha);assert.equal(e.proof.type,'none');assert.match(e.source,new RegExp(sha));}
 assert.deepEqual(s.actions,before.actions);assert.deepEqual(s.outcome,before.outcome);assert.deepEqual(s.milestone,before.milestone);const calls=x.calls.length;
 x.reopen();assert.deepEqual(x.store.get(p),s);assert.deepEqual(await x.adapter.prepare(p,command),s);assert.equal(x.calls.length,calls);
 await assert.rejects(x.adapter.prepare(p,{...command,expectedRevision:1}),/IDEMPOTENCY_CONFLICT/);x.store.close();
});
test('strict command, operator scope, customer isolation and stale revisions fail before GitHub access',async()=>{
 const x=setup();for(const extra of [{approve:true},{repository:'other/repo'},{evidence:[]},{actionRevision:-1}])await assert.rejects(x.adapter.prepare(p,{...command,...extra}),/INVALID_REQUEST/);
 for(const principal of [{...p,customerId:'other'},{...p,tenantId:'other'},{...p,sessionId:'other'}])await assert.rejects(x.adapter.prepare(principal,command),/NOT_FOUND/);
 await assert.rejects(x.adapter.prepare(p,{...command,expectedRevision:9}),/REVISION_CONFLICT/);await assert.rejects(x.adapter.prepare(p,{...command,actionId:'other'}),/FORBIDDEN/);assert.equal(x.calls.length,0);x.store.close();
 const absent=setup({scopes:[]});await assert.rejects(absent.adapter.prepare(p,command),/FORBIDDEN/);assert.equal(absent.store.get(p).revision,0);absent.store.close();
});
for(const [status,code] of [[401,'GITHUB_AUTH_FAILED'],[403,'GITHUB_FORBIDDEN'],[404,'GITHUB_NOT_FOUND'],[429,'GITHUB_RATE_LIMITED'],[500,'GITHUB_UNAVAILABLE']] as const)test(`HTTP ${status} is durable sanitized failure; no false readiness`,async()=>{
 const x=setup({fetchImpl:async()=>new Response('secret must not be stored',{status})});const s=await x.adapter.prepare(p,command),packet=s.githubPreparations![command.id];assert.equal(packet.status,'failed');assert.equal(packet.errorCode,code);assert.equal(packet.artifact,null);assert.deepEqual(packet.evidenceIds,[]);assert.ok(!JSON.stringify(s).includes('secret must'));x.reopen();assert.deepEqual(await x.adapter.prepare(p,command),s);x.store.close();
});
test('bad blob, incomplete tree and branch drift fail closed',async()=>{
 for(const mode of ['blob','tree','head','missing','network','oversize']){
  const fetchImpl:typeof fetch=async(url)=>{
   const path=String(url);if(mode==='network')throw new Error('token must not leak');
   if(mode==='oversize')return new Response('x'.repeat(2_000_001));
   if(path.endsWith('/fictional'))return Response.json({full_name:scope.repository,default_branch:'main'});
   if(path.endsWith('/commits/main'))return Response.json({sha:mode==='head'?'c'.repeat(40):sha});
   if(path.includes('/git/commits/'))return Response.json({sha,tree:{sha:tree}});
   if(path.includes('/git/trees/'))return Response.json({sha:tree,truncated:mode==='tree',tree:mode==='missing'?[]:['template.yaml','package.json'].map(path=>({path,type:'blob',mode:'100644',sha:blob}))});
   return Response.json({sha:blob,encoding:'base64',size:content.length,content:Buffer.from('tampered').toString('base64')});
  };
  const x=setup({fetchImpl});const initialEvidence=x.store.get(p).evidence.length;const s=await x.adapter.prepare(p,command);assert.equal(s.githubPreparations![command.id].status,'failed');assert.equal(s.githubPreparations![command.id].artifact,null);assert.equal(s.evidence.length,initialEvidence);x.store.close();
 }
});
test('concurrent exact retry shares inspection; changed retry conflicts',async()=>{
 const x=setup();const [a,b]=await Promise.all([x.adapter.prepare(p,command),x.adapter.prepare(p,command)]);assert.deepEqual(a,b);assert.equal(x.calls.length,7);await assert.rejects(x.adapter.prepare(p,{...command,planRevision:1}),/IDEMPOTENCY_CONFLICT/);x.store.close();
});
test('interrupted inspection can resume safely after restart; concurrent state changes invalidate preparation',async()=>{
 let release!:()=>void;let entered!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);
 const x=setup({fetchImpl:async()=>{entered();await gate;throw new Error('interrupted');}});
 const work=x.adapter.prepare(p,command);await ready;const pending=x.store.get(p);assert.equal(pending.githubPreparations![command.id].status,'inspecting');
 // Persist an unrelated mutation while network is outstanding.
 x.store.reportDeveloperProgress(p,'report',1,0,{...fixtures.orbit.context.evidence[0],id:'concurrent',kind:'developer_report',scope:pending.context.agreedGoal.text,proof:{type:'none',actionId:'none',actionRevision:0,reference:'none',verifier:'none',result:'not_checked'}},false);
 release();const s=await work;assert.equal(s.githubPreparations![command.id].errorCode,'REVISION_CONFLICT');assert.equal(s.outcome.status,'reported');x.reopen();assert.deepEqual(x.store.get(p),s);x.store.close();
});
test('resume a durable inspecting record using exact original command',async()=>{
 const x=setup();const digest=createHash('sha256').update(JSON.stringify([command.id,0,0,command.actionId,command.actionRevision])).digest('hex');
 x.store.beginGitHubPreparation(p,0,{id:command.id,commandDigest:digest,scopeDigest:createHash('sha256').update(JSON.stringify(scope)).digest('hex'),actionId:action.id,actionRevision:action.revision,planRevision:0,startedRevision:1,status:'inspecting',repository:scope.repository,commit:sha,templatePath:scope.templatePath,templateBlob:null,observedAt:new Date().toISOString(),completedAt:null,evidenceIds:[],artifact:null,artifactDigest:null,blockers:['pending'],errorCode:null,authorization:'inspect_prepare_only',approved:false,executed:false,verified:false,prUrl:null});
 x.reopen();const s=await x.adapter.prepare(p,command);assert.equal(s.githubPreparations![command.id].status,'prepared');assert.equal(s.revision,2);x.store.close();
});
test('HTTP route requires scoped session identity and rejects invented authorization',async()=>{
 const {createApp}=await import('../src/app.ts');const {openGoalStore}=await import('../src/store.ts');const x=setup(),goals=openGoalStore(':memory:');
 const server=createApp(goals,undefined,{store:x.store,prepareGitHub:x.adapter.prepare,authorize:r=>r.headers.authorization==='Bearer test'?p:null});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/orbit/github-preparations`;
 const post=(body:unknown,target=url,auth=true)=>fetch(target,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
 try {assert.equal((await post(command,url,false)).status,403);assert.equal((await post(command,url.replace('/orbit/','/other/'))).status,403);assert.equal((await post({...command,approve:true})).status,400);const response=await post(command);assert.equal(response.status,200);assert.equal(response.headers.get('etag'),'"activation-2"');assert.equal((await response.json()).githubPreparations[command.id].status,'prepared');assert.equal((await post(command)).status,200);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));x.store.close();goals.close();}
});

test('expired scope and unadmitted GitHub observations are denied',async()=>{
 const expired=setup({now:()=>Date.parse('2100-01-01')});await assert.rejects(expired.adapter.prepare(p,command),/FORBIDDEN/);assert.equal(expired.calls.length,0);expired.store.close();
 const x=setup();const before=x.store.get(p);const record={...before.evidence[0],id:'forged-github',kind:'github_observation' as const};
 assert.equal(x.adapter.policy.admit(p,record,'progress'),false);
 assert.equal(x.adapter.policy.admit({...p,customerId:'other'},record,'progress'),false);x.store.close();
});
