# Spotify Portal Activation Intelligence

A shared activation workspace for Chris and the developer: turn a customer briefing and separately agreed goal into a relevant next action, recover when the developer gets blocked, and show evidence-linked progress toward the first useful outcome.

This is a local review prototype. Customer and Portal records are simulated fixtures. The GitHub inspector makes real, read-only, commit-pinned observations when authorized access is available. A repository observation does not prove a passing check, deployment, customer adoption or ROI. There is no live AiKA/Spotify Portal integration and no verified deployment or adoption.

## Six-step journey

1. **Briefing and agreed goal:** retain Chris’s context, constraints, unknowns and attributed agreement. A fictional agreement cannot initialize a real customer ledger.
2. **Personalized plan:** select a milestone and suggested actions grounded in admitted context. Suggestions never grant approval or execution authority.
3. **Developer next action:** show the welcome, prerequisites, current action and recorded preparation/approval/execution states.
4. **Blocker and recovery:** accept an attributed developer report, preserve the goal and constraints, invalidate affected actions, and persist a replacement suggestion or request Chris’s help.
5. **GitHub evidence:** inspect authorized repository content read-only; retain commit, source, scope and proof labels. Artifact metadata is reviewable; proposed diffs are not fetched by artifact review.
6. **Chris outcome:** connect evidence to the agreed goal, distinguishing reported progress, technical proof and an unassessed customer outcome.

The [active blueprint](docs/blueprint/activation-intelligence.md) records implementation and remaining acceptance gates. The [integration handoff](docs/activation/handoff.md) documents the provisional API and demonstration limits.

## Current architecture

| Path | Role |
| --- | --- |
| `prototypes/v1/src/activation/` | React activation page and separate API client; `/` and `/activation` are the product entry points |
| `services/workflow-api/src/activation/` | SQLite canonical state/history, revision checks, idempotency, exact-record admission, intake and durable replanning |
| `contracts/activation/v1/` | Provisional versioned types, schema, validators, fixtures and evidence semantics |
| `prototypes/v1/server/` | Read-only GitHub inspector and conversation/interpretation service; hosted interpretation is optional and server-side |
| `prototypes/v1/src/portal/`, `src/phase-a/` | Preserved supporting fixture workspace at `/portal`, conversation and repository diagnosis; Navyaa’s frontend remains available |
| `prototypes/v1/src/logic/` | Reusable deterministic workflow, validation, generation, simulation and evidence rules with regression tests |
| `services/workflow-api/src/{app,store,server}.ts`, `contracts/goals.ts` | Preserved Goal API foundation and shared contract |
| `plugins/`, `packages/` | Integration planning markers, not installed managed Portal packages |
| `archive/`, `docs/v1/`, historical blueprint JSON/register | Provenance and earlier designs, not the current product roadmap |

Vite proxies activation requests to port 7007 and inspector/conversation requests to 8787. The backend owns authoritative state; browser text, model output and fixture policy never establish production authority. Package names such as `@portal-architect/*` are retained compatibility identifiers, not a second product.

## Run locally

Use **Node 24.12 or later in the Node 24 line** and npm. There is no root npm workspace. From a fresh clone, install each independently:

```sh
git clone https://github.com/navyaamehta581-ship-it/Spotify-portal-solution.git
cd Spotify-portal-solution
npm ci --prefix prototypes/v1
npm ci --ignore-scripts --prefix services/workflow-api
```

In separate terminals from the repository root:

```sh
npm run dev --prefix prototypes/v1 -- --port 5173 --strictPort
```

```sh
npm run start:inspector --prefix prototypes/v1
```

```sh
npm start --prefix services/workflow-api
```

Open http://127.0.0.1:5173/. The screen loads without credentials; a saved activation session requires the explicitly enabled development API. By default the last command starts only the Goal API. Follow [development activation configuration](docs/activation/wire-review.md#explicit-development-configuration) for `ACTIVATION_DEV=1`, a private server-only token, one operator-owned scoped admission bundle and a separate activation database. Enable `ACTIVATION_INTAKE=1` only for the optional intake candidate. Bundle expiry and exact-record admission still apply. Re-enter the in-memory token after reload; canonical state persists in SQLite. Never commit bundles, tokens, databases or environment values, or put secrets in `VITE_*` variables.

For a reproducible fictional review session, `node tests/activation/browser-server.ts` provides a loopback-only test adapter on port 7007 (stop the regular API first). Read its public test customer/token constants in that file. It bypasses real admission only for fixtures and must not be deployed. `node tests/activation/walkthrough.ts` is the separate simulated acceptance harness; inspect its configuration before running network-dependent evidence collection. [GitHub inspection setup](docs/v1/github-inspection.md) explains authorized read access; a server-only `GITHUB_TOKEN` is optional for public repositories and required where repository access needs it.

## Test and build

From repository root under Node 24:

```sh
npm test --prefix prototypes/v1
npm run test:inspector --prefix prototypes/v1
npm run test:phase-a --prefix prototypes/v1
npm run build --prefix prototypes/v1
npm test --prefix services/workflow-api
npm run check --prefix services/workflow-api
node --test contracts/activation/v1/contract.test.mjs
./services/workflow-api/node_modules/.bin/tsc --noEmit --strict --skipLibCheck --module nodenext --moduleResolution nodenext --target es2022 --allowImportingTsExtensions contracts/activation/v1/typecheck.ts
python3 scripts/validate_blueprint.py
```

The build includes frontend typechecking. HTTP tests need loopback listeners. Blueprint validation checks the immutable historical register and tracker, not product completion. Test doubles, local builds and simulated walkthroughs do not certify Portal compatibility or customer outcomes.

## Provenance and limits

Main incorporated PR #13 (`3b37899165d57d4b7808666106344bee55709bf5`) before this cleanup. The [current handoff](docs/activation/handoff.md) supersedes earlier session status reports. The original [Workflow Architect snapshot](archive/workflow-architect-v1/README.md), handoff ZIP, 516-atom register and hashes are retained for traceability. No historical atom is promoted to complete by this narrative update.

Production identity, actual Chris/customer agreement, independent artifact/check receipts, native Portal/AiKA contracts and customer outcome evidence remain acceptance gates. Hosted interpretation has not been established as live acceptance. Deterministic blocker recovery remains available without a hosted model. No source license has been selected; historical branding/redistribution notes remain in the V1 handoff.

See [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and the [cleanup record](docs/narrative-cleanup.md) for scope, retained legacy references and verification.
