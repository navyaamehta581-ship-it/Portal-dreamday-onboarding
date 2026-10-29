/** Shared harness for the Phase 5–6 HTTP tests: the real stores and services behind the activation routes, one
 * credential per persona, and a local stub of Ollama's /api/chat (a fixed reply, not a model). */
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {createServer,type IncomingMessage} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {HandoffRecord,ReviewDraft,SourceInput,TeamProgress} from '../../../../contracts/activation/v1/handoff.ts';
import {interpretRuleBased} from '../../src/activation/handoff/interpret.ts';
import {proposeMilestones} from '../../src/activation/handoff/milestones.ts';
import type {Analysis,StageListener} from '../../src/activation/handoff/intelligence.ts';
import {createOllama} from '../../src/llm/ollama.ts';

export const CALL='Maya Chen: Nobody can tell who owns a service and the runbooks are missing.\nMaya Chen: Let’s pilot with payments-api on GitHub.';
export const NOTES='Opportunity: $300K ARR, stage: technical validation. Her VP thinks Backstage is a nice-to-have. Jamie Park (AE) owns the renewal.';
export const PRIVATE=['300K','ARR','nice-to-have','VP thinks','Jamie','renewal','technical validation','My pricing notes'];
export const rule=async(s:SourceInput[],onStage?:StageListener):Promise<Analysis>=>{onStage?.('interpreting',null);const understanding=interpretRuleBased(s);onStage?.('planning',null);return {understanding,proposal:proposeMilestones(understanding)};};

