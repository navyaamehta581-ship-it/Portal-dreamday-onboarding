# Activation session vertical slice — review candidate, freeze HOLD

This implementation is local and additive on `feat/activation-session-persistence`, based on preservation `fa6e987`. No teammate checkout, Goal database, conversation store, frontend source, dependency or lockfile was changed. The Phase 0 proposal and five hardening candidate files were copied into this isolated worktree after reviewing receipt equality, provenance cycles, capability semantics and blocker CAS rules. They remain review candidates; their historical comments describing them as frozen are not approval.

## Implemented boundary

`openActivationStore(filename, policy)` opens a **separate activation-only SQLite file**. Do not pass the existing Goal/conversation database filename. A session is scoped by server-derived tenant, customer and developer-session identity. The canonical JSON snapshot includes the exact context and plan, current action state, required action revisions, aggregate revision, evidence ledger, milestone, replan intent, Chris escalation and outcome projection. Embedded pinned context/plan avoid mixed-revision joins. Revision zero requires an approved customer agreement and an initial plan; briefing-only intake is not accepted.

Every mutation uses BEGIN IMMEDIATE, checks aggregate CAS, appends its immutable command and complete revision snapshot, and commits the current state atomically. Two connections cannot overwrite a stale revision. Command IDs are idempotency keys: equal parsed bodies return the current canonical state without increment; changed bodies return IDEMPOTENCY_CONFLICT. Initialization is create-only and repeats return REVISION_CONFLICT. Immutable history includes old plans, blockers and receipts. `getRevision` and `getEvent` are server-only retrieval methods. Data is saved before HTTP success, and restart recovers committed state. No client snapshot PUT exists.

Configure `createApp(goalStore, allowedOrigin, {store: activationStore, authorize})` to mount:

| Method | Path suffix under `/api/activation/v1/customers/:customerId` | Body/result |
| --- | --- | --- |
| POST | `/state` | Exact `{context, plan}` wrapper, 201 canonical state |
| GET | `/state` | 200 canonical state, no-store, aggregate ETag |
| POST | `/progress` | Existing strict ProgressUpdate, 200 canonical state |
| POST | `/blockers` | Existing strict BlockerUpdate, 200 canonical state |

`authorize(request, customerId)` must authenticate the caller and return its authorized tenant/customer/session or null; never derive authority from request JSON. Cross-origin preflight allows Authorization only when activation is configured. The original server entrypoint intentionally does not configure activation: default Goal/conversation behavior is unchanged, and unauthenticated activation deployment is prevented. HTTP integration tests mount the actual application with a test-only authentication adapter.

`Policy.admitContext` and `Policy.admitPlan` approve the exact full records, including agreement, context revision, required criteria, capabilities and action revision. `Policy.admit` must resolve exact server-owned evidence bytes and actor/action/tenant/session/scope/revision/freshness. All callbacks are synchronous, must be pure, and fail closed when missing. They run inside the mutation transaction for evidence admission. The context/plan admission callbacks also run before persistence; adapters must not perform external side effects. Browser/model input is never the trust registry. The store rejects recognized fixture/simulation receipt or agreement sources even if a callback accepts them; this detection is defense in depth, not authentication. Receipt independence and substantive criterion satisfaction belong to the real admission adapter, which is not implemented here.

## Progress, blockers and replanning

Progress requires adjacent forward transitions at the exact current action and plan revisions and immutable admitted receipt records. Authorization, execution and independent verification remain distinct proof types. Explicit approval IDs come only from admitted authorization records. Plan admission decides the server-owned milestone criteria/required action. A reached milestone never implies a verified customer outcome. Portal workflow/deployment actions and the unavailable AiKA adapter fail closed.

The conservative blocker policy blocks **all current actions**, regardless of client invalidation omissions, even before progress starts. It preserves prior action statuses as historical facts but makes those approvals unusable for further execution. The blocked milestone cannot be cleared by an empty progress event. Replan-required blockers persist `pending` in the same snapshot/transaction as the blocker event. A second blocker while pending/failed returns REPLAN_PENDING, preserving the caller's draft for retry after resolution. Non-replan blockers remain blocked: no implicit recovery or escalation resolution is supported.

