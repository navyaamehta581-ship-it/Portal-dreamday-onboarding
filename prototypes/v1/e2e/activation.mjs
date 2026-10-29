/** Real browser + two real local SQLite APIs (two fictional customers). No external calls or writes. */
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
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
const NORTHSTAR=['PRIVATE CONTRACT NOTE: renewal discount pending; exclude from publication.',
 'FICTIONAL TEST: Northstar Engineering wants to onboard its existing checkout-api, a Node.js/TypeScript service in the GitHub monorepo northstar/platform.',
 'Backstage familiarity: the platform team ran a proof of concept; app developers are new to it.',
 'SSO uses Okta; repository access is managed through GitHub teams. Docs live in Confluence.',
 'A solutions engineer can help with deep configuration.'].join('\n');
const LUMEN='FICTIONAL TEST: Lumen Retail wants to create a new Python recommendation service from a Scaffolder template. Code is on GitLab; SSO via Entra ID.\nTemplate repo is gitlab.com/lumen/recs-service.';
try{
 const uiPort=await port(),url=`http://127.0.0.1:${uiPort}`;
 const customers=[{id:'northstar',label:'Northstar Engineering',customerId:'fictional-northstar-engineering'},{id:'lumen',label:'Lumen Retail',customerId:'fictional-lumen-retail'}];
 for(const c of customers){
  c.dir=join(directory,c.id);mkdirSync(c.dir,{mode:0o700});c.apiOrigin=`http://127.0.0.1:${await port()}`;c.tokenFile=join(c.dir,'token');c.operatorTokenFile=join(c.dir,'operator-token');
  await start(['scripts/demo.ts','handoff'],join(repo,'services/workflow-api'),{PORT:c.apiOrigin.split(':')[2],ACTIVATION_DEMO_DIR:c.dir,ACTIVATION_DEMO_CUSTOMER_ID:c.customerId,ACTIVATION_DEMO_FRONTEND_ORIGIN:url},out=>out.includes('FICTIONAL DEMO API:'));
 }
 const accounts=join(directory,'accounts.json');
 // One entry, five fictional personas: Chris across both customers; Maya, Alex and Jordan at Northstar; Sam at Lumen.
 writeFileSync(accounts,JSON.stringify({customers:customers.map(({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile})=>({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile})),
  personas:[{id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:['northstar','lumen']},{id:'maya',name:'Maya Chen',role:'champion',title:'Platform Champion',customers:['northstar']},
   {id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:['northstar']},{id:'jordan',name:'Jordan Lee',role:'developer',title:'Developer',customers:['northstar']},{id:'sam',name:'Sam Okafor',role:'developer',title:'Developer',customers:['lumen']}]}),{mode:0o600});
 await start(['node_modules/vite/bin/vite.js','--port',String(uiPort),'--strictPort'],frontend,{PORTAL_DEMO_ACCOUNTS:accounts,ACTIVATION_API_ORIGIN:customers[0].apiOrigin},out=>out.includes('Local:'));
 const [north,lumen]=customers;
 const devToken=readFileSync(north.tokenFile,'utf8'),opToken=readFileSync(north.operatorTokenFile,'utf8');
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 const errors=[];const watch=page=>page.on('pageerror',e=>errors.push(e.message));
 console.log('Browser ready');
 // Entry → persona sign-in, as a person would do it.
 async function signInAs(page,name,start='/'){
  await page.goto(url+start);
  if(start==='/'){await page.getByRole('button',{name:'Get started'}).click();}
  await page.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
  assert.equal(await page.locator('input[type=password]').count(),0,'no credentials collected');
  await page.getByLabel(new RegExp(name)).check();await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('button',{name:`Account: ${name}`}).waitFor();
 }

 // --- Chris publishes both customers from the external workspace.
 const op=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(op);
 const opTraffic=[];op.on('request',r=>{if(r.url().includes('-api/'))opTraffic.push(r.url());if(r.headers().authorization)opTraffic.push('BEARER '+r.url());});
 await signInAs(op,'Chris');assert.equal(new URL(op.url()).pathname,'/operator','Chris starts in Customer Onboarding');
 assert.ok(!(await op.content()).includes(opToken),'operator token never reaches the page');
 assert.equal(await op.getByLabel('Operator access token').count(),0,'no token entry');
 async function publish(account,notes,outcome,by){
  await op.getByLabel('Customer account').selectOption(account);await op.getByRole('tab',{name:'Customer Context'}).click();
  await op.getByLabel('Raw account and call notes').fill(notes);await op.getByRole('button',{name:'Analyze sources'}).click();
  await op.getByText('Kept internal').waitFor();
  await op.getByRole('tab',{name:'Activation Goal'}).click();
  await op.getByLabel('Agreed activation outcome').fill(outcome);await op.getByLabel('Agreement attribution').fill(by);
  await op.getByRole('checkbox',{name:/I reviewed this developer-visible/}).check();
  const sent=op.waitForRequest(r=>r.url().endsWith('/handoff-publications')&&r.method()==='POST');
  await op.getByRole('button',{name:'Publish to developers'}).click();
  const body=(await sent).postData();await op.getByRole('heading',{name:'Agreed activation outcome'}).waitFor();return body;
 }
 const posted=await publish('northstar',NORTHSTAR,'Register checkout-api in the Software Catalog with an owner','Fictional platform lead, local test call');
 assert.ok(!posted.includes('PRIVATE CONTRACT NOTE'),'private line held back');
 await publish('lumen',LUMEN,'Generate a first recommendation service from an approved template','Fictional data lead, local test call');
 console.log('Both customers published');
 // Same Portal shell, separate navigation targets and access.
 assert.equal(await op.locator('.pt-shell .pt-side').count(),1);
 assert.equal(await op.getByRole('link',{name:'Customer Onboarding'}).getAttribute('href'),'/operator');
 assert.equal(await op.locator('a[href^="/portal"],a[href="/activation"]').count(),0);
 assert.ok(opTraffic.length>0&&opTraffic.every(u=>u.includes('/operator-api/')),'Chris uses only the operator API, without bearer tokens in the browser');
 assert.equal(await op.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403,'Chris has no developer session');

 // --- Developer: welcome → simulated login → personalized Portal.
 const devContext=await browser.newContext({viewport:{width:1920,height:1042}});const dev=await devContext.newPage();watch(dev);
 const bearer=[];dev.on('request',r=>{if(r.headers().authorization)bearer.push(r.url());});
 // Hidden JSON fields must not carry Chris's research either.
 const leaked=[];dev.on('response',async r=>{if(!r.url().includes('/portal-api/'))return;const body=await r.text().catch(()=>'');for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead','solutions engineer'])if(body.includes(x))leaked.push(x);});
 await dev.goto(url);await dev.getByRole('button',{name:'Get started'}).waitFor();await dev.keyboard.press('Tab');await dev.keyboard.press('Enter');
 await dev.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 const listed=await dev.locator('label.pt-account').allInnerTexts();
 assert.deepEqual(listed.map(t=>t.split('\n')[0].replace(/\s+/g,' ').trim()),['Chris Account operator','Maya Chen Champion','Alex Rivera Developer','Jordan Lee Developer','Sam Okafor Developer']);
 await signInAs(dev,'Alex Rivera','/login');
 await dev.getByRole('heading',{name:/First up/}).waitFor();
 assert.equal(new URL(dev.url()).pathname,'/portal');
 assert.ok((await dev.getByLabel('Your assigned work').innerText()).includes('Nothing is assigned to you yet'));
 // A typed URL for Chris's workspace explains instead of switching persona, and no operator call is made.
 const opCalls=[];dev.on('request',r=>{if(r.url().includes('/operator-api/'))opCalls.push(r.url());});
 await dev.goto(url+'/operator');await dev.getByText('This workspace is for the Spotify account operator').waitFor();
 await dev.getByRole('button',{name:'Account: Alex Rivera'}).waitFor();assert.deepEqual(opCalls,[]);
 assert.equal(await dev.evaluate(async c=>(await fetch(`/operator-api/northstar/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the session layer refuses operator access for a developer');
 await dev.goto(url+'/login');await dev.waitForURL(url+'/portal');
 await dev.getByRole('heading',{name:/First up/}).waitFor();
 let text=await dev.locator('body').innerText();
 assert.ok(text.includes('checkout-api'));for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead'])assert.ok(!text.includes(x),'developer page leaks '+x);
 assert.ok(!(await dev.content()).includes(devToken),'developer token never reaches the page');
 assert.equal(await dev.getByLabel('Raw account and call notes').count(),0);
 assert.equal(await dev.locator('a[href^="/operator"]').count(),0,'no operator links for developers');
 await dev.getByRole('button',{name:'Open your onboarding'}).click();
 await dev.getByRole('tab',{name:'Overview'}).waitFor();text=await dev.locator('body').innerText();
 assert.ok(text.includes('northstar/platform')&&text.includes('Review checkout-api repository readiness'));assert.ok(!text.includes('renewal'),'no commercial notes');assert.equal(await dev.getByRole('tab',{name:'Team'}).count(),0);
 // Developer credentials cannot publish (role denial at the API).
 assert.equal((await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/intake`,{method:'POST',headers:{Authorization:`Bearer ${devToken}`,'Content-Type':'application/json'},body:'{}'})).status,403);

 console.log('Guide: question then blocker');
 await dev.getByRole('tab',{name:'Guide'}).click();
 await dev.getByLabel('Question or update').fill('Which repository holds checkout-api?');await dev.getByRole('button',{name:'Send'}).click();
 await dev.getByText('Saved as your report').waitFor();assert.ok((await dev.locator('body').innerText()).includes('northstar/platform'));
 await dev.getByLabel('Message type').selectOption('blocker');
 await dev.getByLabel('Blocker note').fill('I don’t have permission to deploy to staging, and I don’t know who owns the service metadata.');
 await dev.getByRole('button',{name:'Submit blocker'}).click();
 await dev.getByText(/Updated direction · plan revision 1/).waitFor({timeout:20000});
 assert.ok((await dev.locator('body').innerText()).includes('Prepare a review checklist for the reported blocker'));

 console.log('Direction, team plan, refresh persistence');
 await dev.getByRole('tab',{name:'Overview'}).click();await dev.getByRole('button',{name:'Accept this onboarding direction'}).click();
 await dev.getByRole('tab',{name:'Team'}).click();
 await dev.getByLabel('Champion kickoff message').fill('Fictional kickoff: resolve staging access with the technical owner. No adoption claimed.');
 assert.ok((await dev.getByLabel('Bring Your Team Along').innerText()).includes('Blocked'));
 await dev.reload();await dev.getByRole('tab',{name:'Team'}).waitFor();
 await dev.getByRole('tab',{name:'Guide'}).click();await dev.getByText(/Updated direction/).waitFor();
 console.log('Repository inspection fails closed without a configured read scope');
 await dev.getByRole('tab',{name:'Repository'}).click();await dev.getByRole('button',{name:'Inspect and prepare'}).click();
 await dev.getByRole('alert').filter({hasText:/isn’t authorized|isn’t available/}).waitFor();
 assert.equal(bearer.length,0,'developer browser never sends bearer tokens');
 assert.deepEqual(leaked,[],'developer API responses carry no private research');

 // --- Chris reviews evidence-backed follow-up.
 await op.goto(url+'/operator/progress');await op.getByRole('button',{name:'Account: Chris'}).waitFor();
 await op.getByText('Chris intervention requested',{exact:true}).waitFor();
 assert.ok((await op.getByLabel('Chris team handoff summary').innerText()).includes('blocked'));
 assert.ok((await op.getByLabel('Developer activity').innerText()).includes('deploy to staging'));
 const state=await (await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).json();
 assert.equal(state.chrisHelp.status,'requested');assert.equal(state.planRevision,1);

 // --- Customer isolation: Lumen sees only its own onboarding.
 const other=await (await browser.newContext({viewport:{width:1920,height:1042}})).newPage();watch(other);
 await signInAs(other,'Sam Okafor','/activation');
 await other.getByRole('tab',{name:'Overview'}).waitFor();text=await other.locator('body').innerText();
 assert.ok(text.includes('Software Template')&&text.includes('lumen/recs-service')&&!text.includes('checkout-api')&&!text.includes('Okta'));
 assert.equal(await other.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403);
 assert.equal((await fetch(`${lumen.apiOrigin}/api/activation/v1/customers/${lumen.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).status,403);

 // --- Maya: the same Portal plus Team Coordination, with proposals only; Jordan: honest assigned-work state.
 const maya=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(maya);
 await signInAs(maya,'Maya Chen');
 await maya.getByRole('link',{name:'Team Coordination'}).click();await maya.getByLabel('Proposed work').waitFor();
 const proposed=await maya.getByLabel('Proposed work').innerText();
 assert.ok(proposed.includes('checkout-api')&&proposed.includes('Proposed — not approved')&&proposed.includes('not shown until the assignment is approved'));
 assert.equal(await maya.getByRole('button',{name:/approve|reject/i}).count(),0,'no approval controls yet');
 assert.ok(!(await maya.locator('body').innerText()).includes('renewal'));
 await maya.reload();await maya.getByLabel('Proposed work').waitFor();assert.equal(new URL(maya.url()).pathname,'/champion','reload keeps the persona and page');
 assert.equal(await maya.evaluate(async c=>(await fetch(`/operator-api/northstar/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the Champion has no operator access');
 const jordan=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(jordan);
 await signInAs(jordan,'Jordan Lee');await jordan.getByLabel('Your assigned work').waitFor();
 assert.equal(await jordan.getByRole('link',{name:'Team Coordination'}).count(),0);

 // --- Sign-out ends the session; mobile layouts do not overflow.
 await dev.getByRole('button',{name:/Account:/}).click();await dev.getByRole('menuitem',{name:'Sign out'}).click();
 await dev.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 assert.equal(await dev.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),401);
 const entry=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();watch(entry);await entry.goto(url+'/login');await entry.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 for(const page of [op,other,maya,entry]){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: one entry → persona sign-in (Chris, Maya, Alex, Jordan, Sam) → Chris publishes both customers without a token in the page (private notes held back) → Alex: personalized onboarding, question + blocker replan, direction + team plan (survives refresh), GitHub fail-closed, typed operator URL refused → Chris follow-up → Maya: Team Coordination proposals only, reload keeps persona → Jordan: no Champion view; role denial at session layer and API, no browser tokens, two-customer isolation, sign-out, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 rmSync(directory,{recursive:true,force:true});
}
