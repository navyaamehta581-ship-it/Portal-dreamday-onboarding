// Additive handoff contract (not part of the frozen 1.0.0 schema). Browser-safe types only.
// The operator view holds private sources and the full understanding; the developer view is a
// separate, server-built projection that never carries source text, commercial or stakeholder data.

export type SourceType = 'crm' | 'conversation' | 'chris_notes' | 'account_prep' | 'technical_requirements' | 'repository' | 'integration_tools';
export type SourceInput = { id: string; type: SourceType; label: string; text: string };
/** Compact provenance: a short opening excerpt, never the full source. */
export type SourceRef = { sourceId: string; type: SourceType; label: string; excerpt: string };

export type FindingCategory = 'commercial' | 'stakeholder' | 'evaluation' | 'internal_note' | 'business_need' | 'technical_fact' | 'technical_requirement' | 'repository';
export type FindingStatus = 'verified' | 'reported' | 'assumption' | 'contradicted' | 'outdated';
export type Audience = 'internal' | 'champion' | 'developer';
export type Finding = { id: string; category: FindingCategory; topic: string; statement: string; status: FindingStatus; audience: Audience; sources: SourceRef[] };

export type UnknownPriority = 'blocks_first_milestone' | 'needed_later' | 'not_needed_now';
export type Unknown = { id: string; question: string; priority: UnknownPriority; audience: 'developer' | 'chris'; reason: string };
export type Contradiction = { topic: string; summary: string; findingIds: string[] };
export type Entities = { services: string[]; repositories: string[]; scm: string | null; sso: string | null; docs: string | null; ci: string | null; languages: string[] };
export type Goal = { need: string; technicalGoal: string; playbook: Playbook; findingIds: string[] };
export type Playbook = 'service_readiness' | 'techdocs' | 'scaffolder' | 'ci_investigation' | 'model_proposed';

export type EvidenceStatus = 'verified' | 'reported' | 'suggested' | 'unknown';
/** A passage of the input and the category the model assigned. Editable later; never treated as fact. */
export type Classification = { sourceId: string; category: SourceType; excerpt: string };
/** workBasis: 'stated' = the sources assign this work to the person; 'role_default' = what the product expects of the role (e.g. a Champion coordinates). */
export type Stakeholder = { name: string | null; role: string; responsibilities: string[]; confidence: 'reported' | 'inferred' | 'unknown'; sources: SourceRef[]; workBasis?: 'stated' | 'role_default' | 'none' };
export type BaselineCheck = { area: string; reason: string; status: EvidenceStatus };
/** How the understanding was produced; failures are recorded so the fallback is visible. */
/** Why the server rejected an item from model output. Codes only; never source content. */
export type Discard = { stage: 'interpret' | 'plan'; item: string; reason: string };
export type ModelStage = { name: string; ms: number; attempts: number; attemptErrors: string[]; promptTokens: number | null; outputTokens: number | null;
  promptEvalMs: number | null; evalMs: number | null; loadMs: number | null; tokensPerSecond: number | null; thinkingChars: number; numCtx: number; truncated: boolean };
export type ModelRun = { provider: 'ollama' | 'openai_compatible'; model: string; ok: boolean; error: string | null; durationMs: number; chunks: number; discarded: number;
  errorDetail?: string | null; discards?: Discard[]; stages?: ModelStage[] };

export type Understanding = {
  interpreter: 'hosted_model' | 'rule_based';
  findings: Finding[]; goals: Goal[]; unknowns: Unknown[]; contradictions: Contradiction[]; entities: Entities;
  company?: string | null; engineeringProblem?: string | null;
  stakeholders?: Stakeholder[]; classifications?: Classification[]; baseline?: BaselineCheck[];
  clarifications?: string[]; model?: ModelRun;
  /** Operator-only. Distinctive word stems of each private source passage, derived from the sources (never from model
   * text) and used to screen developer-facing text for restatements. */
  privateStems?: string[][];
};

export type MilestoneDraft = {
  id: string; objective: string;
  system: { service: string | null; repository: string | null; platform: string | null };
  why: string; actions: string[];
  prerequisites: { text: string; state: 'met' | 'unmet' | 'unknown' }[];
  requiredInformation: string[];
  destinations: { label: string; path: string }[];
  expectedOutput: string; completionCriteria: string[]; dependencies: string[]; developerUnknowns: string[];
  /** Role-aware proposal fields. A proposed assignee is a recommendation until the Champion approves it. */
  recommendedRole?: string; proposedAssignee?: string | null;
  /** Where the proposed assignee came from: the model's plan, or the person's work as stated in the sources. */
  assignmentBasis?: 'model' | 'stated_work'; expectedEvidence?: string[]; evidenceStatus?: EvidenceStatus;
  /** Developers see an assignee only once the assignment is approved (Champion step, not built yet). */
  assignmentStatus?: 'proposed' | 'approved';
};
/** Milestone generation result: a milestone, or the information Chris still needs to collect. */
export type MilestoneProposal = { milestones: MilestoneDraft[]; missing: string[] };

/** Technical context a developer can use: a topic and two or three sentences. */
export type TechnicalNote = { topic: string; text: string; status: 'verified' | 'reported' | 'assumption' };

export type DeveloperHandoff = {
  version: number; publishedAt: string; interpreter: Understanding['interpreter'];
  summary: string; context: TechnicalNote[]; unknowns: { question: string; reason: string }[];
  milestones: MilestoneDraft[];
  /** Technical stakeholders named in the sources (Champion, developers, platform/service owners) and their roles. */
  team?: { name: string; role: string; status: 'reported' | 'inferred' }[];
  /** The Champion's Dream Day approval of this plan. Absent for plans published before Dream Day. */
  approval?: { by: string; at: string };
};

