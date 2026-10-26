import type {CustomerContext,ActivationPlan,ProgressUpdate,BlockerUpdate,EvidenceRecord} from './types.ts';
export const CONTRACT_VERSION: '1.0.0';
export class ContractError extends Error {code:string;path:string}
type Contracts={CustomerContext:CustomerContext;ActivationPlan:ActivationPlan;ProgressUpdate:ProgressUpdate;BlockerUpdate:BlockerUpdate};
export function validateContract<K extends keyof Contracts>(name:K,input:unknown):Contracts[K];
export interface TrustedProgressContext {
 customerId:string;sessionId:string;authorized:boolean;revision:number;planRevision:number;
 trustedEvidenceRecords:EvidenceRecord[];milestoneId:string;requiredActionIds:string[];trustedEvidenceIds:string[];authorizedApprovalIds:string[];
 actions:Record<string,{revision:number;status:'suggested'|'prepared'|'approved'|'executed'|'verified';kind:'github_inspect'|'prepare_artifact'|'portal_workflow'|'deployment';at:string;receiptId?:string}>;
}
export function validateProgress(input:ProgressUpdate,context:TrustedProgressContext):TrustedProgressContext['actions'];

export interface TrustedBlockerContext {customerId:string;sessionId:string;authorized:boolean;revision:number;planRevision:number;actionIds:string[];milestoneIds:string[]}
export function validateBlocker(input:BlockerUpdate,context:TrustedBlockerContext):BlockerUpdate;
