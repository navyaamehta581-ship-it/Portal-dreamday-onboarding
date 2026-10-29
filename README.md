# Spotify Portal Activation Intelligence

A shared activation workspace for Chris and the developer: turn a customer briefing and separately agreed goal into a relevant next action, recover when the developer gets blocked, and show evidence-linked progress toward the first useful outcome.

This repository contains one runnable fictional demo, with a React/Vite frontend and a Node 24 backend. It can run locally or as one Docker service on Render Free. The hosted demo has been verified on Render, including a real Gemini analysis request; it is not a native Spotify Portal integration or evidence of real customer adoption. Customer, persona and repository records are fictional. The optional GitHub inspector makes real, read-only, commit-pinned observations when authorized access is available. A repository observation does not prove a passing check, deployment, adoption or ROI.

## Start here

- **Hosted demo and deployment:** [Render guide](docs/deployment/render.md). The backend serves the demo gate, persona sessions, API routes and built frontend together. State is temporary.
- **Local persona demo:** [local bootstrap](services/workflow-api/LOCAL_DEMO.md).
- **Current source:** `prototypes/v1/` is the active frontend despite its historical directory name; `services/workflow-api/` is the active backend; `contracts/` contains shared contracts.
- **Earlier versions and audit records:** [repository cleanup map](docs/repository-cleanup.md). `archive/` and `docs/v1/` are historical references, not competing release candidates.
- **Deployment target:** Render Free. The earlier [Vercel evaluation](docs/deployment/vercel-evaluation.md) is historical reference; migration is no longer planned.

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
| `prototypes/v1/src/operator/`, `src/portal/`, `src/activation/` | Active operator, Portal and onboarding UI; hosted entry goes through the demo gate and persona sign-in |
| `services/workflow-api/src/activation/` | SQLite canonical state/history, revision checks, idempotency, exact-record admission, intake and durable replanning |
| `contracts/activation/v1/` | Provisional versioned types, schema, validators, fixtures and evidence semantics |
| `services/workflow-api/src/production.ts`, `prototypes/v1/server/portal-session.mjs` | Hosted entry point, gate, room isolation, persona sessions, API forwarding and static frontend serving |
| Other files in `prototypes/v1/server/` | Supporting local GitHub inspector and conversation/interpretation service |
| `prototypes/v1/src/phase-a/` | Supporting conversation and repository diagnosis UI |
| `prototypes/v1/src/logic/` | Reusable deterministic workflow, validation, generation, simulation and evidence rules with regression tests |
| `services/workflow-api/src/{app,store,server}.ts`, `contracts/goals.ts` | Preserved Goal API foundation and shared contract |
| `plugins/`, `packages/` | Integration planning markers, not installed managed Portal packages |
| `archive/`, `docs/v1/`, historical blueprint JSON/register | Provenance and earlier designs, not the current product roadmap |

In local development, Vite proxies activation requests to port 7007 and inspector/conversation requests to 8787. On Render, the production server serves the frontend and API under one origin; Vite development proxies do not run. The backend owns authoritative state; browser text, model output and fixture policy never establish production authority. Package names such as `@portal-architect/*` are retained compatibility identifiers, not a second product.

## Run locally

For the persona demo (one entry for Chris, Maya, Alex and Jordan), follow the
[private fictional demo bootstrap](services/workflow-api/LOCAL_DEMO.md). The local
Portal session layer holds the generated tokens server-side; nothing is pasted in
the browser. Routing and access rules: [personas](docs/activation/personas.md). What each role sees and does: [roles, opportunities and adoption](docs/activation/roles-and-opportunities.md).

Use **Node 24.12 or later in the Node 24 line** and npm. There is no root npm workspace. From a fresh clone, install each independently:

```sh
git clone https://github.com/navyaamehta581-ship-it/Spotify-portal-solution.git
cd Spotify-portal-solution
npm ci --prefix prototypes/v1
npm ci --ignore-scripts --prefix services/workflow-api
```

### Lower-level development services

The commands below start the individual development services. For the full persona journey, use the local bootstrap linked above; for hosted operation, use the Docker/Render guide.

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

Production identity, actual Chris/customer agreement, independent artifact/check receipts, native Portal/AiKA contracts and customer outcome evidence remain acceptance gates. Hosted Gemini analysis has been smoke-tested on the fictional Render demo. Native Portal integration and real customer acceptance remain unverified. Deterministic blocker recovery remains available without a hosted model. No source license has been selected; historical branding/redistribution notes remain in the V1 handoff.

See [contributing](CONTRIBUTING.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and the [cleanup record](docs/narrative-cleanup.md) for scope, retained legacy references and verification.
