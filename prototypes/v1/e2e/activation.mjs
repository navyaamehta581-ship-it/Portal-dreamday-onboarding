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
 const customers=[{id:'northstar',label:'Northstar Engineering',user:'Alex Rivera',customerId:'fictional-northstar-engineering'},{id:'lumen',label:'Lumen Retail',user:'Sam Okafor',customerId:'fictional-lumen-retail'}];
 for(const c of customers){
  c.dir=join(directory,c.id);mkdirSync(c.dir,{mode:0o700});c.apiOrigin=`http://127.0.0.1:${await port()}`;c.tokenFile=join(c.dir,'token');
  await start(['scripts/demo.ts','handoff'],join(repo,'services/workflow-api'),{PORT:c.apiOrigin.split(':')[2],ACTIVATION_DEMO_DIR:c.dir,ACTIVATION_DEMO_CUSTOMER_ID:c.customerId,ACTIVATION_DEMO_FRONTEND_ORIGIN:url},out=>out.includes('FICTIONAL DEMO API:'));
 }
 const accounts=join(directory,'accounts.json');
 writeFileSync(accounts,JSON.stringify(customers.map(({id,label,user,customerId,apiOrigin,tokenFile})=>({id,label,user,customerId,apiOrigin,tokenFile}))),{mode:0o600});
 await start(['node_modules/vite/bin/vite.js','--port',String(uiPort),'--strictPort'],frontend,{PORTAL_DEMO_ACCOUNTS:accounts,ACTIVATION_API_ORIGIN:customers[0].apiOrigin},out=>out.includes('Local:'));
 const [north,lumen]=customers;
 const devToken=readFileSync(north.tokenFile,'utf8'),opToken=readFileSync(join(north.dir,'operator-token'),'utf8'),lumenOp=readFileSync(join(lumen.dir,'operator-token'),'utf8');
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
 const errors=[];const watch=page=>page.on('pageerror',e=>errors.push(e.message));
 console.log('Browser ready');

 // --- Chris publishes both customers from the external workspace.
 const op=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(op);
 async function publish(account,token,notes,outcome,by){
  await op.goto(url+'/operator');await op.getByLabel('Customer account').selectOption(account);
  await op.getByLabel('Operator access token').fill(token);await op.getByRole('button',{name:'Open workspace'}).click();
  await op.getByLabel('Raw account and call notes').fill(notes);await op.getByRole('button',{name:'Analyze sources'}).click();
  await op.getByText('Kept internal').waitFor();
  await op.getByRole('tab',{name:'Activation Goal'}).click();
  await op.getByLabel('Agreed activation outcome').fill(outcome);await op.getByLabel('Agreement attribution').fill(by);
  await op.getByRole('checkbox',{name:/I reviewed this developer-visible/}).check();
  const sent=op.waitForRequest(r=>r.url().endsWith('/handoff-publications')&&r.method()==='POST');
  await op.getByRole('button',{name:'Publish to developers'}).click();
  const body=(await sent).postData();await op.getByRole('heading',{name:'Agreed activation outcome'}).waitFor();return body;
 }
 const posted=await publish('northstar',opToken,NORTHSTAR,'Register checkout-api in the Software Catalog with an owner','Fictional platform lead, local test call');
 assert.ok(!posted.includes('PRIVATE CONTRACT NOTE'),'private line held back');
 await publish('lumen',lumenOp,LUMEN,'Generate a first recommendation service from an approved template','Fictional data lead, local test call');
 console.log('Both customers published');
 // Same Portal shell, separate navigation targets and access.
 assert.equal(await op.locator('.pt-shell .pt-side').count(),1);
 assert.equal(await op.getByRole('link',{name:'Customer Onboarding'}).getAttribute('href'),'/operator');
 assert.equal(await op.locator('a[href^="/portal"],a[href="/activation"]').count(),0);
 assert.equal((await op.context().cookies()).length,0,'Chris never holds a developer session');

 // --- Developer: welcome → simulated login → personalized Portal.
 const devContext=await browser.newContext({viewport:{width:1920,height:1042}});const dev=await devContext.newPage();watch(dev);
 const bearer=[];dev.on('request',r=>{if(r.headers().authorization)bearer.push(r.url());});
 // Hidden JSON fields must not carry Chris's research either.
 const leaked=[];dev.on('response',async r=>{if(!r.url().includes('/portal-api/'))return;const body=await r.text().catch(()=>'');for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead','solutions engineer'])if(body.includes(x))leaked.push(x);});
 await dev.goto(url);await dev.getByRole('button',{name:'Get started'}).waitFor();await dev.keyboard.press('Tab');await dev.keyboard.press('Enter');
 await dev.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 assert.equal(await dev.locator('input[type=password]').count(),0);
 await dev.getByRole('button',{name:'Continue'}).click();
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
 await op.goto(url+'/operator/progress');await op.getByLabel('Operator access token').fill(opToken);await op.getByRole('button',{name:'Open workspace'}).click();
 await op.getByText('Chris intervention requested',{exact:true}).waitFor();
 assert.ok((await op.getByLabel('Chris team handoff summary').innerText()).includes('blocked'));
 assert.ok((await op.getByLabel('Developer activity').innerText()).includes('deploy to staging'));
 const state=await (await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).json();
 assert.equal(state.chrisHelp.status,'requested');assert.equal(state.planRevision,1);

 // --- Customer isolation: Lumen sees only its own onboarding.
 const other=await (await browser.newContext({viewport:{width:1920,height:1042}})).newPage();watch(other);
 await other.goto(url+'/activation');await other.getByLabel(/Sam Okafor/).check();await other.getByRole('button',{name:'Continue'}).click();
 await other.getByRole('tab',{name:'Overview'}).waitFor();text=await other.locator('body').innerText();
 assert.ok(text.includes('Software Template')&&text.includes('lumen/recs-service')&&!text.includes('checkout-api')&&!text.includes('Okta'));
 assert.equal(await other.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403);
 assert.equal((await fetch(`${lumen.apiOrigin}/api/activation/v1/customers/${lumen.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).status,403);

 // --- Sign-out ends the session; mobile layouts do not overflow.
 await dev.getByRole('button',{name:/Account:/}).click();await dev.getByRole('menuitem',{name:'Sign out'}).click();
 await dev.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 assert.equal(await dev.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),401);
 for(const page of [op,other]){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: Chris publication (private notes held back) → Portal welcome/simulated login → personalized onboarding → question + blocker replan → direction + team plan (survives refresh) → GitHub fail-closed → Chris follow-up; role denial, no browser tokens, two-customer isolation, sign-out, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 rmSync(directory,{recursive:true,force:true});
}
