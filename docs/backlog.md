> Current product: [Spotify Portal Activation Intelligence](../README.md) and its [active blueprint](blueprint/activation-intelligence.md). The Architect scope and baseline below are historical reference; use the root README for current setup and validation.

# Atom backlog and tracking

[Source register](blueprint/spotify_portal_workflow_architect_micro_atomic_register.md) contains 516 atoms: 355 retained and 161 additive. [Editable tracker](backlog/atoms.json) preserves every ID, dependency, operation and PASS criterion. All implementation statuses start NOT_STARTED; repository preparation is not a claim that the Architect has been implemented.

For each atom, claim an owner and reviewer, link its GitHub issue and PR, and attach proof at the layer claimed. Allowed statuses: NOT_STARTED, IN_PROGRESS, BLOCKED, DEFERRED, DONE. BLOCKED/DEFERRED require a reason; DONE requires proof and reviewer. The blueprint's full per-atom ticket schema must be expanded in the issue before coding. Conditional architecture/digest gates require a recorded decision; exclusion never counts as PASS.

## Scope amendment REP-008

The source register's REP-008 prohibited repository writes during document creation. On 23 October 2026 the user explicitly authorized updating this repository, committing the blueprint and preparing a review PR. For this repository-adoption task, REP-008 is amended to: **record authorized scope, preserve source material, restrict remote changes to a feature branch/PR, and do not merge, force-push or enable production.** The source text/ledger remain unchanged. Human review of this amendment and the other REP evidence is required before marking associated atoms DONE. PORT-001 retains the REP-008 dependency.

## First work

Review REP-001–REP-008 evidence in the inventory and provenance; then collect PORT-001–PORT-025 tenant/runtime evidence and select A/B/C. Claim only small dependency-ready work. No broad feature is represented by a single atom, and no GitHub issues or people were bulk-assigned by this update.

Run `python3 scripts/validate_blueprint.py` from the root after tracker changes.
