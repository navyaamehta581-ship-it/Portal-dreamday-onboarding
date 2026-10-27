/** Local test harness only. All agreement/receipt records are TEST DOUBLES, never real admission. */
import {isDeepStrictEqual} from 'node:util';
import {readFileSync,writeFileSync} from 'node:fs';
import fixtures from '../../contracts/activation/v1/fixtures.json' with {type:'json'};
import {openActivationStore} from '../../services/workflow-api/src/activation/store.ts';
import {openGoalStore} from '../../services/workflow-api/src/store.ts';
import {createApp} from '../../services/workflow-api/src/app.ts';
import {createBlockerReports} from '../../services/workflow-api/src/activation/reports.ts';
import {registryPolicy} from '../../services/workflow-api/src/activation/admission.ts';
import {createReplanWorker} from '../../services/workflow-api/src/activation/worker.ts';
const p={tenantId:'browser-test',customerId:'ledger',sessionId:'session-ledger'};
const context=structuredClone(fixtures.ledger.context),plan=structuredClone(fixtures.ledger.plan),replacement=structuredClone(fixtures.blockerReplan.plan),blocker=structuredClone(fixtures.blockerReplan.blocker);
context.briefing='SIMULATED ACCEPTANCE — no real customer agreement. '+context.briefing;
const records=new Map();
for(const obj of [context,plan,replacement,blocker])for(const e of obj.evidence){
 if(records.has(e.id)){Object.assign(e,records.get(e.id));continue;}
 e.sourceRevision='a'.repeat(40);e.source='test-adapter/'+e.id;e.producer='test-adapter';e.observedAt=new Date().toISOString();e.proof.reference='test://'+e.id;records.set(e.id,structuredClone(e));
}
const policy={admitContext:(_p,c)=>isDeepStrictEqual(c,context),admitPlan:(_p,_c,a)=>isDeepStrictEqual(a,plan)||isDeepStrictEqual(a,replacement),admit:(_p,e)=>isDeepStrictEqual(records.get(e.id),e)};
let store;const reports=createBlockerReports(policy,()=>store);store=openActivationStore('/private/tmp/activation-browser.sqlite',reports.policy);try{store.get(p);}catch{store.initialize(p,context,plan);}
writeFileSync('/private/tmp/activation-browser-command.json',JSON.stringify(blocker));
const snapshot=JSON.parse(readFileSync(new URL('../../docs/activation/evidence/followup-github-observation.json',import.meta.url),'utf8'));
const observationPolicy=registryPolicy([{principal:p,context,plans:[plan],evidence:snapshot.records,expiresAt:new Date(Date.now()+3600000).toISOString()}]);
const originalAdmit=policy.admit;policy.admit=(p,e,purpose)=>originalAdmit(p,e)||observationPolicy.admit(p,e,purpose);
if(!store.get(p).evidence.some(e=>e.id===snapshot.records[0].id)){const current=store.get(p);store.progress(p,{contractVersion:'1.0.0',customerId:p.customerId,id:'fresh-github-observation',developerSessionId:p.sessionId,expectedRevision:current.revision,revision:current.revision+1,planRevision:current.planRevision,milestoneId:current.milestone.id,milestoneStatus:current.milestone.status,valueDemonstrated:'No customer outcome assessed; real repository observation only',needsChris:false,transitions:[],evidence:snapshot.records});}
const goals=openGoalStore(':memory:');const server=createApp(goals,undefined,{store,reportBlocker:reports.submit,authorize:r=>r.headers.authorization==='Bearer browser-test-token-0000000000000000'?p:null});
const handler=server.listeners('request')[0] as Function;
server.removeAllListeners('request');server.on('request',(req,res)=>{
 let mode='';try{mode=readFileSync('/private/tmp/activation-browser-mode','utf8').trim();}catch{}
 if(mode==='conflict'&&req.method==='POST'){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'REVISION_CONFLICT'}}));return;}
 if(mode==='timeout'&&req.method==='GET'){setTimeout(()=>{if(!res.destroyed)handler(req,res);},32000);return;}
 handler(req,res);
});
const worker=createReplanWorker(store,async(_p,s,e)=>reports.replacement(s,e)??replacement,10000);const stop=worker.start();
server.listen(7007,'127.0.0.1',()=>console.log('SIMULATED browser acceptance on 7007'));
process.on('SIGTERM',()=>server.close(async()=>{await stop();store.close();goals.close();}));
