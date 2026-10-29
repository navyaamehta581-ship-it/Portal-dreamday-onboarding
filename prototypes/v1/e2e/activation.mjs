/** Real browser + two real local SQLite APIs (two fictional customers). No external calls or writes. */
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
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
// A local stand-in for Ollama, used by AiKA only (AIKA_LLM_PROVIDER=ollama). It is not a language model: it answers from
// the prompt it receives, so the test can check what AiKA was given and how the answer is labelled and screened.
const aikaPrompts=[];let aikaMode='ok';
const stubOllama=createHttpServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{
 if(req.url!=='/api/chat'||aikaMode==='down'){res.writeHead(503);res.end();return;}
 const prompt=JSON.parse(body).messages.map(x=>x.content).join('\n');aikaPrompts.push(prompt);
 const focus=/\(the question is about this one\): ([^—\n]+)/.exec(prompt)?.[1]?.trim()??'your approved milestones';
 const content=JSON.stringify({sections:[{kind:'known',text:`Your milestone is ${focus}.`},{kind:'reported',text:'You reported a blocker about repository access.'},
  {kind:'known',text:'I inspected the repository and verified the CODEOWNERS file.'},{kind:'suggestion',text:'Resolve the access blocker with your Champion before the next action.'},
  {kind:'unknown',text:'Which CI system deploys it is not stated; your Champion could answer.'}],next_step:'Mark the next action started once access is granted.'});
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({message:{content},done:true,eval_count:40,eval_duration:1e9}));});});
try{
 await new Promise(r=>stubOllama.listen(0,'127.0.0.1',r));const ollamaUrl=`http://127.0.0.1:${stubOllama.address().port}`;
 const uiPort=await port(),url=`http://127.0.0.1:${uiPort}`;
 const customers=[{id:'northstar',label:'Northstar Engineering',customerId:'fictional-northstar-engineering'},{id:'lumen',label:'Lumen Retail',customerId:'fictional-lumen-retail'}];
 for(const c of customers){
  c.dir=join(directory,c.id);mkdirSync(c.dir,{mode:0o700});c.apiOrigin=`http://127.0.0.1:${await port()}`;c.tokenFile=join(c.dir,'token');c.operatorTokenFile=join(c.dir,'operator-token');c.championTokenFile=join(c.dir,'champion-token');
  await start(['scripts/demo.ts','handoff'],join(repo,'services/workflow-api'),{PORT:c.apiOrigin.split(':')[2],ACTIVATION_DEMO_DIR:c.dir,ACTIVATION_DEMO_CUSTOMER_ID:c.customerId,ACTIVATION_DEMO_FRONTEND_ORIGIN:url,
   // Each developer gets their own credential; Northstar's AiKA uses the stub model, Lumen's has none.
   ACTIVATION_DEMO_DEVELOPERS:c.id==='lumen'?'sam=Sam Okafor':'alex=Alex Rivera,jordan=Jordan Lee',
   ...(c.id==='northstar'?{AIKA_LLM_PROVIDER:'ollama',OLLAMA_URL:ollamaUrl,OLLAMA_MODEL:'stub-model',OLLAMA_RETRIES:'0',OLLAMA_TIMEOUT_MS:'10000'}:{AIKA_LLM_PROVIDER:'',PORTAL_LLM_PROVIDER:''})},out=>out.includes('FICTIONAL DEMO API:'));
 }
 const accounts=join(directory,'accounts.json');
 // One entry, six fictional personas: Chris across both customers; Maya (Champion), Alex and Jordan at Northstar; Sam and Priya (Champion) at Lumen.
 writeFileSync(accounts,JSON.stringify({customers:customers.map(({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile,championTokenFile})=>({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile,championTokenFile})),
  personas:[{id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:['northstar','lumen']},{id:'maya',name:'Maya Chen',role:'champion',title:'Platform Champion',customers:['northstar']},
   {id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:['northstar']},{id:'jordan',name:'Jordan Lee',role:'developer',title:'Developer',customers:['northstar']},{id:'sam',name:'Sam Okafor',role:'developer',title:'Developer',customers:['lumen']},{id:'priya',name:'Priya Nair',role:'champion',title:'Platform Champion',customers:['lumen']}]}),{mode:0o600});
 await start(['node_modules/vite/bin/vite.js','--port',String(uiPort),'--strictPort'],frontend,{PORTAL_DEMO_ACCOUNTS:accounts,ACTIVATION_API_ORIGIN:customers[0].apiOrigin},out=>out.includes('Local:'));
 const [north,lumen]=customers;
 const devToken=readFileSync(north.tokenFile,'utf8'),alexToken=readFileSync(join(north.dir,'developer-token-alex'),'utf8'),opToken=readFileSync(north.operatorTokenFile,'utf8'),champToken=readFileSync(north.championTokenFile,'utf8');
 const api=(c,path,token,body)=>fetch(`${c.apiOrigin}/api/activation/v1/customers/${c.customerId}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
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
 // Chris: information → analysis → review → (Northstar) submission for Champion review → labelled direct publication.
 async function prepare(account,notes){
  await op.getByLabel('Customer account').selectOption(account);await op.getByRole('tab',{name:'Customer Context'}).click();
  await op.getByLabel('Information 1 text').fill(notes);await op.getByLabel('Information 1 name').fill('Discovery call');
  await op.getByRole('button',{name:'Add information'}).click();
  await op.getByLabel('Information 2 category').selectOption('integration_tools');await op.getByLabel('Information 2 text').fill('Docs live in Confluence; CI runs in GitHub Actions.');
  await op.getByRole('button',{name:'Save information'}).click();await op.getByText(/^Saved \d/).waitFor();
  await op.getByRole('button',{name:'Analyze customer'}).click();
  await op.getByRole('button',{name:'Review the onboarding draft'}).waitFor({timeout:20000});
  await op.getByRole('button',{name:'Review the onboarding draft'}).click();
  await op.getByLabel('Onboarding milestones').waitFor();
 }
 async function addPeople(people){
  for(const [name,role] of people){
   const n=await op.locator('[aria-label^="Stakeholder "][aria-label$=" name"]').count();
   await op.getByRole('button',{name:'Add stakeholder'}).click();
   await op.getByLabel(`Stakeholder ${n+1} name`).fill(name);await op.getByLabel(`Stakeholder ${n+1} role`).fill(role);
  }
 }
 async function submitDraft(label){
  await op.getByRole('checkbox',{name:/I reviewed this draft/}).check();
  await op.getByRole('button',{name:label}).click();
 }
 // Champion: open Dream Day, assign, save; then approve.
 async function championAssigns(page,assignments){
  await page.getByLabel('Your decision').waitFor();
  for(const [i,name] of assignments)await page.getByLabel(`Milestone ${i} proposed assignee`).selectOption(name);
  await page.getByRole('button',{name:'Save draft'}).click();await page.getByLabel('Review status').getByText(/^Saved$/).waitFor();
 }
 async function championApproves(page){
  await page.getByRole('checkbox',{name:/I confirm the technical goals/}).check();
  await page.getByRole('button',{name:'Approve onboarding plan'}).click();
  await page.getByLabel('Approved responsibilities').waitFor();
 }
 await prepare('northstar',NORTHSTAR);
 assert.ok((await op.getByLabel('Kept internal').innerText()).includes('Kept internal'));
 // Edit the draft: retitle the first milestone, add a second one that depends on it, name the technical team; save.
 await op.getByLabel('Milestone 1 title').fill('Review checkout-api repository readiness and prepare it for Catalog registration');
 await op.getByRole('button',{name:'Add milestone'}).click();
 await op.getByLabel('Milestone 2 title').fill('Validate that checkout-api is discoverable in the Catalog');
 await op.getByLabel('Milestone 2 actions').fill('Search the Catalog for checkout-api\nOpen its docs link');
 await op.getByLabel('Milestone 2 completion criteria').fill('checkout-api is found from Catalog search with a working docs link');
 await op.getByLabel('Milestone 2').getByRole('checkbox').check();
 await addPeople([['Maya Chen','Champion, Platform Engineering'],['Alex Rivera','Developer'],['Jordan Lee','Developer']]);
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 // Persisted on the server: a reload brings the edited draft back.
 await op.reload();await op.getByLabel('Milestone 2 title').waitFor();
 assert.equal(await op.getByLabel('Milestone 2 title').inputValue(),'Validate that checkout-api is discoverable in the Catalog');
 await submitDraft('Mark ready for Champion review');
 await op.getByRole('heading',{name:'Submitted for Champion review'}).waitFor();
 // Submission publishes nothing: the developer credential still has no onboarding, and no workspace route.
 assert.equal((await api(north,'state',devToken)).status,404,'developers see nothing after submission');
 assert.equal((await api(north,'handoff',devToken)).status,403);
 const early=await (await browser.newContext()).newPage();watch(early);await signInAs(early,'Alex Rivera');
 await early.getByText('Your onboarding hasn’t been published yet').waitFor();
 assert.ok(!(await early.locator('body').innerText()).includes('Validate that checkout-api'),'Alex does not see the submitted draft');
 await early.close();

 // --- Dream Day: Maya reviews, assigns Alex and Jordan, and asks for a change.
 const maya=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(maya);
 const mayaLeaks=[];maya.on('response',async r=>{if(!r.url().includes('/portal-api/'))return;const body=await r.text().catch(()=>'');for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Discovery call','Kept internal'])if(body.includes(x))mayaLeaks.push(x);});
 await signInAs(maya,'Maya Chen');
 await maya.getByRole('button',{name:'Open Dream Day'}).click();await maya.getByLabel('Dream Day',{exact:true}).waitFor();
 assert.ok((await maya.getByLabel('Dream Day review').innerText()).includes('Waiting for your review'));
 await championAssigns(maya,[[1,'Alex Rivera'],[2,'Jordan Lee']]);
 await maya.getByLabel('Milestone 2 title').fill('Independently validate that checkout-api and its docs are discoverable');
 await maya.getByRole('button',{name:'Save draft'}).click();await maya.getByLabel('Review status').getByText(/^Saved$/).waitFor();
 assert.equal((await api(north,'state',devToken)).status,404,'saving is not approving');
 await maya.getByLabel('What should Chris change?').fill('Please confirm which CI system deploys checkout-api before Alex starts.');
 await maya.getByRole('button',{name:'Request changes'}).click();
 await maya.getByLabel('Dream Day review').getByText('Changes requested',{exact:true}).waitFor();
 assert.equal((await api(north,'state',devToken)).status,404,'returned plans never reach developers');
 // Chris sees the feedback, revises and resubmits.
 await op.reload();await op.getByLabel('Champion feedback').waitFor();
 assert.ok((await op.getByLabel('Champion feedback').innerText()).includes('Please confirm which CI system deploys checkout-api'));
 assert.equal(await op.getByLabel('Milestone 2 proposed assignee').inputValue(),'Jordan Lee','Maya’s assignments carry back to Chris');
 await op.getByRole('button',{name:'Add unknown'}).click();
 await op.getByRole('textbox',{name:/^Unknown \d+$/}).last().fill('CI runs in GitHub Actions; confirmed with Maya');
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 await submitDraft('Resubmit for Champion review');
 await op.getByRole('heading',{name:'Resubmitted for Champion review'}).waitFor();
 // Chris and developers cannot approve; nobody can publish around Dream Day.
 assert.equal((await api(north,'champion-decisions',opToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,403);
 assert.equal((await api(north,'champion-decisions',devToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,403);
 const bypass=await op.evaluate(async c=>{const r=await fetch(`/operator-api/northstar/activation/v1/customers/${c}/handoff-publications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:1,fromReview:true,outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true})});return [r.status,(await r.json()).error.code];},north.customerId);
 assert.deepEqual(bypass,[403,'CHAMPION_APPROVAL_REQUIRED'],'the removed publishing bypass is refused on the server');
 assert.equal((await api(north,'champion-review',devToken)).status,403,'developers cannot open Dream Day');
 // Maya approves the resubmitted plan.
 await maya.reload();await maya.getByLabel('Dream Day review').getByText('Resubmitted · waiting for your review').waitFor();
 assert.equal(await maya.getByLabel('Milestone 1 proposed assignee').inputValue(),'Alex Rivera');
 await championApproves(maya);
 const responsibilities=await maya.getByLabel('Approved responsibilities').innerText();
 assert.ok(responsibilities.includes('Alex Rivera')&&responsibilities.includes('Jordan Lee')&&responsibilities.includes('Independently validate'));
 assert.deepEqual(mayaLeaks,[],'Dream Day responses carry no operator-only information');
 assert.equal((await api(north,'champion-decisions',champToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,409,'no second approval');
 await op.reload();await op.getByText('Champion approval complete: approved by Maya Chen in Dream Day').waitFor();
 await prepare('lumen',LUMEN);
 await addPeople([['Sam Okafor','Developer']]);
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 await submitDraft('Mark ready for Champion review');await op.getByRole('heading',{name:'Submitted for Champion review'}).waitFor();
 const priya=await (await browser.newContext()).newPage();watch(priya);await signInAs(priya,'Priya Nair');
 await priya.getByRole('link',{name:'Team Coordination'}).click();
 await championAssigns(priya,[[1,'Sam Okafor']]);await championApproves(priya);await priya.close();
 console.log('Both customers approved in Dream Day');
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
 assert.deepEqual(listed.map(t=>t.split('\n')[0].replace(/\s+/g,' ').trim()),['Chris Account operator','Maya Chen Champion','Alex Rivera Developer','Jordan Lee Developer','Sam Okafor Developer','Priya Nair Champion']);
 await signInAs(dev,'Alex Rivera','/login');
 await dev.getByRole('heading',{name:/First up/}).waitFor();
 assert.equal(new URL(dev.url()).pathname,'/portal');
 const alexWork=await dev.getByLabel('Your assigned work').innerText();
 assert.ok(alexWork.includes('Review checkout-api repository readiness')&&alexWork.includes('Approved by Maya Chen in Dream Day'),alexWork);
 assert.ok(!alexWork.includes('Independently validate'),'Alex sees only his own approved work');
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


 console.log('Phase 5: Alex works on his approved milestone; AiKA answers from approved context');
 const ALEX='Review checkout-api repository readiness',JORDAN='Independently validate that checkout-api and its docs are discoverable';
 await dev.goto(url+'/activation/work');
 const card=dev.locator(`[aria-label^="Milestone: ${ALEX}"]`);await card.waitFor();
 assert.equal(await dev.locator(`[aria-label^="Milestone: ${JORDAN}"]`).count(),0,'Jordan’s workspace is not shown to Alex');
 assert.ok((await dev.getByLabel('Team milestones').innerText()).includes('Jordan Lee'));
 assert.ok((await dev.locator('body').innerText()).includes('Approved by Maya Chen in Dream Day'));
 const status=c=>c.locator('[data-testid=milestone-status]').innerText();
 await card.getByLabel('Status of action 1').selectOption('started');await card.getByText(/Started by Alex Rivera/).waitFor();
 await card.getByLabel('Note type').selectOption('blocker');
 await card.getByLabel('Short note').fill('No read access to northstar/platform yet.');
 await card.getByLabel('Evidence reference').fill('https://example.test/northstar/access-request/17');
 await card.getByRole('button',{name:'Record blocker'}).click();await card.getByText('No read access to northstar/platform yet.').waitFor();
 assert.equal(await status(card),'Blocked');
 await card.getByRole('button',{name:'Mark ready for review'}).click();
 await card.getByRole('alert').filter({hasText:'open blockers are resolved'}).waitFor();
 await dev.reload();await card.waitFor();assert.equal(await status(card),'Blocked','progress survives a refresh');
 if(process.env.E2E_SCREENSHOTS)await dev.screenshot({path:join(process.env.E2E_SCREENSHOTS,'my-work.png'),fullPage:true});
 assert.ok((await card.innerText()).includes('Reference (reported, not verified)'));
 // The shared developer credential has no identity: it can read but never change anyone's work.
 const ids=await (await api(north,'milestone-work',alexToken)).json();const alexId=ids.milestones.find(x=>x.title.startsWith(ALEX)).id,jordanId=ids.milestones.find(x=>x.title.startsWith(JORDAN)).id;
 assert.equal((await api(north,'milestone-updates',devToken,{milestoneId:alexId,expectedRevision:2,status:'in_progress'})).status,403,'shared token cannot update');
 assert.equal((await api(north,'milestone-updates',alexToken,{milestoneId:jordanId,expectedRevision:0,status:'in_progress'})).status,403,'Alex cannot change Jordan’s work');
 assert.equal((await api(north,'milestone-updates',opToken,{milestoneId:alexId,expectedRevision:2,status:'in_progress'})).status,403,'Chris cannot change developer work');
 // AiKA, through the Portal API only.
 const modelCalls=[];dev.on('request',r=>{if(r.url().startsWith(ollamaUrl)||r.url().includes(':11434'))modelCalls.push(r.url());});
 await card.getByRole('button',{name:'Ask AiKA about this milestone'}).click();await dev.waitForURL(/\/aika\?milestone=/);
 assert.equal(await dev.getByLabel('Milestone for AiKA').inputValue(),alexId);
 await dev.getByRole('button',{name:'What should I do next on this milestone?'}).click();
 const answer=dev.getByLabel('AiKA answer');await answer.locator('.pt-aika-sections').waitFor({timeout:20000});
 const said=await answer.innerText();
 if(process.env.E2E_SCREENSHOTS)await dev.screenshot({path:join(process.env.E2E_SCREENSHOTS,'aika.png'),fullPage:true});
 assert.ok(said.includes(`Your milestone is ${ALEX}`)&&said.includes('Known')&&said.includes('Reported')&&said.includes('Suggestion')&&said.includes('Unknown'),said);
 assert.ok(!said.includes('I inspected')&&said.includes('1 part was removed'),'claimed inspections are removed: nothing was inspected');
 const prompt=aikaPrompts.at(-1);
 assert.ok(prompt.includes(`YOUR MILESTONE (the question is about this one): ${ALEX}`)&&prompt.includes('No read access to northstar/platform yet.')&&prompt.includes('REPOSITORY EVIDENCE: none'));
 assert.ok(prompt.includes(`TEAM MILESTONE: ${JORDAN}`),'other milestones by title and status only');
 for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','solutions engineer','Fictional platform lead'])assert.ok(!prompt.includes(x),'AiKA context leaks '+x);
 assert.deepEqual(modelCalls,[],'the browser never talks to the model');
 aikaMode='down';
 await dev.getByLabel('Question for AiKA').fill('What does my milestone depend on?');await dev.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 await answer.getByRole('alert').filter({hasText:'AiKA couldn’t reach its model'}).waitFor({timeout:20000});aikaMode='ok';
 // Back to work: resolve the blocker, finish the actions, mark ready for review.
 await dev.goto(url+'/activation/work');await card.waitFor();
 await card.getByRole('button',{name:'Mark blocker resolved'}).click();await card.getByText(/resolved by Alex Rivera/).waitFor();
 const actions=await card.locator('[aria-label^="Status of action"]').count();
 for(let i=1;i<=actions;i++){await card.getByLabel(`Status of action ${i}`).selectOption('completed');await dev.waitForFunction(([a,n])=>{const s=document.querySelector(`[aria-label^="${a}"] [aria-label="Status of action ${n}"]`);return s&&!s.disabled&&s.value==='completed';},[`Milestone: ${ALEX}`,i]);}
 await card.getByRole('button',{name:'Mark ready for review'}).click();
 await dev.waitForFunction(a=>document.querySelector(`[aria-label^="${a}"] [data-testid=milestone-status]`)?.textContent==='Ready for review',`Milestone: ${ALEX}`);

 // --- Chris reviews evidence-backed follow-up.
 await op.goto(url+'/operator/progress');await op.getByRole('button',{name:'Account: Chris'}).waitFor();
 await op.getByText('Chris intervention requested',{exact:true}).waitFor();
 assert.ok((await op.getByLabel('Chris team handoff summary').innerText()).includes('blocked'));
 assert.ok((await op.getByLabel('Developer activity').innerText()).includes('deploy to staging'));
 const opProgress=await op.getByLabel('Approved milestone progress').innerText();
 assert.ok(opProgress.includes(ALEX)&&opProgress.includes('Ready for review')&&opProgress.includes('Jordan Lee'),opProgress);
 const state=await (await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).json();
 assert.equal(state.chrisHelp.status,'requested');assert.equal(state.planRevision,1);

 // --- Customer isolation: Lumen sees only its own onboarding.
 const other=await (await browser.newContext({viewport:{width:1920,height:1042}})).newPage();watch(other);
 await signInAs(other,'Sam Okafor','/activation');
 await other.getByRole('tab',{name:'Overview'}).waitFor();text=await other.locator('body').innerText();
 assert.ok(text.includes('Software Template')&&text.includes('lumen/recs-service')&&!text.includes('checkout-api')&&!text.includes('Okta'));
 assert.equal(await other.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403);
 assert.equal((await fetch(`${lumen.apiOrigin}/api/activation/v1/customers/${lumen.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).status,403);
 assert.equal((await api(lumen,'milestone-work',alexToken)).status,403,'Alex’s credential does not open another customer’s work');
 await other.goto(url+'/activation/work');await other.locator('[aria-label^="Milestone: "]').first().waitFor();
 text=await other.locator('body').innerText();assert.ok(!text.includes('checkout-api')&&!text.includes('Alex Rivera'));
 const before=aikaPrompts.length;
 await other.goto(url+'/aika');await other.getByLabel('Question for AiKA').fill('What should I do first?');await other.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 await other.getByRole('alert').filter({hasText:'AiKA isn’t connected to a model'}).waitFor();assert.equal(aikaPrompts.length,before,'Lumen never reaches Northstar’s model');

 // --- Maya: the approved plan in Team overview, same as Dream Day; Jordan: only his approved work.
 await maya.getByRole('tab',{name:'Team overview'}).click();await maya.getByLabel('Proposed work').waitFor();
 const work=await maya.getByLabel('Proposed work').innerText();
 assert.ok(work.includes('Approved work')&&work.includes('Alex Rivera')&&work.includes('Jordan Lee'),work);
 assert.ok(!(await maya.locator('body').innerText()).includes('renewal'));
 await maya.reload();await maya.getByLabel('Proposed work').waitFor();assert.equal(new URL(maya.url()).pathname,'/champion/team','reload keeps the persona and page');
 assert.equal(await maya.evaluate(async c=>(await fetch(`/operator-api/northstar/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the Champion has no operator access');
 const jordan=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(jordan);
 await signInAs(jordan,'Jordan Lee');await jordan.getByLabel('Your assigned work').waitFor();
 const jordanWork=await jordan.getByLabel('Your assigned work').innerText();
 assert.ok(jordanWork.includes('Independently validate that checkout-api and its docs are discoverable')&&jordanWork.includes('Starts after: Review checkout-api repository readiness'),jordanWork);
 assert.equal(await jordan.locator('[aria-label^="Assigned: "]').count(),1,'Jordan sees only his own approved work');
 assert.equal(await jordan.getByRole('link',{name:'Team Coordination'}).count(),0);
 assert.equal(await jordan.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/champion-review`)).status,north.customerId),403,'developers cannot open Dream Day');
 console.log('Phase 5: Jordan works independently; his work waits for Alex’s');
 await jordan.getByRole('link',{name:'Open my work'}).click();
 const jcard=jordan.locator(`[aria-label^="Milestone: ${JORDAN}"]`);await jcard.waitFor();
 const jteam=await jordan.getByLabel('Team milestones').innerText();
 assert.ok(jteam.includes(ALEX)&&jteam.includes('Ready for review'),jteam);
 assert.ok(!(await jordan.locator('body').innerText()).includes('No read access to northstar/platform'),'Alex’s notes stay in his workspace');
 assert.ok((await jcard.innerText()).includes('can only be completed after Alex Rivera’s work'));
 const jactions=await jcard.locator('[aria-label^="Status of action"]').count();
 for(let i=1;i<=jactions;i++){await jcard.getByLabel(`Status of action ${i}`).selectOption('completed');await jordan.waitForFunction(([a,n])=>{const s=document.querySelector(`[aria-label^="${a}"] [aria-label="Status of action ${n}"]`);return s&&!s.disabled&&s.value==='completed';},[`Milestone: ${JORDAN}`,i]);}
 await jcard.getByRole('button',{name:'Mark completed'}).click();
 await jcard.getByRole('alert').filter({hasText:'the work it depends on is completed by its owner'}).waitFor();
 assert.equal(await jcard.locator('[data-testid=milestone-status]').innerText(),'In progress','dependent work is never completed early or automatically');
 const mine=await jordan.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 assert.equal(mine.milestones.find(x=>x.title.startsWith(ALEX)).detail,null,'Alex’s workspace detail is not sent to Jordan');
 assert.ok(mine.milestones.find(x=>x.title.startsWith(JORDAN)).detail.actions.every(a=>a.by==='Jordan Lee'),'Jordan’s changes are attributed to Jordan');
 await maya.goto(url+'/champion/team');const team=await maya.getByLabel('Team progress').innerText();
 assert.ok(team.includes('Alex Rivera')&&team.includes('Jordan Lee')&&team.includes('Ready for review'),team);
 if(process.env.E2E_SCREENSHOTS){await jordan.screenshot({path:join(process.env.E2E_SCREENSHOTS,'jordan-work.png'),fullPage:true});await maya.screenshot({path:join(process.env.E2E_SCREENSHOTS,'maya-team.png'),fullPage:true});}

 // --- Sign-out ends the session; mobile layouts do not overflow.
 await dev.getByRole('button',{name:/Account:/}).click();await dev.getByRole('menuitem',{name:'Sign out'}).click();
 await dev.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 assert.equal(await dev.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),401);
 const entry=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();watch(entry);await entry.goto(url+'/login');await entry.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 for(const page of [op,other,maya,entry]){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: one entry → persona sign-in (Chris, Maya, Alex, Jordan, Sam, Priya) → Chris: saved information, background analysis, edited multi-milestone draft (survives reload), submitted → Dream Day: Maya assigns Alex and Jordan, requests changes; Chris revises and resubmits; Maya approves; bypass, Chris and developer approvals refused; Lumen approved by its own Champion → Alex: personalized onboarding, question + blocker replan, direction + team plan (survives refresh), GitHub fail-closed, typed operator URL refused → Chris follow-up → Maya: approved plan in Team overview, reload keeps persona → Jordan: only his approved work, no Dream Day → Phase 5: Alex and Jordan work separately with attributed, revision-checked updates that survive refresh; blockers block review; dependent work never completes early; shared/operator/cross-customer credentials refused; AiKA via a local stub model gets approved context only, labels answers, removes claimed inspections, reports failure; Maya and Chris see consolidated progress; role denial at session layer and API, no browser tokens, two-customer isolation, sign-out, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 stubOllama.close();rmSync(directory,{recursive:true,force:true});
}
