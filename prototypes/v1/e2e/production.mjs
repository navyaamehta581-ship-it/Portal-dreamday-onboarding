/** Real browser against the production server (services/workflow-api/src/production.ts) serving the built Portal,
 * as the Docker image runs it: passphrase gate, demo rooms, persona sign-in, Chris's workspace, room isolation and
 * sharing, a restart with persistence, leaving a room, health. No network: no Gemini key, so analysis is rule-based
 * and labelled as such. Build first: npm run build. */
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const frontend=fileURLToPath(new URL('..',import.meta.url)),repo=resolve(frontend,'../..');
if(!existsSync(join(frontend,'dist/index.html')))throw Error('Run npm run build first');
const data=mkdtempSync(join(tmpdir(),'portal-production-e2e-'));
const PASS='e2e demo passphrase',SECRET='e2e-'+'x'.repeat(60);
let child,browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(p){
 child=spawn(process.execPath,['services/workflow-api/src/production.ts'],{cwd:repo,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'production',PORT:String(p),PORTAL_DATA_DIR:data,PORTAL_ALLOW_HTTP:'1',
  PORTAL_DEMO_PASSPHRASE:PASS,PORTAL_SESSION_SECRET:SECRET,PORTAL_LLM_PROVIDER:'gemini',GEMINI_MODEL:'gemini-2.5-flash',PORTAL_AI_DAILY_REQUEST_LIMIT:'300',
  PORTAL_DEMO_ROOM_LIMIT:'50',PORTAL_DEMO_ROOM_TTL_HOURS:'24',ACTIVATION_EVIDENCE_MAX_AGE_HOURS:'24'}});
 let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
 const end=Date.now()+20000;while(Date.now()<end){if(out.includes('"event":"started"'))return ()=>out;if(child.exitCode!==null)throw Error(out);await new Promise(r=>setTimeout(r,100));}
 throw Error('Startup timeout: '+out);
}
async function stop(){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
try{
 const p=await port(),url=`http://127.0.0.1:${p}`;
 let logs=await start(p);
 const health=await (await fetch(url+'/healthz')).json();
 assert.equal(health.status,'ok');assert.equal(health.checks.ai,'not_configured (GEMINI_API_KEY missing)');
 browser=await chromium.launch({headless:true});
 const errors=[];const watch=page=>{page.on('pageerror',e=>errors.push(e.message));return page;};
 const a=watch(await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage());
 // The gate comes first, for every path.
 await a.goto(url+'/operator');assert.equal(new URL(a.url()).pathname,'/demo-gate');
 assert.ok((await a.locator('body').innerText()).includes('Every customer, person and repository here is invented'));
 await a.getByLabel('Demo passphrase').fill('wrong passphrase');await a.getByRole('button',{name:'Enter the demo'}).click();
 await a.getByText('That passphrase isn’t right.').waitFor();
 await a.getByLabel('Demo passphrase').fill(PASS);await a.getByRole('button',{name:'Enter the demo'}).click();
 await a.getByRole('button',{name:'Get started'}).waitFor();
 const bar=a.getByRole('status',{name:'Demo room'});await bar.waitFor();
 const room=/Room ([A-Z2-9]{5}-[A-Z2-9]{5})/.exec(await bar.innerText())[1];
 // Chris adds customer information and runs the analysis (rule-based here: no Gemini key is configured).
 await a.getByRole('button',{name:'Get started'}).click();await a.getByLabel(/^Chris/).check();await a.getByRole('button',{name:'Continue'}).click();
 await a.waitForURL(url+'/operator');
 await a.getByLabel('Information 1 text').fill('FICTIONAL: Maya Chen: nobody can tell who owns payments-api. Let’s pilot with payments-api on GitHub.');
 await a.getByLabel('Information 1 name').fill('Discovery call');
 await a.getByRole('button',{name:'Save information'}).click();await a.getByText(/^Saved \d/).waitFor();
 await a.getByRole('button',{name:'Analyze customer'}).click();
 await a.getByText(/rule-based analysis \(no model configured\)/).waitFor({timeout:20000});
 // Another visitor gets their own room and sees none of it; joining with the code shares it.
 const b=watch(await (await browser.newContext()).newPage());
 await b.goto(url+'/');await b.getByLabel('Demo passphrase').fill(PASS);await b.getByRole('button',{name:'Enter the demo'}).click();
 await b.getByRole('status',{name:'Demo room'}).waitFor();
 assert.ok(!(await b.getByRole('status',{name:'Demo room'}).innerText()).includes(room));
 await b.goto(url+'/login');await b.getByLabel(/^Chris/).check();await b.getByRole('button',{name:'Continue'}).click();await b.waitForURL(url+'/operator');
 await b.getByLabel('Information 1 text').waitFor();assert.equal(await b.getByLabel('Information 1 text').inputValue(),'','a separate room starts empty');
 const c=watch(await (await browser.newContext()).newPage());
 await c.goto(url+'/');await c.getByLabel('Demo passphrase').fill(PASS);await c.getByLabel('Room code (optional)').fill(room.toLowerCase());await c.getByRole('button',{name:'Enter the demo'}).click();
 await c.goto(url+'/login');await c.getByLabel(/^Chris/).check();await c.getByRole('button',{name:'Continue'}).click();await c.waitForURL(url+'/operator');
 await c.getByText(/rule-based analysis/).first().waitFor();
 assert.match(await c.getByLabel('Information 1 text').inputValue(),/payments-api/,'the shared code joins the same room');
 // Restart: the room, the sign-in and the saved work survive.
 await stop();logs=await start(p);
 await a.reload();await a.getByLabel('Information 1 text').waitFor();
 assert.match(await a.getByLabel('Information 1 text').inputValue(),/payments-api/);assert.equal(new URL(a.url()).pathname,'/operator');
 // Leaving the room returns to the gate.
 await a.getByRole('button',{name:'Leave room'}).click();await a.waitForURL(url+'/demo-gate');
 await a.goto(url+'/operator');assert.equal(new URL(a.url()).pathname,'/demo-gate');
 // Phone width: the gate fits.
 const m=watch(await (await browser.newContext({viewport:{width:390,height:844}})).newPage());await m.goto(url+'/demo-gate');
 assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 assert.deepEqual(errors,[]);
 for(const secret of [PASS,SECRET])assert.ok(!logs().includes(secret),'no secrets in logs');
 console.log('PASS: production server — gate (wrong and right passphrase), own room with shareable code, Chris saves and analyzes (rule-based, labelled), second visitor isolated, code joins the room, restart keeps room/sign-in/work, leave returns to the gate, health, phone width, no secrets in logs.');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();if(child&&child.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});}
