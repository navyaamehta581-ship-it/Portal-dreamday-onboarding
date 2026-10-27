import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateContract, validateProgress, validateBlocker } from '../../../../contracts/activation/v1/validate.mjs';
import type { CustomerContext, ActivationPlan, ProgressUpdate, BlockerUpdate, EvidenceRecord } from '../../../../contracts/activation/v1/types.ts';

export type Principal = { tenantId: string; customerId: string; sessionId: string };
export class ActivationError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const fail = (code: string): never => { throw new ActivationError(code); };
export type Policy = {
  approveSetup?: (principal:Principal,packet:GitHubPreparation)=>boolean;
  // Server-only integration boundary: authenticate agreement, inspect receipts and actor authority.
  admitContext?: (principal: Principal, context: CustomerContext) => boolean;
  admitPlan?: (principal: Principal, context: CustomerContext, plan: ActivationPlan) => boolean;
  admit: (principal: Principal, record: EvidenceRecord, purpose: 'initialize' | 'progress' | 'blocker' | 'plan') => boolean;
};
import type { GitHubPreparation, ActivationState, ActionState } from '../../../../contracts/activation/v1/state.ts';
export type { ActivationState } from '../../../../contracts/activation/v1/state.ts';
/** Separate DB and schema: never migrates or opens the Goal/conversation stores. */
export function openActivationStore(filename: string, policy: Policy = { admit: () => false }) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS activation_sessions (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session)) STRICT;
    CREATE TABLE IF NOT EXISTS activation_events (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session,id)) STRICT;
    CREATE TABLE IF NOT EXISTS activation_history (tenant TEXT NOT NULL, customer TEXT NOT NULL, session TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(tenant,customer,session,revision)) STRICT;`);
  const key = (p: Principal) => {
    if (![p.tenantId,p.customerId,p.sessionId].every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 200)) fail('FORBIDDEN');
    return [p.tenantId,p.customerId,p.sessionId];
  };
  function read(p: Principal): ActivationState {
    const row = db.prepare('SELECT body FROM activation_sessions WHERE tenant=? AND customer=? AND session=?').get(...key(p));
    if (!row) return fail('NOT_FOUND');
    return JSON.parse(row.body as string);
  }
  function ledger(p: Principal, old: EvidenceRecord[], records: EvidenceRecord[], purpose: Parameters<Policy['admit']>[2]) {
    const map = new Map(old.map(e => [e.id,e]));
    for (const e of records) {
      if (map.has(e.id)) { if (!isDeepStrictEqual(map.get(e.id),e)) fail('INVALID_EVIDENCE'); }
      else {
        // Synthetic/representative sources may inform planning, never authenticate receipts/agreement.
        if ((e.proof.type !== 'none' || e.kind === 'customer_report') && /fixture|simulat|synthetic/i.test([e.source,e.producer,e.sourceRevision,e.proof.reference].join(' '))) fail('INVALID_EVIDENCE');
        if (!policy.admit(p,structuredClone(e),purpose)) fail('INVALID_EVIDENCE');
        map.set(e.id,e);
      }
    }
    return [...map.values()];
  }
  function planCheck(p: Principal, context: CustomerContext, plan: ActivationPlan) {
    validateContract('ActivationPlan',plan);
    if (plan.customerId !== p.customerId || plan.contextRevision !== context.revision || !plan.selectedMilestone.successCriteria.length) fail('INVALID_REQUEST');
    if (plan.planner !== 'demo_backend_adapter') fail('ADAPTER_UNAVAILABLE');
    if (!policy.admitPlan?.(p,structuredClone(context),structuredClone(plan))) fail('INVALID_EVIDENCE');
  }
  function action(plan: ActivationPlan): Record<string,ActionState> {
    const a=plan.suggestedNextAction;
    return {[a.id]: {revision:a.revision,status:'suggested',kind:a.kind,at:new Date().toISOString(),planRevision:plan.revision,blockedByIds:[],evidenceIds:[...a.evidenceIds]}};
  }
  function save(p: Principal, s: ActivationState) {
    const body=JSON.stringify(s);
    db.prepare('INSERT INTO activation_history VALUES (?,?,?,?,?)').run(...key(p),s.revision,body);
    db.prepare('INSERT INTO activation_sessions VALUES (?,?,?,?) ON CONFLICT(tenant,customer,session) DO UPDATE SET body=excluded.body').run(...key(p),body);
  }
  function transaction<T>(fn:()=>T):T {
    db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  function mutate(p: Principal, id: string, body: unknown, expected: number, apply:(s:ActivationState)=>void) {
    if (typeof id !== 'string' || !id.trim() || id.length>200 || !Number.isSafeInteger(expected) || expected<0) fail('INVALID_REQUEST');
    return transaction(()=>{
      const s=read(p);
      const prior=db.prepare('SELECT body FROM activation_events WHERE tenant=? AND customer=? AND session=? AND id=?').get(...key(p),id);
      if(prior) { if (!isDeepStrictEqual(JSON.parse(prior.body as string),body)) fail('IDEMPOTENCY_CONFLICT'); return s; }
      if(s.revision!==expected) fail('REVISION_CONFLICT');
      apply(s); s.revision++; save(p,s);
      db.prepare('INSERT INTO activation_events VALUES (?,?,?,?,?)').run(...key(p),id,JSON.stringify(body));
      return s;
    });
  }
  return {
    get: read,
    pending(): Principal[] {
      return db.prepare('SELECT tenant,customer,session,body FROM activation_sessions').all()
        .filter(row => ['pending','failed'].includes(JSON.parse(row.body as string).replan.status))
        .map(row => ({tenantId:row.tenant as string,customerId:row.customer as string,sessionId:row.session as string}));
    },
    getRevision(p:Principal,revision:number):ActivationState {
      if(!Number.isSafeInteger(revision)||revision<0) fail('INVALID_REQUEST');
      const row=db.prepare('SELECT body FROM activation_history WHERE tenant=? AND customer=? AND session=? AND revision=?').get(...key(p),revision);
      return row?JSON.parse(row.body as string):fail('NOT_FOUND');
    },
    getEvent(p:Principal,id:string):unknown {
      const row=db.prepare('SELECT body FROM activation_events WHERE tenant=? AND customer=? AND session=? AND id=?').get(...key(p),id);
      return row?JSON.parse(row.body as string):fail('NOT_FOUND');
    },
    initialize(p: Principal, context: CustomerContext, plan: ActivationPlan) {
      validateContract('CustomerContext',context); planCheck(p,context,plan);
      if (!policy.admitContext?.(p,structuredClone(context))) fail('INVALID_EVIDENCE');
      if(context.customerId!==p.customerId || plan.revision!==0 || plan.supersedesRevision!==null) fail('INVALID_REQUEST');
      return transaction(()=>{
        if(db.prepare('SELECT 1 FROM activation_sessions WHERE tenant=? AND customer=? AND session=?').get(...key(p))) fail('REVISION_CONFLICT');
        const evidence=ledger(p,[],context.evidence,'initialize');
        const all=ledger(p,evidence,plan.evidence,'plan');
        const a=plan.suggestedNextAction;
        const s:ActivationState={contractVersion:'1.0.0',customerId:p.customerId,developerSessionId:p.sessionId,revision:0,contextRevision:context.revision,planRevision:0,context,plan,evidence:all,
          milestone:{id:plan.selectedMilestone.id,status:'pending',requiredActions:[{id:a.id,revision:a.revision}],evidenceIds:[]},actions:action(plan),
          replan:{status:'none',blockerId:null,replacementPlanRevision:null,errorCode:null},chrisHelp:{status:'none',blockerIds:[],owner:null,reason:null,evidenceIds:[]},
          outcome:{agreedGoalContextRevision:context.revision,status:'unassessed',summary:'',evidenceIds:[],scope:context.agreedGoal.text}};
        save(p,s); return s;
      });
    },
    progress(p: Principal, event: ProgressUpdate) {
      validateContract('ProgressUpdate',event);
      return mutate(p,event.id,event,event.expectedRevision,s=>{
        if(event.transitions.some(t=>s.actions[t.actionId]?.blockedByIds.length)) fail('INVALID_TRANSITION');
        const evidence=ledger(p,s.evidence,event.evidence,'progress');
        const states=validateProgress(event,{customerId:p.customerId,sessionId:p.sessionId,authorized:true,revision:s.revision,planRevision:s.planRevision,milestoneId:s.milestone.id,requiredActionIds:s.milestone.requiredActions.map(a=>a.id),trustedEvidenceRecords:evidence,trustedEvidenceIds:evidence.map(e=>e.id),authorizedApprovalIds:evidence.filter(e=>e.proof.type==='authorization').map(e=>e.id),actions:s.actions});
        for(const [id,a] of Object.entries(states)) s.actions[id]={...s.actions[id],...a};
        for(const t of event.transitions) s.actions[t.actionId].evidenceIds=[...new Set([...s.actions[t.actionId].evidenceIds,...t.evidenceIds])];
        s.evidence=evidence;
        if(!Object.values(s.actions).some(a=>a.blockedByIds.length)) s.milestone.status=event.milestoneStatus;
        // Legacy narrative and reached milestone never promote a customer outcome.
        if(event.needsChris) s.chrisHelp={...s.chrisHelp,status:'requested',reason:'Developer requested help'};
      });
    },
    blocker(p: Principal,event:BlockerUpdate) {
      validateContract('BlockerUpdate',event);
      return mutate(p,event.id,event,event.expectedRevision,s=>{
        validateBlocker(event,{customerId:p.customerId,sessionId:p.sessionId,authorized:true,revision:s.revision,planRevision:s.planRevision,actionIds:Object.keys(s.actions),milestoneIds:[s.milestone.id]});
        if(s.replan.status==='pending'||s.replan.status==='failed') fail('REPLAN_PENDING');
        s.evidence=ledger(p,s.evidence,event.evidence,'blocker');
        // Conservative server policy blocks all current actions; clients cannot omit affected actions.
        for(const a of Object.values(s.actions)) a.blockedByIds.push(event.id);
        s.milestone.status='blocked';
        if(event.replan.required) s.replan={status:'pending',blockerId:event.id,replacementPlanRevision:null,errorCode:null};
        if(event.escalation.required) s.chrisHelp={status:'requested',blockerIds:[...s.chrisHelp.blockerIds,event.id],owner:event.escalation.owner,reason:event.escalation.reason,evidenceIds:event.evidenceIds};

      });
    },
    // Only the server inspector calls these methods. No client-supplied receipts or authority.
    beginGitHubPreparation(p:Principal,expected:number,record:GitHubPreparation) {
      return mutate(p,`github:start:${record.id}`,record,expected,s=>{
        const a=s.actions[record.actionId];
        if(s.planRevision!==record.planRevision||a?.revision!==record.actionRevision||a.blockedByIds.length||!['github_inspect','prepare_artifact'].includes(a.kind)) fail('INVALID_TRANSITION');
        s.githubPreparations={...s.githubPreparations,[record.id]:record};
      });
    },
    finishGitHubPreparation(p:Principal,id:string,expected:number,record:GitHubPreparation,records:EvidenceRecord[]) {
      return mutate(p,`github:finish:${id}`,{record,records},expected,s=>{
        const prior=s.githubPreparations?.[id];
        if(!prior||prior.status!=='inspecting'||prior.commandDigest!==record.commandDigest) fail('INVALID_TRANSITION');
        if(record.status==='prepared'&&(s.planRevision!==record.planRevision||s.actions[record.actionId]?.revision!==record.actionRevision||s.actions[record.actionId].blockedByIds.length)) fail('REVISION_CONFLICT');
        validateContract('CustomerContext',{...s.context,evidence:[...s.evidence,...records]});
        s.evidence=ledger(p,s.evidence,records,'progress');
        s.githubPreparations![id]=record;
        // A prepared review packet remains separate from approved/executed plan actions.
        // Never complete a milestone or overwrite the customer's reported outcome.
      });
    },
    acceptSetupProposal(p:Principal,input:unknown) {
      if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_REQUEST');
      const b=input as {id:string;expectedRevision:number;preparationId:string;artifactDigest:string;sourceCommit:string;planRevision:number;actionRevision:number;decision:'accept_proposal_only'};
      if(Object.keys(b).sort().join(',')!=='actionRevision,artifactDigest,decision,expectedRevision,id,planRevision,preparationId,sourceCommit'||typeof b.id!=='string'||!/^approval:[A-Za-z0-9_-]{1,80}$/.test(b.id)||typeof b.preparationId!=='string'||!/^prepare:[A-Za-z0-9_-]{1,80}$/.test(b.preparationId)||!/^[a-f0-9]{64}$/.test(b.artifactDigest)||!/^[a-f0-9]{40}$/.test(b.sourceCommit)||![b.expectedRevision,b.planRevision,b.actionRevision].every(n=>Number.isSafeInteger(n)&&n>=0)||b.decision!=='accept_proposal_only')return fail('INVALID_REQUEST');
      return mutate(p,b.id,b,b.expectedRevision,s=>{
        const packet=s.githubPreparations?.[b.preparationId];
        if(!packet||packet.status!=='prepared'||!packet.setupProposal||packet.artifactDigest!==b.artifactDigest||packet.commit!==b.sourceCommit||packet.planRevision!==b.planRevision||packet.actionRevision!==b.actionRevision||packet.proposalApproval)return fail('INVALID_TRANSITION');
        const a=s.actions[packet.actionId];
        if(s.planRevision!==b.planRevision||a?.revision!==b.actionRevision||a.blockedByIds.length)fail('REVISION_CONFLICT');
        if(!policy.approveSetup?.(p,structuredClone(packet)))fail('FORBIDDEN');
        packet.proposalApproval={decision:b.decision,artifactDigest:b.artifactDigest,sourceCommit:b.sourceCommit,planRevision:b.planRevision,actionRevision:b.actionRevision,acceptedAt:new Date().toISOString()};
        // Acceptance records review consent only. Artifact/digest/blockers, action proofs,
        // executed/verified flags, milestones and outcomes remain unchanged.
      });
    },
    // Server-built attributed progress: one transaction for report, dashboard and help request.
    reportDeveloperProgress(p:Principal,id:string,expected:number,planRevision:number,record:EvidenceRecord,needsChris:boolean) {
      return mutate(p,id,{planRevision,record,needsChris},expected,s=>{
        if(planRevision!==s.planRevision) fail('REVISION_CONFLICT');
        validateContract('CustomerContext',{...s.context,evidence:[...s.evidence,record]});
        if(record.kind!=='developer_report'||record.scope!==s.context.agreedGoal.text||record.proof.type!=='none') fail('INVALID_EVIDENCE');
        s.evidence=ledger(p,s.evidence,[record],'progress');
        // A narrative can report progress, but cannot establish action execution or milestone completion.
        if(s.milestone.status==='pending') s.milestone.status='in_progress';
        s.outcome={agreedGoalContextRevision:s.contextRevision,status:'reported',summary:record.claim,evidenceIds:[record.id],scope:record.scope};
        if(needsChris) s.chrisHelp={...s.chrisHelp,status:'requested',owner:'Chris',reason:'Developer requested help with reported progress',evidenceIds:[...s.chrisHelp.evidenceIds,record.id]};
      });
    },
    // Server-only report projection. Scope must be the exact agreed goal; no verified promotion exists.
    reportOutcome(p:Principal,id:string,expected:number,contextRevision:number,records:EvidenceRecord[]) {
      return mutate(p,id,{contextRevision,records},expected,s=>{
        if(contextRevision!==s.contextRevision || !records.length || records.some(e=>!['developer_report','customer_report'].includes(e.kind)||e.scope!==s.context.agreedGoal.text)) fail('INVALID_EVIDENCE');
        const combined=[...s.evidence,...records.filter(e=>!s.evidence.some(old=>old.id===e.id))];
        validateContract('CustomerContext',{...s.context,evidence:combined});
        s.evidence=ledger(p,s.evidence,records,'progress');
        s.outcome={agreedGoalContextRevision:contextRevision,status:'reported',summary:records.map(e=>e.claim).join('\n'),evidenceIds:records.map(e=>e.id),scope:s.context.agreedGoal.text};
      });
    },
    // Server worker only. Pending/failed intent and old plan remain durably readable after restart.
    completeReplan(p:Principal,id:string,expected:number,blockerId:string,result:ActivationPlan|null) {
      return mutate(p,id,{blockerId,result},expected,s=>{
        if(!['pending','failed'].includes(s.replan.status)||s.replan.blockerId!==blockerId) fail('INVALID_TRANSITION');
        if(!result) {s.replan.status='failed';s.replan.errorCode='PLANNER_UNAVAILABLE';return;}
        planCheck(p,s.context,result);
        if(result.revision!==s.planRevision+1 || result.supersedesRevision!==s.planRevision || !result.blockerIds.includes(blockerId)) fail('REVISION_CONFLICT');
        const next=result.suggestedNextAction;
        if(Object.hasOwn(s.actions,next.id)&&next.revision<=s.actions[next.id].revision) fail('REVISION_CONFLICT');
        s.evidence=ledger(p,s.evidence,result.evidence,'plan');
        s.plan=result;s.planRevision=result.revision;
        s.actions=action(result); // Prior revisions/approvals remain in immutable history, never carried forward.
        s.milestone={id:result.selectedMilestone.id,status:'pending',requiredActions:[{id:next.id,revision:next.revision}],evidenceIds:[]};
        s.replan={status:'ready',blockerId,replacementPlanRevision:result.revision,errorCode:null};
      });
    },
    close(){db.close();}
  };
}
export type ActivationStore=ReturnType<typeof openActivationStore>;
