# Developer work and AiKA (Phase 5)

> **Updated by the role redesign and the non-blocking flow.** Where this page talks about Champion approval, submitting for Champion review, assigned work, the Repository, Evidence or Team tabs, inspecting repositories by hand, "Ask Chris" or developer Insights, [roles-and-opportunities.md](roles-and-opportunities.md) is current: Chris's **Finalize and publish** publishes the plan to the Champion and developers with no approval step ("approved" on this page now means "published"), developers choose their work, the Portal observes repositories itself, and progress is what people record in Portal (nothing is detected automatically).

After Maya approves the plan in [Dream Day](dream-day.md), Alex and Jordan each work through their own approved milestones inside the developer Portal. AiKA helps them, using approved, developer-safe context only.

## What each person sees

| Who | Where | What |
|---|---|---|
| Alex, Jordan | Onboarding → **My work** (`/activation/work`); Home → **Open my work** | Maya's approval (who, when). Their own approved milestones in full: system, why, actions with status, completion criteria, dependencies with status, and their notes. Then the team's engineering objective: problem, technical goals and outstanding technical questions, each screened by the developer privacy check. Then the other milestones by **title, assignee and status only**. |
| Maya | Team Coordination → Team overview | Every approved milestone in full, with the discussion; she responds, adds notes, requests follow-up and reviews. See [team-coordination.md](team-coordination.md). |
| Chris | Customer Onboarding → Developer Progress → **Approved milestone progress** | The same view as Maya's, read-only. |

The **My work** tab appears only once a plan is approved. Before that, the server answers `NO_APPROVED_PLAN` and nothing is shown. Unapproved drafts, Chris's notes and commercial information never reach this view: it is built from the published, approved developer handoff only.

## Working on a milestone

On their own milestone card, a developer can:

- set each action to **Not started**, **Started**, **Blocked** or **Completed**;
- record a short **update**, **blocker** or **question** (3–1000 characters), optionally with an **evidence reference**. The reference is one link or identifier without spaces, up to 300 characters, and is labelled "reported, not verified";
- **mark a blocker resolved**;
- **mark the milestone ready for review** or **completed**, or **reopen** it.

The milestone's status is derived on the server:

- an explicit *ready for review* or *completed* wins;
- otherwise it is *blocked* if a blocker is open or an action is blocked;
- otherwise *in progress* once anything has started or been noted;
- otherwise *not started*.

Changing an action or recording a new blocker clears an explicit status, which reopens the milestone.

Server-side validation (`MILESTONE_NOT_READY`, with `issues`):
- *ready for review* and *completed* need every action completed (`actions_incomplete`) and no open blocker (`open_blockers`);
- *completed* also needs every milestone it depends on to be completed by its owner (`dependencies_incomplete`). Jordan can start before Alex finishes, but can't complete ahead of him. **Nothing is ever completed automatically**, including dependent work when its dependency completes.

## Identity, attribution and no overwriting

- **One credential per developer.** The demo launcher creates `developer-token-<id>` for each developer in `ACTIVATION_DEMO_DEVELOPERS` (default `alex=Alex Rivera,jordan=Jordan Lee`). It writes `developers.json` and points `ACTIVATION_DEVELOPERS_PATH` at it.
  - The Portal session layer uses `developer-token-<persona id>` from the customer's token directory for that developer persona. Without one, it falls back to the customer's shared developer token.
- **Identity comes from the credential only.** The API maps the token to a developer name; the `X-Portal-Actor` header is never used for developer identity.
  - The shared developer token has no identity: it can read but every update is refused with `DEVELOPER_IDENTITY_REQUIRED`.
  - Champion and operator credentials can read progress but cannot change developer work.
- **Only the assignee changes a milestone** (`NOT_ASSIGNEE` otherwise). Each action and note records who made it and when, and so does each blocker resolution and the milestone's last update.
- **Revision-checked.** Every update names the milestone revision the developer was looking at. A stale page gets `REVISION_CONFLICT`, and the page reloads the latest work instead of overwriting it.
- **Another developer's workspace stays theirs.** A developer sees only the title, assignee and status of a milestone that isn't theirs; the API sends no notes or action detail for it (`detail: null`).
- **Customers are isolated.** Every request is bound to one customer by its credential.