/** A stand-in for Ollama's /api/chat: records each request, answers after an optional delay. */
export async function ollamaStub(reply:(body:any)=>unknown,delay=0){
 const requests:any[]=[];
 const server=createServer(async(req:IncomingMessage,res)=>{let d='';for await(const c of req)d+=c;const body=JSON.parse(d);requests.push(body);
  if(delay)await new Promise(r=>setTimeout(r,delay));
  res.end(JSON.stringify({done:true,done_reason:'stop',eval_count:80,eval_duration:1e9,message:{content:JSON.stringify(reply(body))}}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${(server.address() as {port:number}).port}`,requests,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}

export type Call=(customer:string,path:string,token:string,body?:unknown,actor?:string)=>Promise<{status:number;json:any;raw:string}>;
export async function harness({file=':memory:',modelUrl=null as string|null,timeoutMs=5000,evidence=[] as string[]}={}){
 const {createApp}=await import('../../src/app.ts');const {openGoalStore}=await import('../../src/store.ts');
 const {openActivationStore}=await import('../../src/activation/store.ts');const {createIntake}=await import('../../src/activation/intake.ts');
 const {openHandoffStore}=await import('../../src/activation/handoff/store.ts');const {createHandoffService}=await import('../../src/activation/handoff/service.ts');
 const {createWorkService,openWorkStore}=await import('../../src/activation/handoff/work.ts');const {createAika}=await import('../../src/activation/handoff/aika.ts');
 const intake=createIntake({admit:()=>false});
 const store=openActivationStore(file,intake.policy),handoffs=openHandoffStore(file),workStore=openWorkStore(file),goals=openGoalStore(':memory:');
 const handoff=createHandoffService({handoffs,store:()=>store,analyze:rule,stage:intake.stage,release:intake.release});
 const work=createWorkService({published:p=>handoffs.published(p),work:workStore,verifiedEvidence:p=>p.customerId==='northstar'?evidence:[]});
 const aika=createAika({model:modelUrl?createOllama({endpoint:modelUrl,model:'qwen3:1.7b',timeoutMs,retries:0,numCtx:8192}):null,work,
  publishedRecord:p=>handoffs.all(p).filter(r=>r.status==='published').at(-1)??null,repositoryEvidence:()=>[]});
 const north={tenantId:'t',customerId:'northstar',sessionId:'s'},lumen={...north,customerId:'lumen'};
 // One credential per developer (identity), plus the shared developer credential, the Champion and Chris.
 const tokens:Record<string,{p:typeof north;role:'dev'|'op'|'champ';name?:string}>={dev:{p:north,role:'dev'},op:{p:north,role:'op'},champ:{p:north,role:'champ'},
  alex:{p:north,role:'dev',name:'Alex Rivera'},jordan:{p:north,role:'dev',name:'Jordan Lee'},'lumen-alex':{p:lumen,role:'dev',name:'Alex Rivera'},'lumen-champ':{p:lumen,role:'champ'}};
 const who=(r:{headers:{authorization?:string}})=>tokens[(r.headers.authorization??'').replace('Bearer ','')];
 const server=createApp(goals,undefined,{store,handoff,work,aika,championApproval:true,authorize:(r,c)=>who(r)?.p.customerId===c?who(r)!.p:null,
  isOperator:r=>who(r)?.role==='op',isChampion:r=>who(r)?.role==='champ',developerName:r=>who(r)?.name??null});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/activation/v1/customers/`;
 const call:Call=async(customer,path,token,body,actor)=>{const r=await fetch(base+customer+'/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(actor?{'X-Portal-Actor':actor}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();return {status:r.status,json:raw?JSON.parse(raw):null,raw};};
 return {call,close:async()=>{await new Promise<void>(r=>server.close(()=>r()));store.close();handoffs.close();workStore.close();goals.close();}};
}

/** Chris submits; Maya assigns Alex the repository assessment and Jordan the dependent discoverability check, and approves. */
export async function approvedPlan(call:Call,approve=true){
 await call('northstar','handoff-workspace','op',{expectedRevision:0,sources:[{type:'conversation',label:'Discovery call',text:CALL},{type:'chris_notes',label:'My pricing notes',text:NOTES}]});
 await call('northstar','handoff-analyses','op',{workspaceRevision:1});
 for(let i=0;i<50&&(await call('northstar','handoff-analyses','op')).json.job.status==='running';i++)await new Promise(r=>setTimeout(r,5));
 const record:HandoffRecord=(await call('northstar','handoff','op')).json.drafts[0];
 const m=(id:string,title:string,assignee:string,dependsOn:string[]=[])=>({id,title,description:`${title} for the pilot`,system:'payments-api',actions:[`Start ${title}`,'Record what was found'],completionCriteria:['Each item is marked verified, missing or inaccessible'],assignee,role:'developer',dependsOn,origin:'ai' as const});
 const review:ReviewDraft={...record.review!,goals:[{id:'g1',text:'Establish a service-readiness baseline for payments-api',origin:'ai'}],questions:[{id:'q1',text:'Which CI system deploys payments-api?',origin:'ai'}],
  stakeholders:[{id:'p1',name:'Maya Chen',role:'Champion',responsibilities:'Coordinate',basis:'stated',sources:[],technical:true},{id:'p2',name:'Alex Rivera',role:'Developer',responsibilities:'',basis:'stated',sources:[],technical:true},{id:'p3',name:'Jordan Lee',role:'Developer',responsibilities:'',basis:'stated',sources:[],technical:true}],
  milestones:[m('m-alex','Assess payments-api repository readiness','Alex Rivera'),m('m-jordan','Validate payments-api discoverability','Jordan Lee',['m-alex'])]};
 await call('northstar','handoff-reviews','op',{draft:1,expectedRevision:0,review});
 await call('northstar','handoff-submissions','op',{draft:1,reviewRevision:1,action:'submit',confirmed:true},'Chris');
 if(!approve)return;
 const view=(await call('northstar','champion-review','champ')).json;
 const r=await call('northstar','champion-decisions','champ',{draft:1,reviewRevision:view.reviewRevision,decision:'approve',confirmed:true},'Maya Chen');
 assert.equal(r.json.status,'published',r.raw);
}
export const work=async(call:Call,token:string)=>(await call('northstar','milestone-work',token)).json as TeamProgress;
/** Maya's coordination; the session layer names her in X-Portal-Actor. */
export const coordinate=(call:Call,token:string,milestoneId:string,expectedRevision:number,change:object,actor='Maya Chen')=>call('northstar','milestone-coordination',token,{milestoneId,expectedRevision,...change},actor);
export const update=(call:Call,token:string,milestoneId:string,expectedRevision:number,change:object)=>call('northstar','milestone-updates',token,{milestoneId,expectedRevision,...change});
