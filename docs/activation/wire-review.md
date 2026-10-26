> Latest follow-up: [access-recovery-session.md](access-recovery-session.md) confirms the repository is private, authenticated reads succeeded, four real observations were admitted in a test-owned session, browser blocker/replan/restart passed, and validation reached 146 tests. Earlier sections below are historical.

# Activation wire review and critical-path milestone — freeze HOLD

## Recovery point and scope

The previously tested persistence implementation is committed locally as `4fd85d5` on `feat/activation-session-persistence`. This document describes subsequent additive changes, still an integration candidate. No push, merge, deployment, live AiKA or Portal execution occurred. No teammate was messaged. This is a repository-based compatibility review of Navyaa's frontend, **not her approval**.

Reviewed local branch tips and dirty status for all seven original checkouts: collaboration foundation `8f3aa38`, blueprint `3f3620a`, cleanup `1d027dd`, GitHub Checkpoint-2 `af1aa64` (dirty Phase B/provider/store changes), Phase 0 `a32e3c1` (untracked contracts), preservation `fa6e987`, and V2 `9cd4082` (dirty app/backend/plugin work). Also inspected local frontend-conversation `240dc10`, Goal `65bd2b2`, Codespaces proxy `76a5a34`, and GitHub UI/backend branch listings. No network fetch was performed; remote-tracking references are cached local knowledge. Old backend and V2 work remain separate, not silently reconciled into this branch.

## Exact HTTP contract

Prefix: `/api/activation/v1/customers/:customerId`. Customer IDs match `[A-Za-z0-9_-]{1,200}`. Every request requires the configured bearer token in development mode. Authority comes from the server bundle principal, never the body. JSON request bodies are limited to 16 KiB. Responses are canonical state directly, **not** `{state: ...}` and not the conversation `StateResponse`.

| Route | Request | Success |
| --- | --- | --- |
| POST `/state` | Exactly `{context: CustomerContext, plan: ActivationPlan}` | 201 state; create only |
| GET `/state` | No body | 200 state |
| POST `/progress` | Strict `ProgressUpdate` | 200 state |
| POST `/blockers` | Strict `BlockerUpdate` | 200 state, initially pending replan |

All activation responses have `Cache-Control: no-store`. Success has `ETag: "activation-N"` where N is aggregate revision. Writes use JSON `expectedRevision`, not If-Match. Errors are `{error:{code}}` with 400 validation/evidence, 403 authorization, 404 unknown session, 409 revision/idempotency/transition/replan conflicts, 413 body size, 415 media type, 503 adapter unavailable; unexpected exceptions return only INTERNAL_ERROR/500. Other methods return 405 plus Allow. OPTIONS allows Content-Type and Authorization when activation is configured.

Canonical browser-safe types are in `contracts/activation/v1/state.ts`; domain request types stay in `types.ts` and strict request validation stays unchanged. No Node/store import is needed by the browser.

State fields are exactly: `contractVersion`, `customerId`, `developerSessionId`, aggregate `revision`, `contextRevision`, `planRevision`, full `context`, full `plan`, `milestone`, `actions`, `evidence`, `replan`, `chrisHelp`, `outcome`. `actions` is an ID-keyed object, with revision/status/kind/**at**/optional receiptId/planRevision/blockedByIds/evidenceIds. Milestone has id/status/requiredActions/evidenceIds. Replan has status/blockerId/replacementPlanRevision/errorCode. Chris help has status/blockerIds/owner/reason/evidenceIds. Outcome has agreedGoalContextRevision/status/summary/evidenceIds/scope. No verified customer outcome status exists.

Progress fields: `contractVersion, customerId, revision, evidence, id, developerSessionId, planRevision, expectedRevision, milestoneId, milestoneStatus, valueDemonstrated, needsChris, transitions`. Transition fields: `actionId, actionRevision, fromStatus, toStatus, at, evidenceIds`. `revision` must equal `expectedRevision+1`; planRevision is independent. `valueDemonstrated` is compatibility narrative only.

Blocker fields: `contractVersion, customerId, revision, evidence, id, developerSessionId, planRevision, expectedRevision, newInformation, evidenceIds, constraints, replan, escalation`. Replan fields: `required, reason, preserveMilestoneIds, invalidateActionIds`. Escalation fields: `required, owner, reason`. All current actions are invalidated conservatively even when the caller omits action IDs. Pending or failed replans reject a second blocker with REPLAN_PENDING.

Frontend findings and fixes: the conversation client posts to `/api/conversations`, expects `{state}`, and uses its own versioned envelope. It cannot consume activation state. Added `prototypes/v1/src/activation/client.ts` with separate read/initialize/progress/blocker methods and Authorization. It performs basic response shape checks, not full runtime response-schema validation. Added only the `/api/activation` proxy to port 7007; existing inspector/conversation proxies remain on 8787. The older Codespaces proxy branch is not merged or changed. Existing UI code is unchanged and **does not invoke the new client yet**. A timeout must preserve the exact command ID and body; reload canonical state before retry. On 409 preserve the developer draft and reload; do not silently rebase a command. Poll GET to see worker updates; no SSE or push transport exists.

## Evidence admission and interpretation

`registryPolicy` clones operator-owned bundles and compares exact full records, context and plans. Bundles bind tenant/customer/session and expiry. New evidence must be no more than 24 hours old and not future-dated. The request/model cannot append trust entries. Retained historical evidence is not retrospectively removed when a bundle expires; new admissions fail closed. Store and contract validators continue enforcing immutable IDs, dependency references, cycles and action revision binding.

