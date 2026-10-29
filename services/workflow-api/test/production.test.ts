/** The production server end to end over HTTP, in-process (no Docker, no network): configuration and health,
 * the passphrase gate, demo rooms (isolation, sharing, expiry, capacity), persona sessions surviving a restart,
 * rate limits, static serving, Gemini through a loopback stand-in, and no secrets in logs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cleanKey,configFromEnv,startProduction} from '../src/production.ts';
import {aperturePdf} from './support/sample-pdf.mjs';

const SECRET='s'.repeat(48),PASS='correct horse battery';
const CUSTOMER='fictional-aperture-commerce';
const env=(dir:string,extra:Record<string,string>={})=>({NODE_ENV:'production',PORTAL_ALLOW_HTTP:'1',PORT:'0',PORTAL_DATA_DIR:dir,PORTAL_DEMO_PASSPHRASE:PASS,PORTAL_SESSION_SECRET:SECRET,
 PORTAL_LLM_PROVIDER:'gemini',GEMINI_MODEL:'gemini-2.5-flash',PORTAL_AI_DAILY_REQUEST_LIMIT:'300',PORTAL_DEMO_ROOM_LIMIT:'50',PORTAL_DEMO_ROOM_TTL_HOURS:'24',ACTIVATION_EVIDENCE_MAX_AGE_HOURS:'24',...extra});

/** A browser-like client with its own cookie jar. */
function client(origin:string){
 const jar=new Map<string,string>();
 async function call(path:string,init:{method?:string;body?:string;form?:Record<string,string>;headers?:Record<string,string>}={}){
  const headers:Record<string,string>={...init.headers,...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{})};
  let body=init.body;
  if(init.form){body=new URLSearchParams(init.form).toString();headers['Content-Type']='application/x-www-form-urlencoded';}
  if((init.method??'GET')==='POST')headers.Origin??=origin;
  if(init.body)headers['Content-Type']='application/json';
  const r=await fetch(origin+path,{method:init.method??'GET',headers,body,redirect:'manual'});
  for(const c of r.headers.getSetCookie()){const [kv]=c.split(';');const [k,v]=kv.split('=');if(v)jar.set(k,v);else jar.delete(k);}
  const text=await r.text();let json:any=null;try{json=JSON.parse(text);}catch{/* html */}
  return {status:r.status,headers:r.headers,text,json};
 }
 return {call,jar,
  enter:(room?:string)=>call('/demo-gate',{method:'POST',form:{passphrase:PASS,...(room?{room}:{})}}),
  signIn:(personaId:string)=>call('/portal-auth/login',{method:'POST',body:JSON.stringify({personaId})})};
}
const op=(path:string)=>`/operator-api/aperture/activation/v1/customers/${CUSTOMER}/${path}`;
const lines:string[]=[];
async function boot(dir:string,extra:Record<string,string>={},opts:{now?:()=>number}={}){
 const app=await startProduction(configFromEnv(env(dir,extra)),{...opts,log:(level,event,fields={})=>{lines.push(JSON.stringify({level,event,...fields}));}});
 return {...app,origin:`http://127.0.0.1:${app.port}`};
}
function captureLogs(){lines.length=0;return {lines,restore:()=>undefined};}

