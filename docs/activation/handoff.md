# Activation integration handoff — 27 October 2026

Status: provisional API 1.0.0; contract freeze HOLD pending Navyaa and backend/domain owner approval. This branch is a review candidate, not a production Portal/AiKA integration or real customer approval.

## Included and preserved

The current main baseline contains preservation commit fa6e987 and persistence commit 4fd85d5, plus evidence admission, durable replan recovery, browser-safe shared state/client, explicit local development configuration, isolated /activation UI, read-only GitHub collector/diagnostics and bounded briefing intake. New-service requests inspect template prerequisites without choosing an unsupported runtime/template. Simulated recommendation intake produces a preview and cannot initialize a real agreed-customer ledger.

All pre-existing checkouts, including dirty checkouts, were left unchanged by this follow-up apart from read-only Git fetch metadata. Their unfinished Phase B, native V2 and Codespaces proxy work is outside this integration; do not merge it incidentally.

Included fixtures: the explicitly fictional recommendation intake required by the regression test, frozen contract fixtures, and historical commit-pinned GitHub observations required by exact-admission tests. GitHub observations are not passing checks for this branch or customer-outcome proof.

Excluded and retained locally: browser screenshots, browser/session validation snapshots, preservation inventory, generated recommendation preview and historical failed-inspection/retry captures. These are temporary test/session artifacts, not implementation. Machine-specific temporary paths were removed from historical reports. No credentials, private customer intake, local admission bundle, database, environment values, dependencies or generated build output are included. The inherited archive is a preserved source handoff, not a new build artifact.

## Provisional API and ownership

Keep contracts/activation/v1 request structures, validation, version and digest stable. state.ts publishes the existing canonical response shape without moving authority into the browser. Exact endpoints and errors are in wire-review.md; later intake additions are in intake-session.md. POST /state additionally supports context-only reviewed-plan selection; POST /intake is optional and development-only. No envelope change: activation returns state directly, conversation still returns its existing envelope.

Navyaa owns review of the isolated /activation entry point versus her Portal/conversation workspace, customer briefing and developer next-action experience, refresh/conflict handling and evidence/outcome presentation. Backend review owns admission, principal scope, revisions/idempotency, worker recovery and authority. Joint review must approve response validation and any actual compatibility change before changing shared structures. No approval is inferred from publication.

## Fetch and validate

Use Node 24.12.0 (supported: >=24.12.0 <25). From a clean clone, or a new worktree if your existing checkout is dirty:

```sh
git fetch origin
git switch --track origin/<approved-followup-branch>
cd services/workflow-api
npm ci --ignore-scripts
npm run check
npm test
cd ../../prototypes/v1
npm ci
npm test
npm run test:inspector
npm run test:phase-a
npm run build
cd ../..
node --test contracts/activation/v1/contract.test.mjs
node services/workflow-api/node_modules/typescript/bin/tsc --noEmit --strict --target ES2023 --module NodeNext --allowImportingTsExtensions contracts/activation/v1/typecheck.ts
python3 scripts/validate_blueprint.py
```

## Local UI and backend

Follow wire-review.md for the operator-owned, scoped admission bundle and server-only token. Keep both outside Git. Set ACTIVATION_DEV=1, ACTIVATION_DEV_TOKEN (at least 32 characters), ACTIVATION_ADMISSION_PATH and a dedicated ACTIVATION_DATABASE_PATH; enable ACTIVATION_INTAKE=1 only for reported-agreement intake. Run npm start in services/workflow-api, npm run start:inspector in prototypes/v1, and npm run dev there in another terminal. Open http://127.0.0.1:5173/activation. API is 7007; inspector is 8787. Credentials stay in memory and must be reentered after reload. The default Portal remains at /.

The standalone inspector needs its own server-side GITHUB_TOKEN for private repositories; the connected account does not export one. Do not copy browser cookies or connector tokens. Collector output requires exact operator review/admission; existing captured evidence must never be retimestamped to bypass freshness checks.

