/** Six-step simulated acceptance. Agreement is a contract test double; GitHub observation is real. */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import fixtures from '../../contracts/activation/v1/fixtures.json' with {type:'json'};
import {createIntake} from '../../services/workflow-api/src/activation/intake.ts';
import {registryPolicy} from '../../services/workflow-api/src/activation/admission.ts';
import {createBlockerReports} from '../../services/workflow-api/src/activation/reports.ts';
import {openActivationStore,type ActivationStore} from '../../services/workflow-api/src/activation/store.ts';
const p={tenantId:'acceptance-test',customerId:'ledger',sessionId:'session-ledger'};
const dir=mkdtempSync(join(tmpdir(),'activation-walkthrough-')),filename=join(dir,'state.sqlite');
const context=structuredClone(fixtures.ledger.context),plan=structuredClone(fixtures.ledger.plan);
context.briefing='SIMULATED ACCEPTANCE — fixture agreement only. '+context.briefing;
for(const obj of [context,plan])for(const e of obj.evidence){e.source='test-adapter';e.sourceRevision='a'.repeat(40);e.producer='test-adapter';e.proof.reference='none';}
const snapshot=JSON.parse(readFileSync(new URL('../../docs/activation/evidence/followup-github-observation.json',import.meta.url),'utf8'));
const registry=registryPolicy([{principal:p,context,plans:[plan],evidence:snapshot.records,expiresAt:new Date(Date.now()+3600000).toISOString()}]);
const base={admitContext:(_p,c)=>isDeepStrictEqual(c,context),admitPlan:(_p,_c,a)=>isDeepStrictEqual(a,plan),admit:(p,e,purpose)=>[...context.evidence,...plan.evidence].some(r=>isDeepStrictEqual(r,e))||registry.admit(p,e,purpose)};
let store:ActivationStore;const reports=createBlockerReports(base,()=>store);store=openActivationStore(filename,reports.policy);
const previews=createIntake({admit:()=>false});
const first=await previews.prepare(p,{briefing:'A new service needs a documented template readiness checklist. No writes permitted.',outcome:'Review prerequisites',agreedBy:'DEMO participants',agreementMode:'simulated',agreementConfirmed:false});
const second=await previews.prepare(p,{briefing:'Existing Java onboarding needs a documentation review without repository writes.',outcome:'Review onboarding guidance',agreedBy:'DEMO participants',agreementMode:'simulated',agreementConfirmed:false});
assert.notEqual(first.plan.suggestedNextAction.description,second.plan.suggestedNextAction.description);assert.equal(previews.policy.admitContext!(p,first.context),false);
store.initialize(p,context as never,plan as never);
const input={id:'developer:walkthrough',expectedRevision:0,planRevision:0,message:'DEMO developer report: expected repository access is unavailable. Preserve no external writes.'};
reports.submit(p,input);const blocked=store.get(p);store.close();
// Separate process recovers only the durable command; no in-memory admission survives.
const recovery=spawnSync(process.execPath,['--input-type=module','-e',`
import {openActivationStore} from ${JSON.stringify(new URL('../../services/workflow-api/src/activation/store.ts',import.meta.url).href)};
import {createBlockerReports} from ${JSON.stringify(new URL('../../services/workflow-api/src/activation/reports.ts',import.meta.url).href)};
import {createReplanWorker} from ${JSON.stringify(new URL('../../services/workflow-api/src/activation/worker.ts',import.meta.url).href)};
let store;const reports=createBlockerReports({admit:()=>false},()=>store);store=openActivationStore(${JSON.stringify(filename)},reports.policy);await createReplanWorker(store,async(p,s,e)=>reports.replacement(s,e)).tick();store.close();`],{encoding:'utf8'});
assert.equal(recovery.status,0,recovery.stderr);store=openActivationStore(filename,reports.policy);const ready=store.get(p);assert.equal(ready.replan.status,'ready');assert.equal(ready.planRevision,1);
// Actual pinned observation admission, no transitions or invented proof.
const event={contractVersion:'1.0.0',customerId:p.customerId,id:'observe-github',revision:3,expectedRevision:2,planRevision:1,developerSessionId:p.sessionId,milestoneId:ready.milestone.id,milestoneStatus:'pending',valueDemonstrated:'No customer value assessed; observation only',needsChris:false,transitions:[],evidence:snapshot.records};
assert.throws(()=>store.progress(p,{...event,evidence:[{...snapshot.records[0],claim:'Invented passing CI'}]} as never),/INVALID_EVIDENCE/);
const observed=store.progress(p,event as never);assert.equal(observed.outcome.status,'unassessed');
const technicalReport=`# Pinned GitHub configuration review\n\nSource: ${snapshot.records[0].source}\n\n${snapshot.records[0].claim}\n\nObserved file blob: ${snapshot.blobSha}.\n\nThis review confirms declared workflow steps only. It does not prove remote CI success, deployment, approval or adoption.\n`;
writeFileSync(join(dir,'technical-review.md'),technicalReport);const digest=createHash('sha256').update(technicalReport).digest('hex');
store.close();store=openActivationStore(filename,reports.policy);assert.deepEqual(store.get(p),observed);assert.equal(reports.submit(p,input).revision,3);
const summary={mode:'SIMULATED agreement and customer context; real read-only GitHub observation',blockedRealAcceptance:['Actual Chris/customer agreement and customer outcome evidence unavailable','No production identity provider or external execution credentials used','Hosted interpretation not exercised; deterministic fallback validated'],steps:[{step:1,briefing:context.briefing,agreement:'Contract fixture test double; not real agreement'},{step:2,personalizedPreviews:[first.plan.suggestedNextAction.description,second.plan.suggestedNextAction.description]},{step:3,workspaceRevision:0},{step:4,blockerRevision:blocked.revision,recoveredPlanRevision:ready.planRevision,separateProcessExit:recovery.status},{step:5,source:snapshot.records[0].source,artifact:join(dir,'technical-review.md'),sha256:digest,technicalVerification:'Exact bytes admitted; tampered claim rejected; artifact hash calculated locally. No execution receipt fabricated.'},{step:6,goal:observed.context.agreedGoal.text,outcome:observed.outcome.status,chrisHelp:observed.chrisHelp,evidenceIds:observed.evidence.map(e=>e.id),restartExact:true}],database:filename};
writeFileSync(join(dir,'walkthrough.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));store.close();
