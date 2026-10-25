import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from './store.mjs';
import {conversationRoute} from './routes.mjs';
test('durability, multi-turn preservation, stages, errors and concurrent revisions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'phase-a-'));try{
 const store=createStore(dir),s=await store.create();
 const request={contractVersion:'1.0.0',expectedRevision:0,content:'Automate deployment',confirmedConstraints:['Keep tests unchanged']};
 const first=await store.append(s.conversationId,request);
 const second=await store.append(s.conversationId,{...request,expectedRevision:1,content:'Use staging',confirmedConstraints:[]});
 assert.deepEqual(second.constraints,first.constraints);assert.deepEqual(second.developerNeed.constraints,first.constraints);
 assert.equal(second.evidence[0].status,'developer_statement');assert.equal(second.boundary,'read_only');assert.deepEqual(second.candidateSolutions,[]);
 assert.deepEqual(second.events.map(e=>e.stage),['understanding_request','ready','understanding_request','ready']);
 assert.deepEqual(await createStore(dir).read(s.conversationId),second);
 const results=await Promise.allSettled([store.append(s.conversationId,{...request,expectedRevision:2}),store.append(s.conversationId,{...request,expectedRevision:2})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT');
 for(const input of [{},{...request,expectedRevision:3,content:''},{...request,expectedRevision:3,confirmedConstraints:[12]},{...request,expectedRevision:3,answersQuestionId:'fake'}])assert.equal((await conversationRoute(store,'POST',`/api/conversations/v1/${s.conversationId}/messages`,input)).status,400);
 assert.equal((await conversationRoute(store,'GET','/api/conversations/v1/missing')).status,404);
 assert.equal((await conversationRoute(store,'POST','/api/conversations/v1',{contractVersion:'1.0.0'})).status,201);
 assert.equal((await conversationRoute(store,'GET',`/api/conversations/v1/${s.conversationId}`)).status,200);
 }finally{await rm(dir,{recursive:true,force:true});}
});
