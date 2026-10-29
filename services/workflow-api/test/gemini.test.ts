/** Gemini client against a stand-in for the generateContent endpoint (no network): request shape, key handling,
 * structured output, failures as codes, and the deployment's daily budget. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGemini} from '../src/llm/gemini.ts';
import {openAiBudget} from '../src/llm/budget.ts';
import {ModelError} from '../src/llm/ollama.ts';

const KEY='test-key-not-real';
type Reply=(body:any,n:number)=>Response;
function stub(reply:Reply){
 const calls:{url:string;headers:Headers;body:any}[]=[];
 const fetchImpl=(async(input:string|URL|Request,init?:RequestInit)=>{const body=JSON.parse(String(init!.body));calls.push({url:String(input),headers:new Headers(init!.headers),body});return reply(body,calls.length-1);}) as typeof fetch;
 return {fetchImpl,calls};
}
const ok=(value:unknown,finishReason='STOP')=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(value)}]},finishReason}],usageMetadata:{promptTokenCount:120,candidatesTokenCount:30}}),{status:200});
const task={name:'t',system:'Answer as JSON.',user:'Question',schema:{type:'object',properties:{answer:{type:'string',maxLength:10}},required:['answer']},numPredict:600,
 validate:(v:unknown)=>{if(typeof (v as any)?.answer!=='string')throw new ModelError('INVALID_MODEL_OUTPUT','schema_mismatch');return v as {answer:string};}};
const gemini=(f:typeof fetch,extra={})=>createGemini({apiKey:KEY,model:'gemini-2.5-flash',timeoutMs:2000,retries:1,maxOutputTokens:8192,apiOrigin:'http://127.0.0.1:9',...extra},f);
const code=async(p:Promise<unknown>)=>{try{await p;return 'none';}catch(e){return (e as ModelError).code+((e as ModelError).detail?':'+(e as ModelError).detail:'');}};

test('structured JSON request: key in a header only, schema attached, thinking off for 2.5 Flash, answer fitted and validated',async()=>{
 const s=stub(()=>ok({answer:'a very long answer'}));
 const r=await gemini(s.fetchImpl).run(task);
 assert.equal(r.value.answer,'a very lo…','schema limits applied');
 const c=s.calls[0];
 assert.equal(c.url,'http://127.0.0.1:9/v1beta/models/gemini-2.5-flash:generateContent');assert.ok(!c.url.includes(KEY));
 assert.equal(c.headers.get('x-goog-api-key'),KEY);
 assert.equal(c.body.generationConfig.responseMimeType,'application/json');assert.deepEqual(c.body.generationConfig.responseJsonSchema,task.schema);
 assert.deepEqual(c.body.generationConfig.thinkingConfig,{thinkingBudget:0});assert.equal(c.body.generationConfig.maxOutputTokens,1200);
 assert.equal(c.body.systemInstruction.parts[0].text,'Answer as JSON.');assert.equal(r.stats.promptTokens,120);
});

test('a rejected schema falls back to plain JSON mode once; an invalid key is a configuration error, never retried',async()=>{
 const s=stub((b,n)=>n===0?new Response(JSON.stringify({error:{status:'INVALID_ARGUMENT'}}),{status:400}):ok({answer:'ok'}));
 assert.equal((await gemini(s.fetchImpl).run(task)).value.answer,'ok');
 assert.equal(s.calls[1].body.generationConfig.responseJsonSchema,undefined);assert.match(s.calls[1].body.systemInstruction.parts[0].text,/JSON Schema/);
 const bad=stub(()=>new Response(JSON.stringify({error:{status:'INVALID_ARGUMENT',details:[{reason:'API_KEY_INVALID'}]}}),{status:400}));
 assert.equal(await code(gemini(bad.fetchImpl).run(task)),'MODEL_NOT_CONFIGURED:invalid_api_key');assert.equal(bad.calls.length,1);
 assert.equal(await code(createGemini({apiKey:null,model:'gemini-2.5-flash',timeoutMs:2000,retries:0,maxOutputTokens:8192}).run(task)),'MODEL_NOT_CONFIGURED');
 assert.equal(await code(gemini(bad.fetchImpl,{apiOrigin:'https://example.com'}).run(task)),'MODEL_NOT_CONFIGURED','only Google or a loopback test origin');
});

test('failures are codes: rate limit, outage (retried once), timeout, truncation (retried with more room), blocked, invalid JSON',async()=>{
 assert.equal(await code(gemini(stub(()=>new Response('{}',{status:429})).fetchImpl).run(task)),'MODEL_RATE_LIMITED');
 const down=stub(()=>new Response('{}',{status:503}));
 assert.equal(await code(gemini(down.fetchImpl).run(task)),'MODEL_UNAVAILABLE');assert.equal(down.calls.length,2);
 const slow=(async(_:unknown,init?:RequestInit)=>new Promise((_r,reject)=>init!.signal!.addEventListener('abort',()=>reject(Object.assign(new Error('t'),{name:'TimeoutError'}))))) as typeof fetch;
 assert.equal(await code(gemini(slow,{timeoutMs:1000}).run(task)),'MODEL_TIMEOUT');
 const cut=stub((b,n)=>n===0?ok({answer:'x'},'MAX_TOKENS'):ok({answer:'x'}));
 assert.equal((await gemini(cut.fetchImpl).run(task)).value.answer,'x');assert.equal(cut.calls[1].body.generationConfig.maxOutputTokens,2400);
 assert.equal(await code(gemini(stub(()=>ok({answer:'x'},'SAFETY')).fetchImpl,{retries:0}).run(task)),'INVALID_MODEL_OUTPUT:blocked');
 assert.equal(await code(gemini(stub(()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'not json'}]},finishReason:'STOP'}]}))).fetchImpl,{retries:0}).run(task)),'INVALID_MODEL_OUTPUT:invalid_json');
 assert.equal(await code(gemini(stub(()=>ok({answer:'x'})).fetchImpl).run({...task,user:'x'.repeat(70000)})),'CONTEXT_LIMIT');
});

test('the daily budget is checked before every request and survives a restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'budget-'));
 try{
  let day=Date.parse('2026-10-29T10:00:00Z');
  let budget=openAiBudget(join(dir,'db.sqlite'),2,()=>day);
  const s=stub(()=>ok({answer:'ok'}));
  const g=gemini(s.fetchImpl,{admit:()=>budget.take()});
  await g.run(task);await g.run(task);
  assert.equal(await code(g.run(task)),'AI_DAILY_LIMIT');assert.equal(s.calls.length,2,'no request beyond the cap');
  budget.close();budget=openAiBudget(join(dir,'db.sqlite'),2,()=>day);
  assert.equal(budget.used(),2);assert.equal(await code(g.run(task)),'AI_DAILY_LIMIT');
  day+=24*3600_000;await g.run(task);assert.equal(budget.used(),1,'a new UTC day starts again');
  const zero=openAiBudget(join(dir,'zero.sqlite'),0);assert.throws(()=>zero.take());zero.close();
  budget.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
