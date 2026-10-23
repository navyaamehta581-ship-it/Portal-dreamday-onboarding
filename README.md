# Spotify Portal AI Workflow Architect

Team workspace for implementing the [516-atom Portal blueprint](docs/blueprint/spotify_portal_workflow_architect_micro_atomic_register.md). The target is **Spotify-managed Portal**. Backstage examples alone do not establish managed deployment, API access or tenant compatibility.

**Implemented today:** a runnable V1 React/TypeScript prototype with fictional data, deterministic planning and simulated execution. Plugin folders contain scope notes only. There is no implemented Portal backend, authenticated tenant integration, production execution or certified plugin artifact.

## Start in VS Code

```sh
git clone https://github.com/navyaamehta581-ship-it/Spotify-portal-solution.git
cd Spotify-portal-solution
code .
```

Use Node 24 and npm for V1; installation requires registry access. In a VS Code terminal:

```sh
cd prototypes/v1
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173/. No credentials or environment file are required. Reload resets local tasks and conversations. In another terminal from the same directory:

```sh
npm test
npm run build
```

These checks validate the prototype only. There is no root npm workspace or Portal plugin start command yet. See [setup and compatibility gates](docs/setup.md) before generating packages.

## Team workflow

Read [CONTRIBUTING.md](CONTRIBUTING.md), claim an atom from the [backlog](docs/backlog.md), and work on a separate branch and PR. Each atom needs an owner, reviewer, explicit dependencies, acceptance checks and evidence. Do not mark an atom complete from a mock, screenshot or written plan alone. [Repository inventory](docs/repository-inventory.md) explains retained V1 code and the setup guidance replaced by this change.

## Repository map

| Path | Role |
| --- | --- |
| `docs/blueprint/` | Unmodified blueprint, dependency ledger and original provenance |
| `docs/backlog/atoms.json` | Editable team tracking for all 516 atoms; initially NOT_STARTED |
| `docs/architecture.md` | Domain boundaries and architecture selection gate |
| `docs/roadmap.md` | Dependency-led implementation order |
| `plugins/` | Proposed frontend, backend and common scope markers; no packages yet |
| `packages/` | Reserved integration composition; no generic host scaffold promised |
| `prototypes/v1/` | Runnable source, lockfile, 39 existing unit tests and audit records |
| `examples/` | Fictional scenarios and illustrative YAML with missing skeletons |
| `tests/` | Integration/E2E acceptance plans, not automated suites |
| `.github/` | V1 CI, issue form and PR review template |
| `V1_SOURCE_HANDOFF.zip` | Preserved original transfer archive |

The Orbit launch and Ledger onboarding demos simulate all permissions, integrations and external effects. V1's fake Portal shell, fixture authorization and text-based evidence checks are not production integration components. Preserve useful rules and regression cases while replacing those boundaries.

No project source license has been selected. Branding and redistribution considerations remain in the [V1 handoff](docs/v1/V1_HANDOFF.md).

The [cleanup audit](docs/cleanup-audit.md) records the current pinned inventory, deletion evidence and items requiring review.
