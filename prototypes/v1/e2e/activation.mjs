/** Real browser + two real local SQLite APIs (two fictional customers). No external calls or writes. */
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH??'playwright');
const {makePdf}=await import('../../../services/workflow-api/test/support/pdf.mjs');
const frontend=fileURLToPath(new URL('..',import.meta.url)),repo=resolve(frontend,'../..');
const directory=mkdtempSync(join(tmpdir(),'spotify-handoff-e2e-'));
const children=[];let browser;
async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(args,cwd,env,ready){
 const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(child);let output='';
 child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 const end=Date.now()+20000;while(Date.now()<end){if(child.exitCode!==null)throw Error(output);if(ready(output))return;await new Promise(r=>setTimeout(r,100));}throw Error('Startup timeout: '+output);
}
const APERTURE=['PRIVATE CONTRACT NOTE: renewal discount pending; exclude from publication.',
 'FICTIONAL TEST: Aperture Engineering wants to onboard its existing checkout-api, a Node.js/TypeScript service in the GitHub monorepo aperture/platform.',
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
// Phase 7: once the prompt carries a recorded live CODEOWNERS observation, the stub cites it in a "verified" part and
 // adds an uncited repository claim, which AiKA must remove.
 const owners=/\[(obs-[a-f0-9]{10})\] OBSERVED \(live, read-only\) example-org\/checkout-api@[a-f0-9]{12} codeowners/.exec(prompt)?.[1];
 if(owners){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({message:{content:JSON.stringify({sections:[{kind:'verified',text:'CODEOWNERS at .github/CODEOWNERS names @example-org/checkout-team.',citations:[owners]},
  {kind:'known',text:'The repository has a catalog-info.yaml and passing CI.',citations:[]},{kind:'suggestion',text:'Confirm with @example-org/checkout-team that they own checkout-api.',citations:[]}],next_step:null})},done:true}));return;}
 const content=JSON.stringify({sections:[{kind:'known',text:`Your milestone is ${focus}.`},{kind:'reported',text:'You reported a blocker about repository access.'},
  {kind:'known',text:'I inspected the repository and verified the CODEOWNERS file.'},{kind:'suggestion',text:'Resolve the access blocker with your Champion before the next action.'},
  {kind:'unknown',text:'Which CI system deploys it is not stated; your Champion could answer.'}],next_step:'Mark the next action started once access is granted.'});
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({message:{content},done:true,eval_count:40,eval_duration:1e9}));});});
// A loopback stand-in for GitHub's REST API (a test double, not GitHub): one repository, GET only. Every request is
// recorded so the test can prove the inspector only reads. githubMode switches it to a rate limit.
const githubCalls=[];let githubMode='ok';
const GH_FILES={'README.md':'# checkout-api\n\nTest double content.\n','.github/CODEOWNERS':'* @example-org/checkout-team\n','.github/workflows/ci.yml':'name: ci\non: [push]\n',
 'docs/index.md':'# Docs\n','mkdocs.yml':'site_name: checkout-api\n','Dockerfile':'FROM scratch\n','src/index.ts':'export {};\n'};
