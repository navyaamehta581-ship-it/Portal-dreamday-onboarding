# Portal Assistant — Spotify Portal workflow concept

A collaboration repository for evolving the **V1 Portal Assistant prototype** (formerly AI Workflow Architect) into a **V2 native Backstage plugin**. Tell Portal what you are trying to accomplish, then review a workflow grounded in your team's approved tools and constraints.

**Current status:** V1 is runnable React/TypeScript/Vite software with fictional customer data, deterministic planning and simulated execution. V2 plugin packages and Backstage host have not been generated. No real Spotify connection, AI provider, Scaffolder execution or deployment is included.

## Repository map

```text
packages/                  Planned Backstage host app/backend wiring
plugins/
  portal-assistant/        Planned native frontend plugin
  portal-assistant-backend/ Planned backend context, policy and orchestration
  portal-assistant-common/  Planned shared contracts and pure planning rules
prototypes/v1/             Preserved, runnable V1 source with its own npm lockfile
docs/                      Architecture, roadmap, research and audited V1 handoff
examples/                  Fictional requests and illustrative template YAML
tests/                     Integration and end-to-end acceptance plans
.github/                   V1 CI, issue forms and pull request template
CONTRIBUTING.md            Branch, review, ownership and validation process
.env.example               Comments explaining future configuration boundaries
V1_SOURCE_HANDOFF.zip      Original immutable V1 transfer archive
```

`packages/` and `plugins/` contain planning notes only. This follows [Backstage's monorepo conventions](https://backstage.io/docs/contribute/project-structure/); the final scaffold must match the actual host version and frontend/backend APIs.

## Run V1 locally

Use Node **24** and npm (the audit also passed on Node 26). Initial installation requires registry access. From the repository root:

```sh
cd prototypes/v1
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173/ and leave the server running. No `.env`, API keys, database or external infrastructure is required. Reloading resets in-memory tasks and conversations.

```sh
npm test
npm run build
```

The 23 October 2026 V1 audit passed **39 tests across four files** and a production build. The PR workflow repeats those commands from `prototypes/v1/`; it does not test native Backstage functionality. CI results belong to each GitHub run and must be checked before merging.

## Demo paths

- Orbit: Node.js service, CI/CD, monitoring and documentation; six simulated steps including publishing and registration.
- Ledger: Java onboarding for an existing service; repository creation is prohibited; Java setup and documentation use fetch actions only.
- Ask Portal: open a catalog service and request local setup guidance; continue into a contextual tracked task.

All integrations, permissions, artifacts and execution are simulated. Generated YAML references missing illustrative skeletons; it is not ready for real execution. Task evidence is self-reported or explicitly simulated.

## Collaborate

Read [CONTRIBUTING.md](CONTRIBUTING.md), [module boundaries](docs/architecture.md) and the [roadmap](docs/roadmap.md). Use an issue, a separate branch and a pull request. Do not merge your own unreviewed work or push directly to `main`. Repository rules require a separate maintainer settings change; this documentation alone does not enforce them.

Start a V2 development chat with [the handoff](docs/v1/V1_HANDOFF.md), [feature matrix](docs/v1/V1_FEATURE_MATRIX.md), this repository, and the actual target Backstage host/version. The source archive is retained for comparison. Do not independently scaffold multiple incompatible Backstage apps in this repository.

No project source license has been selected. Obtain approval before public redistribution, including the screenshot-derived logo. See the handoff for dependency and branding considerations.
