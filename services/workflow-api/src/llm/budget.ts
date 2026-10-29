/** Limits on model requests for the whole deployment, to stay inside the provider's quota (for example Gemini's free
 * tier):
 *  - PORTAL_AI_REQUESTS_PER_MINUTE: requests wait (up to a minute) for a free slot instead of being sent too fast;
 *  - PORTAL_AI_DAILY_REQUEST_LIMIT: a cap per UTC day, kept in SQLite. With ephemeral storage the count starts again
 *    after a restart, so the provider's own daily quota still applies (its 429s are handled by the client).
 * Counted per request sent to the provider. */
import {DatabaseSync} from 'node:sqlite';
import {ModelError} from './ollama.ts';

export function openAiBudget(filename:string,limit:number,now:()=>number=()=>Date.now(),perMinute=0,sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))){
 if(!Number.isInteger(limit)||limit<0)throw new Error('PORTAL_AI_DAILY_REQUEST_LIMIT must be a whole number of requests per day');
 if(!Number.isInteger(perMinute)||perMinute<0)throw new Error('PORTAL_AI_REQUESTS_PER_MINUTE must be a whole number (0 means no per-minute pacing)');
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS portal_ai_usage (day TEXT PRIMARY KEY, requests INTEGER NOT NULL) STRICT;');
 const day=()=>new Date(now()).toISOString().slice(0,10);
 const used=()=>Number((db.prepare('SELECT requests FROM portal_ai_usage WHERE day=?').get(day()) as {requests?:number}|undefined)?.requests??0);
 const recent:number[]=[];
 /** Takes one request from today's budget, or throws AI_DAILY_LIMIT. */
 function take(){
  if(limit===0)throw new ModelError('AI_DAILY_LIMIT');
  const r=db.prepare('INSERT INTO portal_ai_usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').get(day(),limit) as {requests?:number}|undefined;
  if(!r?.requests)throw new ModelError('AI_DAILY_LIMIT');
 }
 return {
  limit,perMinute,used,take,
  /** Waits for a per-minute slot (at most about a minute), then takes from the daily budget. */
  async admit(){
   if(perMinute>0){
    for(let waited=0;;){
     const t=now();while(recent.length&&recent[0]<=t-60_000)recent.shift();
     if(recent.length<perMinute)break;
     const wait=recent[0]+60_000-t+50;
     if(waited+wait>65_000)throw new ModelError('MODEL_RATE_LIMITED','local_pacing');
     waited+=wait;await sleep(wait);
    }
   }
   take();
   if(perMinute>0)recent.push(now());
  },
  close:()=>db.close()};
}
export type AiBudget=ReturnType<typeof openAiBudget>;
