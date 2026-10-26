import schema from './schema.json' with {type:'json'};
export const CONTRACT_VERSION = '1.0.0';
export class ContractError extends Error {
  constructor(code, path, message) { super(`${path}: ${message}`); this.code=code; this.path=path; }
}
const fail=(code,path,message)=>{throw new ContractError(code,path,message);};
/** Dependency-free validator for the keywords used by this frozen schema, not a general JSON Schema engine. */
function check(rule,value,path) {
  if(rule.$ref) return check(schema.$defs[rule.$ref.split('/').at(-1)],value,path);
  if('const' in rule && value!==rule.const) fail('UNSUPPORTED_VERSION',path,'Unexpected constant');
  if(rule.enum && !rule.enum.includes(value)) fail('INVALID_REQUEST',path,'Unexpected enum value');
  const types=Array.isArray(rule.type)?rule.type:[rule.type];
  const matches=t=>t==='null'?value===null:t==='integer'?Number.isSafeInteger(value):t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):typeof value===t;
  if(rule.type && !types.some(matches)) fail('INVALID_REQUEST',path,'Wrong type');
  if(typeof value==='string') {
    if(value.trim().length<(rule.minLength??0)||value.length>(rule.maxLength??Infinity)) fail('INVALID_REQUEST',path,'Invalid length');
    if(rule.format==='date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,19)!==value.slice(0,19))) fail('INVALID_REQUEST',path,'Expected valid UTC timestamp');
  }
  if(typeof value==='number' && value<(rule.minimum??-Infinity)) fail('INVALID_REQUEST',path,'Below minimum');
  if(Array.isArray(value)) {
    if(value.length>(rule.maxItems??Infinity)) fail('INVALID_REQUEST',path,'Too many items');
    value.forEach((v,i)=>check(rule.items,v,`${path}[${i}]`));
  }
  if(rule.properties) {
    for(const k of rule.required) if(!Object.hasOwn(value,k)) fail('INVALID_REQUEST',path+'.'+k,'Required');
    for(const k of Object.keys(value)) {
      if(!Object.hasOwn(rule.properties,k)) fail('INVALID_REQUEST',path+'.'+k,'Unknown field');
      check(rule.properties[k],value[k],path+'.'+k);
    }
  }
}
export function validateContract(name,input) {
  if(!['CustomerContext','ActivationPlan','ProgressUpdate','BlockerUpdate'].includes(name)) fail('INVALID_REQUEST','type','Unknown contract');
  check(schema.$defs[name],input,name);
  const evidence=new Map();
  for(const e of input.evidence) {
    if(evidence.has(e.id)) fail('INVALID_EVIDENCE',e.id,'Duplicate evidence ID');
    evidence.set(e.id,e);
    if(e.kind!=='verified_outcome' && e.proof.type==='verification') fail('INVALID_EVIDENCE',e.id,'Verification must be explicitly classified');
    if(e.kind==='verified_outcome' && (e.proof.type!=='verification'||e.proof.result!=='passed'||!e.basisIds.length)) fail('INVALID_EVIDENCE',e.id,'Verified outcome needs passing check and basis');
    if(['portal_simulated','customer_report','developer_report','ai_inference'].includes(e.kind) && e.proof.type!=='none') fail('INVALID_EVIDENCE',e.id,'This source cannot prove an action');
    if(e.kind==='github_observation' && !/^[a-f0-9]{40,64}$/.test(e.sourceRevision)) fail('INVALID_EVIDENCE',e.id,'Pin GitHub observations to a commit');
  }
  function refs(value, key='') {
    if (Array.isArray(value)) {
      if (key.endsWith('EvidenceIds') || key === 'evidenceIds' || key === 'basisIds') {
        for (const id of value) {
          if (!evidence.has(id)) fail('INVALID_EVIDENCE', key, 'Unresolved evidence ID');
        }
      } else value.forEach(item => refs(item));
    } else if (value && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) refs(item, field);
    }
  }
  refs(input);
  const visiting=new Set(), visited=new Set();
  function visit(id) {
    if(visiting.has(id)) fail('INVALID_EVIDENCE',id,'Cyclic evidence basis');
    if(visited.has(id)) return;
    visiting.add(id); evidence.get(id).basisIds.forEach(visit); visiting.delete(id); visited.add(id);
  }
  for(const e of evidence.values()) {
    visit(e.id);
    if(e.kind==='ai_inference'&&!e.basisIds.length) fail('INVALID_EVIDENCE',e.id,'Inference requires basis');
    if(e.proof.type==='none'&&e.proof.result!=='not_checked') fail('INVALID_EVIDENCE',e.id,'No proof cannot claim passed or failed');
  }
  if(['ProgressUpdate','BlockerUpdate'].includes(name)&&input.revision!==input.expectedRevision+1) fail('REVISION_CONFLICT','revision','Event revision must follow expected revision');
  if(name==='CustomerContext' && (!input.briefingEvidenceIds.length||!input.agreedGoal.evidenceIds.length||input.agreedGoal.evidenceIds.some(id=>evidence.get(id).kind!=='customer_report'))) fail('INVALID_EVIDENCE','agreedGoal','Require recorded customer agreement');
  if(name==='ActivationPlan') {
    const a=input.suggestedNextAction;
    if(!input.capabilities.some(c=>c.id===a.capabilityId&&(a.kind==='github_inspect'?c.availability==='read_only':c.availability!=='unavailable'))) fail('CAPABILITY_UNAVAILABLE','suggestedNextAction','No available capability');
    if(['portal_workflow','deployment'].includes(a.kind)) fail('CAPABILITY_UNAVAILABLE','suggestedNextAction','No Portal execution or deployment in demonstration');
    if(input.supersedesRevision!==null && input.supersedesRevision>=input.revision) fail('REVISION_CONFLICT','supersedesRevision','Must precede current plan');
  }
  if(name==='BlockerUpdate' && !input.evidenceIds.length) fail('INVALID_REQUEST','replan','New information needs evidence');
  if(name==='ProgressUpdate') for(const t of input.transitions) {
    const order=['suggested','prepared','approved','executed','verified'];
    if(order.indexOf(t.toStatus)!==order.indexOf(t.fromStatus)+1) fail('INVALID_TRANSITION','transitions','Only adjacent forward transitions');
    if(!t.evidenceIds.length) fail('INVALID_EVIDENCE','transitions','Evidence required');
  }
  return input;
}
/** Call only with server-owned history, authenticated authorization and stored evidence IDs.
 * This validates receipts; a JSON claim alone never authenticates evidence. Pure function, no persistence. */
