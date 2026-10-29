/** Explicit fictional loopback demo. Never imported by the normal server. */
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {developmentActivation} from '../src/activation/dev.ts';
import {openGoalStore} from '../src/store.ts';
import {createApp} from '../src/app.ts';
import type {AdmissionBundle} from '../src/activation/admission.ts';
import type {CustomerContext, ActivationPlan} from '../../../contracts/activation/v1/types.ts';
import fixtures from '../../../contracts/activation/v1/fixtures.json' with {type:'json'};

if(process.env.NODE_ENV==='production')throw Error('Fictional demo is forbidden in production');
if(process.versions.node.split('.')[0]!=='24')throw Error('Use Node 24.12 or later in the Node 24 line');
const command=process.argv[2]??'start';
if(!['start','token','operator-token','handoff'].includes(command))throw Error('Usage: npm run demo [-- token | operator-token | handoff]');
process.umask(0o077);
const directory=resolve(process.env.ACTIVATION_DEMO_DIR??join(tmpdir(),`spotify-fictional-demo-${process.getuid?.()??'local'}`));
const operatorTokenPath=join(directory,'operator-token');
const tokenPath=join(directory,'token');
const admissionPath=join(directory,'admission.json');
// Optional second fictional customer for isolation checks; the prefix keeps it visibly fictional.
const customerId=process.env.ACTIVATION_DEMO_CUSTOMER_ID??'fictional-recommendation-demo';
if(!/^fictional-[a-z0-9-]{1,60}$/.test(customerId))throw Error('ACTIVATION_DEMO_CUSTOMER_ID must start with fictional- and use lowercase letters, digits or hyphens');
if(!existsSync(directory))mkdirSync(directory,{mode:0o700});
function privatePath(path:string, directory=false) {
 const s=lstatSync(path);
 if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile())||(s.mode&0o077)!==0||(process.getuid&&s.uid!==process.getuid()))throw Error('Demo files must be privately owned, without symlinks or group/other access');
}
privatePath(directory,true);
if(!existsSync(admissionPath)) {
 if(command==='token'||command==='operator-token')throw Error('Start the demo first');
 if(existsSync(tokenPath))throw Error('Incomplete setup: choose a fresh ACTIVATION_DEMO_DIR');
 const principal={tenantId:'fictional-demo',customerId,sessionId:'fictional-local-session'};
 const context=structuredClone(fixtures.orbit.context) as CustomerContext,plan=structuredClone(fixtures.orbit.plan) as ActivationPlan;
 context.customerId=plan.customerId=principal.customerId;
 context.briefing='FICTIONAL LOCAL DEMO. Chris and the customer are invented. A new team wants to review its first recommendation-service onboarding path. No real customer agreement, Portal access, GitHub inspection, deployment or adoption is claimed.';
 context.agreedGoal.text='Fictional exercise: review the first backend onboarding path';
 context.agreedGoal.agreedBy='Fictional customer played by the local demo operator';
 context.agreedGoal.agreedAt=new Date().toISOString();
 context.constraints.push('Fictional local exercise only; no external writes or real approval');
 // These are newly created fictional reports, never refreshed GitHub observations or receipts.
 const records=new Map();
 for(const item of [context,plan])for(const e of item.evidence){
  e.source='fictional-local-demo:'+e.id;e.producer='fictional-demo-operator';
  e.sourceRevision='fictional-demo-v1';e.observedAt=context.agreedGoal.agreedAt;
  e.scope='Fictional planning exercise only';e.claim='FICTIONAL DEMO: '+e.claim;
  records.set(e.id,e);
 }
 const bundle:AdmissionBundle={principal,context,plans:[plan],evidence:[...records.values()],expiresAt:new Date(Date.now()+8*3600000).toISOString()};
 writeFileSync(tokenPath,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
 writeFileSync(admissionPath,JSON.stringify([bundle],null,2),{mode:0o600,flag:'wx'});
}
privatePath(tokenPath);privatePath(admissionPath);
if(!existsSync(operatorTokenPath))writeFileSync(operatorTokenPath,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
privatePath(operatorTokenPath);
process.env.ACTIVATION_OPERATOR_TOKEN=readFileSync(operatorTokenPath,'utf8');
// Dream Day: the customer's Champion has a separate credential, held by the Portal session layer.
const championTokenPath=join(directory,'champion-token');
if(!existsSync(championTokenPath))writeFileSync(championTokenPath,randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});
privatePath(championTokenPath);
process.env.ACTIVATION_CHAMPION_TOKEN=readFileSync(championTokenPath,'utf8');
if(command==='operator-token'){process.stdout.write(process.env.ACTIVATION_OPERATOR_TOKEN+'\n');process.exit(0);}
const token=readFileSync(tokenPath,'utf8');
if(command==='token'){process.stdout.write(token+'\n');process.exit(0);}
const bundles=JSON.parse(readFileSync(admissionPath,'utf8')) as AdmissionBundle[];
if(bundles.length!==1||bundles[0].principal.customerId!==customerId||bundles[0].principal.tenantId!=='fictional-demo'||bundles[0].principal.sessionId!=='fictional-local-session')throw Error('Unexpected demo principal');
const bundle=bundles[0];
if(Date.parse(bundle.expiresAt)<=Date.now())throw Error('Eight-hour demo expired. Choose a fresh ACTIVATION_DEMO_DIR; old saved data is retained.');
// Ignore inherited live integrations and grants; this launcher cannot use them.
delete process.env.ACTIVATION_GITHUB_READ_SCOPES;
delete process.env.ACTIVATION_SETUP_APPROVAL_GRANTS;
delete process.env.GITHUB_READ_TOKEN;
delete process.env.OPENAI_API_KEY;
delete process.env.PORTAL_LLM_API_KEY;
process.env.ACTIVATION_INTAKE=command==='handoff'?'1':'0';
process.env.ACTIVATION_DEV='1';
process.env.ACTIVATION_DEV_TOKEN=token;
process.env.ACTIVATION_ADMISSION_PATH=admissionPath;
process.env.ACTIVATION_DATABASE_PATH=join(directory,'activation.sqlite');
for(const name of ['activation.sqlite','goals.sqlite'])if(existsSync(join(directory,name)))privatePath(join(directory,name));
const port=Number(process.env.PORT??7007);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
const goalPath=join(directory,'goals.sqlite');
const activation=developmentActivation(goalPath)!;
try{activation.options.store.get(bundle.principal);}catch(error){
 if(!(error instanceof Error)||!('code' in error)||error.code!=='NOT_FOUND')throw error;
 if(command!=='handoff')activation.options.store.initialize(bundle.principal,bundle.context,bundle.plans[0]);
}
const goals=openGoalStore(goalPath);
const frontendOrigin=process.env.ACTIVATION_DEMO_FRONTEND_ORIGIN??'http://127.0.0.1:5173';
if(!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(frontendOrigin))throw Error('Demo frontend must be an explicit loopback origin');
const app=createApp(goals,frontendOrigin,activation.options);
async function close(){await activation.close();goals.close();}
app.on('error',async()=>{await close();console.error('Demo could not listen; check PORT.');process.exitCode=1;});
app.listen(port,'127.0.0.1',()=>console.log(`FICTIONAL DEMO API: http://127.0.0.1:${port}\nCustomer ID: ${bundle.principal.customerId}\nPrivate data: ${directory}\nPortal: start it with the same ACTIVATION_DEMO_DIR (and ACTIVATION_DEMO_CUSTOMER_ID), open http://127.0.0.1:5173/ and choose a persona. Tokens stay server-side.\nFor a new handoff, start with npm run demo:handoff in a fresh ACTIVATION_DEMO_DIR.\nExpires: ${bundle.expiresAt}. ${process.env.PORTAL_LLM_PROVIDER==='ollama'?`Local model for analysis: ${process.env.OLLAMA_MODEL??'qwen3:4b'} (runs in the background; an analysis can take minutes)`:'Rule-based analysis (no model)'}. No GitHub access or execution grants.`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{app.closeAllConnections();app.close(()=>{void close();});});