const ghSha=c=>{const b=Buffer.from(c);return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');};
const stubGitHub=createHttpServer((req,res)=>{
 githubCalls.push({method:req.method,path:req.url,auth:req.headers.authorization??null});
 const json=(v,status=200,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(v));};
 if(githubMode==='limit')return json({message:'API rate limit exceeded'},403,{'x-ratelimit-remaining':'0','x-ratelimit-reset':String(Math.floor(Date.now()/1000)+900)});
 const root='/repos/example-org/checkout-api',commit='c'.repeat(40),tree='d'.repeat(40);
 if(req.method!=='GET')return json({message:'read-only test double'},405);
 if(req.url===root)return json({full_name:'example-org/checkout-api',default_branch:'main',html_url:'https://github.com/example-org/checkout-api',pushed_at:'2026-10-28T10:00:00Z',visibility:'private',archived:false});
 if(req.url===`${root}/commits/main`)return json({sha:commit,commit:{committer:{date:'2026-10-28T09:00:00Z'},tree:{sha:tree}}});
 if(req.url===`${root}/git/trees/${tree}?recursive=1`)return json({sha:tree,truncated:false,tree:Object.entries(GH_FILES).map(([path,c])=>({path,type:'blob',mode:'100644',sha:ghSha(c),size:Buffer.byteLength(c)}))});
 const blob=/\/git\/blobs\/([a-f0-9]{40})$/.exec(req.url??'');const file=blob&&Object.values(GH_FILES).find(c=>ghSha(c)===blob[1]);
 if(file)return json({sha:blob[1],encoding:'base64',size:Buffer.byteLength(file),content:Buffer.from(file).toString('base64')});
 return json({message:'Not Found'},404);
});
try{
 await new Promise(r=>stubGitHub.listen(0,'127.0.0.1',r));const githubOrigin=`http://127.0.0.1:${stubGitHub.address().port}`;
 await new Promise(r=>stubOllama.listen(0,'127.0.0.1',r));const ollamaUrl=`http://127.0.0.1:${stubOllama.address().port}`;
 const uiPort=await port(),url=`http://127.0.0.1:${uiPort}`;
 const customers=[{id:'aperture',label:'Aperture Engineering',customerId:'fictional-aperture-engineering'},{id:'lumen',label:'Lumen Retail',customerId:'fictional-lumen-retail'}];
 for(const c of customers){
  c.dir=join(directory,c.id);mkdirSync(c.dir,{mode:0o700});
  // Phase 7: Aperture's checkout-api in live mode against the GitHub test double; Lumen's service as labelled sample data.
  c.repositories=join(c.dir,'repositories.json');
  if(c.id==='lumen')writeFileSync(join(c.dir,'recs-fixture.json'),JSON.stringify({repository:'lumen/recs-service',defaultBranch:'main',commit:'e'.repeat(40),committedAt:'2026-10-01T00:00:00Z',pushedAt:'2026-10-01T00:00:00Z',
   files:{'README.md':'# recs-service (sample)\n','.github/workflows/ci.yml':'name: ci\n'}}));
  writeFileSync(c.repositories,JSON.stringify(c.id==='lumen'?[{customerId:c.customerId,id:'recs-service',label:'recs-service',repository:'lumen/recs-service',mode:'fixture',fixture:join(c.dir,'recs-fixture.json'),services:['recs-service','recommendation-service','lumen/recs-service','gitlab.com/lumen/recs-service']}]
   :[{customerId:c.customerId,id:'checkout-api',label:'checkout-api',repository:'example-org/checkout-api',mode:'live',services:['checkout-api']}]));c.apiOrigin=`http://127.0.0.1:${await port()}`;c.tokenFile=join(c.dir,'token');c.operatorTokenFile=join(c.dir,'operator-token');c.championTokenFile=join(c.dir,'champion-token');
  await start(['scripts/demo.ts','handoff'],join(repo,'services/workflow-api'),{PORT:c.apiOrigin.split(':')[2],ACTIVATION_DEMO_DIR:c.dir,ACTIVATION_DEMO_CUSTOMER_ID:c.customerId,ACTIVATION_DEMO_FRONTEND_ORIGIN:url,
   ACTIVATION_REPOSITORIES_PATH:c.repositories,ACTIVATION_INSPECTION_COOLDOWN_SECONDS:'0',
   ...(c.id==='aperture'?{ACTIVATION_GITHUB_API_ORIGIN:githubOrigin,ACTIVATION_GITHUB_REPOSITORY_TOKEN:'e2e-read-only-test-token'}:{}),
   // Each developer gets their own credential; Aperture's AiKA uses the stub model, Lumen's has none.
   ACTIVATION_DEMO_DEVELOPERS:c.id==='lumen'?'sam=Sam Okafor':'alex=Alex Rivera,jordan=Jordan Lee',
   ...(c.id==='aperture'?{AIKA_LLM_PROVIDER:'ollama',OLLAMA_URL:ollamaUrl,OLLAMA_MODEL:'stub-model',OLLAMA_RETRIES:'0',OLLAMA_TIMEOUT_MS:'10000'}:{AIKA_LLM_PROVIDER:'',PORTAL_LLM_PROVIDER:''})},out=>out.includes('FICTIONAL DEMO API:'));
 }
 const accounts=join(directory,'accounts.json');
 // One entry, six fictional personas: Chris across both customers; Maya (Champion), Alex and Jordan at Aperture; Sam and Priya (Champion) at Lumen.
 writeFileSync(accounts,JSON.stringify({customers:customers.map(({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile,championTokenFile})=>({id,label,customerId,apiOrigin,tokenFile,operatorTokenFile,championTokenFile})),
  personas:[{id:'chris',name:'Chris',role:'operator',title:'Spotify account operator',customers:['aperture','lumen']},{id:'maya',name:'Maya Chen',role:'champion',title:'Platform Champion',customers:['aperture']},
   {id:'alex',name:'Alex Rivera',role:'developer',title:'Developer',customers:['aperture']},{id:'jordan',name:'Jordan Lee',role:'developer',title:'Developer',customers:['aperture']},{id:'sam',name:'Sam Okafor',role:'developer',title:'Developer',customers:['lumen']},{id:'priya',name:'Priya Nair',role:'champion',title:'Platform Champion',customers:['lumen']}]}),{mode:0o600});
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

 // --- Chris: PDF → draft → proposed plan for the Champion (both customers).
 const op=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(op);
 const opTraffic=[];op.on('request',r=>{if(r.url().includes('-api/'))opTraffic.push(r.url());if(r.headers().authorization)opTraffic.push('BEARER '+r.url());});
 await signInAs(op,'Chris');assert.equal(new URL(op.url()).pathname,'/operator','Chris starts in Customer Onboarding');
 assert.ok(!(await op.content()).includes(opToken),'operator token never reaches the page');
 assert.equal(await op.getByLabel('Operator access token').count(),0,'no token entry');
 // Opens a collapsible section by its id (closed sections show only their header).
 const openSection=async(page,id)=>{const head=page.locator(`#${id} > .pt-section-head`);await head.waitFor();if(await head.getAttribute('aria-expanded')!=='true')await head.click();};
 const editMilestone=async(page,n)=>{if(!(await page.getByLabel(`Milestone ${n} title`).count()))await page.getByRole('button',{name:`Edit milestone ${n}`,exact:true}).click();};
 async function prepare(account,notes){
  await op.getByLabel('Customer account').selectOption(account);await op.getByRole('tab',{name:'Customer Context'}).click();
  // One way in: a PDF. No entry fields, no save or analyze buttons.
  for(const old of ['Information 1 text','Information 1 name'])assert.equal(await op.getByLabel(old).count(),0,`no ${old}`);
  for(const old of ['Add information','Save information','Analyze customer'])assert.equal(await op.getByRole('button',{name:old}).count(),0,`no ${old}`);
  const pdf=makePdf([{lines:[{text:'Discovery call',size:14,bold:true},...notes.split('\n').map(text=>({text})),{text:''},{text:'Tools and integrations',size:14,bold:true},{text:'Docs live in Confluence; CI runs in GitHub Actions.'}]}],{compress:true});
  await op.getByLabel('Customer PDF').setInputFiles({name:`${account} discovery.pdf`,mimeType:'application/pdf',buffer:pdf});
  await op.getByText(`${account} discovery.pdf`).waitFor();await op.getByText('Fully read').waitFor();
  // Analysis runs by itself and Chris lands on the draft: no repository, wiki or sign-in step in between.
  await op.waitForURL(url+'/operator/draft',{timeout:20000});
  await op.getByLabel('Draft overview').waitFor();await op.getByLabel('Onboarding milestones').waitFor();
 }
 async function addPeople(people){
  await openSection(op,'draft-people');
  for(const [name,role] of people){
   const n=await op.getByLabel('Stakeholder list').locator('li[aria-label^="Stakeholder "]').count();
   await op.getByRole('button',{name:'Add stakeholder'}).click();
   await op.getByLabel(`Stakeholder ${n+1} name`).fill(name);await op.getByLabel(`Stakeholder ${n+1} role`).fill(role);
  }
 }
 async function sendToChampion(label){
  await op.getByRole('checkbox',{name:/I checked this proposal/}).check();
  await op.getByRole('button',{name:label}).click();
 }
 async function championApproves(page){
  await page.getByRole('checkbox',{name:/I reviewed the technical goals and milestones/}).check();
  await page.getByRole('button',{name:'Approve onboarding plan'}).click();
  await page.getByLabel('Approved responsibilities').waitFor();
 }
 await prepare('aperture',APERTURE);
 assert.ok((await op.getByLabel('Kept internal').innerText()).includes('Kept internal'));
 // The draft reads as an overview first; facts and stakeholders stay closed until Chris opens them.
 for(const id of ['draft-facts','draft-people','draft-questions','draft-problems'])assert.equal(await op.locator(`#${id} > .pt-section-head`).getAttribute('aria-expanded'),'false',id);
 const draftText=await op.locator('body').innerText();
 for(const x of [/Inspect repository/,/Connect (a |your )?repositor/,/Integration tools/])assert.ok(!x.test(draftText),'no technical-setup task for Chris: '+x);
 // Edit: retitle the first milestone, add a second one that depends on it, name the technical team; save.
 await editMilestone(op,1);await op.getByLabel('Milestone 1 title').fill('Review checkout-api repository readiness and prepare it for Catalog registration');
 await op.getByRole('button',{name:'Add milestone'}).click();
 await op.getByLabel('Milestone 2 title').fill('Validate that checkout-api is discoverable in the Catalog');
 await op.getByLabel('Milestone 2 system').fill('checkout-api · aperture/platform');
 await op.getByLabel('Milestone 2 actions').fill('Search the Catalog for checkout-api\nOpen its docs link');
 await op.getByLabel('Milestone 2 completion criteria').fill('checkout-api is found from Catalog search with a working docs link');
 await op.getByLabel('Milestone 2',{exact:true}).getByRole('checkbox').check();
 await addPeople([['Maya Chen','Champion, Platform Engineering'],['Alex Rivera','Developer'],['Jordan Lee','Developer']]);
 assert.ok((await op.getByLabel('Stakeholder list').innerText()).includes('Responsibility not specified in the sources'),'no invented responsibilities');
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 // Persisted on the server: a reload brings the edited draft back.
 await op.reload();await op.getByLabel('Draft overview').waitFor();
 assert.ok((await op.getByLabel('Draft overview').innerText()).includes('Validate that checkout-api is discoverable in the Catalog'));
 // Sent as a proposed plan, with open questions and unknown owners left for the Champion.
 await sendToChampion('Send to Champion for review');
 await op.getByRole('heading',{name:'Submitted for Champion review'}).waitFor();
 // Submission publishes nothing: the developer credential still has no onboarding, and no workspace route.
 assert.equal((await api(north,'state',devToken)).status,404,'developers see nothing after submission');
 assert.equal((await api(north,'handoff',devToken)).status,403);
 const early=await (await browser.newContext()).newPage();watch(early);await signInAs(early,'Alex Rivera');
 await early.getByText('Your team’s plan isn’t approved yet').waitFor();
 assert.ok(!(await early.locator('body').innerText()).includes('Validate that checkout-api'),'Alex does not see the submitted draft');
 await early.close();

 // --- Dream Day: Maya sees the plan at a glance, edits one milestone, sends one point back, then approves.
 const ALEX='Review checkout-api repository readiness',JORDAN='Independently validate that checkout-api and its docs are discoverable';
 const maya=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(maya);
 const mayaLeaks=[];maya.on('response',async r=>{if(!r.url().includes('/portal-api/'))return;const body=await r.text().catch(()=>'');for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Discovery call','Kept internal'])if(body.includes(x))mayaLeaks.push(x);});
 await signInAs(maya,'Maya Chen');
 await maya.getByRole('button',{name:'Open Dream Day'}).click();await maya.getByLabel('Dream Day',{exact:true}).waitFor();
 assert.ok((await maya.getByLabel('Dream Day review').innerText()).includes('Waiting for your review'));
 const glance=await maya.getByLabel('Proposed plan').innerText();
 assert.ok(glance.includes('Validate that checkout-api is discoverable in the Catalog')&&glance.includes('Proposed by Chris · nothing changed yet'),glance);
 for(const id of ['dd-problems','dd-facts','dd-people'])assert.equal(await maya.locator(`#${id} > .pt-section-head`).getAttribute('aria-expanded'),'false','supporting context is collapsed: '+id);
 assert.equal(await maya.getByRole('button',{name:/Inspect repository/}).count(),0,'the Champion inspects nothing');
 // A targeted edit: one title and one optional suggested owner. Milestone 2 keeps no owner.
 await editMilestone(maya,2);await maya.getByLabel('Milestone 2 title').fill(JORDAN);
 await editMilestone(maya,1);await maya.getByLabel('Milestone 1 suggested owner').selectOption('Alex Rivera');
 await maya.getByRole('button',{name:'Save draft'}).click();await maya.getByLabel('Review status').getByText(/^Saved$/).waitFor();
 await maya.getByLabel('Proposed plan').getByText(/Your last saved changes: Edited 2 milestones/).waitFor();
 assert.equal((await api(north,'state',devToken)).status,404,'saving is not approving');
 // Chris sees her changes as updates he doesn't approve.
 await op.reload();await op.getByLabel('Champion updates').waitFor();
 assert.ok((await op.getByLabel('Champion updates').innerText()).includes('Maya Chen updated the plan'));
 // Sending it back is optional; here one point only Chris can answer.
 await maya.getByText('Send it back to Chris instead (optional)').click();
 await maya.getByLabel('What should Chris change?').fill('Please confirm which CI system deploys checkout-api before Alex starts.');
 await maya.getByRole('button',{name:'Request changes'}).click();
 await maya.getByLabel('Dream Day review').getByText('Changes requested',{exact:true}).waitFor();
 assert.equal((await api(north,'state',devToken)).status,404,'returned plans never reach developers');
 // Chris sees the feedback, answers with a question entry, and resubmits.
 await op.reload();await op.getByLabel('Champion feedback').waitFor();
 assert.ok((await op.getByLabel('Champion feedback').innerText()).includes('Please confirm which CI system deploys checkout-api'));
 assert.ok((await op.getByLabel('Draft overview').innerText()).includes('Alex Rivera'),'Maya’s suggested owner carries back to Chris');
 await openSection(op,'draft-questions');await op.getByRole('button',{name:'Add question'}).click();
 await op.getByRole('textbox',{name:/^Question \d+$/}).last().fill('Confirm with Maya that CI runs in GitHub Actions.');
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 await sendToChampion('Resubmit for Champion review');
 await op.getByRole('heading',{name:'Resubmitted for Champion review'}).waitFor();
 // Chris and developers cannot approve; nobody can publish around Dream Day.
 assert.equal((await api(north,'champion-decisions',opToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,403);
 assert.equal((await api(north,'champion-decisions',devToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,403);
 const bypass=await op.evaluate(async c=>{const r=await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff-publications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:1,fromReview:true,outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true})});return [r.status,(await r.json()).error.code];},north.customerId);
 assert.deepEqual(bypass,[403,'CHAMPION_APPROVAL_REQUIRED'],'the removed publishing bypass is refused on the server');
 assert.equal((await api(north,'champion-review',devToken)).status,403,'developers cannot open Dream Day');
 // Maya approves without an owner on every milestone.
 await maya.reload();await maya.getByLabel('Dream Day review').getByText('Resubmitted · waiting for your review').waitFor();
 await championApproves(maya);
 const responsibilities=await maya.getByLabel('Approved responsibilities').innerText();
 assert.ok(responsibilities.includes('Alex Rivera')&&responsibilities.includes('Anyone')&&responsibilities.includes('Independently validate'),responsibilities);
 assert.deepEqual(mayaLeaks,[],'Dream Day responses carry no operator-only information');
 assert.equal((await api(north,'champion-decisions',champToken,{draft:1,reviewRevision:99,decision:'approve',confirmed:true})).status,409,'no second approval');
 await op.reload();await op.getByText('Champion approval complete: approved by Maya Chen in Dream Day').waitFor();
 assert.ok((await op.getByLabel('Dream Day review history').innerText()).includes('Changed by the Champion'),'Chris sees what the Champion changed');
 // A scanned PDF (images only) is refused with an explanation; nothing is analyzed, and a text PDF then works.
 await op.getByLabel('Customer account').selectOption('lumen');await op.getByRole('tab',{name:'Customer Context'}).click();
 await op.getByLabel('Customer PDF').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:makePdf([{image:true},{image:true}])});
 await op.getByRole('alert').getByText(/No text could be read from this PDF \(2 pages\)\. It looks like a scan/).waitFor();
 assert.equal(await op.getByRole('button',{name:'Review the onboarding draft'}).count(),0,'nothing analyzed');
 await prepare('lumen',LUMEN);
 await addPeople([['Sam Okafor','Developer']]);
 await op.getByRole('button',{name:'Save draft'}).click();await op.getByLabel('Draft status').getByText(/^Saved/).waitFor();
 await sendToChampion('Send to Champion for review');await op.getByRole('heading',{name:'Submitted for Champion review'}).waitFor();
 const priya=await (await browser.newContext()).newPage();watch(priya);await signInAs(priya,'Priya Nair');
 await priya.getByRole('link',{name:'Team Coordination'}).click();await priya.getByLabel('Your decision').waitFor();
 await championApproves(priya);await priya.close();
 console.log('Both customers approved in Dream Day');
 // Same Portal shell, separate navigation targets and access.
 assert.equal(await op.locator('.pt-shell .pt-side').count(),1);
 assert.equal(await op.getByRole('link',{name:'Customer Onboarding'}).getAttribute('href'),'/operator');
 assert.equal(await op.locator('a[href^="/portal"],a[href="/activation"]').count(),0);
 assert.ok(opTraffic.length>0&&opTraffic.every(u=>u.includes('/operator-api/')),'Chris uses only the operator API, without bearer tokens in the browser');
 assert.equal(await op.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403,'Chris has no developer session');

 // --- Developer: welcome → simulated login → goals, opportunities and milestones to choose.
 const devContext=await browser.newContext({viewport:{width:1920,height:1042}});const dev=await devContext.newPage();watch(dev);
 const bearer=[];dev.on('request',r=>{if(r.headers().authorization)bearer.push(r.url());});
 const leaked=[];dev.on('response',async r=>{if(!r.url().includes('/portal-api/'))return;const body=await r.text().catch(()=>'');for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead','solutions engineer'])if(body.includes(x))leaked.push(x);});
 await dev.goto(url);await dev.getByRole('button',{name:'Get started'}).waitFor();await dev.keyboard.press('Tab');await dev.keyboard.press('Enter');
 await dev.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 const listed=await dev.locator('label.pt-account').allInnerTexts();
 assert.deepEqual(listed.map(t=>t.split('\n')[0].replace(/\s+/g,' ').trim()),['Chris Account operator','Maya Chen Champion','Alex Rivera Developer','Jordan Lee Developer','Sam Okafor Developer','Priya Nair Champion']);
 await signInAs(dev,'Alex Rivera','/login');
 assert.equal(new URL(dev.url()).pathname,'/portal');
 await dev.getByLabel('What you can build or improve').waitFor();
 const home=await dev.locator('body').innerText();
 assert.ok(home.includes(ALEX)&&home.includes('Suggested for you'),'Maya’s suggestion shows on Alex’s Home');
 for(const x of [/Chris/,/assigned to you/i,/Share your progress/,/Team & Evidence/])assert.ok(!x.test(home),'developer Home: '+x);
 // A typed URL for Chris's workspace explains instead of switching persona, and no operator call is made.
 const opCalls=[];dev.on('request',r=>{if(r.url().includes('/operator-api/'))opCalls.push(r.url());});
 await dev.goto(url+'/operator');await dev.getByText('This workspace is for the Spotify account operator').waitFor();
 await dev.getByRole('button',{name:'Account: Alex Rivera'}).waitFor();assert.deepEqual(opCalls,[]);
 assert.equal(await dev.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the session layer refuses operator access for a developer');
 await dev.goto(url+'/login');await dev.waitForURL(url+'/portal');
 let text=await dev.locator('body').innerText();
 for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead'])assert.ok(!text.includes(x),'developer page leaks '+x);
 assert.ok(!(await dev.content()).includes(devToken),'developer token never reaches the page');
 assert.equal(await dev.locator('a[href^="/operator"]').count(),0,'no operator links for developers');
 await dev.goto(url+'/activation');await dev.getByRole('tab',{name:'Overview'}).waitFor();
 assert.deepEqual(await dev.getByRole('tab').allInnerTexts(),['Overview','My milestones','Guide'],'no Repository, Evidence or Team tabs');
 // Opportunities: verified ones come from the Portal's own read-only observation, made after approval with nobody inspecting.
 await dev.locator('[data-basis=verified]').first().waitFor({timeout:20000});
 assert.ok(githubCalls.length>0&&[...new Set(githubCalls.map(c=>c.method))].join()==='GET','observed read-only');
 assert.ok(githubCalls.every(c=>c.path.startsWith('/repos/example-org/checkout-api')&&c.auth==='Bearer e2e-read-only-test-token'));
 assert.equal((await (await api(north,'repository-evidence',champToken)).json()).repositories[0].latest.requestedBy,'Spotify integration');
 assert.equal(await dev.getByRole('button',{name:/Inspect/}).count(),0,'developers inspect nothing');
 text=await dev.locator('body').innerText();
 assert.ok(text.includes('Nobody has picked it up yet')&&text.includes(JORDAN),'every approved milestone is visible to choose');
 assert.ok(!/Chris|Upload|Ask Chris|kickoff/i.test(text),'no Chris, uploads or kickoff for developers');
 // Developer credentials cannot publish (role denial at the API).
 assert.equal((await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/intake`,{method:'POST',headers:{Authorization:`Bearer ${devToken}`,'Content-Type':'application/json'},body:'{}'})).status,403);
 // Alex pursues a verified opportunity; the Guide shows its steps first.
 const verified=dev.locator('article.pt-opportunity:has([data-basis=verified])').first();
 const VERIFIED=(await verified.locator('h4').innerText()).trim();
 await verified.getByRole('button',{name:'Pursue this'}).click();await verified.getByText('(including you)').waitFor();
 await dev.getByRole('tab',{name:'Guide'}).click();
 assert.equal(await dev.locator('[aria-label^="Guide: "]').first().getAttribute('aria-label'),`Guide: ${VERIFIED}`);
 assert.equal(bearer.length,0,'developer browser never sends bearer tokens');

 console.log('Phase 5: Alex works on his suggested milestone; AiKA answers from approved context');
 await dev.goto(url+'/activation/work');
 const card=dev.locator(`section[aria-label^="Milestone: ${ALEX}"]`);await card.waitFor();
 assert.equal(await dev.locator(`section[aria-label^="Milestone: ${JORDAN}"]`).count(),0,'Alex hasn’t chosen Jordan’s milestone');
 assert.ok((await dev.getByLabel('Milestones to choose from').innerText()).includes(JORDAN));
 const status=c=>c.locator('[data-testid=milestone-status]').innerText();
 await card.getByLabel('Status of action 1').selectOption('started');await card.getByText(/Started by Alex Rivera/).waitFor();
 await card.getByLabel('Note type').selectOption('blocker');
 await card.getByLabel('Short note').fill('No read access to aperture/platform yet.');
 await card.getByLabel('Evidence reference').fill('https://example.test/aperture/access-request/17');
 await card.getByRole('button',{name:'Record blocker'}).click();await card.getByText('No read access to aperture/platform yet.').waitFor();
 assert.equal(await status(card),'Blocked');
 await card.getByRole('button',{name:'Mark ready for review'}).click();
 await card.getByRole('alert').filter({hasText:'open blockers are resolved'}).waitFor();
 await dev.reload();await card.waitFor();assert.equal(await status(card),'Blocked','progress survives a refresh');
 if(process.env.E2E_SCREENSHOTS)await dev.screenshot({path:join(process.env.E2E_SCREENSHOTS,'my-work.png'),fullPage:true});
 assert.ok((await card.innerText()).includes('Reference (reported, not verified)'));
 // The shared developer credential has no identity: it can read but never change anyone's work.
 const ids=await (await api(north,'milestone-work',alexToken)).json();const alexId=ids.milestones.find(x=>x.title.startsWith(ALEX)).id,jordanId=ids.milestones.find(x=>x.title.startsWith(JORDAN)).id;
 assert.equal((await api(north,'milestone-updates',devToken,{milestoneId:alexId,expectedRevision:2,status:'in_progress'})).status,403,'shared token cannot update');
 assert.equal((await api(north,'milestone-updates',alexToken,{milestoneId:jordanId,expectedRevision:0,status:'in_progress'})).status,403,'Alex cannot change a milestone he hasn’t chosen');
 assert.equal((await api(north,'milestone-updates',opToken,{milestoneId:alexId,expectedRevision:2,status:'in_progress'})).status,403,'Chris cannot change developer work');
 // AiKA, through the Portal API only.
 const modelCalls=[];dev.on('request',r=>{if(r.url().startsWith(ollamaUrl)||r.url().includes(':11434'))modelCalls.push(r.url());});
 await card.getByRole('button',{name:'Ask AiKA about this milestone'}).click();await dev.waitForURL(/\/aika\?milestone=/);
 assert.equal(await dev.getByLabel('What AiKA should focus on').inputValue(),`m:${alexId}`);
 await dev.getByRole('button',{name:/How do I get started on what I chose\?/}).click();
 const answer=dev.getByLabel('AiKA answer').last();await answer.locator('.pt-aika-sections').waitFor({timeout:20000});
 const said=await answer.innerText();
 if(process.env.E2E_SCREENSHOTS)await dev.screenshot({path:join(process.env.E2E_SCREENSHOTS,'aika.png'),fullPage:true});
 assert.ok(said.includes(`Your milestone is ${ALEX}`)&&said.includes('Known')&&said.includes('Reported')&&said.includes('Suggestion')&&said.includes('Unknown'),said);
 assert.ok(!said.includes('I inspected')&&said.includes('1 part was removed'),'claimed inspections are removed: AiKA inspected nothing');
 const prompt=aikaPrompts.at(-1);
 assert.ok(prompt.includes(`YOUR MILESTONE (the question is about this one): ${ALEX}`)&&prompt.includes('No read access to aperture/platform yet.')&&prompt.includes('CAPABILITIES CHOSEN: /my-work'),prompt);
 assert.ok(prompt.includes(`ENGINEERING SUGGESTION (you chose this): ${VERIFIED}`)&&prompt.includes('VERIFIED by a live read-only observation'),'AiKA knows the opportunity Alex chose');
 for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','solutions engineer','Fictional platform lead'])assert.ok(!prompt.includes(x),'AiKA context leaks '+x);
 assert.deepEqual(modelCalls,[],'the browser never talks to the model');
 aikaMode='down';
 await dev.getByLabel('Question for AiKA').fill('What does my milestone depend on?');await dev.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 await dev.getByLabel('AiKA answer').last().getByRole('alert').filter({hasText:'AiKA couldn’t reach its AI model'}).waitFor({timeout:20000});aikaMode='ok';
 // Back to work: resolve the blocker, finish the actions, mark ready for review.
 await dev.goto(url+'/activation/work');await card.waitFor();
 await card.getByRole('button',{name:'Mark blocker resolved'}).click();await card.getByText(/resolved by Alex Rivera/).waitFor();
 const actions=await card.locator('[aria-label^="Status of action"]').count();
 for(let i=1;i<=actions;i++){await card.getByLabel(`Status of action ${i}`).selectOption('completed');await dev.waitForFunction(([a,n])=>{const s=document.querySelector(`section[aria-label^="${a}"] [aria-label="Status of action ${n}"]`);return s&&!s.disabled&&s.value==='completed';},[`Milestone: ${ALEX}`,i]);}
 await card.getByRole('button',{name:'Mark ready for review'}).click();
 await dev.waitForFunction(a=>document.querySelector(`section[aria-label^="${a}"] [data-testid=milestone-status]`)?.textContent==='Ready for review',`Milestone: ${ALEX}`);
 // My progress: Alex's own milestone and the opportunity he chose, nothing about others.
 await dev.goto(url+'/progress');await dev.getByLabel('Milestones I’m working on').waitFor();
 assert.ok((await dev.getByLabel('Milestones I’m working on').innerText()).includes(ALEX));
 assert.ok((await dev.getByLabel('Opportunities I’m pursuing').innerText()).includes(VERIFIED));

 // --- Customer isolation: Lumen sees only its own onboarding.
 const other=await (await browser.newContext({viewport:{width:1920,height:1042}})).newPage();watch(other);
 await signInAs(other,'Sam Okafor','/activation');
 // Lumen's repository is sample data: its opportunities say so, and GitHub is never called for it.
 await other.getByRole('tab',{name:'Overview'}).waitFor();await other.locator('[data-basis=sample]').first().waitFor({timeout:20000});
 text=await other.locator('body').innerText();
 assert.ok(text.includes('recs-service')&&!text.includes('checkout-api')&&!text.includes('Okta'),text);
 assert.equal(await other.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),403);
 assert.equal((await fetch(`${lumen.apiOrigin}/api/activation/v1/customers/${lumen.customerId}/state`,{headers:{Authorization:`Bearer ${devToken}`}})).status,403);
 assert.equal((await api(lumen,'milestone-work',alexToken)).status,403,'Alex’s credential does not open another customer’s work');
 assert.ok(githubCalls.every(c=>c.path.startsWith('/repos/example-org/checkout-api')),'sample data never calls GitHub');
 const before=aikaPrompts.length;
 await other.goto(url+'/aika');await other.getByLabel('Question for AiKA').fill('What should I do first?');await other.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 await other.getByRole('alert').filter({hasText:'AiKA isn’t connected to a model'}).waitFor();assert.equal(aikaPrompts.length,before,'Lumen never reaches Aperture’s model');

 // --- Jordan chooses the milestone nobody picked up; his work waits for Alex's.
 const jordan=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(jordan);
 await signInAs(jordan,'Jordan Lee');await jordan.getByLabel('Your milestones').waitFor();
 assert.ok((await jordan.getByLabel('Your milestones').innerText()).includes('You haven’t chosen a milestone yet'),'nothing is assigned to Jordan');
 assert.equal(await jordan.getByRole('link',{name:'Team Coordination'}).count(),0);
 assert.equal(await jordan.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/champion-review`)).status,north.customerId),403,'developers cannot open Dream Day');
 await jordan.goto(url+'/activation');
 const choice=jordan.getByLabel('Milestones to choose from').locator(`[aria-label^="Milestone: ${JORDAN}"]`);await choice.waitFor();
 await choice.getByRole('button',{name:'Choose this milestone'}).click();await choice.getByText('Working on it: Jordan Lee').waitFor();
 await jordan.getByRole('tab',{name:'My milestones'}).click();
 const jcard=jordan.locator(`section[aria-label^="Milestone: ${JORDAN}"]`);await jcard.waitFor();
 assert.ok((await jcard.innerText()).includes('You chose this'));
 const jteam=await jordan.getByLabel('Milestones to choose from').innerText();
 assert.ok(jteam.includes(ALEX)&&jteam.includes('Ready for review'),jteam);
 assert.ok(!(await jordan.locator('body').innerText()).includes('No read access to aperture/platform'),'Alex’s notes stay in his workspace');
 assert.ok((await jcard.innerText()).includes('can only be completed after Alex Rivera’s work'));
 const jactions=await jcard.locator('[aria-label^="Status of action"]').count();
 for(let i=1;i<=jactions;i++){await jcard.getByLabel(`Status of action ${i}`).selectOption('completed');await jordan.waitForFunction(([a,n])=>{const s=document.querySelector(`section[aria-label^="${a}"] [aria-label="Status of action ${n}"]`);return s&&!s.disabled&&s.value==='completed';},[`Milestone: ${JORDAN}`,i]);}
 await jcard.getByRole('button',{name:'Mark completed'}).click();
 await jcard.getByRole('alert').filter({hasText:'the work it depends on is completed by its owner'}).waitFor();
 assert.equal(await jcard.locator('[data-testid=milestone-status]').innerText(),'In progress','dependent work is never completed early or automatically');
 const mine=await jordan.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 assert.equal(mine.milestones.find(x=>x.title.startsWith(ALEX)).detail,null,'Alex’s workspace detail is not sent to Jordan');
 assert.ok(mine.milestones.find(x=>x.title.startsWith(JORDAN)).detail.actions.every(a=>a.by==='Jordan Lee'),'Jordan’s changes are attributed to Jordan');
 await jcard.getByLabel('Note type').selectOption('question');
 await jcard.getByLabel('Short note').fill('Which docs site should the discoverability check cover?');
 await jcard.getByRole('button',{name:'Record question'}).click();await jcard.getByText('awaiting a reply').waitFor();

 console.log('Champion: team overview (goals, opportunities, adoption), coordination; Chris reads');
 await maya.goto(url+'/champion/team');await maya.getByLabel('Company goals').waitFor();
 assert.ok(!(await maya.locator('body').innerText()).includes('renewal'));
 // Prioritise and recommend the opportunity Alex chose; nothing is assigned.
 const mopp=maya.getByLabel('Improvement opportunities').locator(`[aria-label="Opportunity: ${VERIFIED}"]`);
 await mopp.getByText('Pursued by Alex Rivera').waitFor();
 await mopp.getByLabel(`Priority: ${VERIFIED}`).selectOption('high');await maya.waitForFunction(t=>document.querySelector(`[aria-label="Opportunity: ${t}"] select`)?.value==='high',VERIFIED);
 await mopp.getByRole('checkbox',{name:'Recommend to developers'}).check();await mopp.getByText('Recommended by your Champion').waitFor();
 const engagement=await maya.getByLabel('Developer engagement').innerText();
 assert.ok(engagement.includes('Alex Rivera')&&engagement.includes('Jordan Lee'),engagement);
 assert.equal(await maya.getByRole('button',{name:/Inspect/}).count(),0,'the Champion inspects nothing');
 // Coordination is one click away.
 await openSection(maya,'team-milestones');
 const mayaAlex=maya.locator('[aria-label^="Coordination: Review checkout-api repository readiness"]');await mayaAlex.waitFor();
 assert.ok((await mayaAlex.innerText()).includes('Suggested for Alex Rivera'));
 assert.ok((await maya.locator('[aria-label^="Coordination: Independently validate"]').innerText()).includes('Working on it: Jordan Lee'));
 const attention=await maya.getByLabel('Needs attention').innerText();
 assert.ok(attention.includes('Ready for your review')&&attention.includes('Unanswered question'),attention);
 const summary=await maya.getByLabel('Team progress').innerText();
 assert.match(summary,/AWAITING YOUR REVIEW\s*1/i);assert.match(summary,/COMPLETED\s*0 of 2/i);
 const mayaJordan=maya.locator('[aria-label^="Coordination: Independently validate"]');
 await mayaJordan.getByRole('button',{name:'Respond'}).click();
 await mayaJordan.getByLabel('Response').fill('Cover the TechDocs site for checkout-api only.');
 await mayaJordan.getByRole('button',{name:'Send response'}).click();await mayaJordan.getByText('Maya Chen (Champion)').waitFor();
 assert.ok((await mayaAlex.innerText()).includes('Reference (reported, not verified)'),'developer references are marked reported');
 await mayaAlex.getByRole('button',{name:'Mark reviewed'}).click();
 await maya.waitForFunction(a=>document.querySelector(`[aria-label^="${a}"] [data-testid=review-state]`)?.textContent==='Reviewed','Coordination: Review checkout-api');
 assert.equal(await mayaAlex.locator('[data-testid=coord-status]').innerText(),'Ready for review','a review never completes the milestone');
 await mayaAlex.getByLabel('Coordination type').selectOption('followUp');
 await mayaAlex.getByLabel('Coordination text').fill('Please share the access request link for the record.');
 await mayaAlex.getByRole('button',{name:'Request follow-up'}).click();await mayaAlex.getByText('Please share the access request link for the record.').waitFor();
 await maya.reload();await openSection(maya,'team-milestones');await mayaAlex.waitFor();
 assert.equal(await mayaAlex.locator('[data-testid=review-state]').innerText(),'Reviewed','review persists across a refresh');
 assert.equal(new URL(maya.url()).pathname,'/champion/team','reload keeps the persona and page');
 assert.equal(await maya.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the Champion has no operator access');
 // Role boundaries and stale writes at the API.
 const champCall=(c,token,body)=>fetch(`${c.apiOrigin}/api/activation/v1/customers/${c.customerId}/milestone-coordination`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Portal-Actor':'Maya Chen'},body:JSON.stringify(body)});
 for(const t of [alexToken,devToken,opToken])assert.equal((await champCall(north,t,{milestoneId:alexId,expectedRevision:0,note:{text:'Not allowed'}})).status,403,'only the Champion coordinates');
 assert.equal((await champCall(north,readFileSync(lumen.championTokenFile,'utf8'),{milestoneId:alexId,expectedRevision:0,note:{text:'Other customer'}})).status,403,'another customer’s Champion');
 const stale=await champCall(north,champToken,{milestoneId:alexId,expectedRevision:0,note:{text:'Stale'}});
 assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'REVISION_CONFLICT');
 assert.equal((await api(north,'opportunity-priorities',alexToken,{id:'x',priority:'high'})).status,403,'only the Champion sets priorities');
 // Jordan sees Maya's answer; Alex's follow-up stays on Alex's milestone.
 await jordan.reload();await jcard.getByText('Cover the TechDocs site for checkout-api only.').waitFor();
 assert.ok(!(await jordan.locator('body').innerText()).includes('access request link'),'Alex’s discussion stays on his milestone');
 // Alex sees the review, the Champion's recommendation, and answers the follow-up.
 await dev.goto(url+'/portal');await dev.getByLabel('What you can build or improve').getByText('Recommended by your Champion').first().waitFor();
 await dev.goto(url+'/activation/work');await card.waitFor();
 assert.equal(await card.locator('[data-testid=review-state]').innerText(),'Reviewed by Maya Chen');
 await card.locator('[data-entry-kind=follow_up]').getByRole('button',{name:'Reply to Maya Chen'}).click();
 await card.getByLabel('Short note').fill('The request is linked in my blocker note.');
 await card.getByRole('button',{name:'Send reply'}).click();await card.getByText('The request is linked in my blocker note.').waitFor();
 assert.equal(await status(card),'Ready for review');
 // Chris observes the same progress, read-only.
 await op.goto(url+'/operator/progress');await op.getByLabel('Adoption',{exact:true}).waitFor();
 await openSection(op,'progress-team');const observed=op.locator('#progress-team');
 await observed.getByText('Reviewed by Maya Chen').first().waitFor();
 const seen=await observed.innerText();
 assert.ok(seen.includes('The request is linked in my blocker note.')&&seen.includes('Cover the TechDocs site'),seen);
 assert.equal(await observed.getByRole('button',{name:/Mark reviewed|Respond|Add note|Request follow-up/}).count(),0,'Chris cannot coordinate');
 await openSection(op,'progress-opportunities');
 const copp=await op.locator('#progress-opportunities').innerText();
 assert.ok(copp.includes('Pursued by Alex Rivera')&&copp.includes('High priority'),copp);
 assert.equal(await op.locator('#progress-opportunities select, #progress-opportunities input').count(),0,'Chris only reads');
 assert.equal(await op.getByRole('button',{name:/Inspect/}).count(),0,'Chris inspects nothing');
 const chrisView=await op.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 const mayaView=await maya.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 assert.deepEqual(chrisView.summary,mayaView.summary,'one source of truth for the numbers');
 assert.ok(!JSON.stringify(mayaView).includes('renewal')&&!JSON.stringify(mayaView).includes('PRIVATE CONTRACT'),'no commercial notes in coordination');
 if(process.env.E2E_SCREENSHOTS){await jordan.screenshot({path:join(process.env.E2E_SCREENSHOTS,'jordan-work.png'),fullPage:true});await maya.screenshot({path:join(process.env.E2E_SCREENSHOTS,'maya-team.png'),fullPage:true});}

 console.log('AiKA cites the Portal’s own observation; slash commands narrow retrieval');
 await dev.goto(url+`/aika?milestone=${alexId}`);await dev.getByLabel('Question for AiKA').fill('Who owns checkout-api?');
 await dev.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 const cited=dev.getByLabel('AiKA answer').last();await cited.getByText('Verified · repository').waitFor({timeout:20000});
 const citedText=await cited.innerText();
 assert.ok(citedText.includes('Based on: CODEOWNERS (ownership) (live, example-org/checkout-api@cccccccccccc')&&!citedText.includes('passing CI')&&citedText.includes('1 part was removed'),citedText);
 await dev.getByLabel('Question for AiKA').fill('What does the evidence say about ownership? /rep');
 await dev.getByRole('listbox',{name:'AiKA commands'}).getByRole('option',{name:/\/repository/}).waitFor();
 assert.equal(await dev.getByRole('listbox',{name:'AiKA commands'}).getByRole('option').count(),1,'filtered as you type');
 await dev.getByLabel('Question for AiKA').press('Enter');
 await dev.locator('.pt-aika-chips').getByText('/repository').waitFor();
 assert.equal(await dev.getByRole('option',{name:/\/docs/}).count(),0,'/docs is not offered: no documentation source');
 await dev.getByLabel('Question for AiKA').press('Enter');
 await dev.locator('.pt-aika-user small').filter({hasText:'/repository'}).last().waitFor();
 await dev.getByLabel('AiKA answer').last().locator('.pt-aika-sections').waitFor({timeout:20000});
 const scoped=aikaPrompts.at(-1);
 assert.ok(scoped.includes('CAPABILITIES CHOSEN: /repository')&&scoped.includes('REPOSITORY OBSERVATIONS')&&!scoped.includes('YOUR MILESTONE')&&!scoped.includes('TECHNICAL GOAL'),'the command narrows what the server retrieves');
 assert.equal((await api(north,'aika-questions',alexToken,{question:'Show me the docs',capabilities:['docs']})).status,403);
 // Contextual AiKA (055) on another page shares the conversation.
 await dev.goto(url+'/activation/work');await dev.getByRole('button',{name:'Open AiKA'}).click();
 const aikaPanel=dev.getByLabel('Contextual AiKA');await aikaPanel.getByText('New AiKA Chat').waitFor();
 await aikaPanel.getByRole('button',{name:'Minimize AiKA'}).click();
 // Insights for the Champion and Chris: the server's numbers.
 await maya.goto(url+'/insights');const mi=await maya.getByLabel('Activity').innerText();
 assert.ok(mi.includes('Team activity')&&mi.includes('Alex Rivera')&&mi.includes('Jordan Lee'),mi);
 await op.goto(url+'/operator/insights');await op.getByLabel('Progress summary').waitFor();
 assert.ok((await op.getByLabel('Plan status').innerText()).includes('Approved by Maya Chen'));
 assert.deepEqual(leaked,[],'developer API responses carry no private research');

 // --- Sign-out ends the session; mobile layouts do not overflow.
 await dev.getByRole('button',{name:/Account:/}).click();await dev.getByRole('menuitem',{name:'Sign out'}).click();
 await dev.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 assert.equal(await dev.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),401);
 const entry=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();watch(entry);await entry.goto(url+'/login');await entry.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 await maya.goto(url+'/champion/team');await maya.getByLabel('Company goals').waitFor();await jordan.goto(url+'/activation');await jordan.getByRole('tab',{name:'Overview'}).waitFor();
 for(const page of [op,other,maya,jordan,entry]){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: one entry → persona sign-in → Chris: PDF upload only, scanned PDF refused, automatic analysis straight to the draft (overview first, details collapsed, no technical-setup task), edited multi-milestone draft (survives reload), sent as a proposed plan → Dream Day: Maya sees the plan at a glance, edits one milestone and suggests one owner (optional), Chris sees her changes as updates without approving them, she sends one point back; Chris answers and resubmits; Maya approves with a milestone left unowned; bypass, Chris and developer approvals refused; Lumen approved by its own Champion → developers: goals, opportunities labelled verified (the Portal’s own read-only observation after approval, GET only, server-side token, requested by Spotify integration) or sample, every milestone to choose, no Chris/uploads/repository tabs; Alex pursues an opportunity (Guide shows it first) and works on his suggested milestone with attributed, revision-checked updates; AiKA via a local stub gets approved context incl. his chosen opportunity, labels answers and removes claimed inspections; My progress → Jordan chooses the unowned milestone; dependency holds → Maya: goals, prioritises and recommends the opportunity, engagement, coordination one click away (answers, reviews, follow-up); Alex sees the recommendation and replies; Chris reads progress and opportunities without controls → AiKA cites the live observation, slash commands narrow retrieval; Insights for Maya and Chris; isolation, no browser tokens, sign-out, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 stubOllama.close();stubGitHub.close();rmSync(directory,{recursive:true,force:true});
}
