import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnose,validateRecommendation} from './diagnose.mjs';
const input={goal:'Help me add reliable CI',repository:'example/service'};
function github(paths,extra={}) {return async url => ({ok:true,json:async()=>url.includes('/git/blobs/')?{encoding:'base64',size:2,content:Buffer.from('{}').toString('base64')}:url.includes('/git/trees/')?{tree:paths.map(path=>({path,type:'blob',sha:'b'.repeat(40)})),...extra}:url.includes('/commits/')?{sha:'a'.repeat(40)}:{default_branch:'main'}});}
test('missing CI is based on complete immutable tree evidence',async()=>{const r=await diagnose(input,{fetchImpl:github(['package.json'])});assert.equal(r.diagnosis,'missing_ci');assert.match(r.evidence[1].source,/a{40}/);assert.deepEqual(r.actions[0].evidenceIds,['ci']);});
test('existing CI must be reused and not duplicated',async()=>{const r=await diagnose(input,{fetchImpl:github(['.github/workflows/test.yml'])});assert.equal(r.diagnosis,'existing_ci');assert.match(r.actions[0].title,/do not create a duplicate/);});
for(const status of [401,403,404,429]) test(`HTTP ${status} blocks recommendations rather than asserting absent CI`,async()=>{const r=await diagnose(input,{fetchImpl:async()=>({ok:false,status})});assert.equal(r.diagnosis,'blocked');assert.deepEqual(r.actions[0].evidenceIds,['access']);assert.match(r.evidence[0].observation,new RegExp(String(status)));});
test('truncated evidence cannot establish missing CI',async()=>assert.equal((await diagnose(input,{fetchImpl:github([],{truncated:true})})).diagnosis,'blocked'));
test('external CI is recognized',async()=>assert.equal((await diagnose(input,{fetchImpl:github(['Jenkinsfile'])})).diagnosis,'existing_ci'));
test('invalid repository never reaches network',async()=>{await assert.rejects(diagnose({...input,repository:'https://evil.test'},{fetchImpl:()=>assert.fail('network called')}));});
test('recommendation validator rejects invented citations',async()=>{const r=await diagnose(input,{fetchImpl:github([])});r.actions[0].evidenceIds=['invented'];assert.throws(()=>validateRecommendation(r));});
test('network failure remains unknown',async()=>assert.equal((await diagnose(input,{fetchImpl:async()=>{throw Error('secret token');}})).diagnosis,'blocked'));
test('unreadable CI content blocks the diagnosis',async()=>{const fake=github(['.github/workflows/test.yml']);const r=await diagnose(input,{fetchImpl:async url=>url.includes('/git/blobs/')?{ok:false,status:403}:fake(url)});assert.equal(r.diagnosis,'blocked');assert.match(r.evidence.at(-1).observation,/403/);});
test('package scripts are inspected without running them',async()=>{const fake=github(['package.json']);const r=await diagnose(input,{fetchImpl:async url=>url.includes('/git/blobs/')?{ok:true,json:async()=>({encoding:'base64',size:50,content:Buffer.from('{"scripts":{"test":"dangerous-command"}}').toString('base64')})}:fake(url)});assert.match(r.evidence.find(e=>e.id.startsWith('file-')).observation,/dangerous-command/);assert.equal(r.diagnosis,'missing_ci');});
test('failure cites exact encoded branch endpoint and never exposes credentials',async()=>{
 const token='secret-test-only';const calls=[];
 const r=await diagnose(input,{token,fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?{ok:true,json:async()=>({default_branch:'release/next'})}:{ok:false,status:404};}});
 assert.equal(r.evidence.at(-1).source,'https://api.github.com/repos/example/service/commits/release%2Fnext');
 assert.match(r.evidence.at(-1).observation,/default_branch; authentication configured/);
 assert.equal(calls[0].options.headers.Authorization,`Bearer ${token}`);assert.ok(!JSON.stringify(r).includes(token));
});
test('metadata failure identifies absent authentication and makes no branch request',async()=>{
 let calls=0;const r=await diagnose(input,{token:'',fetchImpl:async()=>{calls++;return {ok:false,status:404};}});
 assert.equal(calls,1);assert.match(r.evidence[0].observation,/metadata; authentication absent/);
});
