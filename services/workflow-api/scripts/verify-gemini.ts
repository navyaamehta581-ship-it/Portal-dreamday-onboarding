/** Live check that Gemini powers both Chris's analysis and AiKA, end to end on the hosted server, with the fictional
 * sample PDF. Needs a real GEMINI_API_KEY in the environment (never pass it on the command line); GEMINI_MODEL is
 * optional. Makes a handful of real Gemini requests (about 4–8). Prints codes, counts and AiKA's short answer only:
 * never the key, prompts or document text.
 *
 *   GEMINI_API_KEY=… node scripts/verify-gemini.ts      (or: npm run verify:gemini)
 */
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configFromEnv,startProduction} from '../src/production.ts';

const PASS='verify gemini passphrase',CUSTOMER='fictional-aperture-commerce';
const SAMPLE=new URL('../../../prototypes/v1/public/samples/aperture-commerce-discovery-notes-fictional.pdf',import.meta.url);
if(!process.env.GEMINI_API_KEY?.trim()){console.error('FAIL: GEMINI_API_KEY is not set in this environment.');process.exit(2);}
const dir=mkdtempSync(join(tmpdir(),'verify-gemini-'));
const results:{step:string;ok:boolean;detail:string}[]=[];
const record=(step:string,ok:boolean,detail:string)=>{results.push({step,ok,detail});console.log(`${ok?'PASS':'FAIL'}  ${step}: ${detail}`);};
const app=await startProduction(configFromEnv({NODE_ENV:'production',PORTAL_ALLOW_HTTP:'1',PORT:'0',PORTAL_DATA_DIR:dir,PORTAL_DEMO_PASSPHRASE:PASS,PORTAL_SESSION_SECRET:'v'.repeat(48),
 PORTAL_LLM_PROVIDER:'gemini',GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_MODEL:process.env.GEMINI_MODEL??'gemini-2.5-flash',PORTAL_AI_DAILY_REQUEST_LIMIT:'40',
 ...(process.env.GEMINI_API_ORIGIN?{GEMINI_API_ORIGIN:process.env.GEMINI_API_ORIGIN}:{})}),{log:()=>undefined});