A server worker reads `get(principal).replan`, then `getEvent(principal, blockerId)` for the complete intent. `completeReplan(principal, commandId, expectedRevision, blockerId, planOrNull)` persists failed state with safe PLANNER_UNAVAILABLE or publishes an admitted replacement atomically. Replacement must be current plan + 1, supersede the current plan, include the intent blocker, use the pinned context, and start with suggested action state. Reusing an action ID requires an increased action revision. Old approved actions are never copied into the replacement. Failed intents survive restart; retries use fresh command IDs with current CAS. This is a durable manually driven worker boundary, **not an installed scheduler or live planner**. Pending work is not automatically processed on startup.

Chris escalation retains blocker/evidence links and cannot resolve through `needsChris:false` or replacement plan publication. Explicit authorized resolution is deferred.

## Source-linked outcome projection

A server-only `reportOutcome(principal, commandId, expectedRevision, contextRevision, evidenceRecords)` accepts authenticated customer/developer reports scoped to the exact agreed goal text at the pinned context revision. It persists source IDs and builds summary from the admitted records' claims. It does not accept a caller-authored success summary. Blocker information is linked through Chris help, not presented as a successful outcome. `ProgressUpdate.valueDemonstrated` remains accepted for wire compatibility but is not promoted to outcome proof.

Outcome status is deliberately only unassessed/reported. There is **no verified-customer-outcome write**, no Portal execution, deployment, adoption or ROI claim from generated files. Substantive, independent outcome evidence admission remains an integration blocker.

## Wire differences and remaining freeze blockers

`ActivationState` is exported from the service store, not a frozen browser contract. Compared with the earlier snapshot proposal, this slice requires a plan at initialization, embeds context/plan, keys current actions by ID, and uses `at` for action time. Historic revisions remain queryable internally. It omits proposed ProgressUpdate value fields and does not change existing strict domain schema bytes. Do not ship a frontend cast to the proposed ActivationSnapshot.

The full freeze remains HOLD pending backend and Navyaa agreement on exact wire schema/types/digest, browser client/UI integration, real authentication and evidence/criterion admission adapters, verified outcome policy, explicit help/blocker recovery, automatic worker scheduling and retry policy. Review the conservative all-action invalidation policy. The older Checkpoint-2 backend storage/provider work and proxy/V2 work remain separate and unmodified. No live model, GitHub operation, Portal execution, browser acceptance or deployment is claimed.

## Validation and changed files

Node **24.12.0**: **126 distinct tests passed** — 37 activation contract tests, 9 new activation integration/store tests, 9 existing Goal tests, 16 existing diagnosis/conversation tests and 55 frontend tests. API and contract strict TypeScript checks passed; frontend TypeScript and Vite production build passed. HTTP suites required local listener access; their final runs passed. No dirty Phase B or V2 build was run in this implementation pass.

Coverage includes every action state after reopening the store, separate-process restart, tenant/customer/session isolation, duplicate/stale writes and second-connection CAS, blocker before progress, approved-action execution rejection, persisted failed replan/retry, old revision/event retrieval, receipt substitution rollback, fixture trust rejection, fail-closed admissions, unsupported adapter, empty criteria, cross-origin auth preflight, unchanged Goal endpoint behavior, and scoped reported Chris outcome persistence.

Exact implementation files:

- `services/workflow-api/src/app.ts` — optional activation routing and authenticated preflight.
- `services/workflow-api/src/activation/store.ts` — store, domain service, state type and server policy boundaries.
- `services/workflow-api/src/activation/routes.ts` — four HTTP endpoints.
- `services/workflow-api/test/activation.test.ts` — nine integration tests.
- `contracts/activation/v1/{schema.json,types.ts,typecheck.ts}` — copied original proposal, bytes unchanged.
- `contracts/activation/v1/{validate.mjs,validate.d.mts,contract.test.mjs,fixtures.json,SHA256SUMS}` — reviewed hardening candidate, copied bytes unchanged.
- `docs/activation/session-persistence.md` — this implementation and integration record.

All seven original checkouts retain their source bytes, Git status and commit tips, checked against a fresh pre-implementation inventory (`outputs/activation-before.json` and `outputs/activation-preservation-check.json` in the parent workspace). Only the new worktree contains implementation changes.
