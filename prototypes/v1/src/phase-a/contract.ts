/** Contract 1.0.0: additive optional fields only within v1; breaking changes require /v2. */
export const CONTRACT_VERSION = '1.0.0' as const;
export type AgentStage = 'understanding_request' | 'investigating_environment' | 'evaluating_solutions' | 'awaiting_clarification' | 'preparing_recommendation' | 'generating_artifact' | 'validating_results' | 'ready';
export interface Message { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }
export interface Constraint { id: string; text: string; status: 'confirmed'; sourceMessageId: string }
export interface Evidence { id: string; claim: string; status: 'verified' | 'inferred' | 'developer_statement'; source: string; observedAt: string; revision?: string }
export interface ClarificationQuestion { id: string; question: string; reason: string; answerMessageId?: string }
export interface DeveloperNeedProfile { statedProblem: string; desiredOutcome: string | null; intent: 'unclassified'; verifiedContext: string[]; constraints: Constraint[]; observedFriction: string[]; assumptions: string[]; unknowns: string[]; confidence: number }
export interface Hypothesis { id: string; claim: string; evidenceIds: string[]; status: 'unassessed' | 'supported' | 'rejected' }
export interface Capability { id: string; name: string; status: 'documented' | 'verified' | 'inferred' | 'unavailable'; evidenceIds: string[]; limitations: string[] }
export interface CandidateSolution { id: string; approach: 'reuse' | 'modify' | 'create' | 'configuration' | 'non_workflow' | 'clarify'; description: string; evidenceIds: string[]; constraintIds: string[]; assumptions: string[] }
export interface WorkflowArtifact { targetPath: string; operation: 'create' | 'modify'; proposedContent: string; diff: string; validation: {check: string; status: 'passed' | 'failed' | 'not_checked'; detail: string}[]; executionStatus: 'not_executed' }
export interface StageEvent { sequence: number; stage: AgentStage; operation: string; at: string }
export interface AgentState {
 contractVersion: typeof CONTRACT_VERSION; conversationId: string; revision: number; messages: Message[];
 developerNeed: DeveloperNeedProfile; hypotheses: Hypothesis[]; evidence: Evidence[]; capabilities: Capability[];
 constraints: Constraint[]; candidateSolutions: CandidateSolution[]; selectedSolution?: CandidateSolution;
 artifact?: WorkflowArtifact; pendingQuestion?: ClarificationQuestion; stage: AgentStage; events: StageEvent[];
 boundary: 'read_only'; mode: 'phase_a_deterministic';
}
export interface CreateConversationRequest { contractVersion: typeof CONTRACT_VERSION }
export interface MessageRequest { contractVersion: typeof CONTRACT_VERSION; expectedRevision: number; content: string; confirmedConstraints?: string[]; answersQuestionId?: string }
export interface StateResponse { contractVersion: typeof CONTRACT_VERSION; state: AgentState }
export type ErrorCode = 'INVALID_REQUEST' | 'NOT_FOUND' | 'REVISION_CONFLICT' | 'UNSUPPORTED_VERSION' | 'INTERNAL_ERROR' | 'FORBIDDEN' | 'UNSUPPORTED_MEDIA_TYPE' | 'PAYLOAD_TOO_LARGE';
export interface ErrorResponse { contractVersion: typeof CONTRACT_VERSION; error: {code: ErrorCode; message: string} }
export interface FixtureResponse { contractVersion: typeof CONTRACT_VERSION; mode: 'development_fixture'; examples: { empty: StateResponse; confirmedConstraint: StateResponse; conflict: ErrorResponse; multiTurn?: StateResponse; clarification?: StateResponse; investigation?: StateResponse; recommendation?: StateResponse; errors?: Record<ErrorCode, ErrorResponse> } }
export const ROUTES = { fixtures: '/api/conversations/v1/fixtures', create: '/api/conversations/v1', state: (id: string) => `/api/conversations/v1/${encodeURIComponent(id)}`, messages: (id: string) => `/api/conversations/v1/${encodeURIComponent(id)}/messages` };
