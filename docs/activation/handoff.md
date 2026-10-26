# Activation integration handoff — 27 October 2026

Status: provisional API 1.0.0; contract freeze HOLD pending Navyaa and backend/domain owner approval. This branch is a review candidate, not a production Portal/AiKA integration or real customer approval.

## Included and preserved

The integration branch contains preservation commit fa6e987 and persistence commit 4fd85d5, plus evidence admission, durable replan recovery, browser-safe shared state/client, explicit local development configuration, isolated /activation UI, read-only GitHub collector/diagnostics and bounded briefing intake. New-service requests inspect template prerequisites without choosing an unsupported runtime/template. Simulated recommendation intake produces a preview and cannot initialize a real agreed-customer ledger.

All seven original checkouts retain their recorded source hashes, status and HEAD. Their unfinished Phase B, native V2 and Codespaces proxy work is outside this integration; do not merge it incidentally.

Included fixtures: the explicitly fictional recommendation intake required by the regression test, frozen contract fixtures, and historical commit-pinned GitHub observations required by exact-admission tests. GitHub observations are not passing checks for this branch or customer-outcome proof.

Excluded and retained locally: browser screenshots, browser/session validation snapshots, preservation inventory, generated recommendation preview and historical failed-inspection/retry captures. These are temporary test/session artifacts, not implementation. Machine-specific temporary paths were removed from historical reports. No credentials, private customer intake, local admission bundle, database, environment values, dependencies or generated build output are included. The inherited archive is a preserved source handoff, not a new build artifact.

## Provisional API and ownership

Keep contracts/activation/v1 request structures, validation, version and digest stable. state.ts publishes the existing canonical response shape without moving authority into the browser. Exact endpoints and errors are in wire-review.md; later intake additions are in intake-session.md. POST /state additionally supports context-only reviewed-plan selection; POST /intake is optional and development-only. No envelope change: activation returns state directly, conversation still returns its existing envelope.

Navyaa owns review of the isolated /activation entry point versus her Portal/conversation workspace, customer briefing and developer next-action experience, refresh/conflict handling and evidence/outcome presentation. Backend review owns admission, principal scope, revisions/idempotency, worker recovery and authority. Joint review must approve response validation and any actual compatibility change before changing shared structures. No approval is inferred from publication.

## Fetch and validate

Use Node 24.12.0 (supported: >=24.12.0 <25). From a clean clone, or a new worktree if your existing checkout is dirty:

```sh
git fetch origin
git switch --track origin/integration/activation-intelligence-handoff
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

## Validation of the publication candidate

Node 24.12.0: 152 tests passed (33 backend, 37 contracts, 15 inspector, 4 conversation/local HTTP, 63 frontend). Backend, contracts and frontend typechecks and Vite build passed (1676 modules). Validation used a complete isolated source copy and previously installed dependencies; a fresh dependency installation was not performed. Initial restricted HTTP tests could not bind loopback; the permitted rerun passed all 89 server/contract tests. No dependency/lockfile changes.

Historical session reports describe their own earlier checkpoints. This handoff supersedes their uncommitted/no-push status once the branch is published. Real customer acceptance, live hosted interpretation, arbitrary new-context blocker planning, production identity and native Portal/AiKA integration remain open. Demo follow-up must distinguish simulated context, observed repository facts and reviewable technical results.
