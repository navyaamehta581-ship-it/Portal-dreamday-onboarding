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
export type ModelRun = { provider: 'ollama' | 'gemini' | 'openai_compatible'; model: string; ok: boolean; error: string | null; durationMs: number; chunks: number; discarded: number;
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
  /** The approved plan's engineering problem, technical goals and open clarification questions (developer-safe). */
  objective?: { problem: string | null; goals: string[]; questions: string[]; /** Further engineering problems, when the plan has more than one. */ problems?: string[] };
};

// ---- Phase 5: developers working on approved milestones. Attributed by server-side developer identity.
export type ActionStatus = 'not_started' | 'started' | 'blocked' | 'completed';
export type WorkStatus = 'not_started' | 'in_progress' | 'blocked' | 'ready_for_review' | 'completed';
/** An entry in a milestone's record and discussion, attributed to the person whose credential made it.
 * Developers (the assignee) write updates, blockers, questions and replies; the Champion writes coordination notes,
 * responses and follow-up requests (Phase 6). `evidence` is a reference the developer reported; it is not verified.
 * `replyTo` names the entry this one answers. Older records have no `role` or `replyTo` and are read as a developer's. */
export type WorkUpdate = { id: string; at: string; by: string; role?: 'developer' | 'champion';
  kind: 'update' | 'blocker' | 'question' | 'response' | 'coordination' | 'follow_up'; text: string; evidence: string | null;
  replyTo?: string | null; resolved: { at: string; by: string } | null };
/** The Champion's review of a milestone the assignee marked ready for review (or completed). Recorded separately from
 * the developer's status: reviewing never completes a milestone. `developerRevision` is the developer work it saw. */
export type MilestoneReview = { decision: 'reviewed'; at: string; by: string; note: string | null; developerRevision: number };
/** Stored per approved milestone. `explicit` is a status the assignee set (ready for review, completed); otherwise
 * the status is derived from the actions and open blockers. `revision` changes on every write (anyone's);
 * `developerRevision` only when the assignee changes the work itself (actions, status, a new blocker or update). */
export type MilestoneWorkRecord = { milestoneId: string; revision: number; explicit: 'ready_for_review' | 'completed' | null;
  actions: { status: ActionStatus; at: string | null; by: string | null }[]; updates: WorkUpdate[]; updatedAt: string | null; updatedBy: string | null;
  developerRevision?: number; review?: MilestoneReview | null;
  /** Developers who chose to work on this milestone (nobody is assigned work they didn't choose). */
  workingOn?: string[] };
export type MilestoneDependency = { id: string; title: string; assignee: string | null; status: WorkStatus };
/** Review state, derived on the server: awaiting the Champion once the assignee marks it ready (or completed);
 * `reviewed_outdated` when the developer changed the work after the review. */
export type ReviewState = 'none' | 'awaiting_review' | 'reviewed' | 'reviewed_outdated';
/** Why a milestone needs the Champion's attention. */
export type AttentionReason = 'blocked' | 'open_blocker' | 'open_question' | 'awaiting_review' | 'review_outdated' | 'waiting_on_dependency';
/** One approved milestone as a viewer may see it. `detail` is present for the viewer's own milestones (and for the
 * Champion and Chris); other developers' milestones show only title, assignee and status. Counts are computed on
 * the server so every view shows the same numbers. */
/** `assignee` is the owner the Champion suggested, if any. `mine`: the viewer suggested as owner or working on it. */
export type MilestoneProgress = { id: string; title: string; assignee: string | null; status: WorkStatus; openBlockers: number; mine: boolean;
  workingOn?: string[]; suggestedForMe?: boolean;
  /** The work record's revision, so any developer can choose (or stop) a milestone they can't otherwise change. */
  revision?: number;
  /** What the milestone is about, for anyone on the team; a developer's own notes and action progress stay in `detail`. */
  outline?: { description: string; system: string | null; actions: string[]; completionCriteria: string[] };
  dependsOn: MilestoneDependency[];
  openQuestions?: number; openFollowUps?: number; actionsCompleted?: number; actionsTotal?: number;
  reviewState?: ReviewState; review?: MilestoneReview | null; attention?: AttentionReason[];
  latest?: { at: string; by: string; kind: WorkUpdate['kind'] } | null;
  detail: { description: string; system: string | null; actions: { index: number; text: string; status: ActionStatus; at: string | null; by: string | null }[];
    completionCriteria: string[]; updates: WorkUpdate[]; revision: number; updatedAt: string | null; updatedBy: string | null } | null };