Progress is stored in SQLite (`activation_milestone_work`, keyed by tenant, customer, session and milestone). It survives a refresh and an API restart.

## AiKA

AiKA is in the Portal navigation (`/aika`), and each milestone card has **Ask AiKA about this milestone**.

- **Server-side only.** The browser asks the Portal API (`POST /aika-questions`) and polls (`GET /aika-questions`). The workflow API calls the local Ollama provider; the browser never talks to the model. The page shows elapsed time while it runs, and the person can keep using the Portal.
- **Context.** The context is built from the approved developer handoff and the viewer's own progress:
  - the approval;
  - the screened objective;
  - facts with their status (verified, reported, unconfirmed);
  - unknowns;
  - the viewer's own milestones in full (actions, criteria, dependencies, their notes);
  - other milestones by title and status;
  - "REPOSITORY OBSERVATIONS" — only observations the backend recorded, each with an id AiKA must cite (Phase 7, [repository-evidence.md](repository-evidence.md)), otherwise "none. No repository has been inspected."
  
  Every line passes the developer privacy screen again before it reaches the model. Chris's sources and notes, commercial information and unapproved drafts are never included.
- **Labelled answers.** Each part is **Known**, **Reported**, **Suggestion** or **Unknown**, plus an optional next step. The server checks the answer:
  - a "known" part not grounded in the context becomes a suggestion;
  - any part that claims AiKA inspected, checked, ran or verified something is removed when the backend has no repository evidence;
  - private text is removed.
  
  The page says how many parts were removed.
- **Failures are codes, shown in plain language:** `AIKA_UNAVAILABLE` (no model configured), `MODEL_UNAVAILABLE`, `MODEL_TIMEOUT`, `INVALID_MODEL_OUTPUT` (including no usable parts), `CONTEXT_LIMIT`, `NO_APPROVED_PLAN`. Chris (operator credential) can't use AiKA (`FORBIDDEN`). One question runs at a time per person; a second start returns the running one.
- **Configuration.** `PORTAL_LLM_PROVIDER=ollama` turns on the local model for analysis and AiKA. `AIKA_LLM_PROVIDER=ollama` turns it on for AiKA alone. Both use the same `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` and `OLLAMA_RETRIES` settings.

## Data model (additive)

Contract `contracts/activation/v1/handoff.ts`:
- `DeveloperHandoff.objective` (`problem`, `goals`, `questions`, screened at approval);
- `ActionStatus`, `WorkStatus`, `WorkUpdate`, `MilestoneWorkRecord`, `MilestoneDependency`, `MilestoneProgress`, `TeamProgress`;
- `AikaSection`, `AikaJob`.

Routes (per customer):
- `GET milestone-work`;
- `POST milestone-updates` (one change per request: `action`, `note`, `resolve` or `status`, with `expectedRevision`);
- `GET`/`POST aika-questions`.

Code:
- `services/workflow-api/src/activation/handoff/work.ts`;
- `handoff/aika.ts`;
- `routes.ts`;
- `dev.ts`;
- `prototypes/v1/src/portal-app/work/`;
- `portal-app/aika/`;
- `server/portal-session.mjs`.

## Limitations and placeholders

- **The earlier shared session.** The Guide (questions and blockers), the repository tab and the team plan still belong to the customer's single developer session. Those reports are team-level, not per person. Per-person, attributed work lives in **My work**.
- **Evidence references are not checked.** They are recorded as reported. The Portal never claims to have inspected them.
- **Reviews.** Maya reviews milestones marked ready for review in Team Coordination (Phase 6); see [team-coordination.md](team-coordination.md).
- **AiKA's jobs are kept in memory.** After an API restart the last answer is gone; progress is not.
- **Testing.** AiKA was tested with a local stand-in for Ollama, in unit tests and the browser e2e: a small HTTP stub that echoes the prompt into a fixed answer. A real Ollama model was not run for these tests.
- Catalog, Docs, Insights and the other Portal entries keep their existing "isn't available in this demo" pages. No Catalog entries, docs or analytics are invented.