test('configuration: the exact render.yaml names; missing secrets keep the demo closed and fail the health check',async()=>{
 const c=configFromEnv(env('/tmp/x'));
 assert.deepEqual([c.provider,c.geminiModel,c.aiDailyLimit,c.roomLimit,c.roomTtlHours,c.evidenceMaxAgeHours,c.secure],['gemini','gemini-2.5-flash',300,50,24,24,false]);
 assert.equal(configFromEnv({...env('/tmp/x'),PORTAL_ALLOW_HTTP:undefined}).secure,true,'production cookies are Secure');
 assert.throws(()=>configFromEnv({...env('/tmp/x'),PORTAL_LLM_PROVIDER:'other'}));
 assert.throws(()=>configFromEnv({...env('/tmp/x'),GEMINI_API_ORIGIN:'https://evil.example'}));
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 const logs=captureLogs();
 try{
  const app=await boot(dir,{PORTAL_DEMO_PASSPHRASE:'',PORTAL_SESSION_SECRET:'short'});
  const b=client(app.origin);
  const h=await b.call('/healthz');
  assert.equal(h.status,503);assert.equal(h.json.status,'misconfigured');
  assert.deepEqual(h.json.checks.config.missing,['PORTAL_DEMO_PASSPHRASE (at least 12 characters)','PORTAL_SESSION_SECRET (at least 32 characters)']);
  assert.equal(h.json.checks.ai,'not_configured (GEMINI_API_KEY missing)');
  assert.equal((await b.call('/')).status,503);assert.equal((await b.call('/demo-gate',{method:'POST',form:{passphrase:''}})).status,503);
  await app.close();
 }finally{logs.restore();rmSync(dir,{recursive:true,force:true});}
});

test('gate, rooms and personas: isolated rooms, a shareable code, sessions that survive a restart, persisted work',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 const logs=captureLogs();
 try{
  let app=await boot(dir);
  const a=client(app.origin),b=client(app.origin);
  const h=await a.call('/healthz');assert.equal(h.status,200);assert.equal(h.json.checks.storage,'ok');assert.equal(h.json.checks.ai,'not_configured (GEMINI_API_KEY missing)');
  // Everything needs the gate first.
  assert.equal((await a.call('/')).headers.get('location'),'/demo-gate');
  assert.equal((await a.call('/portal-auth/personas')).json.error.code,'DEMO_GATE_REQUIRED');
  assert.equal((await a.call(op('handoff'))).status,401);
  assert.equal((await a.call('/demo-gate',{method:'POST',form:{passphrase:'wrong passphrase'}})).status,401);
  assert.equal((await a.call('/demo-gate',{method:'POST',form:{passphrase:PASS},headers:{Origin:'https://evil.example'}})).status,403);
  const entered=await a.enter();assert.equal(entered.status,303);assert.equal(entered.headers.get('location'),'/login','straight to persona selection');
  const roomA=(await a.call('/demo-gate/room')).json.room;assert.match(roomA,/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  // Chris saves customer information in room A.
  assert.equal((await a.signIn('chris')).status,200);
  const ws=await a.call(op('handoff-workspace'),{method:'POST',body:JSON.stringify({expectedRevision:0,sources:[{type:'conversation',label:'Discovery call',text:'Maya Chen: we want payments-api in the Catalog.'}]})});
  assert.equal(ws.status,200,ws.text);
  // Room B is someone else: an empty workspace.
  await b.enter();assert.notEqual((await b.call('/demo-gate/room')).json.room,roomA);
  await b.signIn('chris');
  assert.equal((await b.call(op('handoff'))).json.workspace.revision,0,'rooms are isolated');
  // A persona session from one room isn't valid in another room.
  const c=client(app.origin);await c.enter();await c.signIn('maya');
  await c.enter(roomA);assert.equal((await c.call('/portal-auth/session')).status,401,'sign in again inside the joined room');
  await c.signIn('chris');assert.equal((await c.call(op('handoff'))).json.workspace.revision,1,'a shared code joins the same room');
  // Restart: the same disk and secret keep the room, the sign-in and the work.
  await app.close();app=await boot(dir);
  const again=client(app.origin);for(const [k,v] of a.jar)again.jar.set(k,v);
  assert.equal((await again.call('/portal-auth/session')).json.persona.id,'chris');
  assert.equal((await again.call(op('handoff'))).json.workspace.sources.length,1);
  // Leaving clears both cookies.
  await again.call('/demo-gate/leave',{method:'POST'});assert.equal(again.jar.size,0);
  await app.close();
  assert.ok(existsSync(join(dir,'activation.sqlite')));
  const all=logs.lines.join('');
  for(const secret of [PASS,SECRET,roomA])assert.ok(!all.includes(secret),'no passphrase, secret or room code in logs');
  assert.ok(all.includes('"event":"room_created"'));
 }finally{logs.restore();rmSync(dir,{recursive:true,force:true});}
});