/** Team totals, computed on the server from the same records as each milestone. */
export type ProgressSummary = { milestones: number; notStarted: number; inProgress: number; blocked: number; readyForReview: number; completed: number;
  reviewed: number; awaitingReview: number; openBlockers: number; openQuestions: number; openFollowUps: number; actionsCompleted: number; actionsTotal: number;
  /** The approved plan carries no deadlines, so nothing can be overdue; this stays null until one exists. */
  overdue: null };
export type TeamProgress = { viewer: { role: 'developer' | 'champion' | 'operator'; name: string | null };
  approval: { by: string; at: string } | null; objective: DeveloperHandoff['objective'] | null; milestones: MilestoneProgress[];
  summary?: ProgressSummary;
  /** What the Portal backend itself observed on GitHub (verified evidence); Champion and Chris only. */
  verifiedEvidence?: string[] };

// ---- Phase 5: AiKA. Answers come from the approved, developer-safe context only.
/** `verified` is a repository observation the backend recorded live and the answer cites; `sample` cites fixture
 * (sample) repository data. Both carry the cited observation ids; uncited repository claims are removed. */
export type AikaSection = { kind: 'known' | 'verified' | 'sample' | 'reported' | 'suggestion' | 'unknown'; text: string; citations?: string[] };
/** Phase 8: contextual capabilities chosen with a slash command; each retrieves different server-side records. */
export type AikaCapabilityId = 'onboarding' | 'my-work' | 'repository' | 'team' | 'docs';
export type AikaCapability = { id: AikaCapabilityId; label: string; description: string; available: boolean; reason: string | null };
export type AikaJob = { id: string; status: 'running' | 'succeeded' | 'failed'; question: string; milestoneId: string | null; capabilities?: AikaCapabilityId[]; startedAt: string; elapsedMs: number;
  answer: { sections: AikaSection[]; nextStep: string | null; removed: number } | null; error: string | null; model: string | null };

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
/** `edited`: the Champion saved changes to the plan; `comment` then summarises them by count (never content). */
export type ReviewEvent = { action: 'submitted' | 'resubmitted' | 'withdrawn' | 'changes_requested' | 'approved' | 'published' | 'edited'; at: string; by: string; comment?: string };
export type HandoffRecord = {
  approvals?: Approvals; assignments?: Assignment[];
  draft: number; status: HandoffStatus; createdAt: string; publishedVersion: number | null; publishedAt: string | null;
  sources: SourceInput[]; understanding: Understanding; proposal: MilestoneProposal; developer: DeveloperHandoff | null;
  /** Chris's edited review of this analysis (operator-only), its revision and the saved information it was built from. */
  review?: ReviewDraft; reviewRevision?: number; reviewUpdatedAt?: string; basedOnWorkspaceRevision?: number;
  submittedAt?: string | null; history?: ReviewEvent[];
};

/** One section of an uploaded PDF and the category it was given: from its heading, from its content, or a
 * default when neither said (shown as uncertain). */
export type DocumentSection = { label: string; type: SourceType; basis: 'heading' | 'content' | 'default'; pages: string; chars: number };
/** What was read from Chris's PDF. Operator-only; the PDF itself is not stored. `complete` is false whenever any page
 * was empty (image-only), unreadable, beyond the page limit, or text was cut at the size limit. `missing` lists topics
 * the document doesn't seem to mention (a heuristic check, not a fact). */
export type DocumentReport = {
  fileName: string; uploadedAt: string; pages: number; pagesRead: number; emptyPages: number[]; unreadablePages: number[];
  notRead: { from: number; to: number } | null; truncated: boolean; removedLines: number; characters: number;
  customer: { name: string | null; basis: 'stated' | 'title' | 'not_found' };
  sections: DocumentSection[]; missing: ('customer' | 'people' | 'systems' | 'goals')[]; complete: boolean;
};

/** Chris's saved, not-yet-analyzed customer information for one customer. Operator-only. `document` describes the
 * PDF the information was extracted from, when it came from one. */
