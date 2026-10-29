/** The hosted demo's activation API: one fictional customer, many isolated demo rooms.
 *
 * Every visitor who passes the demo gate works in a room. A room is its own data partition: the API's principal is
 * {tenant: portal-demo, customer, session: room-<code>}, and every store is keyed by that principal, so rooms never
 * see or change each other's work. Rooms expire (PORTAL_DEMO_ROOM_TTL_HOURS) and their data is then deleted; the
 * number of live rooms is capped (PORTAL_DEMO_ROOM_LIMIT).
 *
 * The API listens on the container's loopback only. Each boot creates internal per-role credentials that only the
 * production server's Portal session layer holds; the room comes from the server-verified gate cookie, never from
 * the browser. */
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import type {IncomingMessage} from 'node:http';
import {createActivationServices} from './services.ts';
import type {RepositoryConfig} from './repository.ts';
import type {JsonModel} from '../llm/ollama.ts';
import type {ActivationOptions} from './routes.ts';

export const DEMO_TENANT='portal-demo';
/** The fictional scenario served by the hosted demo. */
export const DEMO_CUSTOMER={id:'northstar',label:'Northstar Commerce (fictional)',customerId:'fictional-northstar-commerce'};
export const DEMO_PERSONAS=[
 {id:'chris',name:'Chris',role:'operator' as const,title:'Spotify account operator'},
 {id:'maya',name:'Maya Chen',role:'champion' as const,title:'Platform Champion'},
 {id:'alex',name:'Alex Rivera',role:'developer' as const,title:'Developer'},
 {id:'jordan',name:'Jordan Lee',role:'developer' as const,title:'Developer'},
];
const ALPHABET='ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const ROOM_CODE=/^[A-HJKMNP-TV-Z2-9]{5}-[A-HJKMNP-TV-Z2-9]{5}$/;
export const sessionOf=(code:string)=>'room-'+code.replace('-','').toLowerCase();

export class RoomLimitError extends Error {constructor(){super('ROOM_LIMIT');}}

/** Demo rooms, kept in SQLite on the persistent disk so they survive restarts. */
export function openRooms(filename:string,{ttlHours,limit,now=()=>Date.now()}:{ttlHours:number;limit:number;now?:()=>number}){
 if(!(ttlHours>0&&ttlHours<=24*14))throw new Error('PORTAL_DEMO_ROOM_TTL_HOURS must be between 1 and 336');
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('PORTAL_DEMO_ROOM_LIMIT must be a whole number from 1 to 1000');
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS portal_demo_rooms (code TEXT PRIMARY KEY, created TEXT NOT NULL, expires TEXT NOT NULL) STRICT;');
 const iso=(t:number)=>new Date(t).toISOString();
 const code=()=>Array.from({length:10},(_,i)=>ALPHABET[randomInt(ALPHABET.length)]+(i===4?'-':'')).join('');
 function get(c:string|null|undefined){
  if(!c||!ROOM_CODE.test(c))return null;
  const r=db.prepare('SELECT code, created, expires FROM portal_demo_rooms WHERE code=?').get(c) as {code:string;created:string;expires:string}|undefined;
  return r&&Date.parse(r.expires)>now()?r:null;
 }
 return {get,
  active:()=>Number((db.prepare('SELECT COUNT(*) AS n FROM portal_demo_rooms WHERE expires>?').get(iso(now())) as {n:number}).n),
  create(){
   if((db.prepare('SELECT COUNT(*) AS n FROM portal_demo_rooms WHERE expires>?').get(iso(now())) as {n:number}).n>=limit)throw new RoomLimitError();
   for(;;){const c=code();if(!db.prepare('SELECT 1 FROM portal_demo_rooms WHERE code=?').get(c)){db.prepare('INSERT INTO portal_demo_rooms VALUES (?,?,?)').run(c,iso(now()),iso(now()+ttlHours*3600_000));return get(c)!;}}
  },
  expired:()=>(db.prepare('SELECT code FROM portal_demo_rooms WHERE expires<=?').all(iso(now())) as {code:string}[]).map(r=>r.code),
  remove:(c:string)=>{db.prepare('DELETE FROM portal_demo_rooms WHERE code=?').run(c);},
  close:()=>db.close()};
}
export type Rooms=ReturnType<typeof openRooms>;

/** Deletes one room's records from every store (every table keyed by tenant and session). */
export function purgeRoomData(filename:string,code:string){
 const db=new DatabaseSync(filename);
 try{
  db.exec('PRAGMA busy_timeout=5000;');
  const tables=(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(t=>t.name)
   .filter(t=>{const cols=(db.prepare(`PRAGMA table_info("${t.replace(/"/g,'""')}")`).all() as {name:string}[]).map(c=>c.name);return cols.includes('tenant')&&cols.includes('session');});
  let rows=0;
  for(const t of tables)rows+=Number(db.prepare(`DELETE FROM "${t.replace(/"/g,'""')}" WHERE tenant=? AND session=?`).run(DEMO_TENANT,sessionOf(code)).changes);
  return rows;
 }finally{db.close();}
}

export type HostedConfig={filename:string;rooms:Rooms;analysisModel:JsonModel|null;aikaModel:JsonModel|null;evidenceMaxAgeHours:number};
export function createHostedActivation(c:HostedConfig){
 // The fictional payments-api uses labelled sample data; it does not exist on GitHub.
 const repositories:RepositoryConfig[]=[{customerId:DEMO_CUSTOMER.customerId,id:'payments-api',label:'payments-api',repository:'northstar-commerce/payments-api',mode:'fixture',fixture:'northstar-payments-api',services:['payments-api']}];
 const services=createActivationServices({filename:c.filename,bundles:[],handoffMode:true,analysisModel:c.analysisModel,aikaModel:c.aikaModel,
  repositories,github:{},evidenceMaxAgeHours:c.evidenceMaxAgeHours,inspectionCooldownMs:30_000});
 // Internal credentials for this boot only, held by the session layer in this process.
 const token=()=>randomBytes(32).toString('hex');
 const tokens={developer:token(),operator:token(),champion:token(),
  developers:Object.fromEntries(DEMO_PERSONAS.filter(p=>p.role==='developer').map(p=>[p.id,token()]))};
 const bearer=(r:IncomingMessage)=>(r.headers.authorization??'').replace(/^Bearer /,'');
 const is=(r:IncomingMessage,t:string)=>{const b=Buffer.from(bearer(r)),e=Buffer.from(t);return b.length===e.length&&timingSafeEqual(b,e);};
 const developerName=(r:IncomingMessage)=>{const id=Object.entries(tokens.developers).find(([,t])=>is(r,t))?.[0];return DEMO_PERSONAS.find(p=>p.id===id)?.name??null;};
 const known=(r:IncomingMessage)=>is(r,tokens.developer)||is(r,tokens.operator)||is(r,tokens.champion)||!!developerName(r);
 const options:ActivationOptions={store:services.store,handoff:services.handoff,work:services.work,aika:services.aika,repositories:services.repositories,
  championApproval:true,developerName,isOperator:r=>is(r,tokens.operator),isChampion:r=>is(r,tokens.champion),
  reportProgress:services.reports.progress,reportBlocker:services.reports.submit,prepareGitHub:services.github.prepare,initialPlan:services.initialPlan,
  authorize(r,customerId){
   if(!known(r)||customerId!==DEMO_CUSTOMER.customerId)return null;
   const room=c.rooms.get(String(r.headers['x-portal-room']??''));
   return room?{tenantId:DEMO_TENANT,customerId,sessionId:sessionOf(room.code)}:null;
  }};
 return {options,tokens,close:services.close};
}