test('rooms expire and are purged; capacity is capped; rate limits per IP and per room',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 const logs=captureLogs();let clock=Date.parse('2026-10-29T10:00:00Z');
 try{
  const app=await boot(dir,{PORTAL_DEMO_ROOM_LIMIT:'2',PORTAL_DEMO_ROOM_TTL_HOURS:'1'},{now:()=>clock});
  const a=client(app.origin),b=client(app.origin),c=client(app.origin);
  await a.enter();await b.enter();
  assert.equal((await c.enter()).status,503,'at capacity');
  await a.signIn('chris');
  await a.call(op('handoff-workspace'),{method:'POST',body:JSON.stringify({expectedRevision:0,sources:[{type:'conversation',label:'Call',text:'Fictional notes.'}]})});
  clock+=2*3600_000;
  assert.equal((await a.call(op('handoff'))).status,401,'an expired room is closed');
  assert.equal((await a.call('/')).headers.get('location'),'/demo-gate?ended=1','the visitor is told their room ended');
  assert.match((await a.call('/demo-gate?ended=1')).text,/Your previous demo room is no longer available/);
  assert.equal((await c.enter()).status,303,'expired rooms free capacity');
  await app.close();
  const restarted=await boot(dir,{PORTAL_DEMO_ROOM_LIMIT:'2',PORTAL_DEMO_ROOM_TTL_HOURS:'1'},{now:()=>clock});
  assert.ok(logs.lines.some(l=>l.includes('"event":"room_purged"')&&/"rows":[1-9]/.test(l)),'expired room data deleted');
  // Gate attempts per IP (the last X-Forwarded-For entry is the one Render adds).
  const d=client(restarted.origin);
  for(let i=0;i<10;i++)await d.call('/demo-gate',{method:'POST',form:{passphrase:'nope'},headers:{'X-Forwarded-For':'1.1.1.1, 9.9.9.9'}});
  assert.equal((await d.call('/demo-gate',{method:'POST',form:{passphrase:PASS},headers:{'X-Forwarded-For':'2.2.2.2, 9.9.9.9'}})).status,429);
  assert.equal((await d.call('/demo-gate',{method:'POST',form:{passphrase:PASS},headers:{'X-Forwarded-For':'8.8.8.8'}})).status,303);
  // Per-room daily analysis cap.
  await d.signIn('chris');
  for(let i=0;i<15;i++)await d.call(op('handoff-analyses'),{method:'POST',body:JSON.stringify({workspaceRevision:99})});
  assert.equal((await d.call(op('handoff-analyses'),{method:'POST',body:JSON.stringify({workspaceRevision:99})})).json.error.code,'ANALYSIS_LIMIT');
  await restarted.close();
 }finally{logs.restore();rmSync(dir,{recursive:true,force:true});}
});

