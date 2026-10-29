/** Phase 7: read-only repository evidence for approved work. Live mode is exercised against a mocked GitHub API
 * (no network); fixture mode against the labelled Aperture sample. Over HTTP with the real stores. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {RepositoryEvidence,RepositoryInspection,RepositoryObservation} from '../../../contracts/activation/v1/handoff.ts';
import type {RepositoryConfig} from '../src/activation/repository.ts';
import {approvedPlan,harness,ollamaStub,update,work,type Call} from './support/work-harness.ts';
import {githubMock} from './support/github-mock.ts';

const LIVE:RepositoryConfig={customerId:'aperture',id:'payments-api',label:'payments-api',repository:'example-org/payments-api',mode:'live',services:['payments-api']};
const FIXTURE:RepositoryConfig={customerId:'aperture',id:'payments-api',label:'payments-api (sample)',repository:'aperture-commerce/payments-api',mode:'fixture',fixture:'aperture-payments-api',services:['payments-api']};
const inspect=(call:Call,token:string,body:object={repositoryId:'payments-api'},actor?:string)=>call('aperture','repository-inspections',token,body,actor);
const evidence=async(call:Call,token:string)=>(await call('aperture','repository-evidence',token)).json as RepositoryEvidence;
const sig=(i:RepositoryInspection,s:string)=>i.observations.find(o=>o.signal===s)! as RepositoryObservation;
/** Approval publishes the plan; the Portal then observes its repositories itself (Spotify's integration). */
async function observed(call:Call){for(let i=0;i<200;i++){const r=(await evidence(call,'champ')).repositories[0];if(r?.evidence)return r.evidence;await new Promise(x=>setTimeout(x,10));}throw Error('not observed');}

test('live read-only inspection: what was observed, where, at which commit and when; GET requests to the configured repository only',async()=>{
 const gh=githubMock();
 const h=await harness({repositories:[LIVE],github:gh.fetchImpl,githubToken:'ghp_test_read_only'});
 try{
  await approvedPlan(h.call);
  // Nobody has to inspect: approving the plan is enough for the Portal to observe the repository read-only.
  const i=await observed(h.call);
  assert.equal(i.status,'succeeded');assert.equal(i.mode,'live');assert.equal(i.commit,gh.commit);assert.equal(i.requestedBy,'Spotify integration');
  assert.equal((await evidence(h.call,'alex')).repositories[0].canInspect,false,'no inspect control for anyone');
  // The API still accepts a refresh, but only for the configured repository; extra fields are ignored.
  const r=await inspect(h.call,'alex',{repositoryId:'payments-api',repository:'attacker/other',url:'https://evil.example'});
  assert.equal(r.status,200,r.raw);assert.equal(r.json.reused,true);assert.equal(r.json.inspection.repository,'example-org/payments-api');
  assert.equal(sig(i,'identity').status,'observed');assert.match(sig(i,'default_branch').summary,/main is at commit aaaaaaaaaaaa/);
  assert.match(sig(i,'readme').summary,/first heading “example payments-api”/);
  const owners=sig(i,'codeowners');
  assert.equal(owners.status,'observed');assert.deepEqual(owners.details,['@example-org/payments-team','@example-org/docs-team'],'handles only; no e-mail addresses');
  assert.equal(owners.source.url,`https://github.com/example-org/payments-api/blob/${gh.commit}/.github/CODEOWNERS`);assert.equal(owners.source.kind,'github_api');
  assert.match(sig(i,'ci_config').limitation!,/not proof that CI runs or passes/);
  assert.deepEqual(sig(i,'catalog_info').details,['kind: Component','name: payments-api','type: service','lifecycle: production','owner: group:payments-team']);
  assert.equal(sig(i,'runbooks').status,'missing');assert.match(sig(i,'runbooks').limitation!,/outside the repository/);
  assert.equal(sig(i,'ci_runs').status,'not_inspected');
  assert.ok(i.observations.every(o=>o.retrievedAt&&o.repository==='example-org/payments-api'&&o.mode==='live'));
  // Read-only: only GETs, only this repository, with the server-held token; nothing for the browser to see.
  assert.ok(gh.calls.length>0&&gh.calls.every(c=>c.method==='GET'&&c.path.startsWith('/repos/example-org/payments-api')&&c.auth==='Bearer ghp_test_read_only'),JSON.stringify(gh.calls));
  assert.ok(!r.raw.includes('ghp_test_read_only'));
  assert.ok(!JSON.stringify(i).includes('Test repository content'),'file contents are not stored');
  // Requests soon after reuse the recorded observation instead of calling GitHub again.
  const calls=gh.calls.length,again=await inspect(h.call,'alex');
  assert.equal(again.status,200);assert.equal(again.json.reused,true);assert.equal(gh.calls.length,calls);
 }finally{await h.close();}
});

