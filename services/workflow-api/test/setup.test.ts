import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import fixtures from '../../../contracts/activation/v1/fixtures.json' with {type:'json'};
import type {CustomerContext,ActivationPlan,BlockerUpdate} from '../../../contracts/activation/v1/types.ts';
import {openActivationStore,type Principal,type ActivationStore} from '../src/activation/store.ts';
import {createGitHubPreparation} from '../src/activation/github.ts';
import {setupApprovalPolicy,type SetupApprovalGrant} from '../src/activation/approval.ts';
import {buildSetupProposal} from '../src/activation/setup.ts';
const p:Principal={tenantId:'fictional',customerId:'orbit',sessionId:'fictional-review'};
const commit='a'.repeat(40),treeSha='b'.repeat(40),templatePath='examples/templates/node-launch.yaml';
const bytes=readFileSync(new URL('../../../examples/templates/node-launch.yaml',import.meta.url));
const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const action=fixtures.orbit.plan.suggestedNextAction;
const command={id:'prepare:setup',expectedRevision:0,planRevision:0,actionId:action.id,actionRevision:action.revision};
function setup(){
 let writes=0,reads=0,grants:SetupApprovalGrant[]=[],store:ActivationStore;
 const db=join(mkdtempSync(join(tmpdir(),'phase25-test-')),'state.sqlite');
 const fetchImpl:typeof fetch=async(url,opts)=>{
  assert.equal(opts?.method,'GET');reads++;if(opts?.method!=='GET')writes++;
  const path=String(url).replace('https://api.github.com/repos/example/fictional','');
  return Response.json(path===''?{full_name:'example/fictional',default_branch:'main'}:path==='/commits/main'?{sha:commit}:path.includes('/git/commits/')?{sha:commit,tree:{sha:treeSha}}:path.includes('/git/trees/')?{sha:treeSha,truncated:false,tree:[{path:templatePath,type:'blob',mode:'100644',sha:blob}]}:{sha:blob,encoding:'base64',size:bytes.length,content:bytes.toString('base64')});
 };
 const base={admitContext:()=>true,admitPlan:()=>true,admit:()=>true};
 const makeAdapter=(getStore:()=>ActivationStore)=>createGitHubPreparation(base,getStore,[{principal:p,actionId:action.id,actionRevision:action.revision,planRevision:0,repository:'example/fictional',commit,templatePath,prerequisitePaths:[],expiresAt:'2099-01-01'}],{fetchImpl});
 const adapter=makeAdapter(()=>store);
 const open=()=>openActivationStore(db,setupApprovalPolicy(adapter.policy,grants));store=open();
 const context=structuredClone(fixtures.orbit.context) as CustomerContext,plan=structuredClone(fixtures.orbit.plan) as ActivationPlan;
 for(const item of [context,plan])for(const e of item.evidence){e.source='local-test-report';e.producer='local-test';e.sourceRevision='review-1';e.proof.reference='none';}
 store.initialize(p,context,plan);
 return {adapter,peer(){let peer:ActivationStore;const a=makeAdapter(()=>peer);peer=openActivationStore(db,setupApprovalPolicy(a.policy,grants));return {adapter:a,store:peer};},get store(){return store;},get reads(){return reads;},get writes(){return writes;},reopen(){store.close();store=open();},grant(digest:string,change:Partial<SetupApprovalGrant>={}){grants=[{principal:p,preparationId:command.id,artifactDigest:digest,sourceCommit:commit,planRevision:0,actionId:action.id,actionRevision:action.revision,expiresAt:'2099-01-01',...change}];this.reopen();}};
}
function approval(s:ReturnType<ActivationStore['get']>){return {id:'approval:setup',expectedRevision:s.revision,preparationId:command.id,artifactDigest:s.githubPreparations![command.id].artifactDigest!,sourceCommit:commit,planRevision:0,actionRevision:action.revision,decision:'accept_proposal_only' as const};}
test('actual template produces a deterministic proposed file diff with validated missing dependencies and explicit unknowns',async()=>{
 const x=setup(),before=x.store.get(p);const s=await x.adapter.prepare(p,command),packet=s.githubPreparations![command.id],proposal=packet.setupProposal!;
 assert.equal(blob,'838a456dd71d76a1ab6a46ea4e114fe09f9f997f');assert.equal(proposal.templateReview,'reviewed_known_template');assert.equal(proposal.readyToRun,false);
 assert.deepEqual(proposal.dependencies.map(d=>[d.path,d.status]),['node','ci-node','monitoring','docs'].map(d=>['examples/templates/skeletons/'+d,'missing']));
 const file=JSON.parse(proposal.proposedFile);assert.deepEqual(file.candidateParameters,{name:'recommendation-service',owner:null,repoUrl:null});assert.equal(file.remoteWritesAuthorized,false);
 assert.match(proposal.diff,/new file mode 100644/);assert.match(proposal.diff,/\+.*"repoUrl": null/);assert.match(proposal.semantics.join(' '),/not .github\/workflows/);assert.match(proposal.missingPrerequisites.join(' '),/schemas\/versions/);
 assert.equal(packet.artifactDigest,createHash('sha256').update(packet.artifact!).digest('hex'));assert.deepEqual(JSON.parse(packet.artifact!).setupProposal,proposal);
 assert.deepEqual(s.actions,before.actions);assert.deepEqual(s.outcome,before.outcome);assert.deepEqual(s.milestone,before.milestone);assert.equal(x.writes,0);
 const calls=x.reads;x.reopen();assert.deepEqual(await x.adapter.prepare(p,command),s);assert.equal(x.reads,calls);x.store.close();
});
test('proposal acceptance is independently authorized, digest/source/revision bound, durable and never action proof',async()=>{
 const x=setup(),s=await x.adapter.prepare(p,command),b=approval(s),packet=s.githubPreparations![command.id];
 assert.throws(()=>x.store.acceptSetupProposal(p,b),/FORBIDDEN/);
 for(const extra of [{execute:true},{verified:true},{decision:'execute'},{id:'bad'}])assert.throws(()=>x.store.acceptSetupProposal(p,{...b,...extra}),/INVALID_REQUEST/);
 for(const extra of [{artifactDigest:'f'.repeat(64)},{sourceCommit:'c'.repeat(40)},{actionRevision:999},{planRevision:1},{preparationId:'prepare:unknown'}])assert.throws(()=>x.store.acceptSetupProposal(p,{...b,...extra}),/INVALID_TRANSITION/);
 for(const extra of [{principal:{...p,tenantId:'other'}},{principal:{...p,customerId:'other'}},{principal:{...p,sessionId:'other'}},{artifactDigest:'f'.repeat(64)},{sourceCommit:'c'.repeat(40)},{planRevision:1},{actionId:'other'},{actionRevision:999},{expiresAt:'2000-01-01'}]){x.grant(b.artifactDigest,extra);assert.throws(()=>x.store.acceptSetupProposal(p,b),/FORBIDDEN/);}
 x.grant(b.artifactDigest);const accepted=x.store.acceptSetupProposal(p,b),saved=accepted.githubPreparations![command.id];
 assert.equal(saved.proposalApproval?.artifactDigest,b.artifactDigest);assert.equal(saved.approved,false);assert.equal(saved.executed,false);assert.equal(saved.verified,false);assert.equal(saved.prUrl,null);assert.equal(saved.artifact,packet.artifact);assert.deepEqual(saved.blockers,packet.blockers);
 assert.deepEqual(accepted.actions,s.actions);assert.deepEqual(accepted.evidence,s.evidence);assert.deepEqual(accepted.milestone,s.milestone);assert.deepEqual(accepted.outcome,s.outcome);
 assert.deepEqual(x.store.acceptSetupProposal(p,b),accepted);assert.throws(()=>x.store.acceptSetupProposal(p,{...b,expectedRevision:accepted.revision}),/IDEMPOTENCY_CONFLICT/);
 x.reopen();assert.deepEqual(x.store.acceptSetupProposal(p,b),accepted);assert.equal(x.writes,0);x.store.close();
});
test('acceptance conflicts on stale state, blocked action, cross-customer session and duplicate decision',async()=>{
 const x=setup(),s=await x.adapter.prepare(p,command),b=approval(s);x.grant(b.artifactDigest);
 assert.throws(()=>x.store.acceptSetupProposal({...p,customerId:'other'},b),/NOT_FOUND/);assert.throws(()=>x.store.acceptSetupProposal({...p,sessionId:'other'},b),/NOT_FOUND/);
 assert.throws(()=>x.store.acceptSetupProposal(p,{...b,expectedRevision:0}),/REVISION_CONFLICT/);
 const accepted=x.store.acceptSetupProposal(p,b);assert.throws(()=>x.store.acceptSetupProposal(p,{...b,id:'approval:second',expectedRevision:accepted.revision}),/INVALID_TRANSITION/);x.store.close();
 const y=setup(),prepared=await y.adapter.prepare(p,command),cmd=approval(prepared);y.grant(cmd.artifactDigest);
 const event=structuredClone(fixtures.blockerReplan.blocker) as BlockerUpdate;event.customerId=p.customerId;event.expectedRevision=prepared.revision;event.revision=prepared.revision+1;event.developerSessionId=p.sessionId;y.store.blocker(p,event);
 assert.throws(()=>y.store.acceptSetupProposal(p,{...cmd,expectedRevision:y.store.get(p).revision}),/REVISION_CONFLICT/);y.store.close();
});
test('unrecognized templates stay unresolved and present dependency trees never imply validated skeleton content',async()=>{
 const x=setup(),s=await x.adapter.prepare(p,command),packet=s.githubPreparations![command.id];
 const unknown=buildSetupProposal({...packet,templateBlob:'c'.repeat(40)},[],treeSha);assert.equal(unknown.templateReview,'unsupported_template');assert.equal(JSON.parse(unknown.proposedFile).candidateParameters,null);assert.deepEqual(unknown.dependencies,[]);
 const present=buildSetupProposal(packet,[{path:'examples/templates/skeletons/node/package.json',type:'blob',mode:'100644',sha:'d'.repeat(40)}],treeSha);assert.equal(present.dependencies[0].status,'present_uninspected');assert.equal(present.readyToRun,false);assert.match(present.missingPrerequisites[0],/separate read scope/);x.store.close();
});
test('HTTP approval rejects identity mismatch and invented execution; concurrent exact requests accept once',async()=>{
 const {createApp}=await import('../src/app.ts'),{openGoalStore}=await import('../src/store.ts');
 const x=setup(),prepared=await x.adapter.prepare(p,command),body=approval(prepared);x.grant(body.artifactDigest);const goals=openGoalStore(':memory:');
 const server=createApp(goals,undefined,{store:x.store,authorize:req=>req.headers.authorization==='Bearer fictional'?p:null});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const root=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/orbit/setup-approvals`;
 const post=(b:unknown=body,url=root,auth=true)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fictional'}:{})},body:JSON.stringify(b)});
 try{assert.equal((await post(body,root,false)).status,403);assert.equal((await post(body,root.replace('/orbit/','/other/'))).status,403);assert.equal((await post({...body,execute:true})).status,400);const [a,b]=await Promise.all([post(),post()]);assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(await a.json(),await b.json());assert.equal(x.store.get(p).revision,3);assert.equal(x.writes,0);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));x.store.close();goals.close();}
});

test('independent database connections converge on one durable preparation and one proposal acceptance',async()=>{
 const x=setup(),peer=x.peer();
 const [a,b]=await Promise.all([x.adapter.prepare(p,command),peer.adapter.prepare(p,command)]);
 assert.deepEqual(a,b);assert.equal(a.revision,2);assert.equal(Object.keys(a.githubPreparations!).length,1);peer.store.close();
 const cmd=approval(a);x.grant(cmd.artifactDigest);const reviewer=x.peer();
 const accepted=x.store.acceptSetupProposal(p,cmd);assert.deepEqual(reviewer.store.acceptSetupProposal(p,cmd),accepted);assert.equal(accepted.revision,3);reviewer.store.close();x.store.close();
});