test('hosted analysis through Gemini (loopback stand-in) with the daily cap; static Portal files and security headers',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 const logs=captureLogs();
 const requests:{key:string|null;path:string}[]=[];
 // A stand-in for generateContent: answers every task with output that fails validation, so analysis falls back to
 // the labelled rule-based result. What matters here is that requests go out with the key header, and stop at the cap.
 const stub=createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{requests.push({key:req.headers['x-goog-api-key'] as string,path:req.url!});
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(req.method==='GET'?{name:'models/gemini-2.5-flash'}:{candidates:[{content:{parts:[{text:'{}'}]},finishReason:'STOP'}]}));});});
 await new Promise<void>(r=>stub.listen(0,'127.0.0.1',r));
 try{
  const app=await boot(dir,{GEMINI_API_KEY:'test-key-not-real',GEMINI_API_ORIGIN:`http://127.0.0.1:${(stub.address() as {port:number}).port}`,PORTAL_AI_DAILY_REQUEST_LIMIT:'1'});
  const a=client(app.origin);
  assert.equal((await a.call('/healthz')).json.checks.ai,'gemini:gemini-2.5-flash');
  for(let i=0;i<50&&(await a.call('/healthz')).json.checks.aiCheck==='pending';i++)await new Promise(r=>setTimeout(r,10));
  assert.equal((await a.call('/healthz')).json.checks.aiCheck,'ok','the startup check found the key and model accepted');
  // The startup check reads the model's metadata only; it generates nothing and isn't counted.
  assert.deepEqual(requests.splice(0),[{key:'test-key-not-real',path:'/v1beta/models/gemini-2.5-flash'}]);
  await a.enter();await a.signIn('chris');
  await a.call(op('handoff-workspace'),{method:'POST',body:JSON.stringify({expectedRevision:0,sources:[{type:'conversation',label:'Discovery call',text:'Maya Chen: Nobody can tell who owns payments-api. Let’s pilot with payments-api on GitHub.'}]})});
  assert.equal((await a.call(op('handoff-analyses'),{method:'POST',body:JSON.stringify({workspaceRevision:1})})).status,202);
  let job;for(let i=0;i<200;i++){job=(await a.call(op('handoff-analyses'))).json.job;if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(job.status,'succeeded');
  const draft=(await a.call(op('handoff'))).json.drafts[0];
  assert.equal(draft.understanding.model.provider,'gemini');assert.equal(draft.understanding.model.ok,false,'labelled as a fallback');
  assert.ok(requests.length>=1&&requests.every(r=>r.key==='test-key-not-real'&&r.path==='/v1beta/models/gemini-2.5-flash:generateContent'));
  assert.equal(requests.length,1,'no request beyond PORTAL_AI_DAILY_REQUEST_LIMIT');
  assert.equal((await a.call('/healthz')).json.checks.aiRequestsToday,'1/1');
  // Static Portal and headers.
  const home=await a.call('/portal');
  assert.equal(home.status,existsSync(join(import.meta.dirname,'../../../prototypes/v1/dist/index.html'))?200:503);
  assert.match(home.headers.get('content-security-policy')??'',/frame-ancestors 'none'/);assert.equal(home.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await a.call('/assets/../../../../etc/passwd')).text.includes('root:'),false);
  assert.equal((await a.call('/api/activation/v1/customers/x/state')).status,404,'the API is never reachable directly');
  await app.close();
  assert.ok(!logs.lines.join('').includes('test-key-not-real'),'the key is never logged');
 }finally{logs.restore();stub.close();rmSync(dir,{recursive:true,force:true});}
});

test('a key Google rejects is reported at startup in /healthz and the log, and the analysis says why',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 const logs=captureLogs();
 let generate=0;
 // Google's real answer to a bad key (checked against the live API): 400 INVALID_ARGUMENT, reason API_KEY_INVALID.
 const stub=createServer((req,res)=>{req.resume();req.on('end',()=>{if(req.method==='POST')generate++;res.writeHead(400,{'Content-Type':'application/json'});
  res.end(JSON.stringify({error:{code:400,message:'API key not valid. Please pass a valid API key.',status:'INVALID_ARGUMENT',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'API_KEY_INVALID',domain:'googleapis.com'}]}}));});});
 await new Promise<void>(r=>stub.listen(0,'127.0.0.1',r));
 try{
  // Pasted with quotes and a trailing line break: cleaned, never part of a key.
  const app=await boot(dir,{GEMINI_API_KEY:'"wrong-key"\n',GEMINI_API_ORIGIN:`http://127.0.0.1:${(stub.address() as {port:number}).port}`});
  const a=client(app.origin);
  let h;for(let i=0;i<50;i++){h=(await a.call('/healthz')).json;if(h.checks.aiCheck!=='pending')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(h.status,'ok','the demo still works (rule-based), so the deploy stays healthy');
  assert.equal(h.checks.aiCheck,'MODEL_NOT_CONFIGURED:invalid_api_key');
  assert.ok(logs.lines.some(l=>l.includes('"event":"ai_check"')&&l.includes('"level":"warn"')&&l.includes('MODEL_NOT_CONFIGURED:invalid_api_key')));
  await a.enter();await a.signIn('chris');
  await a.call(op('handoff-workspace'),{method:'POST',body:JSON.stringify({expectedRevision:0,sources:[{type:'conversation',label:'Call',text:'Maya Chen: we want payments-api in the Catalog.'}]})});
  await a.call(op('handoff-analyses'),{method:'POST',body:JSON.stringify({workspaceRevision:1})});
  let job;for(let i=0;i<200;i++){job=(await a.call(op('handoff-analyses'))).json.job;if(job.status!=='running')break;await new Promise(r=>setTimeout(r,20));}
  assert.deepEqual([job.status,job.modelOk,job.modelError,job.modelErrorDetail],['succeeded',false,'MODEL_NOT_CONFIGURED','invalid_api_key']);
  assert.equal(generate,1,'a rejected key is not retried');
  await app.close();
  assert.ok(!logs.lines.join('').includes('wrong-key'),'the key is never logged');
 }finally{logs.restore();stub.close();rmSync(dir,{recursive:true,force:true});}
});