test('missing, inaccessible and uninspected are kept apart',async()=>{
 // CODEOWNERS can't be read (403); everything else answers.
 const ownersSha=(await import('../src/activation/repository.ts')).blobSha(Buffer.from('# owners\n* @example-org/payments-team\n/docs/ @example-org/docs-team @someone@example.com\n'));
 const blocked=githubMock({fail:p=>p.endsWith(`/git/blobs/${ownersSha}`)?new Response('{}',{status:403}):undefined});
 let h=await harness({repositories:[LIVE],github:blocked.fetchImpl});
 try{
  await approvedPlan(h.call);
  const i=(await inspect(h.call,'alex')).json.inspection as RepositoryInspection;
  assert.equal(i.status,'partial');assert.equal(sig(i,'codeowners').status,'inaccessible');assert.match(sig(i,'codeowners').summary,/listed but couldn’t be read \(GITHUB_FORBIDDEN\)/);
  assert.equal(sig(i,'runbooks').status,'missing');
 }finally{await h.close();}
 // An incomplete file listing can't establish that anything is missing.
 const truncated=githubMock({truncated:true});
 h=await harness({repositories:[LIVE],github:truncated.fetchImpl});
 try{
  await approvedPlan(h.call);
  const i=(await inspect(h.call,'alex')).json.inspection as RepositoryInspection;
  assert.equal(sig(i,'runbooks').status,'not_inspected');assert.match(sig(i,'runbooks').summary,/can’t be confirmed/);
  assert.equal(sig(i,'readme').status,'observed','what was listed is still observed');
  assert.ok(!i.observations.some(o=>o.status==='missing'));
 }finally{await h.close();}
 // A file without CODEOWNERS is "missing", with the caveat that this proves nothing about ownership.
 const files={...(await import('./support/github-mock.ts')).SAMPLE_FILES};delete files['.github/CODEOWNERS'];
 h=await harness({repositories:[LIVE],github:githubMock({files}).fetchImpl});
 try{
  await approvedPlan(h.call);
  const o=sig((await inspect(h.call,'alex')).json.inspection,'codeowners');
  assert.equal(o.status,'missing');assert.match(o.limitation!,/not proof that nobody owns the service/);
 }finally{await h.close();}
});

test('fixture mode: the same checks on labelled sample data, never presented as a live GitHub observation',async()=>{
 const h=await harness({repositories:[FIXTURE]});
 try{
  await approvedPlan(h.call);
  const i=(await inspect(h.call,'alex')).json.inspection as RepositoryInspection;
  assert.equal(i.mode,'fixture');assert.equal(i.status,'succeeded');
  assert.ok(i.observations.every(o=>o.mode==='fixture'&&o.source.kind==='fixture'&&o.source.url===null),'no GitHub links for sample data');
  assert.ok(i.observations.filter(o=>o.source.request!=='none').every(o=>o.source.request.startsWith('Sample fixture fixtures/repositories/aperture-payments-api.json')));
  assert.equal(sig(i,'codeowners').status,'missing');assert.equal(sig(i,'runbooks').status,'missing');
  assert.match(sig(i,'ci_config').summary,/2 GitHub Actions workflow files; other CI configuration: Jenkinsfile/);
  assert.ok(sig(i,'catalog_info').details.includes('owner: team-checkout'));
  const v=await evidence(h.call,'champ');assert.equal(v.repositories[0].mode,'fixture');
 }finally{await h.close();}
});

