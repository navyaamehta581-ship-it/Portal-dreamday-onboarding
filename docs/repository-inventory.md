# Repository inventory and adoption rationale

Inspected 23 October 2026: fresh clone of `navyaamehta581-ship-it/Spotify-portal-solution`, default/current branch `main`, commit `9cd4082031571129165b4f249c9a33a9ea1430a2` (merged collaboration PR #1). The checkout was clean before the feature branch `docs/managed-portal-blueprint` was created. This is the remote baseline, not either older local checkout. Local unfinished V2 work in `spotify-portal-v2` was neither imported nor changed.

[Baseline manifest](repository-baseline.json) pins the commit and source snapshot hashes. The requested `/mnt/data` attachment path is unavailable here; the existing workspace's matching named 516-atom artifact and companions were copied exactly. Their historical provenance remains intact. No claim is made that the inaccessible path was byte-compared.

## Inventory and decisions

| Paths at baseline | Observed role | Decision and rationale |
| --- | --- | --- |
| `prototypes/v1/package.json`, lockfile, Vite/TS config | Only executable package; React/TypeScript/Vite with Vitest | Preserve runnable reference and dependency lock |
| `prototypes/v1/src/domain/models.ts`, `src/logic/engine.ts`, `generate.ts` | Structured requests, deterministic constraints/dependencies and YAML serialization | Preserve as candidates for extraction after reviewed contracts and removal of fixture coupling |
| `src/logic/conversation.ts`, `assistant.ts`, four `*.test.ts` files under V1 | Context/conversation and planning regression behavior | Preserve tests; their scope is local fixtures, not tenant integration |
| V1 `src/logic/execution.ts`, `evidence.ts` | Simulated attempts and text/self-reported evidence checks | Preserve reference; replace with durable attempts and independent provider verification for real execution |
| V1 `src/data/`, `src/portal/`, `src/components/`, styles and image | Fictional context and local presentation shell | Preserve demo; do not claim native Portal mounting, server authorization or production branding clearance |
| `plugins/portal-assistant*`, `packages/` | README scope markers, no manifests or implemented backend | Replace generic host assumptions with managed Portal gate; retain paths pending architecture decision |
| `examples/` | Fictional scenarios and illustrative templates with missing skeletons | Preserve, explicitly unsuitable for real execution |
| `tests/integration/`, `tests/e2e/` | Acceptance plans, no executable suites | Preserve requirements; update target wording |
| `V1_SOURCE_HANDOFF.zip`, root V1 pointers, `docs/v1/`, V1 audit records | Historical transfer, audit and navigation | Preserve provenance and links; duplication alone does not establish obsolescence |
| README, contributing, architecture, roadmap, environment comments | Generic Backstage host setup mixed with Portal intent | Supersede instructions in place to remove misleading deployment assumptions |
| `.github/` | Existing V1 CI and review forms | Preserve pinned action/runner setup; add blueprint validation and atom review fields |

No application source, tests, archive, examples or other uncertain files were deleted. Obsolete setup prose was replaced in place. New documents add the blueprint snapshot, editable backlog, setup gates and this evidence record. This preparation adds no backend implementation or runnable plugin package.

## Validation scope

Fresh runs and runtime are recorded in [validation](validation.md). The existing historical V1 handoff reports 39 unit tests; historical reports are not substituted for a current run. Test/build results establish only local prototype behavior. The blueprint's PASS statements are future acceptance criteria, and all 516 implementation tracker entries start NOT_STARTED pending owner/reviewer proof.

## Remaining evidence gates

Tenant access, custom frontend/backend entitlement, exact runtime versions, publishing rollout, auth delegation, persistence/jobs/secrets/network facilities and integration APIs remain UNKNOWN. No tenant endpoint was probed, no credentials were committed, and no plugin was published. The source blueprint's original no-write task scope is explicitly amended for this authorized feature branch/PR in [backlog](backlog.md); this does not authorize merge or production enablement.