test('pasted keys are cleaned of spaces, line breaks and surrounding quotes',()=>{
 assert.equal(cleanKey('  AIzaKey \n'),'AIzaKey');assert.equal(cleanKey('"AIzaKey"'),'AIzaKey');assert.equal(cleanKey("'AIzaKey'"),'AIzaKey');
 assert.equal(cleanKey(''),null);assert.equal(cleanKey('  '),null);assert.equal(cleanKey(undefined),null);assert.equal(cleanKey('"'),'"');
});

test('render.yaml and the server agree: every variable the Blueprint sets is read, and the Blueprint never holds a secret value',async()=>{
 const {readFileSync}=await import('node:fs');
 const yaml=readFileSync(join(import.meta.dirname,'../../../render.yaml'),'utf8'),server=readFileSync(join(import.meta.dirname,'../src/production.ts'),'utf8');
 const keys=[...yaml.matchAll(/- key: ([A-Z0-9_]+)/g)].map(m=>m[1]);
 assert.deepEqual(keys,['NODE_ENV','PORTAL_STORAGE','PORTAL_DATA_DIR','PORTAL_LLM_PROVIDER','GEMINI_MODEL','GEMINI_API_KEY','PORTAL_AI_REQUESTS_PER_MINUTE','PORTAL_AI_DAILY_REQUEST_LIMIT','PORTAL_DEMO_PASSPHRASE','PORTAL_SESSION_SECRET','PORTAL_DEMO_ROOM_LIMIT','PORTAL_DEMO_ROOM_TTL_HOURS','ACTIVATION_EVIDENCE_MAX_AGE_HOURS']);
 for(const k of keys)assert.ok(server.includes(k),`production.ts reads ${k}`);
 for(const secret of ['GEMINI_API_KEY','PORTAL_DEMO_PASSPHRASE'])assert.match(yaml,new RegExp(`- key: ${secret}\\n\\s+sync: false`),`${secret} is entered in the dashboard`);
 assert.match(yaml,/- key: PORTAL_SESSION_SECRET\n\s+generateValue: true/);
 assert.match(yaml,/autoDeploy: false/);assert.match(yaml,/dockerfilePath: \.\/Dockerfile/);assert.match(yaml,/healthCheckPath: \/healthz/);
 assert.ok(existsSync(join(import.meta.dirname,'../../../Dockerfile')));
});