test('GitHub failures and rate limits are recorded as codes; earlier evidence stays, marked stale when old',async()=>{
 let mode:'ok'|'limit'|'down'|'missing'='ok';let clock=Date.parse('2026-10-29T12:00:00Z');
 const gh=githubMock({fail:()=>mode==='limit'?new Response('{"message":"API rate limit exceeded"}',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(Math.floor(clock/1000)+600)}})
  :mode==='down'?Promise.reject(new TypeError('fetch failed')):mode==='missing'?new Response('{}',{status:404}):undefined});
 const h=await harness({repositories:[LIVE],github:gh.fetchImpl,now:()=>clock});
 try{
  await approvedPlan(h.call);
  const first=(await inspect(h.call,'alex')).json.inspection as RepositoryInspection;
  assert.equal(first.status,'succeeded');
  clock+=60_000;mode='limit';
  const limited=(await inspect(h.call,'alex')).json.inspection as RepositoryInspection;
  assert.equal(limited.status,'failed');assert.equal(limited.errorCode,'GITHUB_RATE_LIMITED');assert.ok(limited.retryAfter);
  assert.ok(limited.observations.every(o=>o.status==='not_inspected'),'nothing is claimed from a failed inspection');
  let v=(await evidence(h.call,'alex')).repositories[0];
  assert.equal(v.latest!.id,limited.id);assert.equal(v.evidence!.id,first.id,'the last successful inspection is still shown, as earlier evidence');assert.equal(v.stale,false);
  clock+=60_000;mode='down';
  assert.equal((await inspect(h.call,'alex')).json.inspection.errorCode,'GITHUB_UNAVAILABLE');
  clock+=60_000;mode='missing';
  assert.equal((await inspect(h.call,'alex')).json.inspection.errorCode,'GITHUB_NOT_ACCESSIBLE');
  clock+=25*3600_000;
  v=(await evidence(h.call,'alex')).repositories[0];
  assert.equal(v.stale,true,'old evidence is never shown as current');
 }finally{await h.close();}
});

test('authorization: approved plan, configured repository, relevant milestone, inspecting roles; per customer',async()=>{
 const gh=githubMock();
 const other:RepositoryConfig={...LIVE,id:'docs-site',repository:'example-org/docs-site',services:['docs-site']};
 const lumen:RepositoryConfig={...LIVE,customerId:'lumen',id:'recs-service',repository:'example-org/recs-service',services:['recs-service']};
 const h=await harness({repositories:[LIVE,other,lumen],github:gh.fetchImpl});
 try{
  await approvedPlan(h.call,false);
  assert.equal((await inspect(h.call,'alex')).json.error.code,'NO_APPROVED_PLAN');
  await approvedPlan(h.call);
  assert.equal((await inspect(h.call,'op')).json.error.code,'FORBIDDEN','Chris observes; he doesn’t inspect');
  assert.equal((await inspect(h.call,'dev')).json.error.code,'DEVELOPER_IDENTITY_REQUIRED');
  assert.equal((await inspect(h.call,'alex',{repositoryId:'docs-site'})).json.error.code,'NOT_FOUND','not relevant to any approved milestone');
  assert.equal((await inspect(h.call,'alex',{repositoryId:'recs-service'})).json.error.code,'NOT_FOUND','another customer’s repository');
  assert.equal((await inspect(h.call,'alex',{repository:'example-org/payments-api'})).json.error.code,'INVALID_REQUEST','only configured ids, never names or URLs');
  assert.equal((await h.call('aperture','repository-evidence','lumen-alex')).status,403);
  assert.equal((await h.call('aperture','repository-inspections','lumen-champ',{repositoryId:'payments-api'})).status,403);
  assert.deepEqual((await evidence(h.call,'alex')).repositories.map(r=>r.id),['payments-api']);
  await observed(h.call);
  assert.ok(gh.calls.length>0&&gh.calls.every(c=>c.path.startsWith('/repos/example-org/payments-api')),'the Portal observed only the repository the approved plan relies on');
  assert.equal((await evidence(h.call,'op')).repositories[0].canInspect,false);assert.equal((await evidence(h.call,'champ')).repositories[0].canInspect,false,'not the Champion’s job either');
 }finally{await h.close();}
});