const origin=`http://127.0.0.1:${app.port}`;
/** A browser-like client with its own cookie jar. */
function client(){
 const jar=new Map<string,string>();
 const cookie=()=>[...jar].map(([k,v])=>`${k}=${v}`).join('; ');
 async function call(path:string,init:{method?:string;body?:BodyInit;type?:string;form?:Record<string,string>;headers?:Record<string,string>}={}){
  const headers:Record<string,string>={...init.headers,...(jar.size?{Cookie:cookie()}:{}),...(init.method==='POST'?{Origin:origin}:{})};
  let body=init.body;
  if(init.form){body=new URLSearchParams(init.form).toString();headers['Content-Type']='application/x-www-form-urlencoded';}else if(init.type)headers['Content-Type']=init.type;
  const r=await fetch(origin+path,{method:init.method??'GET',headers,body,redirect:'manual'});
  for(const c of r.headers.getSetCookie()){const [kv]=c.split(';');const [k,v]=kv.split('=');if(v)jar.set(k,v);else jar.delete(k);}
  const text=await r.text();let json:any=null;try{json=JSON.parse(text);}catch{/* html */}
  return {status:r.status,json};
 }
 return {call,jar};
}
const wait=async(read:()=>Promise<any>,ms=180_000)=>{const end=Date.now()+ms;let v;while(Date.now()<end){v=await read();if(v&&v.status!=='running')return v;await new Promise(r=>setTimeout(r,1000));}return v;};
try{
 const health=async()=>(await fetch(origin+'/healthz').then(r=>r.json())).checks;
 let h=await health();for(let i=0;i<30&&h.aiCheck==='pending';i++){await new Promise(r=>setTimeout(r,500));h=await health();}
 record('Gemini accepts the key and model (startup check)',h.aiCheck==='ok',`ai=${h.ai}, aiCheck=${h.aiCheck}`);
 if(h.aiCheck!=='ok')throw new Error('stop');
 // Chris uploads the fictional sample PDF; the analysis runs by itself.
 const chris=client();
 await chris.call('/demo-gate',{method:'POST',form:{passphrase:PASS}});
 await chris.call('/portal-auth/login',{method:'POST',type:'application/json',body:JSON.stringify({personaId:'chris'})});
 const op=(p:string)=>`/operator-api/aperture/activation/v1/customers/${CUSTOMER}/${p}`;
 const up=await chris.call(op('handoff-documents'),{method:'POST',type:'application/pdf',body:readFileSync(SAMPLE),headers:{'X-File-Name':encodeURIComponent('aperture-commerce-discovery-notes-fictional.pdf')}});
 record('Sample PDF accepted',up.status===202,`status ${up.status}, ${up.json?.report?.pagesRead??'?'} page(s) read`);
 const job=await wait(async()=>(await chris.call(op('handoff-analyses'))).json.job);
 const draft=(await chris.call(op('handoff'))).json.drafts.at(-1);
 const m=draft?.understanding?.model;
 record('Analysis produced by Gemini (not the rule-based fallback)',job?.status==='succeeded'&&m?.provider==='gemini'&&m?.ok===true,
  `job=${job?.status}${job?.elapsedMs?` in ${Math.round(job.elapsedMs/1000)}s`:''}, model=${m?.provider}:${m?.model}, ok=${m?.ok}${m?.ok?'':`, error=${m?.error}${m?.errorDetail?':'+m.errorDetail:''}`}`);
 const r=draft?.review;
 record('Draft has goals and milestones',!!r&&r.goals.length>0&&r.milestones.length>0,`${r?.goals.length??0} goal(s), ${r?.milestones.length??0} milestone(s), ${1+(r?.moreProblems?.length??0)} problem(s), ${r?.facts.length??0} fact(s)`);
 // Chris finalizes: published to the Champion and developers.
 const fin=await chris.call(op('handoff-submissions'),{method:'POST',type:'application/json',body:JSON.stringify({draft:draft.draft,reviewRevision:draft.reviewRevision??0,action:'submit',confirmed:true})});
 record('Chris finalizes and publishes',fin.json?.status==='published',`status ${fin.status}${fin.json?.error?` ${fin.json.error.code}`:''}`);
 // Alex, in the same demo room, asks AiKA.
 const alex=client();for(const [k,v] of chris.jar)alex.jar.set(k,v);
 await alex.call('/portal-auth/login',{method:'POST',type:'application/json',body:JSON.stringify({personaId:'alex'})});
 const dev=(p:string)=>`/portal-api/activation/v1/customers/${CUSTOMER}/${p}`;
 const caps=(await alex.call(dev('aika-capabilities'))).json;
 record('AiKA is connected to the model',caps?.modelConfigured===true,`available: ${(caps?.capabilities??[]).filter((c:any)=>c.available).map((c:any)=>'/'+c.id).join(' ')}`);
 const asked=await alex.call(dev('aika-questions'),{method:'POST',type:'application/json',body:JSON.stringify({question:'What could I build or improve first for our goals?'})});
 const answer=await wait(async()=>(await alex.call(dev('aika-questions'))).json.job);
 const sections=answer?.answer?.sections??[];
 record('AiKA answered through Gemini',asked.status===202&&answer?.status==='succeeded'&&sections.length>0,
  `job=${answer?.status}${answer?.error?` (${answer.error})`:''}, model=${answer?.model}, ${sections.length} section(s): ${sections.map((s:any)=>s.kind).join(', ')}, ${answer?.answer?.removed??0} removed`);
 if(sections[0])console.log(`      first part: “${String(sections[0].text).slice(0,160)}”`);
 const after=await health();
 console.log(`      Gemini requests counted today: ${after.aiRequestsToday}`);
}catch(e){if((e as Error).message!=='stop')record('Run',false,(e as Error).message);}
finally{await app.close();rmSync(dir,{recursive:true,force:true});}
const failed=results.filter(x=>!x.ok).length;
console.log(failed?`\n${failed} check(s) failed.`:'\nGemini powers the analysis and AiKA end to end.');
process.exit(failed?1:0);