test('free tier: the Blueprint uses the free plan with no disk and temporary storage; the image needs no /var/data and no root',async()=>{
 const {readFileSync}=await import('node:fs');
 const yaml=readFileSync(join(import.meta.dirname,'../../../render.yaml'),'utf8'),docker=readFileSync(join(import.meta.dirname,'../../../Dockerfile'),'utf8');
 const live=(t:string)=>t.split('\n').filter(l=>!l.trim().startsWith('#')).join('\n');
 assert.match(live(yaml),/^\s+plan: free$/m);assert.doesNotMatch(live(yaml),/disk:|mountPath|plan: starter|numInstances/);
 assert.match(yaml,/- key: PORTAL_STORAGE\n\s+value: ephemeral/);assert.match(yaml,/- key: PORTAL_DATA_DIR\n\s+value: \/tmp\/spotify-portal-demo/);
 assert.doesNotMatch(live(docker),/\/var\/data|ENTRYPOINT|setpriv|chown/);assert.match(live(docker),/^USER node$/m);assert.match(live(docker),/PORTAL_STORAGE=ephemeral/);
 // Defaults: ephemeral storage under the OS temp directory, conservative AI pacing; persistent is opt-in.
 const {tmpdir}=await import('node:os');
 const c=configFromEnv({PORTAL_DEMO_PASSPHRASE:PASS,PORTAL_SESSION_SECRET:SECRET});
 assert.equal(c.storage,'ephemeral');assert.equal(c.dataDir,join(tmpdir(),'spotify-portal-demo'));assert.equal(c.aiPerMinute,8);assert.equal(c.aiDailyLimit,200);
 assert.equal(configFromEnv({PORTAL_STORAGE:'persistent',PORTAL_DATA_DIR:'/srv/data'}).storage,'persistent');
 assert.throws(()=>configFromEnv({PORTAL_STORAGE:'disk'}));
});

