# Current source and historical references

Reviewed against main `e3db714fc715a5f8013f754b5ca0f4304f6ec88e` on 29 October 2026.

## What to build

There is one active demo, not a choice between V1 and V2 releases:

| Path | Current role |
| --- | --- |
| `prototypes/v1/` | Active React/Vite frontend. The directory name is historical; do not deploy an archive instead. |
| `services/workflow-api/` | Active Node 24 backend, SQLite stores, Gemini adapter and production entry point. |
| `prototypes/v1/server/portal-session.mjs` | Server-side persona sessions and forwarding, used by the production backend. |
| `contracts/` | Shared contracts and fixtures used by source and tests. |
| `Dockerfile`, `render.yaml` | Current whole-application Render packaging. Auto-deploy is disabled in the Blueprint. |
| `.github/workflows/` | Current validation workflows. |
| `prototypes/v1/e2e/`, `services/workflow-api/test/` | Executable browser and backend verification. |

Use the root README, local demo bootstrap and deployment guide for setup. A Vite build alone does not include the stateful backend.

## What is historical or supporting material

| Path | Why it remains |
| --- | --- |
| `archive/workflow-architect-v1/` | Historical source snapshot with original paths and SHA-256 manifest. Not imported into the active app. |
| Root `V1_SOURCE_HANDOFF.zip` and its archived copy | Identical original transfer artifact; the root copy is linked from compatibility pointers, and the archived copy is covered by the preservation manifest. Neither is a current source distribution. |
| `V1_HANDOFF.md`, `V1_FEATURE_MATRIX.md` | Short compatibility links to the canonical historical documents in `docs/v1/`. |
| `docs/v1/`, historical audit/inventory and blueprint files | Dated requirements, source provenance and audit evidence. Historical status claims are not current deployment status. |
| `plugins/`, `packages/` | Planning markers for a future managed Portal integration; not installed application packages. |
| `examples/`, lower-level inspector/conversation tools and fixture harnesses | Supporting examples and regression/development tools; retain while referenced by tests or documentation. |

The two handoff ZIPs were byte-compared using SHA-256 and match. They are deliberately retained because both paths are documented preservation artifacts. The repository is not materially large because of them (each is about 128 KB).

No old branch was deleted, no application directory was renamed, and no historical manifest was rewritten. Renaming `prototypes/v1` would affect imports, CI, Docker paths and documentation without removing a competing runtime.

## Hygiene checks and changes

The 304 tracked files contained no `node_modules`, `dist`, SQLite databases or obvious `.bak` leftovers. Installed dependencies and generated builds in the review checkout are ignored local files. Other sibling checkouts in the ChatGPT workspace are separate local copies, not files in this GitHub repository; they were not changed.

This cleanup updates stale root/deployment/architecture documentation and clarifies the active-versus-historical map. `.gitignore` also excludes SQLite/database files and their journals wherever local commands create them. Existing `.env`, private key, dependency and build ignore rules remain.

Historical material is already excluded from the Docker build context. Frontend source fixtures and tests needed by the current type-checking build must not be removed from that context simply because their names resemble demo or test material.

Render Free remains the deployment target. Vercel migration is no longer planned; the [earlier evaluation](deployment/vercel-evaluation.md) is retained only as historical reference. Repository cleanup does not trigger a Render redeploy.
