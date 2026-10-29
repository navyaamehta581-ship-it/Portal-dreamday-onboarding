/** Real browser against the production server (services/workflow-api/src/production.ts) serving the built Portal,
 * as the Docker image runs it on Render's free plan (PORTAL_STORAGE=ephemeral, the default): passphrase gate with the
 * temporary-data notice, demo rooms, persona sign-in, Chris's workspace and Insights, room isolation and sharing, a
 * process restart on the same container, a redeploy (fresh, empty storage) that ends the room honestly, leaving a
 * room, health. No network: no Gemini key, so analysis is rule-based and labelled as such. Build first: npm run build. */
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
let child,browser,dir=data;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(p){
 child=spawn(process.execPath,['services/workflow-api/src/production.ts'],{cwd:repo,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'production',PORT:String(p),PORTAL_DATA_DIR:dir,PORTAL_ALLOW_HTTP:'1',
  PORTAL_DEMO_PASSPHRASE:PASS,PORTAL_SESSION_SECRET:SECRET,PORTAL_LLM_PROVIDER:'gemini',GEMINI_MODEL:'gemini-2.5-flash',PORTAL_AI_DAILY_REQUEST_LIMIT:'300',
  PORTAL_DEMO_ROOM_LIMIT:'50',PORTAL_DEMO_ROOM_TTL_HOURS:'24',ACTIVATION_EVIDENCE_MAX_AGE_HOURS:'24'}});
 let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
 const end=Date.now()+20000;while(Date.now()<end){if(out.includes('"event":"started"'))return ()=>out;if(child.exitCode!==null)throw Error(out);await new Promise(r=>setTimeout(r,100));}
 throw Error('Startup timeout: '+out);
}
async function stop(){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
// Entry: welcome → passphrase (optionally a shared room code) → persona selection.
async function enter(page,{room,welcome=true}={}){
 if(welcome){await page.getByRole('heading',{name:'Portal is ready for you'}).waitFor();await page.getByRole('link',{name:'Get started'}).click();}
 await page.getByLabel('Demo passphrase').fill(PASS);
 if(room){await page.getByText('Join a shared room').click();await page.getByLabel('Room code').fill(room);}
 await page.getByRole('button',{name:'Continue'}).click();
 await page.waitForURL(u=>new URL(u).pathname==='/login');await page.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
}
async function persona(page,name,path){await page.getByLabel(new RegExp('^'+name)).check();await page.getByRole('button',{name:'Continue'}).click();await page.waitForURL(u=>new URL(u).pathname===path);}
// The room lives in the top-bar demo menu.
async function openDemoMenu(page){const d=page.getByRole('dialog',{name:'Demo room'});if(!await d.isVisible())await page.getByRole('button',{name:'Fictional demo'}).click();await d.waitFor();return d;}
async function roomCode(page){const code=(await (await openDemoMenu(page)).getByLabel('Room code',{exact:true}).innerText()).trim();await page.keyboard.press('Escape');return code;}
try{
 const p=await port(),url=`http://127.0.0.1:${p}`;
 let logs=await start(p);
 const health=await (await fetch(url+'/healthz')).json();
 assert.equal(health.status,'ok');assert.equal(health.checks.ai,'not_configured (GEMINI_API_KEY missing)');
 assert.equal(health.checks.storageMode,'ephemeral');
 browser=await chromium.launch({headless:true});
 const errors=[];const watch=page=>{page.on('pageerror',e=>errors.push(e.message));return page;};
 const a=watch(await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage());
 // The gate comes first, for every path.
 await a.goto(url+'/operator');assert.equal(new URL(a.url()).pathname,'/demo-gate');
 // Welcome first, with both warnings; the passphrase is the second step.
 await a.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 const gate=await a.locator('body').innerText();
 assert.ok(gate.includes('Every customer, person and repository here is invented'));
 assert.ok(gate.includes('Temporary demo data.')&&gate.includes('lost when it restarts, redeploys or sleeps'),'the free-tier notice is on the welcome screen');
 assert.equal(await a.getByLabel('Demo passphrase').count(),0);
 await a.getByRole('link',{name:'Get started'}).click();
 assert.ok((await a.locator('body').innerText()).includes('Temporary demo data.'),'and on the passphrase step');
 await a.getByLabel('Demo passphrase').fill('wrong passphrase');await a.getByRole('button',{name:'Continue'}).click();
 await a.getByText('That passphrase isn’t right.').waitFor();
 await enter(a,{welcome:false});
 // Persona selection, with the warnings still visible and no second welcome screen.
 await a.getByText(/lost if the service restarts, redeploys or sleeps/).waitFor();
 assert.equal(await a.getByRole('button',{name:'Back'}).count(),0,'no way back to a second welcome screen');
 await a.goto(url+'/');await a.waitForURL(url+'/login');
 assert.equal(await a.getByRole('status',{name:'Demo room'}).count(),0,'no bottom banner');
 // Chris adds customer information and runs the analysis (rule-based here: no Gemini key is configured).
 await persona(a,'Chris','/operator');
 const menu=await openDemoMenu(a);
 const room=(await menu.getByLabel('Room code',{exact:true}).innerText()).trim();assert.match(room,/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
 const menuText=await menu.innerText();
 assert.match(menuText,/lost if the service restarts, redeploys or sleeps/);assert.match(menuText,/Gemini’s free tier/);assert.match(menuText,/or sooner/);
 await a.keyboard.press('Escape');assert.equal(await a.getByRole('dialog',{name:'Demo room'}).count(),0);
 await a.getByLabel('Information 1 text').fill('FICTIONAL: Maya Chen: nobody can tell who owns payments-api. Let’s pilot with payments-api on GitHub.');
 await a.getByLabel('Information 1 name').fill('Discovery call');
 await a.getByRole('button',{name:'Save information'}).click();await a.getByText(/^Saved \d/).waitFor();
 await a.getByRole('button',{name:'Analyze customer'}).click();
 await a.getByText(/rule-based analysis \(no model configured\)/).waitFor({timeout:20000});
 // Insights is served under the gate too, labelled as fictional data.
 await a.goto(url+'/operator/insights');await a.getByRole('heading',{name:'Insights'}).waitFor();
 await a.getByText(/Fictional demo data: every number comes from activity recorded/).waitFor();
 await a.goto(url+'/operator');
 // Another visitor gets their own room and sees none of it; joining with the code shares it.
 const b=watch(await (await browser.newContext()).newPage());
 await b.goto(url+'/');await enter(b);await persona(b,'Chris','/operator');
 assert.notEqual(await roomCode(b),room);
 await b.getByLabel('Information 1 text').waitFor();assert.equal(await b.getByLabel('Information 1 text').inputValue(),'','a separate room starts empty');
 const c=watch(await (await browser.newContext()).newPage());
 await c.goto(url+'/');await enter(c,{room:room.toLowerCase()});await persona(c,'Chris','/operator');
 await c.getByText(/rule-based analysis/).first().waitFor();
 assert.match(await c.getByLabel('Information 1 text').inputValue(),/payments-api/,'the shared code joins the same room');
 // A process restart on the same container keeps /tmp: the room, the sign-in and the saved work survive.
 await stop();logs=await start(p);
 await a.reload();await a.getByLabel('Information 1 text').waitFor();
 assert.match(await a.getByLabel('Information 1 text').inputValue(),/payments-api/);assert.equal(new URL(a.url()).pathname,'/operator');
 // A fresh room from the menu: back to persona selection, empty; the shared room keeps its work.
 await (await openDemoMenu(a)).getByRole('button',{name:'Start a new room'}).click();
 await a.waitForURL(url+'/login');await persona(a,'Chris','/operator');
 const newer=await roomCode(a);assert.notEqual(newer,room);
 await a.getByLabel('Information 1 text').waitFor();assert.equal(await a.getByLabel('Information 1 text').inputValue(),'','a new room starts empty');
 await c.reload();await c.getByLabel('Information 1 text').waitFor();assert.match(await c.getByLabel('Information 1 text').inputValue(),/payments-api/,'the old room keeps its work');
 // Leaving the demo returns to the welcome screen.
 await (await openDemoMenu(a)).getByRole('button',{name:'Leave demo'}).click();await a.waitForURL(url+'/demo-gate');
 await a.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 await a.goto(url+'/operator');assert.equal(new URL(a.url()).pathname,'/demo-gate');
 // A redeploy or sleep on the free plan starts with empty storage: the shared room is gone, and the visitor is told so.
 await stop();dir=mkdtempSync(join(tmpdir(),'portal-production-e2e-redeploy-'));logs=await start(p);
 await c.goto(url+'/operator');await c.waitForURL(url+'/demo-gate?ended=1');
 await c.getByText(/Your previous demo room is no longer available/).waitFor();
 await enter(c);await persona(c,'Chris','/operator');
 assert.notEqual(await roomCode(c),room,'a fresh room after the redeploy');
 // Phone width: every entry step and the Portal with the open demo menu fit without horizontal scrolling.
 const m=watch(await (await browser.newContext({viewport:{width:390,height:844}})).newPage());
 const fits=async what=>assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),what+' fits a phone');
 await m.goto(url+'/demo-gate');await fits('welcome');
 await m.getByRole('link',{name:'Get started'}).click();await m.getByLabel('Demo passphrase').waitFor();await fits('passphrase');
 await enter(m,{welcome:false});await fits('persona selection');
 await persona(m,'Maya','/portal');
 const panel=await openDemoMenu(m);await fits('Portal with the demo menu open');
 const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390+1,'the demo menu stays on screen');
 assert.deepEqual(errors,[]);
 for(const secret of [PASS,SECRET])assert.ok(!logs().includes(secret),'no secrets in logs');
 console.log('PASS: production server — gate (wrong and right passphrase), own room with shareable code, Chris saves and analyzes (rule-based, labelled), second visitor isolated, code joins the room, Insights labelled, entry is welcome → passphrase → persona with the warnings on each step, top-bar demo menu (room code, end time, warnings, new room, leave) instead of a bottom banner, process restart keeps room/sign-in/work, leave returns to the gate, redeploy with empty storage ends the room with an explanation and a fresh room, health, phone width, no secrets in logs.');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();if(child&&child.exitCode===null)await stop();rmSync(data,{recursive:true,force:true});if(dir!==data)rmSync(dir,{recursive:true,force:true});}