test('entry: welcome, then passphrase, then persona selection; a fresh room from inside the Portal',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 try{
  const app=await boot(dir);
  const a=client(app.origin);
  const welcome=await a.call('/demo-gate');
  assert.match(welcome.text,/Portal is ready for you/);assert.match(welcome.text,/href="\/demo-gate\?step=passphrase">Get started/);
  assert.doesNotMatch(welcome.text,/name="passphrase"/,'the passphrase is the second step');
  assert.match(welcome.text,/Every customer, person and repository here is invented/);assert.match(welcome.text,/Temporary demo data/);
  assert.doesNotMatch(welcome.text,/<script/i,'no scripts: the gate works under the strict CSP');
  const step=await a.call('/demo-gate?step=passphrase');
  assert.match(step.text,/name="passphrase"/);assert.match(step.text,/Join a shared room/);assert.match(step.text,/Temporary demo data/);
  // A wrong passphrase keeps the room code that was typed.
  const wrong=await a.call('/demo-gate',{method:'POST',form:{passphrase:'nope',room:'K7M2Q-9XRTB'}});
  assert.equal(wrong.status,401);assert.match(wrong.text,/value="K7M2Q-9XRTB"/);assert.match(wrong.text,/<details open>/);
  await a.enter();
  assert.equal((await a.call('/')).headers.get('location'),'/login','no second welcome screen inside a room');
  const first=(await a.call('/demo-gate/room')).json.room;
  await a.signIn('chris');
  await a.call(op('handoff-workspace'),{method:'POST',body:JSON.stringify({expectedRevision:0,sources:[{type:'conversation',label:'Call',text:'Maya Chen: we want payments-api in the Catalog.'}]})});
  // A fresh room: needs a room already, same origin; signs the persona out; the old room keeps its work.
  const outsider=client(app.origin);
  assert.equal((await outsider.call('/demo-gate/new-room',{method:'POST'})).status,401,'only from inside the demo');
  assert.equal((await a.call('/demo-gate/new-room',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
  const fresh=await a.call('/demo-gate/new-room',{method:'POST'});
  assert.equal(fresh.status,201);assert.notEqual(fresh.json.room,first);
  assert.equal((await a.call('/demo-gate/room')).json.room,fresh.json.room);
  assert.equal((await a.call('/portal-auth/session')).status,401,'choose a persona again in the new room');
  await a.signIn('chris');assert.equal((await a.call(op('handoff'))).json.workspace.revision,0,'the new room starts empty');
  const back=client(app.origin);await back.enter(first);await back.signIn('chris');
  assert.equal((await back.call(op('handoff'))).json.workspace.revision,1,'the old room keeps its work');
  await app.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Chris’s PDF through the whole hosted path: session layer pass-through, room isolation, operator only, daily allowance',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'prod-'));
 try{
  const app=await boot(dir);
  const a=client(app.origin);await a.enter();await a.signIn('chris');
  const post=(c:ReturnType<typeof client>,bytes:Uint8Array,type='application/pdf',origin=app.origin)=>fetch(app.origin+op('handoff-documents'),{method:'POST',body:new Blob([bytes as Uint8Array<ArrayBuffer>]),
   headers:{'Content-Type':type,'X-File-Name':encodeURIComponent('Aperture discovery.pdf'),Origin:origin,Cookie:[...c.jar].map(([k,v])=>`${k}=${v}`).join('; ')}}).then(async r=>({status:r.status,json:await r.json()}));
  const r=await post(a,aperturePdf());
  assert.equal(r.status,202,JSON.stringify(r.json));assert.equal(r.json.report.fileName,'Aperture discovery.pdf');assert.equal(r.json.workspace.sources.length,6);
  for(let i=0;i<100&&(await a.call(op('handoff-analyses'))).json.job.status==='running';i++)await new Promise(x=>setTimeout(x,10));
  assert.equal((await a.call(op('handoff'))).json.drafts.length,1,'analyzed in the room');
  // Another room sees none of it; another persona can't upload; a cross-site page can't either.
  const b=client(app.origin);await b.enter();await b.signIn('chris');
  assert.equal((await b.call(op('handoff'))).json.workspace.revision,0);
  const maya=client(app.origin);await maya.enter();await maya.signIn('maya');
  assert.equal((await post(maya,aperturePdf())).status,403);
  assert.equal((await post(a,aperturePdf(),'application/pdf','https://evil.example')).status,403);
  assert.equal((await post(a,aperturePdf(),'text/plain')).json.error.code,'PDF_REQUIRED');
  // Uploads count against the room's 15 analyses a day (refused files included: the limit protects the server).
  const c=client(app.origin);await c.enter();await c.signIn('chris');
  const codes=[];for(let i=0;i<16;i++)codes.push((await post(c,Buffer.from('not a pdf'))).json.error.code);
  assert.deepEqual(codes,[...Array(15).fill('NOT_A_PDF'),'ANALYSIS_LIMIT']);
  await app.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('free tier: visitors are told data is temporary; a restart that clears storage ends rooms honestly',async()=>{
 const first=mkdtempSync(join(tmpdir(),'prod-')),second=mkdtempSync(join(tmpdir(),'prod-'));
 try{
  let app=await boot(first);
  const a=client(app.origin);
  const gate=await a.call('/demo-gate');
  assert.match(gate.text,/Temporary demo data/);assert.match(gate.text,/lost when it restarts, redeploys or sleeps/);assert.match(gate.text,/Gemini’s free tier/);
  const h=(await a.call('/healthz')).json;assert.equal(h.checks.storageMode,'ephemeral');assert.equal(h.checks.aiRequestsPerMinute,8);
  await a.enter();
  assert.deepEqual((({storage,aiProvider})=>({storage,aiProvider}))((await a.call('/demo-gate/room')).json),{storage:'ephemeral',aiProvider:'gemini'});
  // The free service restarts with an empty /tmp: same secret, no data.
  await app.close();app=await boot(second);
  const b=client(app.origin);for(const [k,v] of a.jar)b.jar.set(k,v);
  const r=await b.call('/operator');
  assert.equal(r.headers.get('location'),'/demo-gate?ended=1');
  assert.match((await b.call('/demo-gate?ended=1')).text,/Your previous demo room is no longer available/);
  assert.equal((await b.call('/portal-auth/session')).json.error.code,'DEMO_GATE_REQUIRED');
  assert.equal((await b.enter()).status,303,'a fresh room starts');
  await app.close();
 }finally{rmSync(first,{recursive:true,force:true});rmSync(second,{recursive:true,force:true});}
});
