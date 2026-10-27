import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createIgnitionStore,ignitionPlugin} from './ignition.mjs';
const principal=(person,tenant='northstar')=>({person,tenant,role:person==='chris'?'operator':person==='maya'?'champion':'developer'});
const publish={action:'publish',reviewed:true,briefing:'Maya prioritizes service ownership and documentation for payments-api on GitHub.',uncertainties:'Okta unverified; conflicting notes. GitHub access reported only.'};
test('approval, commercial privacy, conflicts and role isolation are enforced',()=>{
 const s=createIgnitionStore(),c=principal('chris'),a=principal('alex'),m=principal('maya');
 assert.throws(()=>s.mutate(a,{...publish,revision:0}),/FORBIDDEN/);
 assert.throws(()=>s.mutate(c,{...publish,reviewed:false,revision:0}),/REVIEW_REQUIRED/);
 assert.throws(()=>s.mutate(c,{...publish,uncertainties:'Budget $100K',revision:0}),/PRIVATE_CONTEXT/);
 s.mutate(c,{...publish,revision:0});
 for(const p of [a,m]){const v=s.view(p);assert.equal(v.sources,undefined);assert.equal(v.versions,undefined);assert.equal(v.commercial,undefined);assert.match(v.handoff.uncertainties,/unverified/);assert.doesNotMatch(JSON.stringify(v),/100K/);}
 assert.throws(()=>s.mutate(a,{action:'preferences',priority:'docs',goal:'',invites:[],revision:1}),/FORBIDDEN/);
 assert.throws(()=>s.mutate(m,{action:'verify',workflow:'docs',answer:'Payments recovery',revision:1}),/FORBIDDEN/);
});
test('champion is optional, verification is meaningful, revisions preserve individual evidence and tenants',()=>{
 const s=createIgnitionStore(),c=principal('chris'),a=principal('alex'),j=principal('jordan');s.mutate(c,{...publish,revision:0});
 assert.throws(()=>s.mutate(a,{action:'verify',workflow:'ownership',answer:'random',revision:1}),/OUTCOME_NOT_VERIFIED/);
 s.mutate(a,{action:'verify',workflow:'ownership',answer:'team-payments',revision:1});
 s.mutate(c,{...publish,briefing:'Revised context: find service ownership and docs.',revision:2});
 assert.equal(s.view(a).progress.alex.ownership.handoffVersion,1);assert.equal(s.view(a).handoff.version,2);assert.equal(s.view(c).versions.length,2);
 assert.equal(s.view(j).progress.alex,undefined);assert.deepEqual(s.view(j).progress.jordan,{});
 assert.equal(s.view(principal('chris','other-tenant')).handoff,null);
 assert.throws(()=>s.mutate(c,{...publish,revision:1}),/REVISION_CONFLICT/);
});
test('onboarding steps are role-scoped, ordered, evidence-labelled and private to each developer',()=>{
 const s=createIgnitionStore(),c=principal('chris'),a=principal('alex'),j=principal('jordan'),m=principal('maya');
 assert.throws(()=>s.mutate(a,{action:'step',step:'goal',revision:0}),/HANDOFF_REQUIRED/);
 s.mutate(c,{...publish,revision:0});
 assert.throws(()=>s.mutate(m,{action:'step',step:'goal',revision:1}),/FORBIDDEN/);
 assert.throws(()=>s.mutate(a,{action:'step',step:'register',revision:1}),/STEP_PREREQUISITE/);
 assert.throws(()=>s.mutate(j,{action:'step',step:'register',revision:1}),/INVALID_REQUEST/);
 assert.throws(()=>s.mutate(a,{action:'step',step:'owner',revision:1}),/INVALID_REQUEST/);
 s.mutate(a,{action:'step',step:'prepare',revision:1});s.mutate(a,{action:'step',step:'register',revision:2});
 assert.equal(s.view(a).steps.alex.register.evidence,'simulated');assert.equal(s.view(j).catalogRegistered,true);
 assert.equal(s.view(j).steps.alex,undefined);assert.deepEqual(Object.keys(s.view(m).steps),['alex','jordan']);
 s.mutate(j,{action:'step',step:'discover',revision:3});assert.equal(s.view(j).steps.jordan.discover.evidence,'acknowledged');
});
test('HTTP rejects unauthenticated, cross-origin, injected tenant/role and developer publication',async()=>{
 process.env.IGNITION_DEMO='1';let handler;ignitionPlugin().configureServer({middlewares:{use:h=>handler=h}});
 const server=createServer((q,r)=>handler(q,r,()=>{r.writeHead(404);r.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/ignition-api/state')).status,401);
  assert.equal((await fetch(base+'/ignition-api/session',{method:'POST',body:JSON.stringify({person:'chris'})})).status,403);
  const login=await fetch(base+'/ignition-api/session',{method:'POST',headers:{Origin:base},body:JSON.stringify({person:'alex',role:'operator',tenant:'other'})});const cookie=login.headers.get('set-cookie').split(';')[0];
  const state=await (await fetch(base+'/ignition-api/state',{headers:{Cookie:cookie}})).json();assert.equal(state.role,'developer');assert.equal(state.sources,undefined);
  const scopedCookies=[];
  for(const person of ['chris','maya','alex','jordan']){
   const r=await fetch(base+'/ignition-api/'+person+'/session',{method:'POST',headers:{Origin:base},body:JSON.stringify({person,email:person+'@northstar.example'})});
   assert.equal(r.status,200);scopedCookies.push(r.headers.get('set-cookie').split(';')[0]);
  }
  const allCookies=scopedCookies.join('; ');
  for(const person of ['chris','maya','alex','jordan']){
   const r=await (await fetch(base+'/ignition-api/'+person+'/state',{headers:{Cookie:allCookies}})).json();assert.equal(r.person,person);
   if(person!=='chris')assert.equal(r.sources,undefined);
  }
  assert.equal((await fetch(base+'/ignition-api/chris/session',{method:'POST',headers:{Origin:base},body:JSON.stringify({person:'alex'})})).status,403);
  assert.equal((await fetch(base+'/ignition-api/chris/state',{headers:{Cookie:scopedCookies[2]}})).status,401);
  assert.equal((await fetch(base+'/ignition-api/chris/session',{method:'POST',headers:{Origin:base},body:JSON.stringify({person:'chris',email:'maya@northstar.example'})})).status,403);
  assert.equal((await fetch(base+'/ignition-api/maya/logout',{method:'POST',headers:{Origin:base,Cookie:allCookies},body:'{}'})).status,200);
  assert.equal((await fetch(base+'/ignition-api/maya/state',{headers:{Cookie:allCookies}})).status,401);
  assert.equal((await fetch(base+'/ignition-api/chris/state',{headers:{Cookie:allCookies}})).status,200);
  const denied=await fetch(base+'/ignition-api/state',{method:'POST',headers:{Origin:base,Cookie:cookie},body:JSON.stringify({...publish,revision:0})});assert.equal(denied.status,403);
 }finally{await new Promise(r=>server.close(r));delete process.env.IGNITION_DEMO;}
});