export function validateProgress(input, context) {
  validateContract('ProgressUpdate',input);
  if(!context || context.customerId!==input.customerId || context.sessionId!==input.developerSessionId || !context.authorized) fail('FORBIDDEN','context','Customer/session authorization required');
  if(context.revision!==input.expectedRevision||input.revision!==context.revision+1||input.planRevision!==context.planRevision) fail('REVISION_CONFLICT','revision','Stale update');
  const stored=new Map((context.trustedEvidenceRecords??[]).map(e=>[e.id,e]));
  // Compare parsed JSON structurally: property insertion order is irrelevant.
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  for(const e of input.evidence) if(context.trustedEvidenceIds.includes(e.id)&&JSON.stringify(canonical(stored.get(e.id)))!==JSON.stringify(canonical(e))) fail('INVALID_EVIDENCE',e.id,'Evidence differs from immutable server record');
  const evidence=new Map(input.evidence.map(e=>[e.id,e]));
  const states=structuredClone(context.actions);
  const seen=new Set();
  for(const t of input.transitions) {
    const current=states[t.actionId];
    if(!current||current.revision!==t.actionRevision||current.status!==t.fromStatus||Date.parse(t.at)<Date.parse(current.at)) fail('INVALID_TRANSITION',t.actionId,'State, action revision or event time mismatch');
    const proofType={prepared:'artifact',approved:'authorization',executed:'execution_receipt',verified:'verification'}[t.toStatus];
    const proof=t.evidenceIds.map(id=>evidence.get(id)).find(e=>context.trustedEvidenceIds.includes(e.id)&&e.proof.type===proofType&&e.proof.actionId===t.actionId&&e.proof.actionRevision===t.actionRevision&&e.proof.result==='passed'&&Date.parse(e.observedAt)<=Date.parse(t.at)&&Date.parse(e.observedAt)>=Date.parse(current.at));
    if(!proof||seen.has(proof.id)) fail('INVALID_EVIDENCE',t.actionId,'Distinct trusted evidence for this exact action revision required');
    if(['portal_workflow','deployment'].includes(current.kind)) fail('CAPABILITY_UNAVAILABLE',t.actionId,'Demonstration cannot execute or verify Portal/deployment');
    if(t.toStatus==='verified' && (proof.kind!=='verified_outcome'||!proof.basisIds.some(id=>id===current.receiptId))) fail('INVALID_EVIDENCE',t.actionId,'Verification must reference execution receipt');
    if(t.toStatus==='approved'&&!context.authorizedApprovalIds.includes(proof.id)) fail('FORBIDDEN',t.actionId,'Approval not authorized by server');
    seen.add(proof.id);
    states[t.actionId]={...current,status:t.toStatus,at:t.at,...(t.toStatus==='executed'?{receiptId:proof.id}:{})};
  }
  if(input.milestoneId!==context.milestoneId) fail('INVALID_REQUEST','milestoneId','Unknown milestone');
  if(input.milestoneStatus==='reached' && (!context.requiredActionIds.length||!context.requiredActionIds.every(id=>states[id]?.status==='verified'))) fail('INVALID_TRANSITION','milestoneStatus','All required actions must be verified');
  return states;
}

/** Validate an event against server-owned identities and history; caller persists atomically. */
export function validateBlocker(input,context) {
  validateContract('BlockerUpdate',input);
  if(!context||!context.authorized||context.customerId!==input.customerId||context.sessionId!==input.developerSessionId) fail('FORBIDDEN','context','Customer/session authorization required');
  if(context.revision!==input.expectedRevision||context.planRevision!==input.planRevision) fail('REVISION_CONFLICT','revision','Stale blocker');
  if(input.replan.invalidateActionIds.some(id=>!context.actionIds.includes(id))||input.replan.preserveMilestoneIds.some(id=>!context.milestoneIds.includes(id))) fail('INVALID_REQUEST','replan','Unknown action or milestone');
  if(!input.evidenceIds.some(id=>input.evidence.find(e=>e.id===id)?.kind==='developer_report')) fail('INVALID_EVIDENCE','evidenceIds','Developer report required');
  return input;
}
