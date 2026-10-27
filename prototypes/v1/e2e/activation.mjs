/** Real browser + real local SQLite API. Fictional data; no external calls or writes. */
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const frontend=fileURLToPath(new URL('..',import.meta.url)),repo=resolve(frontend,'../..');
const directory=mkdtempSync(join(tmpdir(),'spotify-handoff-e2e-'));
const children=[];let browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(args,cwd,env,ready){
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);let output='';
 child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const end=Date.now()+20000;while(Date.now()<end){if(child.exitCode!==null)throw Error(output);if(ready(output))return;await new Promise(r=>setTimeout(r,100));}throw Error('Startup timeout: '+output);
}
try{
 const apiPort=await port(),uiPort=await port(),api=`http://127.0.0.1:${apiPort}`,url=`http://127.0.0.1:${uiPort}`;
 await start(['scripts/demo.ts','handoff'],join(repo,'services/workflow-api'),{PORT:String(apiPort),ACTIVATION_DEMO_DIR:directory,ACTIVATION_DEMO_FRONTEND_ORIGIN:url},out=>out.includes('FICTIONAL DEMO API:'));
 await start(['node_modules/vite/bin/vite.js','--port',String(uiPort),'--strictPort'],frontend,{ACTIVATION_API_ORIGIN:api},out=>out.includes('Local:'));
 const token=readFileSync(join(directory,'token'),'utf8'),operator=readFileSync(join(directory,'operator-token'),'utf8'),customer='fictional-recommendation-demo';
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 console.log('Browser ready');
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),op=await context.newPage(),dev=await context.newPage();
 const errors=[];for(const page of [op,dev])page.on('pageerror',e=>errors.push(e.message));
 console.log('Operator input');
 await op.goto(url+'/operator');await op.getByLabel('Customer ID',{exact:true}).fill(customer);await op.getByLabel('Development access token').fill(operator);
 const raw='PRIVATE CONTRACT NOTE: exclude from publication.\nFICTIONAL TEST: Existing Backstage migration. SSO uses Okta; repository access is not yet confirmed. GitHub monorepo and Confluence wiki. A solutions engineer can help with deep configuration.';
 await op.getByLabel('Raw account and call notes').fill(raw);await op.getByRole('button',{name:'Preview developer handoff'}).click();
 await op.getByLabel('Existing customer briefing').fill(raw.split('\n')[1]);
 await op.getByLabel('Agreed activation outcome').fill('Review one customer-specific onboarding workflow');
 await op.getByLabel('Agreement attribution').fill('Fictional customer played by test operator, local test call');
 await op.getByRole('checkbox',{name:/I reviewed this developer-visible/}).check();
 const published=op.waitForResponse(r=>r.url().endsWith('/intake'));
 const sent=op.waitForRequest(r=>r.url().endsWith('/intake')&&r.method()==='POST');
 await op.getByRole('button',{name:'Publish customer context and suggested plan'}).click();
 assert.ok(!(await sent).postData().includes('PRIVATE CONTRACT NOTE'));
 const result=await published;assert.equal(result.status(),200,await result.text());
 await op.getByRole('heading',{name:'Activation at a glance'}).waitFor();
 assert.equal(await op.getByLabel('Bring Your Team Along').count(),0);
 assert.equal(await op.getByLabel('Progress report',{exact:true}).count(),0);
 console.log('Published; entering developer flow');
 await dev.goto(url);await dev.getByRole('button',{name:'Get started'}).click();await dev.getByRole('button',{name:'Continue with simulated login'}).click();
 assert.equal(await dev.getByLabel('Raw account and call notes').count(),0);assert.equal(await dev.getByRole('heading',{name:'Activation at a glance'}).count(),0);
 await dev.getByLabel('Customer ID',{exact:true}).fill(customer);await dev.getByLabel('Development access token').fill(token);await dev.getByRole('button',{name:'Load / refresh saved session'}).click();
 await dev.getByRole('heading',{name:'Your onboarding context'}).waitFor();assert.ok((await dev.locator('body').innerText()).includes('Okta'));assert.ok(!(await dev.locator('body').innerText()).includes('PRIVATE CONTRACT NOTE'));
 assert.equal(await dev.getByLabel('Bring Your Team Along').count(),0);
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 assert.equal((await fetch(`${api}/api/activation/v1/customers/${customer}/intake`,{method:'POST',headers,body:'{}'})).status,403);
 console.log('Reporting blocker');
 await dev.getByLabel('Blocker note').fill('I cannot access the repository. Please ask the technical owner to confirm permissions.');
 await dev.getByRole('button',{name:'Review blocker'}).click();await dev.getByRole('button',{name:/Submit \/ retry attributed/}).click();
 await dev.getByText('report saved to the server',{exact:false}).waitFor();
 await dev.waitForFunction(()=>document.body.innerText.includes('Prepare a review checklist for the reported blocker'),{},{timeout:20000});
 await dev.getByRole('button',{name:'Accept this onboarding direction'}).click();await dev.getByRole('heading',{name:'Bring Your Team Along',exact:true}).waitFor();
 await dev.getByLabel('Champion kickoff message').fill('Fictional kickoff: resolve access with the technical owner before the next onboarding attempt. No completed adoption claimed.');
 assert.ok((await dev.getByLabel('Bring Your Team Along').innerText()).includes('Blocked'));
 console.log('Champion ready; operator review');
 await op.getByRole('button',{name:'Load / refresh saved session'}).click();await op.getByText('Chris intervention requested',{exact:true}).waitFor();
 assert.ok((await op.getByLabel('Chris team handoff summary').innerText()).includes('blocked'));
 const before=await (await fetch(`${api}/api/activation/v1/customers/${customer}/state`,{headers})).json();assert.equal(before.outcome.status,'unassessed');assert.equal(before.chrisHelp.status,'requested');
 // Customer switching removes both saved state and local champion drafts.
 await dev.getByLabel('Customer ID',{exact:true}).fill('another-customer');assert.equal(await dev.getByLabel('Champion kickoff message').count(),0);await dev.getByRole('button',{name:'Load / refresh saved session'}).click();await dev.getByRole('alert').filter({hasText:'FORBIDDEN'}).waitFor();
 // Narrow screen remains usable.
 await op.setViewportSize({width:390,height:844});assert.ok(await op.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: operator publication → Portal simulated login → personalized path → blocker replan → champion draft → Chris outcome; role denial, customer isolation, no private raw-note publication, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 rmSync(directory,{recursive:true,force:true});
}
