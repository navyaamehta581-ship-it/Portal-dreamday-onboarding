// Additive browser response contract; review candidate, freeze HOLD.
import type { CustomerContext, ActivationPlan, EvidenceRecord } from './types.ts';
export type ActionState = { revision: number; status: 'suggested'|'prepared'|'approved'|'executed'|'verified'; kind: 'github_inspect'|'prepare_artifact'|'portal_workflow'|'deployment'; at: string; receiptId?: string; planRevision: number; blockedByIds: string[]; evidenceIds: string[] };
export type GitHubPreparation = {
  id:string; commandDigest:string; scopeDigest:string; actionId:string; actionRevision:number; planRevision:number;
  startedRevision:number; status:'inspecting'|'prepared'|'failed'; repository:string; commit:string;
  templatePath:string; templateBlob:string|null; observedAt:string; completedAt:string|null;
  evidenceIds:string[]; artifact:string|null; artifactDigest:string|null; blockers:string[]; errorCode:string|null;
  setupProposal?: SetupProposal;
  proposalApproval?: {decision:'accept_proposal_only'; artifactDigest:string; sourceCommit:string; planRevision:number; actionRevision:number; acceptedAt:string};
  authorization:'inspect_prepare_only'; approved:false; executed:false; verified:false; prUrl:null;
};
export type ActivationState = {
  githubPreparations?: Record<string,GitHubPreparation>;
  contractVersion: '1.0.0'; customerId: string; developerSessionId: string; revision: number;
  contextRevision: number; planRevision: number; context: CustomerContext; plan: ActivationPlan;
  milestone: { id: string; status: 'pending'|'in_progress'|'blocked'|'reached'; requiredActions: {id:string;revision:number}[]; evidenceIds:string[] };
  actions: Record<string, ActionState>; evidence: EvidenceRecord[];
  replan: { status: 'none'|'pending'|'failed'|'ready'; blockerId: string|null; replacementPlanRevision: number|null; errorCode: string|null };
  chrisHelp: { status:'none'|'requested'; blockerIds:string[]; owner:string|null; reason:string|null; evidenceIds:string[] };
  outcome: { agreedGoalContextRevision:number; status:'unassessed'|'reported'; summary:string; evidenceIds:string[]; scope:string };
};

export type SetupProposal = {
 version:1; sourceTree:string; kind:'fictional_recommendation_service_setup'; targetPath:string; proposedFile:string; diff:string;
 templateReview:'reviewed_known_template'|'unsupported_template';
 dependencies:{path:string;status:'missing'|'present_uninspected';source:string}[];
 missingPrerequisites:string[]; semantics:string[]; readyToRun:false;
};
