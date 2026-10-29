/** A daily cap on model requests for the whole deployment (PORTAL_AI_DAILY_REQUEST_LIMIT), kept in SQLite so a
 * restart doesn't reset it. Counted per request sent to the provider, by UTC day. */
import {DatabaseSync} from 'node:sqlite';
import {ModelError} from './ollama.ts';

export function openAiBudget(filename:string,limit:number,now:()=>number=()=>Date.now()){
 if(!Number.isInteger(limit)||limit<0)throw new Error('PORTAL_AI_DAILY_REQUEST_LIMIT must be a whole number of requests per day');
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS portal_ai_usage (day TEXT PRIMARY KEY, requests INTEGER NOT NULL) STRICT;');
 const day=()=>new Date(now()).toISOString().slice(0,10);
 const used=()=>Number((db.prepare('SELECT requests FROM portal_ai_usage WHERE day=?').get(day()) as {requests?:number}|undefined)?.requests??0);
 return {
  limit,used,
  /** Takes one request from today's budget, or throws AI_DAILY_LIMIT. */
  take(){
   if(limit===0)throw new ModelError('AI_DAILY_LIMIT');
   const d=day();
   const r=db.prepare('INSERT INTO portal_ai_usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').get(d,limit) as {requests?:number}|undefined;
   if(!r?.requests)throw new ModelError('AI_DAILY_LIMIT');
  },
  close:()=>db.close()};
}
export type AiBudget=ReturnType<typeof openAiBudget>;
