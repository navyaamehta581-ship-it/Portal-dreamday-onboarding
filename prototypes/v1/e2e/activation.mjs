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

 // --- Chris publishes both customers from the external workspace.
 const op=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();watch(op);
 const opTraffic=[];op.on('request',r=>{if(r.url().includes('-api/'))opTraffic.push(r.url());if(r.headers().authorization)opTraffic.push('BEARER '+r.url());});
 await signInAs(op,'Chris');assert.equal(new URL(op.url()).pathname,'/operator','Chris starts in Customer Onboarding');
 assert.ok(!(await op.content()).includes(opToken),'operator token never reaches the page');
 assert.equal(await op.getByLabel('Operator access token').count(),0,'no token entry');
 // Chris: information → analysis → review → (Aperture) submission for Champion review → labelled direct publication.
 async function prepare(account,notes){
  await op.getByLabel('Customer account').selectOption(account);await op.getByRole('tab',{name:'Customer Context'}).click();
  // One way in: a PDF. No entry fields, no save or analyze buttons.
  for(const old of ['Information 1 text','Information 1 name'])assert.equal(await op.getByLabel(old).count(),0,`no ${old}`);
  for(const old of ['Add information','Save information','Analyze customer'])assert.equal(await op.getByRole('button',{name:old}).count(),0,`no ${old}`);
  const pdf=makePdf([{lines:[{text:'Discovery call',size:14,bold:true},...notes.split('\n').map(text=>({text})),{text:''},{text:'Tools and integrations',size:14,bold:true},{text:'Docs live in Confluence; CI runs in GitHub Actions.'}]}],{compress:true});
  await op.getByLabel('Customer PDF').setInputFiles({name:`${account} discovery.pdf`,mimeType:'application/pdf',buffer:pdf});
  // Analysis starts by itself; the document summary says what was read and how.
  await op.getByText(`${account} discovery.pdf`).waitFor();await op.getByText('Fully read').waitFor();
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
 await prepare('aperture',APERTURE);
 assert.ok((await op.getByLabel('Kept internal').innerText()).includes('Kept internal'));
 // Edit the draft: retitle the first milestone, add a second one that depends on it, name the technical team; save.
 await op.getByLabel('Milestone 1 title').fill('Review checkout-api repository readiness and prepare it for Catalog registration');
 await op.getByRole('button',{name:'Add milestone'}).click();
 await op.getByLabel('Milestone 2 title').fill('Validate that checkout-api is discoverable in the Catalog');
 await op.getByLabel('Milestone 2 system').fill('checkout-api · aperture/platform');
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
 const bypass=await op.evaluate(async c=>{const r=await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff-publications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:1,fromReview:true,outcome:'x x x',agreedBy:'y y y',agreementConfirmed:true})});return [r.status,(await r.json()).error.code];},north.customerId);
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
 // A scanned PDF (images only) is refused with an explanation; nothing is analyzed, and a text PDF then works.
 await op.getByLabel('Customer account').selectOption('lumen');await op.getByRole('tab',{name:'Customer Context'}).click();
 await op.getByLabel('Customer PDF').setInputFiles({name:'scan.pdf',mimeType:'application/pdf',buffer:makePdf([{image:true},{image:true}])});
 await op.getByRole('alert').getByText(/No text could be read from this PDF \(2 pages\)\. It looks like a scan/).waitFor();
 assert.equal(await op.getByRole('button',{name:'Review the onboarding draft'}).count(),0,'nothing analyzed');
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
 assert.equal(await dev.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the session layer refuses operator access for a developer');
 await dev.goto(url+'/login');await dev.waitForURL(url+'/portal');
 await dev.getByRole('heading',{name:/First up/}).waitFor();
 let text=await dev.locator('body').innerText();
 assert.ok(text.includes('checkout-api'));for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','Fictional platform lead'])assert.ok(!text.includes(x),'developer page leaks '+x);
 assert.ok(!(await dev.content()).includes(devToken),'developer token never reaches the page');
 assert.equal(await dev.getByLabel('Raw account and call notes').count(),0);
 assert.equal(await dev.locator('a[href^="/operator"]').count(),0,'no operator links for developers');
 await dev.getByRole('button',{name:'Open your onboarding'}).click();
 await dev.getByRole('tab',{name:'Overview'}).waitFor();text=await dev.locator('body').innerText();
 assert.ok(text.includes('aperture/platform')&&text.includes('Review checkout-api repository readiness'));assert.ok(!text.includes('renewal'),'no commercial notes');assert.equal(await dev.getByRole('tab',{name:'Team'}).count(),0);
 // Developer credentials cannot publish (role denial at the API).
 assert.equal((await fetch(`${north.apiOrigin}/api/activation/v1/customers/${north.customerId}/intake`,{method:'POST',headers:{Authorization:`Bearer ${devToken}`,'Content-Type':'application/json'},body:'{}'})).status,403);

 console.log('Guide: question then blocker');
 await dev.getByRole('tab',{name:'Guide'}).click();
 await dev.getByLabel('Question or update').fill('Which repository holds checkout-api?');await dev.getByRole('button',{name:'Send'}).click();
 await dev.getByText('Saved as your report').waitFor();assert.ok((await dev.locator('body').innerText()).includes('aperture/platform'));
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
 assert.equal((await api(north,'milestone-updates',alexToken,{milestoneId:jordanId,expectedRevision:0,status:'in_progress'})).status,403,'Alex cannot change Jordan’s work');
 assert.equal((await api(north,'milestone-updates',opToken,{milestoneId:alexId,expectedRevision:2,status:'in_progress'})).status,403,'Chris cannot change developer work');
 // AiKA, through the Portal API only.
 const modelCalls=[];dev.on('request',r=>{if(r.url().startsWith(ollamaUrl)||r.url().includes(':11434'))modelCalls.push(r.url());});
 await card.getByRole('button',{name:'Ask AiKA about this milestone'}).click();await dev.waitForURL(/\/aika\?milestone=/);
 assert.equal(await dev.getByLabel('Milestone for AiKA').inputValue(),alexId);
 await dev.getByRole('button',{name:'What should I do next on this milestone?'}).click();
 const answer=dev.getByLabel('AiKA answer').last();await answer.locator('.pt-aika-sections').waitFor({timeout:20000});
 const said=await answer.innerText();
 if(process.env.E2E_SCREENSHOTS)await dev.screenshot({path:join(process.env.E2E_SCREENSHOTS,'aika.png'),fullPage:true});
 assert.ok(said.includes(`Your milestone is ${ALEX}`)&&said.includes('Known')&&said.includes('Reported')&&said.includes('Suggestion')&&said.includes('Unknown'),said);
 assert.ok(!said.includes('I inspected')&&said.includes('1 part was removed'),'claimed inspections are removed: nothing was inspected');
 const prompt=aikaPrompts.at(-1);
 assert.ok(prompt.includes(`YOUR MILESTONE (the question is about this one): ${ALEX}`)&&prompt.includes('No read access to aperture/platform yet.')&&prompt.includes('REPOSITORY OBSERVATIONS: none'));
 assert.ok(prompt.includes(`TEAM MILESTONE: ${JORDAN}`),'other milestones by title and status only');
 for(const x of ['PRIVATE CONTRACT NOTE','renewal discount','solutions engineer','Fictional platform lead'])assert.ok(!prompt.includes(x),'AiKA context leaks '+x);
 assert.deepEqual(modelCalls,[],'the browser never talks to the model');
 aikaMode='down';
 await dev.getByLabel('Question for AiKA').fill('What does my milestone depend on?');await dev.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 await dev.getByLabel('AiKA answer').last().getByRole('alert').filter({hasText:'AiKA couldn’t reach its AI model'}).waitFor({timeout:20000});aikaMode='ok';
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
 await other.getByRole('alert').filter({hasText:'AiKA isn’t connected to a model'}).waitFor();assert.equal(aikaPrompts.length,before,'Lumen never reaches Aperture’s model');

 // --- Maya: the approved plan in Team overview, same as Dream Day; Jordan: only his approved work.
 await maya.getByRole('tab',{name:'Team overview'}).click();
 const mayaAlex=maya.locator('[aria-label^="Coordination: Review checkout-api repository readiness"]');await mayaAlex.waitFor();
 assert.ok((await mayaAlex.innerText()).includes('Alex Rivera'));
 assert.ok((await maya.locator('[aria-label^="Coordination: Independently validate"]').innerText()).includes('Jordan Lee'));
 assert.ok(!(await maya.locator('body').innerText()).includes('renewal'));
 await maya.reload();await mayaAlex.waitFor();assert.equal(new URL(maya.url()).pathname,'/champion/team','reload keeps the persona and page');
 assert.equal(await maya.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/handoff`)).status,north.customerId),403,'the Champion has no operator access');
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
 assert.ok(!(await jordan.locator('body').innerText()).includes('No read access to aperture/platform'),'Alex’s notes stay in his workspace');
 assert.ok((await jcard.innerText()).includes('can only be completed after Alex Rivera’s work'));
 const jactions=await jcard.locator('[aria-label^="Status of action"]').count();
 for(let i=1;i<=jactions;i++){await jcard.getByLabel(`Status of action ${i}`).selectOption('completed');await jordan.waitForFunction(([a,n])=>{const s=document.querySelector(`[aria-label^="${a}"] [aria-label="Status of action ${n}"]`);return s&&!s.disabled&&s.value==='completed';},[`Milestone: ${JORDAN}`,i]);}
 await jcard.getByRole('button',{name:'Mark completed'}).click();
 await jcard.getByRole('alert').filter({hasText:'the work it depends on is completed by its owner'}).waitFor();
 assert.equal(await jcard.locator('[data-testid=milestone-status]').innerText(),'In progress','dependent work is never completed early or automatically');
 const mine=await jordan.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 assert.equal(mine.milestones.find(x=>x.title.startsWith(ALEX)).detail,null,'Alex’s workspace detail is not sent to Jordan');
 assert.ok(mine.milestones.find(x=>x.title.startsWith(JORDAN)).detail.actions.every(a=>a.by==='Jordan Lee'),'Jordan’s changes are attributed to Jordan');
 console.log('Phase 6: Maya coordinates, answers, reviews and asks for follow-up; Alex replies; Chris reads');
 await jcard.getByLabel('Note type').selectOption('question');
 await jcard.getByLabel('Short note').fill('Which docs site should the discoverability check cover?');
 await jcard.getByRole('button',{name:'Record question'}).click();await jcard.getByText('awaiting a reply').waitFor();
 await maya.goto(url+'/champion/team');
 const attention=await maya.getByLabel('Needs attention').innerText();
 assert.ok(attention.includes('Ready for your review')&&attention.includes('Unanswered question'),attention);
 const summary=await maya.getByLabel('Team progress').innerText();
 assert.match(summary,/AWAITING YOUR REVIEW\s*1/i);assert.match(summary,/COMPLETED\s*0 of 2/i);
 const mayaJordan=maya.locator('[aria-label^="Coordination: Independently validate"]');
 assert.equal(await mayaJordan.locator('[data-testid=coord-status]').innerText(),'In progress');
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
 await maya.reload();await mayaAlex.waitFor();assert.equal(await mayaAlex.locator('[data-testid=review-state]').innerText(),'Reviewed','review persists across a refresh');
 // Role boundaries and stale writes at the API.
 const champCall=(c,token,body)=>fetch(`${c.apiOrigin}/api/activation/v1/customers/${c.customerId}/milestone-coordination`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Portal-Actor':'Maya Chen'},body:JSON.stringify(body)});
 for(const t of [alexToken,devToken,opToken])assert.equal((await champCall(north,t,{milestoneId:alexId,expectedRevision:0,note:{text:'Not allowed'}})).status,403,'only the Champion coordinates');
 assert.equal((await champCall(north,readFileSync(lumen.championTokenFile,'utf8'),{milestoneId:alexId,expectedRevision:0,note:{text:'Other customer'}})).status,403,'another customer’s Champion');
 const stale=await champCall(north,champToken,{milestoneId:alexId,expectedRevision:0,note:{text:'Stale'}});
 assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'REVISION_CONFLICT');
 // Jordan sees Maya's answer; Alex's follow-up stays on Alex's milestone.
 await jordan.reload();await jcard.getByText('Cover the TechDocs site for checkout-api only.').waitFor();
 assert.ok(!(await jordan.locator('body').innerText()).includes('access request link'),'Alex’s discussion stays on his milestone');
 // Alex sees the review and answers the follow-up.
 await dev.goto(url+'/activation/work');await card.waitFor();
 assert.equal(await card.locator('[data-testid=review-state]').innerText(),'Reviewed by Maya Chen');
 await card.locator('[data-entry-kind=follow_up]').getByRole('button',{name:'Reply to Maya Chen'}).click();
 await card.getByLabel('Short note').fill('The request is linked in my blocker note.');
 await card.getByRole('button',{name:'Send reply'}).click();await card.getByText('The request is linked in my blocker note.').waitFor();
 assert.equal(await status(card),'Ready for review');
 // Chris observes the same progress, read-only.
 await op.goto(url+'/operator/progress');const observed=op.getByLabel('Approved milestone progress');await observed.waitFor();
 const seen=await observed.innerText();
 assert.ok(seen.includes('Reviewed by Maya Chen')&&seen.includes('The request is linked in my blocker note.')&&seen.includes('Cover the TechDocs site'),seen);
 assert.equal(await observed.getByRole('button',{name:/Mark reviewed|Respond|Add note|Request follow-up/}).count(),0,'Chris cannot coordinate');
 const chrisView=await op.evaluate(async c=>(await fetch(`/operator-api/aperture/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 const mayaView=await maya.evaluate(async c=>(await fetch(`/portal-api/activation/v1/customers/${c}/milestone-work`)).json(),north.customerId);
 assert.deepEqual(chrisView.summary,mayaView.summary,'one source of truth for the numbers');
 assert.ok(!JSON.stringify(mayaView).includes('renewal')&&!JSON.stringify(mayaView).includes('PRIVATE CONTRACT'),'no commercial notes in coordination');
 if(process.env.E2E_SCREENSHOTS){await jordan.screenshot({path:join(process.env.E2E_SCREENSHOTS,'jordan-work.png'),fullPage:true});await maya.goto(url+'/champion/team');await mayaAlex.waitFor();await maya.screenshot({path:join(process.env.E2E_SCREENSHOTS,'maya-team.png'),fullPage:true});}


 console.log('Phase 7: read-only repository evidence (live via a GitHub test double, sample for Lumen), Maya, Chris and AiKA');
 await dev.goto(url+'/activation/work');await card.waitFor();
 const panel=card.locator('[aria-label="Repository evidence: checkout-api"]');await panel.waitFor();
 assert.equal(await panel.getByTestId('evidence-mode').innerText(),'Live GitHub · read-only');
 assert.ok((await panel.innerText()).includes('nothing about this repository is verified'));
 await panel.getByRole('button',{name:'Inspect repository (read-only)'}).click();
 await panel.locator('[data-signal=codeowners][data-status=observed]').waitFor();
 const seenByAlex=await panel.innerText();
 assert.ok(seenByAlex.includes('CODEOWNERS at .github/CODEOWNERS with 1 rule naming @example-org/checkout-team')&&seenByAlex.includes('by Alex Rivera at commit cccccccccccc'),seenByAlex);
 assert.ok(seenByAlex.includes('A workflow file is not proof that CI runs or passes'),'CI configuration is not CI working');
 assert.ok((await panel.locator('[data-signal=runbooks]').innerText()).includes('Not found'));
 assert.equal(await panel.locator('[data-signal=codeowners] a').getAttribute('href'),`https://github.com/example-org/checkout-api/blob/${'c'.repeat(40)}/.github/CODEOWNERS`);
 assert.deepEqual([...new Set(githubCalls.map(c=>c.method))],['GET'],'the inspector only reads');
 assert.ok(githubCalls.every(c=>c.path.startsWith('/repos/example-org/checkout-api')&&c.auth==='Bearer e2e-read-only-test-token'));
 assert.ok(!(await dev.content()).includes('e2e-read-only-test-token'),'the GitHub credential stays on the server');
 assert.equal(await status(card),'Ready for review','an inspection completes nothing');
 assert.ok((await card.getByTestId('action-evidence').first().innerText()).includes('Related evidence (checkout-api)'));
 // Requests name a configured repository only.
 assert.equal((await api(north,'repository-inspections',alexToken,{repository:'torvalds/linux'})).status,400);
 assert.equal((await api(north,'repository-inspections',opToken,{repositoryId:'checkout-api'})).status,403,'Chris observes');
 assert.equal((await api(lumen,'repository-evidence',alexToken)).status,403,'another customer’s evidence');
 // AiKA cites the recorded observation; an uncited repository claim is removed.
 await dev.goto(url+`/aika?milestone=${alexId}`);await dev.getByLabel('Question for AiKA').fill('Who owns checkout-api?');
 await dev.getByRole('button',{name:'Ask AiKA',exact:true}).click();
 const cited=dev.getByLabel('AiKA answer').last();await cited.getByText('Verified · repository').waitFor({timeout:20000});
 const citedText=await cited.innerText();
 assert.ok(citedText.includes('Based on: CODEOWNERS (ownership) (live, example-org/checkout-api@cccccccccccc')&&!citedText.includes('passing CI')&&citedText.includes('1 part was removed'),citedText);
 // Slash commands: "/rep" + Enter picks /repository as a chip; the server retrieves only repository records.
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
 // A hand-made request for an unavailable capability is refused on the server.
 assert.equal((await api(north,'aika-questions',alexToken,{question:'Show me the docs',capabilities:['docs']})).status,403);
 // Contextual AiKA (055) on another page shares the conversation.
 await dev.goto(url+'/activation/work');await dev.getByRole('button',{name:'Open AiKA'}).click();
 const aikaPanel=dev.getByLabel('Contextual AiKA');await aikaPanel.getByText('New AiKA Chat').waitFor();
 await aikaPanel.getByRole('button',{name:'Minimize AiKA'}).click();
 // Insights: the server's numbers, for Alex (his own activity) and below for Maya and Chris.
 await dev.goto(url+'/insights');await dev.getByLabel('Progress summary').waitFor();
 assert.ok((await dev.getByLabel('Activity').innerText()).includes('Your activity'));
 // Jordan: the same repository, with discoverability first.
 await jordan.goto(url+'/activation/work');
 const jpanel=jordan.locator(`[aria-label^="Milestone: ${JORDAN}"] [aria-label="Repository evidence: checkout-api"]`);await jpanel.waitFor();
 const jfirst=await jpanel.locator('.pt-work-log > li').first().getAttribute('data-signal');
 assert.ok(['docs','catalog_info','readme'].includes(jfirst),jfirst);
 // Maya: observations beside the team's reported progress; a GitHub failure keeps the earlier evidence, labelled.
 await maya.goto(url+'/champion/team');const mpanel=maya.locator('[aria-label="Repository evidence: checkout-api"]');await mpanel.waitFor();
 assert.ok((await mpanel.innerText()).includes('by Alex Rivera'));
 assert.ok((await maya.getByLabel('Evidence',{exact:true}).innerText()).includes('reported, not verified'));
 githubMode='limit';
 await mpanel.getByRole('button',{name:'Inspect again (read-only)'}).click();
 await mpanel.getByText(/GitHub’s rate limit was reached/).waitFor();
 assert.ok((await mpanel.innerText()).includes('The evidence below is from the earlier inspection'));
 githubMode='ok';
 // Chris: the same evidence, read-only.
 await op.goto(url+'/operator/progress');const opanel=op.locator('[aria-label="Approved milestone progress"] [aria-label="Repository evidence: checkout-api"]');await opanel.waitFor();
 assert.equal(await opanel.getByRole('button').count(),0,'Chris cannot inspect');
 await maya.goto(url+'/insights');const mi=await maya.getByLabel('Activity').innerText();
 assert.ok(mi.includes('Team activity')&&mi.includes('Alex Rivera')&&mi.includes('Jordan Lee')&&mi.includes('Maya Chen (Champion)'),mi);
 assert.ok((await maya.getByLabel('Evidence coverage').innerText()).includes('Live'));
 await op.goto(url+'/operator/insights');await op.getByLabel('Progress summary').waitFor();
 assert.ok((await op.getByLabel('Plan status').innerText()).includes('Approved by Maya Chen'));
 // Lumen: sample data, never presented as live.
 const githubBefore=githubCalls.length;
 await other.goto(url+'/activation/work');const spanel=other.locator('[aria-label="Repository evidence: recs-service"]');await spanel.waitFor();
 assert.equal(await spanel.getByTestId('evidence-mode').innerText(),'Sample data · fictional repository, not live');
 await spanel.getByRole('button',{name:'Inspect repository (read-only)'}).click();await spanel.getByText('Sample · observed').first().waitFor();
 assert.equal(await spanel.locator('a').count(),0,'no GitHub links for sample data');
 assert.equal(githubCalls.length,githubBefore,'sample data never calls GitHub');
 if(process.env.E2E_SCREENSHOTS){await dev.goto(url+'/activation/work');await panel.waitFor();await panel.screenshot({path:join(process.env.E2E_SCREENSHOTS,'repo-evidence.png')});}

 // --- Sign-out ends the session; mobile layouts do not overflow.
 await dev.getByRole('button',{name:/Account:/}).click();await dev.getByRole('menuitem',{name:'Sign out'}).click();
 await dev.getByRole('heading',{name:'Portal is ready for you'}).waitFor();
 assert.equal(await dev.evaluate(async id=>(await fetch(`/portal-api/activation/v1/customers/${id}/state`)).status,north.customerId),401);
 const entry=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();watch(entry);await entry.goto(url+'/login');await entry.getByRole('heading',{name:'Sign in to Portal'}).waitFor();
 for(const page of [op,other,maya,entry]){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: one entry → persona sign-in (Chris, Maya, Alex, Jordan, Sam, Priya) → Chris: PDF upload only (no entry fields), scanned PDF refused with an explanation, automatic background analysis, edited multi-milestone draft (survives reload), submitted → Dream Day: Maya assigns Alex and Jordan, requests changes; Chris revises and resubmits; Maya approves; bypass, Chris and developer approvals refused; Lumen approved by its own Champion → Alex: personalized onboarding, question + blocker replan, direction + team plan (survives refresh), GitHub fail-closed, typed operator URL refused → Chris follow-up → Maya: approved plan in Team overview, reload keeps persona → Jordan: only his approved work, no Dream Day → Phase 5: Alex and Jordan work separately with attributed, revision-checked updates that survive refresh; blockers block review; dependent work never completes early; shared/operator/cross-customer credentials refused; AiKA via a local stub model gets approved context only, labels answers, removes claimed inspections, reports failure; Maya and Chris see consolidated progress → Phase 6: Maya sees attention and summary, answers Jordan’s question, reviews Alex’s milestone without completing it, requests follow-up; Alex replies; review persists; coordination refused for developers, Chris, the shared token, another customer and stale revisions; Chris sees the same numbers read-only → Phase 7: Alex inspects checkout-api read-only (GitHub test double, GET only, server-side token), evidence with provenance and limits beside his actions, nothing completed; AiKA cites the observation and drops an uncited claim; slash-command menu narrows retrieval to /repository, /docs refused; contextual AiKA panel; Insights for Alex, Maya and Chris; Jordan’s focus is discoverability; Maya sees evidence vs reported work and a rate limit keeps earlier evidence labelled; Chris read-only; Lumen sample data labelled and never calls GitHub; role denial at session layer and API, no browser tokens, two-customer isolation, sign-out, mobile overflow.');
}catch(error){console.error(error);throw error;}finally{
 await browser?.close();for(const child of children.reverse()){if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r();},3000))]);}}
 stubOllama.close();stubGitHub.close();rmSync(directory,{recursive:true,force:true});
}
