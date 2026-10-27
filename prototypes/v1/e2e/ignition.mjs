/** Northstar journey in a real browser: separate sign-ins, handoff → team → developers → adoption. */
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const out=process.env.IGNITION_EVIDENCE??'../../docs/ignition/screenshots';mkdirSync(out,{recursive:true});
let server,base=process.env.IGNITION_URL;
if(!base){
 // Fresh in-memory store for every run unless an existing server is supplied.
 const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--port',String(port),'--strictPort'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,IGNITION_DEMO:'1'},stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
 const end=Date.now()+20000;while(!log.includes('Local:')){if(Date.now()>end||server.exitCode!==null)throw Error('Vite did not start: '+log);await new Promise(r=>setTimeout(r,100));}
 base=`http://127.0.0.1:${port}`;
}
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const errors=[];
try{
 // One browser context: concurrent sessions in separate tabs, each with its own scoped cookie.
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const routes={chris:'/ignition/chris',maya:'/ignition/champion',alex:'/ignition/developer',jordan:'/ignition/developer/jordan'};
 const pages={};
 async function shot(page,name){await page.locator('.pt-main').evaluate(e=>e.scrollTop=0).catch(()=>{});await page.screenshot({path:`${out}/${name}.png`,fullPage:true});}
 async function signIn(p,email=p+'@northstar.example'){
  const page=pages[p]??=await ctx.newPage();page.on('pageerror',e=>errors.push(`${p}: ${e.message}`));
  await page.goto(base+routes[p]+'/login');await page.getByLabel('Work email').fill(email);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  return page;
 }
 const account=p=>pages[p].getByRole('button',{name:`Account: ${p[0].toUpperCase()+p.slice(1)}`,exact:true});

 // Deep link without a session shows that surface's sign-in; a URL alone never signs in.
 const probe=await ctx.newPage();await probe.goto(base+routes.chris+'/handoff');await probe.getByLabel('Work email').waitFor();
 assert.equal(await probe.getByRole('heading',{name:'Customer Activation.'}).count(),1);await probe.close();

 // Wrong account is rejected on Chris's sign-in.
 await signIn('chris','alex@northstar.example');await pages.chris.getByRole('alert').filter({hasText:'Use the account invited'}).waitFor();
 await pages.chris.getByLabel('Work email').fill('chris@northstar.example');await pages.chris.getByRole('button',{name:'Sign in',exact:true}).click();await account('chris').waitFor();
 assert.ok(!(await pages.chris.content()).includes('fictional'));
 await pages.chris.getByRole('button',{name:'Import with Claude Agent'}).click();await pages.chris.getByRole('dialog').getByRole('button',{name:'Import'}).click();await pages.chris.getByText('Simulated import').waitFor();
 await pages.chris.getByRole('button',{name:'Extract a review draft'}).click();await pages.chris.getByLabel('I reviewed both fields').check();await shot(pages.chris,'01-chris-review');
 await pages.chris.getByRole('button',{name:'Approve handoff v1'}).click();await pages.chris.getByText('Approved handoff v1',{exact:true}).waitFor();

 // Alex starts before Maya participates.
 await signIn('alex');await account('alex').waitFor();
 const alexText=await pages.alex.locator('body').innerText();assert.ok(!alexText.includes('$100K')&&!alexText.includes('500 employees'));
 assert.equal(await pages.alex.getByRole('link',{name:'Customer files'}).count(),0);assert.equal(await pages.alex.locator('select').count(),0,'no persona switcher');
 await pages.alex.getByRole('button',{name:'Start workflow'}).click();await pages.alex.getByRole('button',{name:'Open catalog entry'}).click();
 await pages.alex.getByLabel('Which team owns payments-api?').fill('wrong');await pages.alex.getByRole('button',{name:'Verify outcome'}).click();await pages.alex.getByRole('alert').filter({hasText:'doesn’t match'}).waitFor();
 await pages.alex.getByLabel('Which team owns payments-api?').fill('team-payments');await pages.alex.getByRole('button',{name:'Verify outcome'}).click();await pages.alex.getByRole('status').filter({hasText:'verified in simulation'}).waitFor();await shot(pages.alex,'02-developer-outcome');
 await pages.alex.getByRole('button',{name:'Open AiKA'}).click();await pages.alex.getByRole('button',{name:/support draft/}).click();
 await pages.alex.getByLabel('What blocked you?').fill('Real repository access is not confirmed.');await pages.alex.getByRole('button',{name:'Prepare support draft'}).click();
 await pages.alex.getByLabel('Support draft',{exact:true}).waitFor();assert.ok((await pages.alex.getByLabel('Contextual AiKA').innerText()).includes('Not sent'));await shot(pages.alex,'03-contextual-help');

 // Maya's optional preferences reach Jordan; invitations are simulated.
 await signIn('maya');await account('maya').waitFor();
 await pages.maya.getByLabel('Make “Find the payments-api runbook” first').check();await pages.maya.getByLabel('Optional team goal').fill('Both developers find ownership and a runbook this week.');
 await pages.maya.getByLabel('Alex',{exact:true}).check();await pages.maya.getByLabel('Jordan',{exact:true}).check();await pages.maya.getByRole('button',{name:'Save team preferences'}).click();
 await pages.maya.getByRole('status').filter({hasText:'Preferences saved'}).waitFor();await shot(pages.maya,'04-team-activation');
 const mayaState=await pages.maya.evaluate(async()=>(await fetch('/ignition-api/maya/state')).json());assert.equal(mayaState.sources,undefined);assert.equal(mayaState.commercial,undefined);

 await signIn('jordan');await account('jordan').waitFor();
 assert.ok((await pages.jordan.locator('body').innerText()).includes('Both developers find ownership and a runbook this week.'));
 await pages.jordan.getByRole('button',{name:'Start workflow'}).click();await pages.jordan.getByRole('heading',{name:'Find the payments-api runbook'}).waitFor();
 await pages.jordan.getByRole('button',{name:'Open documentation'}).click();await pages.jordan.getByLabel('What is the runbook heading?').fill('Payments recovery');await pages.jordan.getByRole('button',{name:'Verify outcome'}).click();await pages.jordan.getByRole('status').filter({hasText:'verified in simulation'}).waitFor();
 const jordanState=await pages.jordan.evaluate(async()=>(await fetch('/ignition-api/jordan/state')).json());assert.deepEqual(Object.keys(jordanState.progress),['jordan']);assert.equal(jordanState.sources,undefined);

 // Chris publishes v2; earlier outcomes keep v1 and are flagged for revalidation after reload.
 await pages.chris.bringToFront();await pages.chris.getByRole('button',{name:'Refresh'}).click();await pages.chris.getByRole('tab',{name:'Handoff'}).click();
 await pages.chris.getByRole('button',{name:'Revise approved handoff'}).click();await pages.chris.getByLabel('Developer context',{exact:true}).fill('Maya prioritizes service ownership and documentation for payments-api on GitHub. Updated POC handoff.');
 await pages.chris.getByLabel('I reviewed both fields').check();await pages.chris.getByRole('button',{name:'Approve handoff v2'}).click();await pages.chris.getByText('Approved handoff v2',{exact:true}).waitFor();
 await pages.chris.getByRole('link',{name:'Insights'}).click();await pages.chris.reload();await pages.chris.getByRole('cell',{name:/Verified in simulation · handoff v1/}).first().waitFor();
 assert.ok((await pages.chris.locator('body').innerText()).includes('Revalidate against v2'));await shot(pages.chris,'05-adoption-after-revision');
 await pages.chris.goto(base+routes.chris+'/versions');await pages.chris.getByLabel('Handoff changes').first().waitFor();

 // Signing out Maya leaves the others signed in.
 await pages.maya.getByRole('button',{name:'Account: Maya'}).click();await pages.maya.getByRole('menuitem',{name:'Sign out'}).click();await pages.maya.getByLabel('Work email').waitFor();
 for(const p of ['chris','alex','jordan']){await pages[p].reload();await account(p).waitFor();}
 assert.equal(await pages.maya.evaluate(async()=>(await fetch('/ignition-api/maya/state')).status),401);

 await pages.alex.setViewportSize({width:390,height:844});await pages.alex.reload();await account('alex').waitFor();
 assert.ok(await pages.alex.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');await shot(pages.alex,'06-compact');
 assert.deepEqual(errors,[]);
 console.log('PASS: separate sign-ins (wrong account, deep link, concurrent tabs, isolated sign-out), v1 approval, Alex before Maya, optional champion priority reaching Jordan, wrong answer rejected, unsent support draft, v2 with retained v1 evidence and revalidation flags, private data absent from champion/developer payloads, compact layout; no browser errors.');
}finally{await browser.close();server?.kill('SIGTERM');}
