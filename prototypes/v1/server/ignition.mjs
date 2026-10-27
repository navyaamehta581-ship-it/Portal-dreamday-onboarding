import {randomBytes} from 'node:crypto';
const PEOPLE={chris:'Chris',maya:'Maya',alex:'Alex',jordan:'Jordan'};
export const WORKFLOWS={ownership:{title:'Find the owner of payments-api',prerequisite:'GitHub repository read access and an owner entry',steps:['Open the simulated catalog entry for payments-api.','Inspect spec.owner and follow the team reference.','Confirm the owner is team-payments.'],answer:'team-payments'},docs:{title:'Find the payments-api runbook',prerequisite:'A published documentation index; no Okta setup required',steps:['Open payments-api documentation.','Find the incident runbook.','Confirm the runbook heading is Payments recovery.'],answer:'Payments recovery'}};
export const SOURCES=[{id:'crm',kind:'CRM paste',text:'Northstar Engineering: 500 employees, 80 engineers. 30-day POC. ~$100K potential. Maya is champion. Service ownership and docs are the goals.'},{id:'call',kind:'Discovery call paste',text:'Maya: GitHub hosts payments-api. Alex and Jordan need to find service owners and runbooks. Okta might be ready; security has not confirmed.'},{id:'technical',kind:'Technical notes paste',text:'GitHub access reported, not verified. Okta unverified. Earlier note says Okta enabled: conflict remains. Use team-payments and Payments recovery in the demo catalog fixture.'}];
// Onboarding steps a developer can record. Evidence says how the step was established:
// 'acknowledged' = the developer confirmed they reviewed it; 'simulated' = a simulated Portal action.
// Ownership and documentation outcomes come only from fixture verification (action 'verify').
export const STEPS={alex:{goal:'acknowledged',access:'simulated',prepare:'simulated',register:'simulated','docs-enable':'simulated'},jordan:{goal:'acknowledged',discover:'acknowledged'}};
const STEP_PREREQUISITES={register:'prepare'};
const error=code=>{throw Object.assign(Error(code),{code});};
const text=(v,max=8000)=>typeof v==='string'&&v.trim()&&v.length<=max?v.trim():error('INVALID_REQUEST');
export function createIgnitionStore(){
 const tenants=new Map();
 function get(tenant){if(!tenants.has(tenant))tenants.set(tenant,{revision:0,sources:structuredClone(SOURCES),versions:[],preferences:{priority:'ownership',goal:'',invites:[]},progress:{alex:{},jordan:{}},steps:{alex:{},jordan:{}}});return tenants.get(tenant);}
 function view(p){const s=get(p.tenant),latest=s.versions.at(-1);const shared={revision:s.revision,handoff:latest??null,preferences:s.preferences,workflows:WORKFLOWS,progress:p.role==='developer'?{[p.person]:s.progress[p.person]}:s.progress,steps:p.role==='developer'?{[p.person]:s.steps[p.person]}:s.steps,catalogRegistered:!!s.steps.alex.register,docsEnabled:!!s.steps.alex['docs-enable']};return structuredClone(p.role==='operator'?{...shared,sources:s.sources,versions:s.versions,commercial:'500 employees · 80 engineers · 30-day POC · ~$100K potential'}:shared);}
 function mutate(p,b){const s=get(p.tenant);if(b.revision!==s.revision)error('REVISION_CONFLICT');
  if(b.action==='source'){if(p.role!=='operator')error('FORBIDDEN');if(s.sources.length>=30)error('SOURCE_LIMIT');s.sources.push({id:randomBytes(8).toString('hex'),kind:text(b.kind,80),text:text(b.text)});}
  else if(b.action==='publish'){if(p.role!=='operator')error('FORBIDDEN');if(b.reviewed!==true)error('REVIEW_REQUIRED');const briefing=text(b.briefing),uncertainties=text(b.uncertainties,2000);if(/\$|\b(contract|discount|budget|potential|renewal|secret|password|token)\b/i.test(briefing+'\n'+uncertainties))error('PRIVATE_CONTEXT');s.versions.push({version:s.versions.length+1,briefing,uncertainties,approvedBy:'Chris',at:new Date().toISOString()});}
  else if(b.action==='preferences'){if(p.role!=='champion')error('FORBIDDEN');if(!s.versions.length)error('HANDOFF_REQUIRED');if(!Object.hasOwn(WORKFLOWS,b.priority)||typeof b.goal!=='string'||b.goal.length>500||!Array.isArray(b.invites)||b.invites.some(x=>!['alex','jordan'].includes(x)))error('INVALID_REQUEST');s.preferences={priority:b.priority,goal:b.goal,invites:[...new Set(b.invites)]};}
  else if(b.action==='verify'){if(p.role!=='developer')error('FORBIDDEN');if(!s.versions.length)error('HANDOFF_REQUIRED');const w=WORKFLOWS[b.workflow];if(!w)error('INVALID_REQUEST');if(b.answer!==w.answer)error('OUTCOME_NOT_VERIFIED');s.progress[p.person][b.workflow]={status:'verified in simulation',handoffVersion:s.versions.length,at:new Date().toISOString()};}
  else if(b.action==='step'){if(p.role!=='developer')error('FORBIDDEN');if(!s.versions.length)error('HANDOFF_REQUIRED');const evidence=STEPS[p.person]?.[b.step];if(!evidence)error('INVALID_REQUEST');const needs=STEP_PREREQUISITES[b.step];if(needs&&!s.steps[p.person][needs])error('STEP_PREREQUISITE');s.steps[p.person][b.step]={evidence,handoffVersion:s.versions.length,at:new Date().toISOString()};}
  else error('INVALID_REQUEST');s.revision++;return view(p);
 }
 return {view,mutate};
}
export function ignitionPlugin(){
 const store=createIgnitionStore(),sessions=new Map();
 function install(server){server.middlewares.use(async(req,res,next)=>{
  if(!req.url?.startsWith('/ignition-api/'))return next();
  const scoped=/^\/ignition-api\/(chris|maya|alex|jordan)\/(session|state|logout)$/.exec(req.url);
  const endpoint=scoped?'/ignition-api/'+scoped[2]:req.url;
  const cookieName=scoped?'ignition_demo_'+scoped[1]:'ignition_demo';
  const cookiePattern=new RegExp('(?:^|;\\s*)'+cookieName+'=([a-f0-9]{64})(?:;|$)');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(process.env.IGNITION_DEMO!=='1')return send(404,{error:'DEMO_DISABLED'});
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host??''))return send(403,{error:'FORBIDDEN'});
  try{
   if(!['GET','POST'].includes(req.method))return send(405,{error:'METHOD_NOT_ALLOWED'});
   let body={};if(req.method==='POST'){if(req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'ORIGIN_NOT_ALLOWED'});let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>64000)return send(413,{error:'PAYLOAD_TOO_LARGE'});}try{body=JSON.parse(raw);}catch{return send(400,{error:'INVALID_REQUEST'});}}
   if(endpoint==='/ignition-api/session'&&req.method==='POST'){
    if(!Object.hasOwn(PEOPLE,body.person))return send(400,{error:'INVALID_REQUEST'});
    if(scoped&&body.person!==scoped[1])return send(403,{error:'FORBIDDEN'});
    if(scoped&&body.email!==body.person+'@northstar.example')return send(403,{error:'ACCOUNT_MISMATCH'});
    const sid=randomBytes(32).toString('hex');const person=body.person;
    const old=cookiePattern.exec(req.headers.cookie??'');if(old)sessions.delete(old[1]);
    sessions.set(sid,{tenant:'northstar',person,role:person==='chris'?'operator':person==='maya'?'champion':'developer',expires:Date.now()+3600000});res.setHeader('Set-Cookie',`${cookieName}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);return send(200,{ok:true});
   }
   const sid=cookiePattern.exec(req.headers.cookie??'')?.[1],p=sessions.get(sid);if(!p||p.expires<Date.now()||(scoped&&p.person!==scoped[1]))return send(401,{error:'SIGN_IN_REQUIRED'});
   if(endpoint==='/ignition-api/logout'&&req.method==='POST'){sessions.delete(sid);res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return send(200,{ok:true});}
   if(endpoint!=='/ignition-api/state')return send(404,{error:'NOT_FOUND'});
   return send(200,{person:p.person,role:p.role,...(req.method==='GET'?store.view(p):store.mutate(p,body))});
  }catch(e){return send(e.code==='FORBIDDEN'?403:e.code==='REVISION_CONFLICT'?409:400,{error:e.code??'INVALID_REQUEST'});}
 });}
 return {name:'fictional-ignition',configureServer:install,configurePreviewServer:install};
}
