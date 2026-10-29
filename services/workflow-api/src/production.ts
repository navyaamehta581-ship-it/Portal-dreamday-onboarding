/** Production server for the hosted Spotify Portal demo (see render.yaml). One process serves everything:
 *
 *   visitor ─HTTPS─▶ Render ─▶ this server ─┬─ /healthz                        health for Render
 *                                           ├─ /demo-gate                      shared-passphrase gate → demo room
 *                                           ├─ /portal-auth, /portal-api, /operator-api
 *                                           │      Portal session layer (personas) ─loopback─▶ activation API
 *                                           └─ everything else                 built Portal frontend (static)
 *
 * Environment (exact names from render.yaml): NODE_ENV, PORT, PORTAL_DATA_DIR, PORTAL_LLM_PROVIDER, GEMINI_MODEL,
 * GEMINI_API_KEY, PORTAL_AI_DAILY_REQUEST_LIMIT, PORTAL_AI_REQUESTS_PER_MINUTE, PORTAL_DEMO_PASSPHRASE, PORTAL_SESSION_SECRET,
 * PORTAL_DEMO_ROOM_LIMIT, PORTAL_DEMO_ROOM_TTL_HOURS, ACTIVATION_EVIDENCE_MAX_AGE_HOURS, PORTAL_STORAGE.
 * Storage: PORTAL_STORAGE=ephemeral (the default, Render's free plan) keeps SQLite in PORTAL_DATA_DIR (default: a
 * directory under the OS temp dir) and tells visitors that demo data is lost on restart, redeploy or sleep;
 * PORTAL_STORAGE=persistent is for a host with a real disk.
 * Local testing only: PORTAL_ALLOW_HTTP=1 (cookies without Secure over plain http), GEMINI_API_ORIGIN (a loopback
 * stand-in for Gemini). Secrets are never logged; logs are one JSON object per line with codes, never content. */
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {extname,join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from './app.ts';
import {openGoalStore} from './store.ts';
import {DEMO_CUSTOMER,DEMO_PERSONAS,ROOM_CODE,RoomLimitError,createHostedActivation,openRooms,purgeRoomData} from './activation/hosted.ts';
import {createGemini,GEMINI_ORIGIN,geminiOriginAllowed} from './llm/gemini.ts';
import {openAiBudget} from './llm/budget.ts';
import {createOllama,ollamaConfigFromEnv,type JsonModel} from './llm/ollama.ts';
import {createPortalSession} from '../../../prototypes/v1/server/portal-session.mjs';

const ROOM_COOKIE='portal_demo_room';
type Log=(level:'info'|'warn'|'error',event:string,fields?:Record<string,unknown>)=>void;
const stdoutLog:Log=(level,event,fields={})=>{process.stdout.write(JSON.stringify({t:new Date().toISOString(),level,event,...fields})+'\n');};

/** Reads and checks the environment. Missing secrets don't stop the process: /healthz reports them (503) so a
 * misconfigured deploy is visible in Render, and the demo stays closed until they are set. */
/** A key pasted into a dashboard often carries spaces, a line break or quotes; none of those are ever part of a key. */
export const cleanKey=(v:string|undefined)=>v?.trim().replace(/^(["'])(.*)\1$/,'$2').trim()||null;

export function configFromEnv(env:Record<string,string|undefined>=process.env){
 const num=(name:string,fallback:number)=>{const v=env[name];if(v===undefined||v==='')return fallback;const n=Number(v);if(!Number.isFinite(n))throw new Error(`${name} must be a number`);return n;};
 const missing:string[]=[];
 const passphrase=env.PORTAL_DEMO_PASSPHRASE??'',secret=env.PORTAL_SESSION_SECRET??'';
 if(passphrase.length<12)missing.push('PORTAL_DEMO_PASSPHRASE (at least 12 characters)');
 if(secret.length<32)missing.push('PORTAL_SESSION_SECRET (at least 32 characters)');
 const provider=(env.PORTAL_LLM_PROVIDER||'rules').toLowerCase();
 if(!['gemini','ollama','rules'].includes(provider))throw new Error('PORTAL_LLM_PROVIDER must be gemini, ollama or rules');
 const geminiOrigin=env.GEMINI_API_ORIGIN||GEMINI_ORIGIN;
 if(!geminiOriginAllowed(geminiOrigin))throw new Error('GEMINI_API_ORIGIN may only be a loopback test origin');
 const production=env.NODE_ENV==='production';
 const storage=(env.PORTAL_STORAGE||'ephemeral').toLowerCase();
 if(storage!=='ephemeral'&&storage!=='persistent')throw new Error('PORTAL_STORAGE must be ephemeral or persistent');
 return {production,secure:production&&env.PORTAL_ALLOW_HTTP!=='1',port:num('PORT',10000),
  dataDir:resolve(env.PORTAL_DATA_DIR||join(tmpdir(),'spotify-portal-demo')),storage:storage as 'ephemeral'|'persistent',passphrase,secret,missing,
  provider:provider as 'gemini'|'ollama'|'rules',geminiModel:env.GEMINI_MODEL?.trim()||'gemini-2.5-flash',geminiKey:cleanKey(env.GEMINI_API_KEY),geminiOrigin,
  aiDailyLimit:num('PORTAL_AI_DAILY_REQUEST_LIMIT',200),aiPerMinute:num('PORTAL_AI_REQUESTS_PER_MINUTE',8),roomLimit:num('PORTAL_DEMO_ROOM_LIMIT',50),roomTtlHours:num('PORTAL_DEMO_ROOM_TTL_HOURS',24),
  evidenceMaxAgeHours:num('ACTIVATION_EVIDENCE_MAX_AGE_HOURS',24),commit:env.RENDER_GIT_COMMIT?.slice(0,12)??null};
}
export type ProductionConfig=ReturnType<typeof configFromEnv>;

/** Fixed-window counters per key; enough for one instance. */
function limiter(max:number,windowMs:number,now:()=>number){
 const hits=new Map<string,{n:number;reset:number}>();
 return (key:string)=>{
  const t=now();if(hits.size>10_000)for(const [k,v] of hits)if(v.reset<=t)hits.delete(k);
  const h=hits.get(key);if(!h||h.reset<=t){hits.set(key,{n:1,reset:t+windowMs});return true;}
  if(h.n>=max)return false;h.n++;return true;
 };
}

const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"};

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type GateNotes={ephemeral:boolean;gemini:boolean;ended?:boolean};
const GATE_CSS=`*{box-sizing:border-box;margin:0}html{color-scheme:dark}body{min-height:100vh;background:#121212;color:#fff;font:16px/1.5 Figtree,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}
.entry{position:relative;min-height:100vh;display:grid;grid-template-columns:minmax(0,50vw) minmax(0,1fr);gap:4vw;padding:15px 17px 4px}
.art{position:relative;border-radius:10px;overflow:hidden;min-height:calc(100vh - 19px);background:linear-gradient(90deg,rgba(0,0,0,.45),transparent 10%,transparent 90%,rgba(0,0,0,.45)),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 26px,rgba(0,35,0,.07) 26px 30px,rgba(0,0,0,.03) 30px 47px),radial-gradient(ellipse 430px 175px at 50% 53%,rgba(30,95,40,.85),rgba(30,95,40,.5) 55%,transparent 100%),radial-gradient(circle 455px at 50% 57%,rgba(180,242,170,.62) 0 72%,rgba(120,210,120,.4) 88%,rgba(40,90,40,.2) 97%,transparent 100%),linear-gradient(180deg,#93df7d 0%,#80d674 30%,#4f9f4d 66%,#27471d 88%,#1a2a10 100%)}
.logo{position:absolute;top:22px;right:18px;display:inline-flex;align-items:center;gap:9px;color:#0d1d08;font-size:22px;white-space:nowrap}.logo svg{width:33px;height:33px}.logo b{font-weight:700}.beta{margin-left:8px;border:1.5px solid currentColor;border-radius:12px;padding:1px 8px;font-size:11px;font-weight:600;line-height:16px}
.copy{align-self:center;width:min(520px,100%);padding:48px 0}h1{font-size:48px;line-height:1.08;font-weight:800;letter-spacing:-1.6px}
.lead{margin-top:21px;font-size:16.6px;line-height:29px;font-weight:500;color:#f3f3f3}
.btn{display:inline-flex;align-items:center;justify-content:center;margin-top:27px;height:54px;padding:0 34px;border:0;border-radius:999px;background:#1ed760;color:#000;font-family:inherit;font-size:17px;font-weight:700;line-height:1;text-decoration:none;cursor:pointer}.btn:hover{background:#3be477}
.btn:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:2px}
.actions{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.actions .btn{margin-top:27px}.back{margin-top:27px;color:#fff;font-weight:600;text-decoration:none}.back:hover{text-decoration:underline}
label{display:grid;gap:8px;margin-top:24px;font-size:14px;font-weight:700;color:#fff}
input{width:100%;font:inherit;padding:13px 14px;border-radius:6px;border:1px solid #3a3a3a;background:#1c1c1c;color:#fff}input:hover{border-color:#5a5a5a}
details{margin-top:18px;color:#b3b3b3;font-size:14px}summary{cursor:pointer;font-weight:600;color:#fff;width:max-content;max-width:100%}details p{margin-top:6px}
.err{margin-top:18px;padding:12px 14px;border-radius:6px;background:#3a1714;color:#ffd2cc;font-size:14px}
.notes{margin-top:28px;display:grid;gap:10px}.note{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:20px;color:#b3b3b3}.note strong{color:#fff;font-weight:600}
.chip{flex:none;margin-top:1px;padding:0 8px;border-radius:10px;background:#3d2f12;color:#ffd27a;font-size:12px;font-weight:700;line-height:18px}
@media (max-width:860px){.entry{grid-template-columns:1fr;gap:0;padding:12px 16px}.art{min-height:200px}.logo{font-size:15px}.logo svg{width:24px;height:24px}.copy{padding:32px 0 48px}h1{font-size:36px}}`;
const LOGO='<span class="logo"><svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="18" cy="16" r="14" fill="currentColor"/><circle cx="16" cy="18" r="14.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span><b>Spotify Portal</b> for Backstage</span><span class="beta">BETA</span></span>';
/** What visitors are told before entering, and again in the Portal's demo menu. */
function gateNotes(notes:GateNotes){
 return `<div class="notes" aria-label="About this demo">
<p class="note"><span class="chip">Fictional</span><span><strong>Every customer, person and repository here is invented.</strong> Sample repository data is labelled as sample.${notes.gemini?' AI features use Gemini’s free tier, where Google may use submitted text to improve its products. Don’t enter real customer information.':' Don’t enter real customer information.'}</span></p>
${notes.ephemeral?'<p class="note"><span class="chip">Temporary</span><span><strong>Temporary demo data.</strong> This free deployment keeps your work only while the service is running. It is lost when it restarts, redeploys or sleeps after about 15 minutes without visitors.</span></p>':''}
</div>`;
}
/** The hosted entry, in the Portal's welcome design (reference 010): welcome, then passphrase. Persona selection
 * follows in the Portal itself. Server-rendered without scripts, so it works under the strict CSP. */
function gatePage(message:string|null,closed:string|null,notes:GateNotes={ephemeral:false,gemini:false},step:'welcome'|'passphrase'='passphrase',joining=''){
 const head=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotify Portal</title><style>${GATE_CSS}</style></head>
<body><main class="entry"><div class="art" role="img" aria-label="Portal artwork">${LOGO}</div><section class="copy">`;
 const tail='</section></main></body></html>';
 if(closed)return `${head}<h1>Portal isn’t available</h1><div class="err" role="alert">${esc(closed)}</div>${tail}`;
 const ended=notes.ended?'<div class="err" role="status">Your previous demo room is no longer available. On free hosting, demo data is cleared when the service restarts, redeploys or sleeps. Enter again to start a fresh room.</div>':'';
 if(step==='welcome')return `${head}<h1>Portal is ready for you</h1>
<p class="lead">Portal restores order to your microservices and infrastructure and enables your product teams to ship high-quality code quickly.</p>
${ended}<a class="btn" href="/demo-gate?step=passphrase">Get started</a>${gateNotes(notes)}${tail}`;
 return `${head}<form method="post" action="/demo-gate"><h1>Enter the demo</h1>
<p class="lead">Enter the passphrase you were given. Next, you’ll choose who to sign in as.</p>
${ended}
<label>Demo passphrase<input name="passphrase" type="password" autocomplete="current-password" required maxlength="200" autofocus></label>
<details${joining?' open':''}><summary>Join a shared room</summary><p>Someone in the demo can share their room code with you to work in the same room. Leave it empty for your own room.</p>
<label>Room code<input name="room" placeholder="e.g. K7M2Q-9XRTB" maxlength="11" autocomplete="off" value="${esc(joining)}"></label></details>
${message?`<div class="err" role="alert">${esc(message)}</div>`:''}
<div class="actions"><button class="btn" type="submit">Continue</button><a class="back" href="/demo-gate">Back</a></div></form>${gateNotes(notes)}${tail}`;
}

export async function startProduction(config:ProductionConfig,{now=()=>Date.now(),fetchImpl=fetch,log=stdoutLog}:{now?:()=>number;fetchImpl?:typeof fetch;log?:Log}={}){
 mkdirSync(config.dataDir,{recursive:true,mode:0o700});
 const filename=join(config.dataDir,'activation.sqlite');
 const rooms=openRooms(filename,{ttlHours:config.roomTtlHours,limit:config.roomLimit,now});
 const budget=openAiBudget(filename,config.aiDailyLimit,now,config.aiPerMinute);
 // What visitors are told on the gate and in the room bar.
 const notes={ephemeral:config.storage==='ephemeral',gemini:config.provider==='gemini'};
 const page=(message:string|null,closed:string|null,ended=false,step:'welcome'|'passphrase'='passphrase',joining='')=>gatePage(message,closed,{...notes,ended},step,joining);
 // Hosted inference; without a key the analysis is rule-based (labelled as such) and AiKA reports it is unavailable.
 let model:JsonModel|null=null;
 if(config.provider==='gemini'&&config.geminiKey)model=createGemini({apiKey:config.geminiKey,model:config.geminiModel,timeoutMs:90_000,retries:1,maxOutputTokens:8192,apiOrigin:config.geminiOrigin,admit:()=>budget.admit(),now},fetchImpl);
 if(config.provider==='ollama'){const o=ollamaConfigFromEnv({...process.env,PORTAL_LLM_PROVIDER:'ollama'});if(o)model=createOllama(o,fetchImpl);}
 const ai=model?`${model.provider}:${model.model}`:config.provider==='gemini'?'not_configured (GEMINI_API_KEY missing)':'rules';
 // Once at startup: does the provider accept this key and model? Shown in /healthz and the log (codes only), so a
 // rejected key is visible to the site owner before anyone uploads a document.
 let aiCheck=model?.check?'pending':model?'not_checked':'not_configured';
 if(model?.check)void model.check().then(r=>{aiCheck=r.ok?'ok':`${r.code}${r.detail?':'+r.detail:''}`;log(r.ok?'info':'warn','ai_check',{result:aiCheck});}).catch(()=>{aiCheck='MODEL_UNAVAILABLE:check_failed';});
 const hosted=createHostedActivation({filename,rooms,analysisModel:model,aikaModel:model,evidenceMaxAgeHours:config.evidenceMaxAgeHours});
 const goals=openGoalStore(join(config.dataDir,'goals.sqlite'));
 const api=createApp(goals,'http://127.0.0.1',hosted.options);
 api.requestTimeout=120_000;
 await new Promise<void>(r=>api.listen(0,'127.0.0.1',r));
 const apiOrigin=`http://127.0.0.1:${(api.address() as {port:number}).port}`;

 // The session layer reads its (per-boot) credentials from files in a private runtime directory.
 const runtime=join(config.dataDir,'runtime');mkdirSync(runtime,{recursive:true,mode:0o700});
 const file=(name:string,value:string)=>{const p=join(runtime,name);writeFileSync(p,value,{mode:0o600});return p;};
 const customer={...DEMO_CUSTOMER,apiOrigin,tokenFile:file('token',hosted.tokens.developer),operatorTokenFile:file('operator-token',hosted.tokens.operator),championTokenFile:file('champion-token',hosted.tokens.champion)};
 for(const [id,t] of Object.entries(hosted.tokens.developers))file(`developer-token-${id}`,t);
 const directory={customers:[customer],personas:DEMO_PERSONAS.map(p=>({...p,customers:[DEMO_CUSTOMER.id]}))};

 // Gate cookie: the room code and its expiry, signed with PORTAL_SESSION_SECRET (a restart keeps visitors in their room).
 const sign=(v:string)=>createHmac('sha256',config.secret||randomBytes(32).toString('hex')).update('room:'+v).digest('base64url');
 const roomOf=(req:IncomingMessage)=>{
  const raw=new RegExp(`(?:^|;\\s*)${ROOM_COOKIE}=([A-Za-z0-9_-]{1,200}\\.[A-Za-z0-9_-]{43})(?:;|$)`).exec(req.headers.cookie??'')?.[1];
  if(!raw||config.missing.length)return null;
  const [data,mac]=raw.split('.'),expected=sign(data);
  if(mac.length!==expected.length||!timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))return null;
  let v:{r?:string};try{v=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));}catch{return null;}
  return rooms.get(v.r)?.code??null;
 };
 // A genuine room cookie whose room is gone: the room ended (or ephemeral storage was cleared by a restart).
 const endedRoom=(req:IncomingMessage)=>{
  const raw=new RegExp(`(?:^|;\\s*)${ROOM_COOKIE}=([A-Za-z0-9_-]{1,200})\\.([A-Za-z0-9_-]{43})(?:;|$)`).exec(req.headers.cookie??'');
  if(!raw||config.missing.length)return false;const expected=sign(raw[1]);
  return raw[2].length===expected.length&&timingSafeEqual(Buffer.from(raw[2]),Buffer.from(expected))&&!roomOf(req);
 };
 const roomCookie=(code:string,expires:string)=>{const data=Buffer.from(JSON.stringify({r:code})).toString('base64url');
  return `${ROOM_COOKIE}=${data}.${sign(data)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(0,Math.floor((Date.parse(expires)-now())/1000))}${config.secure?'; Secure':''}`;};
 const session=createPortalSession({directory,secret:config.secret||null,secure:config.secure,room:roomOf,fetchImpl});

 const gateTries=limiter(10,15*60_000,now),writes=limiter(120,60_000,now),reads=limiter(600,60_000,now),analyses=limiter(15,24*3600_000,now),questions=limiter(60,24*3600_000,now);
 const dist=resolve(fileURLToPath(new URL('../../../prototypes/v1/dist/',import.meta.url)));
 const index=existsSync(join(dist,'index.html'))?readFileSync(join(dist,'index.html')):null;
 const passHash=createHash('sha256').update(config.passphrase).digest();
 const passOk=(p:string)=>timingSafeEqual(createHash('sha256').update(p).digest(),passHash)&&!!config.passphrase;
 // Render appends the connecting client's address last; earlier entries can be sent by the client itself.
 const ip=(req:IncomingMessage)=>String(req.headers['x-forwarded-for']??'').split(',').at(-1)!.trim()||req.socket.remoteAddress||'unknown';
 const sameOrigin=(req:IncomingMessage)=>!req.headers.origin||req.headers.origin===`${config.secure?'https':'http'}://${req.headers.host}`;

 const send=(res:ServerResponse,status:number,body:string|Buffer,type:string,headers:Record<string,string|string[]>={})=>{res.writeHead(status,{...SECURITY,'Content-Type':type,...headers});res.end(body);};
 const json=(res:ServerResponse,status:number,v:unknown,headers:Record<string,string|string[]>={})=>send(res,status,JSON.stringify(v),'application/json; charset=utf-8',{'Cache-Control':'no-store',...headers});
 const fail=(res:ServerResponse,status:number,code:string)=>json(res,status,{error:{code}});
 async function form(req:IncomingMessage){let size=0;const chunks:Buffer[]=[];for await(const c of req){size+=c.length;if(size>4096)throw new Error('too large');chunks.push(c);}return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));}
 function storageOk(){try{const db=new DatabaseSync(filename);try{db.prepare('SELECT 1').get();return true;}finally{db.close();}}catch{return false;}}

 async function handle(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url??'/','http://local'),path=url.pathname;
  if(path==='/healthz'){
   const storage=storageOk(),ok=storage&&!config.missing.length;
   return json(res,ok?200:503,{status:ok?'ok':'misconfigured',checks:{storage:storage?'ok':'error',storageMode:config.storage,aiRequestsPerMinute:config.aiPerMinute,config:config.missing.length?{missing:config.missing}:'ok',ai,aiCheck,aiRequestsToday:`${budget.used()}/${budget.limit}`,activeRooms:rooms.active()},commit:config.commit});
  }
  if(config.missing.length)return send(res,503,page(null,'This demo isn’t configured yet. The site owner needs to set its demo passphrase and session secret.'),'text/html; charset=utf-8',{'Cache-Control':'no-store'});
  if(path==='/demo-gate'&&req.method==='GET')return send(res,200,page(null,null,url.searchParams.get('ended')==='1',url.searchParams.get('step')==='passphrase'?'passphrase':'welcome'),'text/html; charset=utf-8',{'Cache-Control':'no-store'});
  if(path==='/demo-gate'&&req.method==='POST'){
   if(!sameOrigin(req))return fail(res,403,'ORIGIN_NOT_ALLOWED');
   if(!gateTries(ip(req))){log('warn','gate_rate_limited');return send(res,429,page('Too many attempts. Wait 15 minutes, then try again.',null),'text/html; charset=utf-8');}
   let f:URLSearchParams;try{f=await form(req);}catch{return fail(res,413,'PAYLOAD_TOO_LARGE');}
   const wanted=(f.get('room')??'').trim().toUpperCase().slice(0,11);
   if(!passOk(f.get('passphrase')??''))return send(res,401,page('That passphrase isn’t right.',null,false,'passphrase',wanted),'text/html; charset=utf-8');
   let room;
   if(wanted){room=ROOM_CODE.test(wanted)?rooms.get(wanted):null;if(!room)return send(res,404,page('That room code doesn’t exist or has expired. Leave it empty to start your own room.',null,false,'passphrase',wanted),'text/html; charset=utf-8');}
   else{try{room=rooms.create();}catch(e){if(e instanceof RoomLimitError){log('warn','room_limit_reached');return send(res,503,page('The demo is at capacity right now. Join an existing room with its code, or try again later.',null),'text/html; charset=utf-8');}throw e;}
    log('info','room_created');}
   // Straight to persona selection: the welcome screen was the gate's first step.
   return send(res,303,'','text/plain',{Location:'/login','Set-Cookie':roomCookie(room.code,room.expires),'Cache-Control':'no-store'});
  }
  if(path==='/demo-gate/room'&&req.method==='GET'){const code=roomOf(req),r=code?rooms.get(code):null;return r?json(res,200,{room:r.code,expiresAt:r.expires,fictional:true,storage:config.storage,aiProvider:config.provider}):fail(res,401,'DEMO_GATE_REQUIRED');}
  // A fresh, empty room for someone already in the demo (they passed the gate). Others in the old room are unaffected;
  // the persona sign-in is cleared so the new room starts at persona selection.
  if(path==='/demo-gate/new-room'&&req.method==='POST'){
   if(!sameOrigin(req))return fail(res,403,'ORIGIN_NOT_ALLOWED');
   if(!roomOf(req))return fail(res,401,'DEMO_GATE_REQUIRED');
   if(!gateTries(ip(req))){log('warn','gate_rate_limited');return fail(res,429,'RATE_LIMITED');}
   let room;try{room=rooms.create();}catch(e){if(e instanceof RoomLimitError){log('warn','room_limit_reached');return fail(res,503,'ROOM_LIMIT');}throw e;}
   log('info','room_created');
   return json(res,201,{room:room.code,expiresAt:room.expires},{'Set-Cookie':[roomCookie(room.code,room.expires),`portal_demo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.secure?'; Secure':''}`]});
  }
  if(path==='/demo-gate/leave'&&req.method==='POST'){
   if(!sameOrigin(req))return fail(res,403,'ORIGIN_NOT_ALLOWED');
   return json(res,200,{},{'Set-Cookie':[`${ROOM_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${config.secure?'; Secure':''}`,`portal_demo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.secure?'; Secure':''}`]});
  }
  const room=roomOf(req);
  const apiPath=path.startsWith('/portal-auth/')||path.startsWith('/portal-api/')||path.startsWith('/operator-api/');
  if(!room){
   if(apiPath||path.startsWith('/api/'))return fail(res,401,'DEMO_GATE_REQUIRED');
   return send(res,303,'','text/plain',{Location:endedRoom(req)?'/demo-gate?ended=1':'/demo-gate','Cache-Control':'no-store'});
  }
  if(apiPath){
   // Per-room limits: requests per minute, and model-backed requests per day.
   if(!(req.method==='POST'?writes:reads)(room))return fail(res,429,'RATE_LIMITED');
   // A PDF upload starts an analysis too, so it counts against the same daily allowance.
   if(req.method==='POST'&&(path.endsWith('/handoff-analyses')||path.endsWith('/handoff-documents'))&&!analyses(room))return fail(res,429,'ANALYSIS_LIMIT');
   if(req.method==='POST'&&path.endsWith('/aika-questions')&&!questions(room))return fail(res,429,'AIKA_QUESTION_LIMIT');
   return await session(req,res,()=>fail(res,404,'NOT_FOUND'));
  }
  if(path.startsWith('/api/'))return fail(res,404,'NOT_FOUND');
  if(req.method!=='GET'&&req.method!=='HEAD')return fail(res,405,'METHOD_NOT_ALLOWED');
  // The gate already showed the welcome screen: inside a room, the Portal starts at persona selection.
  if(path==='/')return send(res,303,'','text/plain',{Location:'/login','Cache-Control':'no-store'});
  // The built Portal: files under dist, otherwise the app shell (client-side routes).
  const target=resolve(dist,'.'+decodeURIComponent(path));
  if(target.startsWith(dist+sep)&&existsSync(target)&&statSync(target).isFile()){
   const immutable=path.startsWith('/assets/');
   return send(res,200,readFileSync(target),TYPES[extname(target)]??'application/octet-stream',{'Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'});
  }
  if(!index)return send(res,503,'The Portal frontend has not been built.','text/plain; charset=utf-8');
  return send(res,200,index,'text/html; charset=utf-8',{'Cache-Control':'no-cache'});
 }

 const server=createServer((req,res)=>{
  const started=now(),path=(req.url??'/').split('?')[0];
  res.on('finish',()=>{if(!path.startsWith('/assets/'))log(res.statusCode>=500?'error':'info','request',{method:req.method,path:path.replace(/[A-HJKMNP-TV-Z2-9]{5}-[A-HJKMNP-TV-Z2-9]{5}/g,':room'),status:res.statusCode,ms:now()-started});});
  handle(req,res).catch(e=>{log('error','unhandled',{code:(e as {code?:string})?.code??'INTERNAL_ERROR'});if(!res.headersSent)fail(res,500,'INTERNAL_ERROR');else res.end();});
 });
 server.requestTimeout=130_000;server.headersTimeout=20_000;
 // Expired rooms: their data is deleted, then the room.
 const purge=()=>{for(const code of rooms.expired()){try{const rows=purgeRoomData(filename,code);rooms.remove(code);log('info','room_purged',{rows});}catch(e){log('error','room_purge_failed',{code:(e as Error).name});}}};
 purge();const timer=setInterval(purge,10*60_000);timer.unref();
 await new Promise<void>(r=>server.listen(config.port,'0.0.0.0',r));
 log(config.missing.length?'warn':'info','started',{port:(server.address() as {port:number}).port,ai,storage:config.storage,missing:config.missing,secureCookies:config.secure,frontend:!!index});
 return {server,port:(server.address() as {port:number}).port,
  async close(){clearInterval(timer);await new Promise<void>(r=>server.close(()=>r()));server.closeAllConnections?.();await new Promise<void>(r=>api.close(()=>r()));api.closeAllConnections?.();await hosted.close();goals.close();budget.close();rooms.close();}};
}

// Started directly (Docker CMD): run until SIGTERM, then shut down cleanly so SQLite is closed.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.versions.node.split('.')[0]!=='24')throw new Error('Use Node 24');
 let config:ProductionConfig;
 const log=stdoutLog;
 try{config=configFromEnv();}catch(e){log('error','invalid_configuration',{message:(e as Error).message});process.exit(1);}
 const app=await startProduction(config!);
 let stopping=false;
 for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,async()=>{if(stopping)return;stopping=true;log('info','stopping',{signal});setTimeout(()=>process.exit(1),10_000).unref();await app.close();process.exit(0);});
 process.on('unhandledRejection',e=>log('error','unhandled_rejection',{code:(e as {code?:string})?.code??'UNKNOWN'}));
}
