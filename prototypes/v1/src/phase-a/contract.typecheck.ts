/** Compile-time negative contract checks; tsc fails if these restrictions disappear. */
import type {Message,AgentState,DeveloperNeedProfile,Evidence,Capability,CandidateSolution,WorkflowArtifact} from './contract';
export type SharedContractTypes = [Message,AgentState,DeveloperNeedProfile,Evidence,Capability,CandidateSolution,WorkflowArtifact];
// @ts-expect-error Only the backend's read-only boundary is supported.
const boundary: AgentState['boundary']='write';
// @ts-expect-error Model confidence cannot assert evidence verification.
const evidence: Evidence['status']='probably_verified';
// @ts-expect-error Artifacts cannot claim execution in this phase.
const execution: WorkflowArtifact['executionStatus']='executed';
// @ts-expect-error Capability documentation is distinct from installed verification.
const capability: Capability['status']='enabled';
void [boundary,evidence,execution,capability];