export type Workspace = { revision: number; updatedAt: string | null; sources: SourceInput[]; document?: DocumentReport };

/** Real stages of one analysis run, reported by the server as they start. */
export type AnalysisStage = 'preparing' | 'interpreting' | 'planning' | 'preparing_review';
export type AnalysisJob = {
  id: string; status: 'running' | 'succeeded' | 'failed'; stage: AnalysisStage; stageDetail: string | null;
  startedAt: string; finishedAt: string | null; elapsedMs: number; workspaceRevision: number;
  /** The analysis record created on success, and how it was produced (model or rule-based fallback). */
  draft: number | null; interpreter: Understanding['interpreter'] | null; modelOk: boolean | null; modelError: string | null;
  /** Why the model failed, as a code (for example invalid_api_key, model_not_found); never provider text. */
  modelErrorDetail?: string | null;
  error: string | null;
};

/** Where a reviewed item came from. 'customer' = stated in the customer's sources; 'ai' = suggested by analysis;
 * 'chris' = added by Chris. `edited` marks an item Chris changed. */
export type ReviewOrigin = 'customer' | 'ai' | 'chris' | 'champion';
export type ReviewItem = { id: string; text: string; origin: ReviewOrigin; edited?: boolean; status?: 'verified' | 'reported' | 'unconfirmed'; sources?: string[] };
export type ReviewStakeholder = { id: string; name: string; role: string; responsibilities: string; basis: 'stated' | 'role_default' | 'inferred' | 'chris'; sources: string[]; technical: boolean };
export type ReviewMilestone = { id: string; title: string; description: string; system: string; actions: string[]; completionCriteria: string[];
  assignee: string | null; role: string; dependsOn: string[]; origin: ReviewOrigin; edited?: boolean };
