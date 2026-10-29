/** Phase 8: AiKA's slash-command capabilities. Each capability retrieves different server-side records; the list a
 * person sees and the checks on a question are both decided on the server. Model calls go to a local stand-in. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {AikaCapability} from '../../../contracts/activation/v1/handoff.ts';
import type {RepositoryConfig} from '../src/activation/repository.ts';
import {PRIVATE,approvedPlan,harness,ollamaStub,update} from './support/work-harness.ts';

const REPO:RepositoryConfig={customerId:'aperture',id:'payments-api',label:'payments-api (sample)',repository:'aperture-commerce/payments-api',mode:'fixture',fixture:'aperture-payments-api',services:['payments-api']};
const caps=async(call:Parameters<typeof approvedPlan>[0],token:string)=>(await call('aperture','aika-capabilities',token)).json.capabilities as AikaCapability[];
const available=(list:AikaCapability[])=>list.filter(c=>c.available).map(c=>c.id);

test('the capability list depends on the person and the approved plan; /docs is never offered without a documentation source',async()=>{
 const h=await harness({repositories:[REPO]});
 try{
  await approvedPlan(h.call,false);
  assert.deepEqual(available(await caps(h.call,'alex')),[],'nothing before approval');
  await approvedPlan(h.call);
  assert.deepEqual(available(await caps(h.call,'alex')),['onboarding','my-work','repository','team']);
  assert.deepEqual(available(await caps(h.call,'champ')),['onboarding','repository','team'],'the Champion has no /my-work');
  const docs=(await caps(h.call,'jordan')).find(c=>c.id==='docs')!;
  assert.equal(docs.available,false);assert.match(docs.reason!,/No documentation source is connected/);
  assert.deepEqual(available(await caps(h.call,'op')),[],'Chris does not use AiKA');
 }finally{await h.close();}
 const none=await harness();
 try{await approvedPlan(none.call);assert.ok(!available(await caps(none.call,'alex')).includes('repository'),'no configured repository, no /repository');}finally{await none.close();}
});

test('each capability retrieves its own records, and only what the person may see',async()=>{
 const stub=await ollamaStub(()=>({sections:[{kind:'suggestion',text:'Start with the first action.',citations:[]}],next_step:null}));
 const h=await harness({repositories:[REPO],modelUrl:stub.url});
 try{
  await approvedPlan(h.call);
  await update(h.call,'alex','m-alex',0,{note:{kind:'blocker',text:'No read access to payments-api yet'}});
  await h.call('aperture','repository-inspections','alex',{repositoryId:'payments-api'});
  const ask=async(token:string,capabilities?:string[])=>{
   const r=await h.call('aperture','aika-questions',token,{question:'What should I do next?',...(capabilities?{capabilities}:{})});
   if(r.status>=400)return {status:r.status,code:r.json.error.code,prompt:''};
   for(let i=0;i<100;i++){const j=(await h.call('aperture','aika-questions',token)).json.job;if(j.status!=='running')break;await new Promise(x=>setTimeout(x,10));}
   return {status:r.status,code:null,prompt:stub.requests.at(-1).messages[1].content as string,job:r.json.job};
  };
  let r=await ask('alex',['repository']);
  assert.deepEqual(r.job.capabilities,['repository']);
  assert.match(r.prompt,/CAPABILITIES CHOSEN: \/repository/);assert.match(r.prompt,/SAMPLE \(fixture data for a fictional repository/);
  assert.doesNotMatch(r.prompt,/YOUR MILESTONE|TEAM MILESTONE|ENGINEERING PROBLEM/);
  r=await ask('alex',['my-work']);
  assert.match(r.prompt,/YOUR MILESTONE: Assess payments-api repository readiness/);assert.match(r.prompt,/Open blocker reported by Alex Rivera/);
  assert.doesNotMatch(r.prompt,/REPOSITORY OBSERVATIONS|TEAM MILESTONE|TECHNICAL GOAL/);
  r=await ask('alex',['onboarding']);
  assert.match(r.prompt,/TECHNICAL GOAL: Establish a service-readiness baseline/);assert.doesNotMatch(r.prompt,/YOUR MILESTONE|REPOSITORY OBSERVATIONS/);
  // Jordan's /team: Alex's milestone by status only, never Alex's notes.
  r=await ask('jordan',['team']);
  assert.match(r.prompt,/TEAM MILESTONE: Assess payments-api repository readiness — Alex Rivera — status blocked — 1 open blocker/);assert.match(r.prompt,/TEAM PROGRESS: 0 of 2 milestones completed/);
  assert.doesNotMatch(r.prompt,/No read access to payments-api yet/);
  // Maya's /team: coordination detail, including the blocker.
  r=await ask('champ',['team']);
  assert.match(r.prompt,/MILESTONE: Assess payments-api repository readiness/);assert.match(r.prompt,/No read access to payments-api yet/);
  // No command: everything the person may see, as before.
  r=await ask('alex');assert.match(r.prompt,/YOUR MILESTONE/);assert.match(r.prompt,/REPOSITORY OBSERVATIONS/);assert.match(r.prompt,/TECHNICAL GOAL/);
  for(const p of stub.requests.map(x=>x.messages[1].content as string))for(const x of PRIVATE)assert.ok(!p.includes(x),`no ${x}`);
  // Refused on the server, whatever the page offered.
  assert.deepEqual([(await ask('alex',['docs'])).status,(await ask('alex',['docs'])).code],[403,'AIKA_CAPABILITY_FORBIDDEN']);
  assert.equal((await ask('champ',['my-work'])).code,'AIKA_CAPABILITY_FORBIDDEN');
  assert.equal((await ask('alex',['secrets'])).code,'INVALID_REQUEST');
  assert.equal((await ask('alex',['team','team','team','team','team'])).code,'INVALID_REQUEST');
  assert.equal((await ask('op',['team'])).status,403);
  assert.equal((await h.call('aperture','aika-capabilities','lumen-alex')).status,403,'another customer');
 }finally{await h.close();await stub.close();}
});
