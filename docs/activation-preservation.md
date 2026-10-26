# Activation pivot preservation and integration order

The cleanup audit was approved with an explicit no-deletion constraint. This change implements only additive preservation: four byte-identical archive copies, their manifest and README, this handoff, and a navigation note in the root README. Every original file remains. No application, API contract, shared path, dependency, lockfile or CI behavior changes.

## Source of truth

Current runnable code stays under `prototypes/v1/`; existing goal contracts and API remain under `contracts/goals.ts` and `services/workflow-api/`. Historical screens and handoff are indexed in [the preservation snapshot](../archive/workflow-architect-v1/README.md). Copies are not replacement source.

Retain the capability matcher, domain models, validation, generation, evidence handling and tests. Fictional catalog, environment and conversation fixtures remain necessary for demos and regression checks. Label simulated Portal context separately from actual read-only GitHub observations; neither simulation nor AI inference proves execution or a verified customer outcome.

Root V1 handoff links remain navigation pointers. Canonical documents remain under `docs/v1/`. Blueprint/backlog and their validator remain together until an activation roadmap and CI migration are agreed. Duplicate example/evidence YAML remains because baseline hashes and historical reports reference it.

## Sequencing

1. Backend/domain reviewer and Navyaa review the existing local Phase 0 additive activation contracts and fixtures together. They remain in the separate `spotify-portal-phase0` checkout and are not included or approved by this preservation change. Agree on exact contract version/digest and ownership before wiring routes or dependent UI.
2. Reconcile the older Checkpoint-2 backend branch with the common reviewed baseline. Preserve provider.mjs SYSTEM prompt, schemas/controller, training preparation and tests, acceptance reports including failed live results, and storage compatibility work. Do not bulk-copy over merged frontend work or treat old verified labels as activation outcome proof.
3. Review the existing Codespaces proxy fix with frontend ownership. Maintain goal/conversation compatibility while developing activation screens against reviewed fixtures. The backend is a demo planning adapter; no live AiKA or Portal execution is claimed.
4. Review this additive archive change independently. Original screens, handoff, fixtures and useful experiments remain available. Any future move, consolidation or deletion is a separate decision; none is authorized by this implementation.

Backend/domain reviewer identity remains unassigned in repository guidance. Frontend panel/client/presentation belong to Navyaa's workstream; shared contract/fixture changes require both reviews. No teammate approvals or contract rollout are implied by the cleanup audit approval.

## Verification

Archive copies must match originals and manifest SHA-256 values. All previously tracked files except the root README must remain byte-identical to the base. Run frontend tests and build with the locked dependencies; no new behavior tests are needed for reference copies. Runtime verification results are recorded with the local delivery, not represented as historical snapshot evidence.