| Kind / proof | Interpretation |
| --- | --- |
| portal_simulated / none | Simulated Portal fixture; planning context only |
| github_observation / none | Read-only observation, commit pinned; not workflow execution |
| developer_report / none | Attributed developer report; no technical proof |
| customer_report / none | Attributed customer report/agreement; no verified adoption |
| ai_inference / none | Inference with linked basis; no execution proof |
| action_record | Separately admitted preparation, approval or execution receipt |
| verified_outcome / verification | Legacy wire name, restricted by registry to `technical:` scope and distinct producer/verifier, passing proof, execution receipt basis; never verified customer success |

Technical verification rejects simulated, inferred or human-report bases. `evidenceLabel` provides explicit labels for integrations. The registry is a minimal operator-attestation boundary, **not a GitHub collector, cryptographic attestation or independently running check service**. A URL alone does not establish an actual GitHub observation; the operator must populate the registry from real inspected bytes. Existing read-only inspector tests use network doubles; no live repository inspection was performed here. The wire name `verified_outcome` still needs review/renaming before full freeze. Chris outcome remains unassessed/reported only; no customer adoption, deployment, ROI or Portal execution is inferred.

## Automatic replan recovery

The store enumerates pending/failed sessions server-side. The worker scans at startup and every five seconds, reads the durable blocker command, calls a read-only planner and publishes via existing transactional CAS. Command IDs bind blocker ID and aggregate revision. Repeated/concurrent workers cannot publish duplicate revisions. Planner exceptions or rejected records persist a safe failed intent, retaining the blocked plan; a later scan retries with current CAS. A fresh worker resumes committed failed/pending intents. Valid replacements start suggested, with increased plan/action revisions and no inherited approval. Chris help is not implicitly resolved.

Development mode selects an exact pre-reviewed replacement from the bundle by context revision, next plan revision, supersedesRevision and blocker ID. This automatically processes durable intents but **does not synthesize new plans from arbitrary developer text**. Missing candidates fail closed and retry. Fixed retry interval has no exponential backoff or durable attempt counter. Custom planners must be bounded, read-only and safe to call again after a crash; worker CAS cannot make external side effects idempotent. No external action execution is installed.

## Explicit development configuration

Normal server operation is unchanged unless `ACTIVATION_DEV=1`. Set these environment variables before running `node src/server.ts` from `services/workflow-api` using Node 24.12.0:

- `ACTIVATION_DEV=1`
- `ACTIVATION_DEV_TOKEN`: local secret of at least 32 characters, passed as Bearer Authorization by the client; never put in a Vite public environment variable or commit it.
- `ACTIVATION_ADMISSION_PATH`: absolute path to an operator-owned JSON file containing **exactly one** AdmissionBundle.
- `ACTIVATION_DATABASE_PATH`: dedicated SQLite filename; defaults to `data/activation-dev.sqlite`, rejected if identical to the Goal path.
- Existing `DATABASE_PATH`, `PORT` (default 7007) and exact local `FRONTEND_ORIGIN` (default http://127.0.0.1:5173) retain their meanings.

Bundle format: `[{principal:{tenantId,customerId,sessionId},context:CustomerContext,plans:ActivationPlan[],evidence:EvidenceRecord[],expiresAt:UTC_TIMESTAMP}]`. The initial and any replacement plan must be in plans; every newly admitted record must be in evidence with exact bytes. No fabricated credentials or fixture-to-live conversion tool is provided. Bundles are loaded once; update the file and restart to change operator approvals. This is explicit single-user loopback development authorization, not production authentication. SIGTERM/SIGINT waits for the worker before closing activation storage.

## Six-step demo status and remaining blockers

| Step | Actual state |
| --- | --- |
| Chris briefing and agreed goal | Canonical admitted initialization and agreement persistence tested; intake UI absent |
| Personalized plan | Existing distinct-context contract fixtures tested; exact reviewed plan admission, no automatic initial planner |
| Developer view | Browser client and shared response type added; screen integration and browser refresh acceptance pending |
| Developer blocker / revised action | Durable blocker plus automatic restart/retry worker tested; exact reviewed replacements only |
| Inspectable GitHub-backed result | Existing isolated read-only inspector retained; not connected to activation ledger or executed live |
| Evidence-linked Chris summary | Existing goal-scoped reported summary persistence tested; screen/projection integration pending, no verified business outcome |

The full freeze remains **HOLD**. The requested safe-session fallback was used: recovery commit, wire review, admission boundary and automatic replan critical path. Remaining integration work: Navyaa's actual review; full response runtime validation; activation screen and intake; initial/replacement planning adapter; real read-only GitHub collection and independent technical check receipts; evidence-linked Chris UI; full six-step browser/restart demo. Production authentication and verified customer outcome policy remain outside this vertical-slice implementation.

## Validation

Node **24.12.0**: **135 distinct tests passed**: 25 backend (16 activation + 9 Goal), 37 activation contracts, 16 diagnosis/conversation, 57 frontend (55 existing + 2 activation client). Strict backend and activation-contract TypeScript checks passed; frontend TypeScript and production build passed. Tests used an isolated temporary source copy with existing dependencies; no dependency or lockfile changes. An initial temporary-copy error omitted frontend `src/data`; copying the unchanged source directory corrected the validation harness and all suites/build then passed. Local listener tests required loopback permission; final runs passed. No browser UI acceptance or live external operation is claimed.

Preservation inventory: parent `outputs/activation-next-preservation.json` checks source hashes, status and commit tips against the earlier seven-checkout inventory. All seven unchanged. The isolated worktree alone contains the implementation. Shared Git metadata now includes the authorized recovery commit; original branch tips remain unchanged.