test('milestone integration and Maya’s view: focus follows each milestone’s own work; nothing is completed by an inspection; evidence persists',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'phase7-'));
 const gh=githubMock();
 try{
  let h=await harness({file:join(dir,'db.sqlite'),repositories:[LIVE],github:gh.fetchImpl});
  await approvedPlan(h.call);
  await update(h.call,'alex','m-alex',0,{action:{index:0,status:'started'}});
  await observed(h.call);
  const alex=(await evidence(h.call,'alex')).repositories[0],jordan=(await evidence(h.call,'jordan')).repositories[0];
  assert.deepEqual(alex.milestones.map(m=>m.id),['m-alex']);assert.deepEqual(jordan.milestones.map(m=>m.id),['m-jordan']);
  assert.ok(['readme','codeowners','ci_config'].every(s=>alex.milestones[0].focus.includes(s as never)),'readiness: README, ownership, CI');
  assert.ok(['catalog_info','docs'].every(s=>jordan.milestones[0].focus.includes(s as never)),'discoverability: catalog metadata and docs');
  assert.ok(alex.milestones[0].actionLinks.some(a=>a.index===0));
  const t=await work(h.call,'champ');
  assert.equal(t.milestones.find(m=>m.id==='m-alex')!.status,'in_progress');assert.equal(t.milestones.find(m=>m.id==='m-alex')!.actionsCompleted,0,'an inspection completes nothing');
  const maya=(await evidence(h.call,'champ')).repositories[0];
  assert.deepEqual(maya.milestones.map(m=>m.id),['m-alex','m-jordan']);assert.equal(maya.evidence!.requestedBy,'Spotify integration');
  await h.close();
  h=await harness({file:join(dir,'db.sqlite'),repositories:[LIVE],github:gh.fetchImpl});
  const after=(await evidence(h.call,'champ')).repositories[0].evidence!;
  assert.equal(after.commit,gh.commit);assert.equal(sig(after,'codeowners').source.path,'.github/CODEOWNERS');
  await h.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('AiKA: verified repository claims must cite recorded observations; uncited or unsupported repository claims are removed; fixtures are “sample”',async()=>{
 const gh=githubMock();
 let reply:(prompt:string)=>unknown=()=>({sections:[{kind:'suggestion',text:'Ask your Champion.',citations:[]}],next_step:null});
 const stub=await ollamaStub(b=>reply(b.messages[1].content));
 try{
  // A "verified" claim citing an observation that doesn't exist is removed.
  let h=await harness({repositories:[LIVE],github:gh.fetchImpl,modelUrl:stub.url});
  await approvedPlan(h.call);await observed(h.call);
  const ask=async()=>{await h.call('aperture','aika-questions','alex',{question:'Who owns payments-api?',milestoneId:'m-alex'});for(let i=0;i<100;i++){const j=(await h.call('aperture','aika-questions','alex')).json.job;if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,10));}};
  reply=()=>({sections:[{kind:'verified',text:'CODEOWNERS names @example-org/payments-team.',citations:['obs-0000000000']},{kind:'unknown',text:'Nobody has looked at the repository yet.',citations:[]}],next_step:null});
  let j=await ask();
  assert.deepEqual(j.answer.sections.map((s:any)=>s.kind),['unknown']);assert.equal(j.answer.removed,1);
  assert.match(stub.requests.at(-1).messages[1].content,/REPOSITORY OBSERVATIONS \(recorded by the Portal backend/);
  reply=prompt=>{const id=/\[(obs-[a-f0-9]{10})\] OBSERVED \(live, read-only\) example-org\/payments-api@a{12} codeowners/.exec(prompt)![1];
   return {sections:[{kind:'verified',text:'CODEOWNERS at .github/CODEOWNERS names @example-org/payments-team.',citations:[id]},
    {kind:'verified',text:'The repository has a runbook.',citations:['obs-ffffffffff']},
    {kind:'known',text:'The repository has a CODEOWNERS file and a catalog-info.yaml.',citations:[]},
    {kind:'verified',text:'CI passes on main.',citations:[]},
    {kind:'reported',text:'Alex reported nothing yet.',citations:[]}],next_step:null};};
  j=await ask();
  assert.deepEqual(j.answer.sections.map((s:any)=>[s.kind,s.citations?.length??0]),[['verified',1],['reported',0]]);assert.equal(j.answer.removed,3);
  const prompt=stub.requests.at(-1).messages[1].content;
  assert.match(prompt,/NOT FOUND \(live listing\) example-org\/payments-api@a{12} runbooks/);assert.match(prompt,/NOT INSPECTED .* ci_runs/);
  await h.close();
  // Fixture evidence: a "verified" claim citing it becomes "sample".
  h=await harness({repositories:[FIXTURE],modelUrl:stub.url});
  await approvedPlan(h.call);await observed(h.call);
  reply=prompt=>{const id=/\[(obs-[a-f0-9]{10})\] SAMPLE \(fixture data for a fictional repository, not a live observation\) aperture-commerce\/payments-api@5f1c0de2a9b4 catalog_info/.exec(prompt)![1];
   return {sections:[{kind:'verified',text:'catalog-info.yaml names team-checkout as owner.',citations:[id]}],next_step:null};};
  j=await ask();
  assert.deepEqual(j.answer.sections.map((s:any)=>s.kind),['sample']);
  await h.close();
 }finally{await stub.close();}
});
