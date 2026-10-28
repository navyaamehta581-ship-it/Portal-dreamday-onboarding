import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.ts';
import {openGoalStore} from '../src/store.ts';
import {openActivationStore} from '../src/activation/store.ts';
import {createIntake} from '../src/activation/intake.ts';
test('operator and agent publication is scoped; developer cannot publish or initialize',async()=>{
 const p={tenantId:'tenant',customerId:'account',sessionId:'session'};
 const intake=createIntake({admit:()=>false}),store=openActivationStore(':memory:',intake.policy),goals=openGoalStore(':memory:');
 const server=createApp(goals,undefined,{store,authorize:(r,c)=>['Bearer developer','Bearer operator'].includes(r.headers.authorization??'')&&c===p.customerId?p:null,isOperator:r=>r.headers.authorization==='Bearer operator',intake:async(principal,b)=>{try{const prepared=await intake.prepare(principal,b);return store.initialize(principal,prepared.context,prepared.plan);}finally{intake.release(principal);}}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const a=server.address() as {port:number};const root=`http://127.0.0.1:${a.port}/api/activation/v1/customers/`;
 const body={briefing:'FICTIONAL TEST: Backstage migration. SSO uses Okta but permissions remain unknown. GitHub monorepo and Confluence wiki.',outcome:'Review one existing workflow',agreedBy:'Fictional customer via test operator, test call',agreementConfirmed:true};
 const post=(path:string,token:string,value:unknown)=>fetch(root+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Role':'operator'},body:JSON.stringify(value)});
 try{
  assert.equal((await post('account/intake','developer',body)).status,403);
  assert.equal((await post('account/state','developer',{})).status,403);
  assert.equal((await post('other/intake','operator',body)).status,403);
  const response=await post('account/intake','operator',body);assert.equal(response.status,200);const s=await response.json();
  assert.equal(s.outcome.status,'unassessed');assert.match(s.context.constraints.join(' '),/Reported Identity and SSO: SSO uses Okta/);
  assert.match(s.plan.suggestedNextAction.description,/Backstage starting point/);
  assert.deepEqual(await (await fetch(root+'account/state',{headers:{Authorization:'Bearer operator'}})).json(),s);
  const dev=await (await fetch(root+'account/state',{headers:{Authorization:'Bearer developer'}})).json(),raw=JSON.stringify(dev);
  assert.equal(dev.revision,s.revision);assert.ok(dev.handoff,'developer receives the server-built handoff');
  for(const leak of ['FICTIONAL TEST','Fictional customer via test operator','SSO uses Okta but permissions'])assert.ok(!raw.includes(leak),`developer state must not contain: ${leak}`);
  assert.equal((await post('account/intake','operator',body)).status,409);
  assert.throws(()=>store.get({...p,tenantId:'other'}));
 }finally{await new Promise<void>(r=>server.close(()=>r()));store.close();goals.close();}
});