/** Operator-only record. Drafts are numbered; publishing freezes one draft as a published version. */
export type Approval = { status: 'pending' | 'approved'; by: string | null; at: string | null };
/** Prepared for the Chris → Champion approval sequence; the Champion step has no UI yet. */
export type Approvals = { chris: Approval; champion: Approval };
export type Assignment = { milestoneId: string; role: string; proposedAssignee: string | null; status: 'proposed' | 'approved' };

/** Record status (Dream Day review workflow):
 * 'draft' = Chris is reviewing or revising; 'submitted' / 'resubmitted' = waiting for the Champion's review;
 * 'changes_requested' = the Champion sent it back with a comment; 'approved' = the Champion approved it but this
 * server doesn't publish; 'published' = developers can see it. Only a Champion approval publishes new plans;
 * a 'published' record without a recorded Champion approval predates Dream Day. */
export type HandoffStatus = 'draft' | 'submitted' | 'changes_requested' | 'resubmitted' | 'approved' | 'published';
/** One step of the Dream Day review, kept on the record. `by` is the display name of who acted. */
export type ReviewEvent = { action: 'submitted' | 'resubmitted' | 'withdrawn' | 'changes_requested' | 'approved' | 'published'; at: string; by: string; comment?: string };
export type HandoffRecord = {
  approvals?: Approvals; assignments?: Assignment[];
  draft: number; status: HandoffStatus; createdAt: string; publishedVersion: number | null; publishedAt: string | null;
  sources: SourceInput[]; understanding: Understanding; proposal: MilestoneProposal; developer: DeveloperHandoff | null;
  /** Chris's edited review of this analysis (operator-only), its revision and the saved information it was built from. */
  review?: ReviewDraft; reviewRevision?: number; reviewUpdatedAt?: string; basedOnWorkspaceRevision?: number;
  submittedAt?: string | null; history?: ReviewEvent[];
};

/** Chris's saved, not-yet-analyzed customer information for one customer. Operator-only. */
export type Workspace = { revision: number; updatedAt: string | null; sources: SourceInput[] };

/** Real stages of one analysis run, reported by the server as they start. */
export type AnalysisStage = 'preparing' | 'interpreting' | 'planning' | 'preparing_review';
export type AnalysisJob = {
  id: string; status: 'running' | 'succeeded' | 'failed'; stage: AnalysisStage; stageDetail: string | null;
  startedAt: string; finishedAt: string | null; elapsedMs: number; workspaceRevision: number;
  /** The analysis record created on success, and how it was produced (model or rule-based fallback). */
  draft: number | null; interpreter: Understanding['interpreter'] | null; modelOk: boolean | null; modelError: string | null;
  error: string | null;
};

/** Where a reviewed item came from. 'customer' = stated in the customer's sources; 'ai' = suggested by analysis;
 * 'chris' = added by Chris. `edited` marks an item Chris changed. */
export type ReviewOrigin = 'customer' | 'ai' | 'chris' | 'champion';
export type ReviewItem = { id: string; text: string; origin: ReviewOrigin; edited?: boolean; status?: 'verified' | 'reported' | 'unconfirmed'; sources?: string[] };
export type ReviewStakeholder = { id: string; name: string; role: string; responsibilities: string; basis: 'stated' | 'role_default' | 'inferred' | 'chris'; sources: string[]; technical: boolean };
export type ReviewMilestone = { id: string; title: string; description: string; system: string; actions: string[]; completionCriteria: string[];
  assignee: string | null; role: string; dependsOn: string[]; origin: ReviewOrigin; edited?: boolean };
export type ReviewDraft = {
  problem: { summary: string; challenges: ReviewItem[]; systems: ReviewItem[]; contradictions: ReviewItem[]; unknowns: ReviewItem[] };
  facts: ReviewItem[];
  stakeholders: ReviewStakeholder[];
  goals: ReviewItem[];
  milestones: ReviewMilestone[];
  questions: ReviewItem[];
};

/** The Champion's server-built view of the plan under review. Only technical, customer-safe content: no internal
 * notes, commercial details, non-technical people or Chris's source names. `plan` is null while Chris is drafting
 * or revising, so work in progress is never shown. */
export type ChampionReviewStatus = 'not_submitted' | 'revising' | 'submitted' | 'resubmitted' | 'changes_requested' | 'approved' | 'published' | 'published_before_dream_day';
export type ChampionPlan = {
  problem: ReviewDraft['problem']; facts: ReviewItem[]; goals: ReviewItem[]; milestones: ReviewMilestone[]; questions: ReviewItem[];
  stakeholders: Omit<ReviewStakeholder, 'technical'>[];
  /** Items left out because they failed the privacy screen (expected 0: submission is screened too). */
  withheld: number;
};
export type ChampionReview = {
  draft: number | null; status: ChampionReviewStatus; reviewRevision: number; submittedAt: string | null;
  analysis: 'model' | 'rule_based' | 'rule_based_fallback' | null;
  history: ReviewEvent[]; approval: { by: string; at: string } | null; plan: ChampionPlan | null;
};

/** Everything Chris's workspace loads in one request. */
export type HandoffOverview = { drafts: HandoffRecord[]; workspace: Workspace; analysis: AnalysisJob | null };
