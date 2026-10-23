# V2 roadmap

This is a proposed sequence, not completed V2 implementation or a release promise.

## 0 — Agree on the host

Confirm Backstage/managed Portal deployment permissions, version, frontend system, backend APIs, package manager, identity and permission model. Scaffold one host and plugin packages in a separate PR. Acceptance: the plugin loads natively; its exact setup/check commands are documented and run in CI.

## 1 — Context and shared contracts

Version request/context/plan schemas, authorized Catalog/docs adapters, capability/action registry and fictional test fixtures. Acceptance: context is access-scoped with source provenance; unknown or forbidden entities fail safely; a model cannot override authorization.

## 2 — Planning and constraints

Extract useful V1 logic, replace fixture policy, add dependency-cycle detection and typed configuration validation. Acceptance: Orbit launch and Ledger onboarding differ materially; unsupported actions and restricted technologies remain blocked after edits.

## 3 — Compilation and tasks

Author reviewed skeletons and real action inputs; bind approval to exact versions; integrate actual Scaffolder task status/failures. Acceptance: host/action-schema tests pass; no unapproved side effect; retry/cancellation behavior and persistence are documented.

## 4 — Native experience and optional AI

Build page and contextual Ask Portal in the real shell. Add backend model orchestration only through approved typed tools. Acceptance: targets/context survive handoff; sources/blockers are readable; changes invalidate approval; unsupported requests are explained.

## 5 — Evidence and pilot

Replace text-regex completeness with provenance-bearing task/CI/review evidence. Measure useful-task completion and time to first reviewed change against a baseline; record corrections, failures, maintenance and manual support. No ROI claim until evidence exists.

Track each milestone with issues and focused PRs. The four workstreams can proceed in parallel after shared contracts are reviewed; do not let multiple teams independently choose conflicting host versions.
