# Chris's customer activation workspace (Phase 3)

Chris (operator persona) turns scattered customer information into a reviewed technical onboarding draft and marks it ready for Champion review. Everything here is operator-only. Nothing in this workspace reaches the Champion or developers.

## Flow

| Step | Where | What happens |
|---|---|---|
| 1. Choose a customer | Header | Only customers listed for Chris's persona. Switching waits while there are unsaved edits. |
| 2. Add information | **Customer Context** | Entries in seven categories: Conversational Transcript, CRM Record, My Notes, Account Preparation, Technical Requirements, Repository Observation, Integration Tools. Chris can add, edit and remove entries. **Save information** stores them on the server (revisioned); a reload brings them back. |
| 3. Analyze customer | Customer Context | Starts a background analysis of the *saved* information. Unsaved edits are saved first. The page polls the run's status and stays usable. |
| 4. Review and edit | **Onboarding Draft** | A structured, editable draft: engineering problem (summary, challenges, systems, contradictions, developer-checkable unknowns), known facts, stakeholders, technical goals, milestones and questions for the customer. **Save draft** stores it (revisioned). |
| 5. Submit | Onboarding Draft | **Mark ready for Champion review** (after confirming). The server checks completeness and privacy. The draft is then locked; **Withdraw to make changes** unlocks it. |

Status labels:
- **Not started**, **Draft** (information saved), **Analyzing**, **Analysis ready**, **Submitted for Champion review**, **Published to developers**.
- **Needs revision** isn't shown because no Champion review step exists to request a revision.

## Analysis progress

`POST …/handoff-analyses {workspaceRevision}` returns at once (202) with a job; `GET …/handoff-analyses` returns its status. The job reports the stage that is actually running:
- *Preparing information*;
- *Interpreting customer context* (with "part n of m" for long input);
- *Generating technical onboarding plan*;
- *Preparing review*.

The interpreting and planning stages are reported by the Phase 1 pipeline as it starts each step (`analyzeWithModel(…, onStage)`). Earlier stages are shown as finished only because the run has moved past them.

There is no percentage and no time estimate. The page shows elapsed time (server-measured, ticking locally between polls) and says local analysis may take 1–2 minutes.

- **Duplicates.** A second start while a run is in progress (repeated clicks, a second tab) returns the same run (200, `duplicate: true`). The button is also disabled.
- **Failures.** A failed run reports a code only (`ANALYSIS_FAILED`, …), and the saved information is kept.
- **Model unavailable.** When the model is unavailable or times out, Phase 1 falls back to rule-based analysis. The run, the Customer Context panel and the draft header all say "rule-based … not the model", and suggestions are labelled *Rule-based suggestion* instead of *AI suggestion*.
- **Restarts.** A run lives in the API process. If the API restarts mid-run, the run is gone and Chris starts again; the saved information is unaffected.

## Origins and evidence in the draft

Each item records where it came from:
- *From customer sources* (or *Customer requirement* for goals);
- *AI suggestion* or *Rule-based suggestion*;
- *Added by you*.

An edited generated item is marked *· edited*.

Facts show *Verified* (observed in a repository), *Reported* or *Unconfirmed*. Questions for the customer are listed separately as unanswered, never as facts.

Stakeholders show how they were found: named in sources, inferred, role default, or added by Chris. Non-technical people (commercial or executive roles) are marked *Internal · not shared*. **Kept internal** lists what the analysis kept private (commercial terms, people notes, Chris's notes); only Chris sees it.

Milestones can be added, removed, reordered (up/down), and edited:
- title, description, system;
- actions and completion criteria, one per line;
- proposed assignee, chosen from the technical stakeholders;
- role;
- dependencies on other milestones.

## Submission boundary and privacy

- **Submitting publishes nothing.** It changes the analysis record's status to `submitted` and records Chris's approval (`approvals.chris`), with the Champion approval pending. Developer and Champion credentials still get `404` for onboarding state and `403` on every workspace route. Maya's review screen is not built (Phase 4).
- **The server refuses submission** when the draft is incomplete (`REVIEW_INCOMPLETE`) or contains something the Champion may not receive (`CONFIDENTIAL_CONTENT`). Every Champion-bound text runs through the Phase 1 developer-safety screen (`unsafeReason`), which covers:
  - commercial terms and company figures;
  - executive or private comments and deal stage or evaluation timeline;
  - restatements of private notes and names of non-technical people.

  The error lists field labels and reason codes (for example "Milestone 1 · description: contains an executive or private comment"), never the text.
- **The earlier direct publication** (`handoff-publications`) is still available for demos under **Integration tools → Publish without Champion review**. It is labelled as skipping the Champion review and not being an approval. It is refused while a draft awaits Champion review (`AWAITING_CHAMPION_REVIEW`). With `fromReview: true` it publishes the saved draft's first three milestones, converted on the server, and the existing publication privacy checks and developer projection apply unchanged.
- **Nothing in URLs, logs or browser storage.** Customer information never goes into URLs, logs or browser storage. Unsaved edits live only in the page's memory; leaving with unsaved edits asks first.

## Data model and API (additive)

Contract `contracts/activation/v1/handoff.ts`:
- `Workspace`, `AnalysisJob`/`AnalysisStage`, `ReviewDraft` (with `ReviewItem`, `ReviewStakeholder`, `ReviewMilestone`, `ReviewOrigin`), `HandoffOverview`;
- `HandoffStatus` adds `submitted`;
- `HandoffRecord` gains `review`, `reviewRevision`, `reviewUpdatedAt`, `basedOnWorkspaceRevision` and `submittedAt`.

Storage: a new `activation_handoff_workspaces` table, one row per customer session. Reviews are stored inside the existing operator-only `activation_handoffs` records.

Operator-only routes, all refused for developer tokens:

| Route | Purpose |
|---|---|
| `GET handoff` | Drafts, saved information and the current run |
| `POST handoff-workspace` | Save information (`expectedRevision`) |
| `POST`/`GET handoff-analyses` | Start a run / read its status |
| `POST handoff-reviews` | Save the draft (`expectedRevision`) |
| `POST handoff-submissions` | `submit` (with `reviewRevision` and `confirmed: true`) or `withdraw` |

Errors: `REVISION_CONFLICT`, `NOT_LATEST_DRAFT`, `ALREADY_PUBLISHED`, `AWAITING_CHAMPION_REVIEW`, `REVIEW_INCOMPLETE`, `CONFIDENTIAL_CONTENT`. The last two include `details.issues`.

Server code:
- `services/workflow-api/src/activation/handoff/review.ts`: building the draft, validation, the submission screen and conversion for publication;
- `service.ts`: transitions and analysis runs;
- `routes.ts`.

Frontend code: `prototypes/v1/src/operator/useCustomerWorkspace.ts`, `InformationTab.tsx`, `ReviewTab.tsx`.
