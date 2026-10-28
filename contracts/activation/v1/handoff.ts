// Additive handoff contract (not part of the frozen 1.0.0 schema). Browser-safe types only.
// The operator view holds private sources and the full understanding; the developer view is a
// separate, server-built projection that never carries source text, commercial or stakeholder data.

export type SourceType = 'crm' | 'conversation' | 'chris_notes' | 'account_prep' | 'technical_requirements' | 'repository';
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
export type Playbook = 'service_readiness' | 'techdocs' | 'scaffolder' | 'ci_investigation';

export type Understanding = {
  interpreter: 'hosted_model' | 'rule_based';
  findings: Finding[]; goals: Goal[]; unknowns: Unknown[]; contradictions: Contradiction[]; entities: Entities;
};

export type MilestoneDraft = {
  id: string; objective: string;
  system: { service: string | null; repository: string | null; platform: string | null };
  why: string; actions: string[];
  prerequisites: { text: string; state: 'met' | 'unmet' | 'unknown' }[];
  requiredInformation: string[];
  destinations: { label: string; path: string }[];
  expectedOutput: string; completionCriteria: string[]; dependencies: string[]; developerUnknowns: string[];
};
/** Milestone generation result: a milestone, or the information Chris still needs to collect. */
export type MilestoneProposal = { milestones: MilestoneDraft[]; missing: string[] };

/** Technical context a developer can use: a topic and two or three sentences. */
export type TechnicalNote = { topic: string; text: string; status: 'verified' | 'reported' | 'assumption' };

export type DeveloperHandoff = {
  version: number; publishedAt: string; interpreter: Understanding['interpreter'];
  summary: string; context: TechnicalNote[]; unknowns: { question: string; reason: string }[];
  milestones: MilestoneDraft[];
};

/** Operator-only record. Drafts are numbered; publishing freezes one draft as a published version. */
export type HandoffRecord = {
  draft: number; status: 'draft' | 'published'; createdAt: string; publishedVersion: number | null; publishedAt: string | null;
  sources: SourceInput[]; understanding: Understanding; proposal: MilestoneProposal; developer: DeveloperHandoff | null;
};
