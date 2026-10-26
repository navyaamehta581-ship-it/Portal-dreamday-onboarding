// Additive browser response contract; review candidate, freeze HOLD.
import type { CustomerContext, ActivationPlan, EvidenceRecord } from './types.ts';
export type ActionState = { revision: number; status: 'suggested'|'prepared'|'approved'|'executed'|'verified'; kind: 'github_inspect'|'prepare_artifact'|'portal_workflow'|'deployment'; at: string; receiptId?: string; planRevision: number; blockedByIds: string[]; evidenceIds: string[] };
export type ActivationState = {
  contractVersion: '1.0.0'; customerId: string; developerSessionId: string; revision: number;
  contextRevision: number; planRevision: number; context: CustomerContext; plan: ActivationPlan;
  milestone: { id: string; status: 'pending'|'in_progress'|'blocked'|'reached'; requiredActions: {id:string;revision:number}[]; evidenceIds:string[] };
  actions: Record<string, ActionState>; evidence: EvidenceRecord[];
  replan: { status: 'none'|'pending'|'failed'|'ready'; blockerId: string|null; replacementPlanRevision: number|null; errorCode: string|null };
  chrisHelp: { status:'none'|'requested'; blockerIds:string[]; owner:string|null; reason:string|null; evidenceIds:string[] };
  outcome: { agreedGoalContextRevision:number; status:'unassessed'|'reported'; summary:string; evidenceIds:string[]; scope:string };
};
