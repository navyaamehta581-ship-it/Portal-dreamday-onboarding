/** Production server for the hosted Spotify Portal demo (see render.yaml). One process serves everything:
 *
 *   visitor ─HTTPS─▶ Render ─▶ this server ─┬─ /healthz                        health for Render
 *                                           ├─ /demo-gate                      shared-passphrase gate → demo room
 *                                           ├─ /portal-auth, /portal-api, /operator-api
 *                                           │      Portal session layer (personas) ─loopback─▶ activation API
 *                                           └─ everything else                 built Portal frontend (static)
 *
 * Environment (exact names from render.yaml): NODE_ENV, PORT, PORTAL_DATA_DIR, PORTAL_LLM_PROVIDER, GEMINI_MODEL,
 * GEMINI_API_KEY, PORTAL_AI_DAILY_REQUEST_LIMIT, PORTAL_DEMO_PASSPHRASE, PORTAL_SESSION_SECRET,
 * PORTAL_DEMO_ROOM_LIMIT, PORTAL_DEMO_ROOM_TTL_HOURS, ACTIVATION_EVIDENCE_MAX_AGE_HOURS.
 * Local testing only: PORTAL_ALLOW_HTTP=1 (cookies without Secure over plain http), GEMINI_API_ORIGIN (a loopback
 * stand-in for Gemini). Secrets are never logged; logs are one JSON object per line with codes, never content. */
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {extname,join,resolve,sep} from 'node:path';
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
 return {production,secure:production&&env.PORTAL_ALLOW_HTTP!=='1',port:num('PORT',10000),
  dataDir:resolve(env.PORTAL_DATA_DIR||'/var/data'),passphrase,secret,missing,
  provider:provider as 'gemini'|'ollama'|'rules',geminiModel:env.GEMINI_MODEL||'gemini-2.5-flash',geminiKey:env.GEMINI_API_KEY||null,geminiOrigin,
  aiDailyLimit:num('PORTAL_AI_DAILY_REQUEST_LIMIT',300),roomLimit:num('PORTAL_DEMO_ROOM_LIMIT',50),roomTtlHours:num('PORTAL_DEMO_ROOM_TTL_HOURS',24),
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

const TYPES:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const SECURITY={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"};

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function gatePage(message:string|null,closed:string|null){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spotify Portal · Fictional demo</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#121212;color:#fff;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(440px,calc(100vw - 32px));background:#181818;border:1px solid #2a2a2a;border-radius:8px;padding:32px}h1{font-size:22px;margin:0 0 6px}
p{color:#b3b3b3;font-size:14px;margin:0 0 18px}label{display:grid;gap:6px;margin-top:16px;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#bdbdbd}
input{width:100%;font:inherit;padding:12px 14px;border-radius:6px;border:1px solid #3a3a3a;background:#242424;color:#fff}button{margin-top:22px;width:100%;height:48px;border:0;border-radius:999px;background:#1ed760;color:#000;font:700 16px system-ui;cursor:pointer}
.err{margin-top:16px;padding:12px 14px;border-left:3px solid #f15e6c;background:#1f1f1f;color:#fff;font-size:14px}.tag{display:inline-block;margin-bottom:14px;padding:2px 10px;border-radius:12px;background:#3d2f12;color:#ffd27a;font-size:12px;font-weight:700}</style></head>
<body><main><span class="tag">Fictional demo</span><h1>Spotify Portal onboarding demo</h1>
<p>A prototype for the Spotify Backstage × TKS Ignition Challenge. Every customer, person and repository here is invented; sample repository data is labelled as sample. Enter the passphrase you were given.</p>
${closed?`<div class="err" role="alert">${esc(closed)}</div>`:`<form method="post" action="/demo-gate">
<label>Demo passphrase<input name="passphrase" type="password" autocomplete="current-password" required minlength="1" maxlength="200"></label>
<label>Room code (optional)<input name="room" placeholder="Join a shared room, e.g. K7M2Q-9XRTB" maxlength="11" autocomplete="off"></label>
${message?`<div class="err" role="alert">${esc(message)}</div>`:''}
<button type="submit">Enter the demo</button></form>
<p style="margin-top:18px">Without a room code you get your own demo room. Share its code to work in the same room with others.</p>`}</main></body></html>`;
}

export async function startProduction(config:ProductionConfig,{now=()=>Date.now(),fetchImpl=fetch,log=stdoutLog}:{now?:()=>number;fetchImpl?:typeof fetch;log?:Log}={}){
 mkdirSync(config.dataDir,{recursive:true,mode:0o700});
 const filename=join(config.dataDir,'activation.sqlite');
 const rooms=openRooms(filename,{ttlHours:config.roomTtlHours,limit:config.roomLimit,now});
 const budget=openAiBudget(filename,config.aiDailyLimit,now);
 // Hosted inference; without a key the analysis is rule-based (labelled as such) and AiKA reports it is unavailable.
 let model:JsonModel|null=null;
 if(config.provider==='gemini'&&config.geminiKey)model=createGemini({apiKey:config.geminiKey,model:config.geminiModel,timeoutMs:90_000,retries:1,maxOutputTokens:8192,apiOrigin:config.geminiOrigin,admit:()=>budget.take()},fetchImpl);
 if(config.provider==='ollama'){const o=ollamaConfigFromEnv({...process.env,PORTAL_LLM_PROVIDER:'ollama'});if(o)model=createOllama(o,fetchImpl);}
 const ai=model?`${model.provider}:${model.model}`:config.provider==='gemini'?'not_configured (GEMINI_API_KEY missing)':'rules';
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
   return json(res,ok?200:503,{status:ok?'ok':'misconfigured',checks:{storage:storage?'ok':'error',config:config.missing.length?{missing:config.missing}:'ok',ai,aiRequestsToday:`${budget.used()}/${budget.limit}`,activeRooms:rooms.active()},commit:config.commit});
  }
  if(config.missing.length)return send(res,503,gatePage(null,'This demo isn’t configured yet. The site owner needs to set its demo passphrase and session secret.'),'text/html; charset=utf-8',{'Cache-Control':'no-store'});
  if(path==='/demo-gate'&&req.method==='GET')return send(res,200,gatePage(null,null),'text/html; charset=utf-8',{'Cache-Control':'no-store'});
  if(path==='/demo-gate'&&req.method==='POST'){
   if(!sameOrigin(req))return fail(res,403,'ORIGIN_NOT_ALLOWED');
   if(!gateTries(ip(req))){log('warn','gate_rate_limited');return send(res,429,gatePage('Too many attempts. Wait 15 minutes, then try again.',null),'text/html; charset=utf-8');}
   let f:URLSearchParams;try{f=await form(req);}catch{return fail(res,413,'PAYLOAD_TOO_LARGE');}
   if(!passOk(f.get('passphrase')??''))return send(res,401,gatePage('That passphrase isn’t right.',null),'text/html; charset=utf-8');
   const wanted=(f.get('room')??'').trim().toUpperCase();
   let room;
   if(wanted){room=ROOM_CODE.test(wanted)?rooms.get(wanted):null;if(!room)return send(res,404,gatePage('That room code doesn’t exist or has expired. Leave it empty to start a new room.',null),'text/html; charset=utf-8');}
   else{try{room=rooms.create();}catch(e){if(e instanceof RoomLimitError){log('warn','room_limit_reached');return send(res,503,gatePage('The demo is at capacity right now. Join an existing room with its code, or try again later.',null),'text/html; charset=utf-8');}throw e;}
    log('info','room_created');}
   return send(res,303,'','text/plain',{Location:'/','Set-Cookie':roomCookie(room.code,room.expires),'Cache-Control':'no-store'});
  }
  if(path==='/demo-gate/room'&&req.method==='GET'){const code=roomOf(req),r=code?rooms.get(code):null;return r?json(res,200,{room:r.code,expiresAt:r.expires,fictional:true}):fail(res,401,'DEMO_GATE_REQUIRED');}
  if(path==='/demo-gate/leave'&&req.method==='POST'){
   if(!sameOrigin(req))return fail(res,403,'ORIGIN_NOT_ALLOWED');
   return json(res,200,{},{'Set-Cookie':[`${ROOM_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${config.secure?'; Secure':''}`,`portal_demo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${config.secure?'; Secure':''}`]});
  }
  const room=roomOf(req);
  const apiPath=path.startsWith('/portal-auth/')||path.startsWith('/portal-api/')||path.startsWith('/operator-api/');
  if(!room){
   if(apiPath||path.startsWith('/api/'))return fail(res,401,'DEMO_GATE_REQUIRED');
   return send(res,303,'','text/plain',{Location:'/demo-gate','Cache-Control':'no-store'});
  }
  if(apiPath){
   // Per-room limits: requests per minute, and model-backed requests per day.
   if(!(req.method==='POST'?writes:reads)(room))return fail(res,429,'RATE_LIMITED');
   if(req.method==='POST'&&path.endsWith('/handoff-analyses')&&!analyses(room))return fail(res,429,'ANALYSIS_LIMIT');
   if(req.method==='POST'&&path.endsWith('/aika-questions')&&!questions(room))return fail(res,429,'AIKA_QUESTION_LIMIT');
   return await session(req,res,()=>fail(res,404,'NOT_FOUND'));
  }
  if(path.startsWith('/api/'))return fail(res,404,'NOT_FOUND');
  if(req.method!=='GET'&&req.method!=='HEAD')return fail(res,405,'METHOD_NOT_ALLOWED');
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
 log(config.missing.length?'warn':'info','started',{port:(server.address() as {port:number}).port,ai,missing:config.missing,secureCookies:config.secure,frontend:!!index});
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
