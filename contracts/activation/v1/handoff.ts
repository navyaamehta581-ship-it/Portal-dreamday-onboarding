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
export type Stakeholder = { name: string | null; role: string; responsibilities: string[]; confidence: 'reported' | 'inferred' | 'unknown'; sources: SourceRef[] };
export type BaselineCheck = { area: string; reason: string; status: EvidenceStatus };
/** How the understanding was produced; failures are recorded so the fallback is visible. */
export type ModelRun = { provider: 'ollama' | 'openai_compatible'; model: string; ok: boolean; error: string | null; durationMs: number; chunks: number; discarded: number };

export type Understanding = {
  interpreter: 'hosted_model' | 'rule_based';
  findings: Finding[]; goals: Goal[]; unknowns: Unknown[]; contradictions: Contradiction[]; entities: Entities;
  company?: string | null; engineeringProblem?: string | null;
  stakeholders?: Stakeholder[]; classifications?: Classification[]; baseline?: BaselineCheck[];
  clarifications?: string[]; model?: ModelRun;
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
  recommendedRole?: string; proposedAssignee?: string | null; expectedEvidence?: string[]; evidenceStatus?: EvidenceStatus;
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
};

/** Operator-only record. Drafts are numbered; publishing freezes one draft as a published version. */
export type Approval = { status: 'pending' | 'approved'; by: string | null; at: string | null };
/** Prepared for the Chris → Champion approval sequence; the Champion step has no UI yet. */
export type Approvals = { chris: Approval; champion: Approval };
export type Assignment = { milestoneId: string; role: string; proposedAssignee: string | null; status: 'proposed' | 'approved' };

export type HandoffRecord = {
  approvals?: Approvals; assignments?: Assignment[];
  draft: number; status: 'draft' | 'published'; createdAt: string; publishedVersion: number | null; publishedAt: string | null;
  sources: SourceInput[]; understanding: Understanding; proposal: MilestoneProposal; developer: DeveloperHandoff | null;
};