export type ReviewProblemBody = { summary: string; challenges: ReviewItem[]; systems: ReviewItem[]; contradictions: ReviewItem[]; unknowns: ReviewItem[] };
/** A further engineering problem in the same draft; `problem` is the first. Same fields, plus an id. */
export type ReviewProblem = ReviewProblemBody & { id: string };
export type ReviewDraft = {
  problem: ReviewProblemBody;
  /** More engineering problems found in the same customer context (absent or empty when there is only one). */
  moreProblems?: ReviewProblem[];
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
  problem: ReviewDraft['problem']; moreProblems?: ReviewProblem[]; facts: ReviewItem[]; goals: ReviewItem[]; milestones: ReviewMilestone[]; questions: ReviewItem[];
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

// ---- Phase 7: repository intelligence. Read-only observations of an operator-configured repository.
/** What was inspected. `ci_runs` is never inspected: run results and required checks are out of scope. */
export type RepositorySignal = 'identity' | 'default_branch' | 'readme' | 'docs' | 'codeowners' | 'ci_config' | 'deployment' | 'catalog_info' | 'runbooks' | 'ci_runs';
/** observed: the backend retrieved it. missing: the complete file listing has no such file. inaccessible: listed but
 * could not be read. not_inspected: not checked, or absence can't be established (failed or truncated listing). */
export type ObservationStatus = 'observed' | 'missing' | 'inaccessible' | 'not_inspected';
/** live: retrieved from GitHub by the backend. fixture: clearly labelled sample data for a fictional repository. */
export type EvidenceMode = 'live' | 'fixture';
export type RepositoryObservation = { id: string; signal: RepositorySignal; status: ObservationStatus; mode: EvidenceMode;
  summary: string; details: string[]; limitation: string | null;
  /** Where it came from: the API request or fixture file, the file path and a link (live only). */
  source: { kind: 'github_api' | 'fixture'; request: string; path: string | null; url: string | null };
  repository: string; commit: string | null; retrievedAt: string };
export type RepositoryInspection = { id: string; repositoryId: string; repository: string; mode: EvidenceMode;
  status: 'succeeded' | 'partial' | 'failed'; errorCode: string | null; retryAfter: string | null;
  defaultBranch: string | null; commit: string | null; startedAt: string; completedAt: string; requestedBy: string;
  observations: RepositoryObservation[] };
/** A configured repository as one viewer may see it, with the milestones it is relevant to. */
export type RepositoryEvidenceView = { id: string; label: string; repository: string; mode: EvidenceMode; canInspect: boolean;
  milestones: { id: string; title: string; assignee: string | null; focus: RepositorySignal[]; actionLinks: { index: number; signals: RepositorySignal[] }[] }[];
  /** The most recent attempt, and the most recent one that produced observations (the same when it succeeded). */
  latest: RepositoryInspection | null; evidence: RepositoryInspection | null;
  /** Evidence older than the configured maximum age is shown as stale, never as current. */
  stale: boolean; maxAgeHours: number };
export type RepositoryEvidence = { repositories: RepositoryEvidenceView[] };

// ---- Phase 8: Insights, computed on the server from stored records (nothing estimated).
export type PersonActivity = { name: string; role: 'developer' | 'champion'; actionChanges: number; updates: number; blockers: number; questions: number; replies: number; coordination: number; reviews: number; lastActiveAt: string | null };
export type Insights = { generatedAt: string; viewer: { role: 'developer' | 'champion' | 'operator'; name: string | null };
  plan: { approved: boolean; approvedBy: string | null; approvedAt: string | null;
    /** Where the plan is in Chris's and Maya's workflow; only for Chris and the Champion. */
    stage: string | null };
  summary: ProgressSummary | null;
  milestones: { id: string; title: string; assignee: string | null; status: string; reviewState: string | null; actionsCompleted: number; actionsTotal: number; openBlockers: number; openQuestions: number; lastActivityAt: string | null }[];
  /** Everyone's for the Champion and Chris; a developer's own only. */
  activity: PersonActivity[];
  /** Developer evidence references are reported, never verified. */
  reportedReferences: number;
  evidence: { id: string; label: string; repository: string; mode: EvidenceMode; inspected: boolean; lastInspectedAt: string | null; stale: boolean; lastAttemptFailed: boolean;
    observed: number; notFound: number; notReadable: number; notInspected: number }[] };

// ---- Role redesign: engineering opportunities, Champion priorities and developer choice, adoption.
/** What a suggestion is: connect an existing tool, move off something, build something new, or improve what exists. */
export type OpportunityKind = 'integration' | 'migration' | 'new_build' | 'improvement';
/** verified: a live read-only observation backs it. sample: fixture data for the fictional demo backs it. hypothesis:
 * it comes from the plan or customer context and nothing has confirmed it. */
export type OpportunityBasis = 'verified' | 'sample' | 'hypothesis';
export type Priority = 'high' | 'normal' | 'later';
export type Opportunity = {
  id: string; kind: OpportunityKind; title: string; why: string; basis: OpportunityBasis;
  /** What backs it: observation summaries for verified/sample, or "From the onboarding plan" for a hypothesis. */
  evidence: string[];
  /** Practical, Portal-specific steps to get started (Guide shows them). */
  steps: string[];
  service: string | null; goal: string | null;
  priority: Priority | null; highlighted: boolean;
  /** Champion and Chris: who chose to pursue it. Developers: only how many, and whether they did. */
  pursuedBy?: string[]; pursuers: number; mine?: boolean;
};
export type GoalView = { id: string; text: string; priority: Priority | null; milestones: { id: string; title: string; status: WorkStatus }[]; completed: number; total: number };
export type Opportunities = { viewer: { role: 'developer' | 'champion' | 'operator'; name: string | null }; goals: GoalView[]; opportunities: Opportunity[];
  /** When the repository observations were last refreshed by the Portal (Spotify's integration, not a person). */
  observedAt: string | null };
/** Champion and Chris: adoption toward the company goals, from activity recorded in the Portal. */
export type Adoption = {
  generatedAt: string;
  goals: { total: number; withProgress: number };
  milestones: { total: number; completed: number; inProgress: number; open: number };
  opportunities: { total: number; pursued: number; highlighted: number };
  /** Developers who recorded any work, chose a milestone or pursued an opportunity, most recent first. */
  developers: { name: string; lastActiveAt: string | null; workingOn: number; pursuing: number; activeThisWeek: boolean }[];
  /** Activity per week (oldest first), counting recorded work, choices and notes. */
  weekly: { weekStart: string; events: number; activeDevelopers: number }[];
  /** Where engagement could improve, as plain observations from the same records. */
  suggestions: string[];
  /** The Portal records activity for this onboarding only; there is no wider usage data in this demo. */
  scope: 'onboarding_activity';
};