## Follow-up delivery — 27 October 2026

Base main is 71e9fdd8753f56ac0da09c8c91fe8f798b13291a. Live refresh confirmed PR #10 merged, PR #11 merged to integration at a73109f, and PR #12 merged that integration into main. PR #11 no longer needs or permits retargeting. Its last head 0dda497 still has historical Goal API success and V1 failure (61 passing, 2 stale presentation assertions), independently verified from GitHub job logs. Local fixes retain outcome/evidence assertions. The connector's workflow query filters to pull-request runs; an empty result for the main merge is not proof of green main CI.

Local branch `followup/activation-intelligence` contains separate frontend repair, backend report/recovery and frontend connection commits. No remote write, PR edit, message, push, merge or publication occurred. Recommended delivery: a new draft PR against main with those commits, or two stacked PRs separating frontend acceptance fixes from backend plus frontend report integration. Do not modify Navyaa's branch or revive unrelated Codespaces/native-V2 changes.

### Additive compatibility proposal

Shared contract v1 schema, types, validation and digest remain unchanged. Existing routes and direct ActivationState responses remain intact. Proposed additive development route:

`POST /api/activation/v1/customers/:customerId/blocker-reports`

Body: `{id:"developer:<stable-id>", expectedRevision:0, planRevision:0, message:"Exact trimmed report"}`. Unknown fields, caller-supplied attribution/authority, invalid revisions and empty/oversized text are rejected. The authenticated principal supplies tenant/customer/session attribution. Report evidence is `developer_report` with proof `none`, never an observed repository fact. The server converts it to the existing BlockerUpdate and commits through the existing revision/idempotency transaction. An exact duplicate returns canonical state; changed bytes under the same id conflict. After uncertain failure, GET then retry the original body; use a new report only after explicit review and clearing.

The deterministic planner prepares a bounded offline review checklist, preserves the original milestone/goal/constraints, retains evidence and prerequisites, and requests Chris's help. It never selects runtime/template execution, manufactures agreement/approval or promotes outcomes. Exact derived plans are admitted against the durable server event, so recovery after process restart needs no ephemeral report admission. Operator-reviewed replacements still work through the existing registry fallback. Development authorization now also enforces bundle expiry.

The hosted interpretation provider was inspected. It is used by existing intake only; the new report recovery deliberately uses deterministic fallback and does not send report text to a hosted model. No live hosted interpretation test is claimed. Provider response mocks in inherited tests are mocks, not hosted acceptance.

### Validation

Node 24.12.0: 165 tests pass (37 backend, 37 contracts, 15 inspector, 4 conversation/local HTTP, 72 frontend), plus backend/contracts/frontend typechecks, production build and blueprint validation. Existing installed temporary dependencies were reused; no fresh dependency install or lockfile change is claimed. HTTP suites require permitted loopback listeners.

`node tests/activation/walkthrough.ts` runs two distinct simulated briefing previews, explicitly fictional admitted context under a test adapter, attributed blocker, replacement in a separate process, exact admission of the freshly captured commit-pinned GitHub observation, tamper rejection, generated local technical review with SHA-256, and an evidence-linked Chris summary with outcome unassessed. It reopens the saved database and verifies exact state and idempotent retry. The captured GitHub file proves declared workflow configuration only, not a remote check pass, customer-repository observation, deployment or adoption.

`tests/activation/browser-server.ts` is a local test harness only, with fictional contract fixtures and loopback-only fault injection. The fixed token is a public test constant, never a real credential. It must not be deployed or used to admit real customer sessions. Browser evidence and generated reports are retained outside Git in the local delivery folder. See frontend-audit-2026-10-27.md for browser cases and the artifact-review boundary.

Real acceptance remains blocked on actual Chris/customer agreement, production principal authentication, independently admitted real artifact/authorization/receipt chains where required, native Portal/AiKA availability and customer outcome evidence. Simulated intake remains preview-only under the unchanged contract; the test adapter is not a production bypass.
