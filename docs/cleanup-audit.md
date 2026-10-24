# Managed Portal cleanup audit

Date: 24 October 2026. Branch: `chore/portal-blueprint-cleanup`.
Pinned remote main: `a5af9f713c4be2db8fad4a24d8ae9c375920e17e`.

The user explicitly authorized cleanup, branch creation and a PR, superseding the blueprint's historical document-only restriction for this task. No merge, force push, tenant publication or production execution is authorized by this cleanup.

## Source of truth and complete inventory

The attachment retrieved from chat `6ac4ef23-71fc-83ed-b9f8-a9b71abc7036`, `spotify_portal_workflow_architect_micro_atomic_register.md`, is byte-identical to the checked-in 516-atom blueprint. SHA-256: `25422bc353bc31485af5c3f0c9381130212a11cac9d4020fd87655e604835658`.

[Machine-readable inventory](cleanup-inventory.json) enumerates every baseline tracked file with size, hash, role and preservation/deletion decision; it also includes the only package manifest's direct dependency declarations and the complete lockfile package inventory with exact resolved versions and integrity information. This inventory records the pre-cleanup commit, not generated dependencies/build outputs. Existing baseline/adoption records remain historical and unchanged.

The only executable package is `prototypes/v1`: React, React DOM, Lucide and YAML; Vite, TypeScript, Vitest, React types and Tailwind tooling are development dependencies. No root workspace or Portal backend package exists. All dependency declarations and lock bytes are preserved. Configuration, CI, four regression test files, fixtures, domain logic, YAML generation, conversation handling and workflow editing are reusable references. Blueprint acceptance criteria remain requirements rather than implemented claims.

## Deletions and proof

| Deleted path | Exact surviving copy | SHA-256 of both at baseline | Reason |
| --- | --- | --- | --- |
| `prototypes/v1/V1_HANDOFF.md` | `docs/v1/V1_HANDOFF.md` | `34c06c78c756aed3bd035b26b72df438ad1040f8c9aef73eb61bc189baf1b8c6` | Redundant copy after canonical documentation moved to docs/v1; contains no unique audit information. |
| `prototypes/v1/V1_FEATURE_MATRIX.md` | `docs/v1/V1_FEATURE_MATRIX.md` | `13871b1b5d159dba515eb7043be6c18fe8c9d3b2f071837395da80e9264459f0` | Redundant copy of canonical migration reference; no unique capability or requirement is lost. |

Tracked-path reference search and application entry/configuration inspection found no build, test or application dependency on these duplicate paths. Prototype README now links directly to both canonical documents. Root compatibility pointers remain. Canonical documents, their historical wording, transfer archive and source/audit hash records are unchanged. Historical hash records describe the original snapshot, not the current checkout.

## Preserve / requires review

- Preserve `V1_SOURCE_HANDOFF.zip`: it records the original transfer snapshot and is referenced by root pointers and audit documents. Its historical packaging role is distinct from the working tree; duplication does not prove obsolescence.
- Preserve legacy `src/App.tsx`, `components/Concept.tsx` and CSS: unmounted does not establish that design/reference behavior is useless. Extraction or retirement needs capability and design review.
- Preserve fake Portal shell, logo and fixture authorization/execution/evidence logic: used by the running prototype or tests. They require replacement/review before managed Portal integration; this is not permission to break the demo or claim production readiness.
- Preserve illustrative templates and scenario fixtures despite missing executable skeletons: they retain compiler/planning intent and cannot be represented as runnable infrastructure.
- Preserve plugin/package README markers and integration/E2E acceptance plans: requirement-bearing scaffolding, not unused implemented packages.
- Preserve Tailwind tooling and all other dependencies pending a separate usage and compatibility review; no speculative dependency pruning or upgrades.
- Tenant runtime, publishing, identity, storage, model and API entitlements remain unresolved. Managed architecture A/B/C selection and future package layout need target evidence, not deletion of reference code.

## Validation

Runtime: Node 26.0.0, npm 11.12.1, Python 3.13 locally; existing CI selects Node 24.

- Locked install (`npm ci --prefix prototypes/v1 --ignore-scripts`): PASS, 100 packages installed; npm audit reported zero vulnerabilities. Registry access was required. Installation scripts were disabled; the subsequent build exercised the installed tools.
- `npm test --prefix prototypes/v1`: PASS, 39 tests in four files.
- `npm run build --prefix prototypes/v1`: PASS, TypeScript and Vite; 1,666 modules transformed.
- `python3 scripts/validate_blueprint.py`: PASS, unchanged snapshot hashes, all 516 unique atoms, 355 original IDs and acyclic dependencies.
- Inventory preservation check: PASS, all 81 baseline paths accounted for; deleted files match canonical hashes; every other baseline file is byte-preserved except the two README navigation additions.
- New Markdown relative links: PASS; all resolve to preserved canonical documents or added audit files.
- `git diff --check`: PASS.

An initial test/build invocation ran before dependency installation finished and reported missing tools; the completed-install runs above supersede that attempt. No application behavior was changed. Local prototype checks cannot certify managed Portal compatibility or GitHub CI status.
