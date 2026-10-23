# Architecture and reuse boundary

The [blueprint](blueprint/spotify_portal_workflow_architect_micro_atomic_register.md) controls implementation scope. Architecture A/B/C remains undecided until tenant capabilities and runtime contracts are verified. No generic Backstage application is selected as the deployment target.

## Proposed boundaries

- Domain/contracts: durable sessions, scoped context snapshots, requirements, deterministic policy, versioned plans and compiler outputs; independent of React and credentials.
- Backend: authoritative authorization, persistence, approvals bound to exact revisions, attempts, reconciliation, evidence and analytics.
- Adapters: permission-filtered catalog/docs, approved SCM/model, supported template/action/task interfaces. Each capability has explicit status, provenance and expiry.
- Thin surfaces: dashboard and contextual assistance share the same engine. AiKA/MCP and digest remain conditional on proven entitlement and reviewed contracts.

These are intended modules, not existing manifests or endpoints. Existing `plugins/portal-assistant*` paths are planning markers; final package names and composition follow the verified Portal runtime. `packages/` does not commit the team to a self-hosted app/backend.

## V1 reuse

Preserve `prototypes/v1/src/logic/` and its tests as reference behavior: structured intake, constraint/dependency validation, YAML serialization, conversations and simulated failure/retry. Extract pure rules only with reviewed contracts and regression tests. Replace static fixture discovery, browser policy decisions, in-memory execution and regex/self-reported evidence before claiming real integration. Do not copy the fake Portal shell into a production plugin.

## Contract review

Agree typed inputs/outputs, failure states, ACL rules, freshness, revision hashes and recovery before implementing adapters. A changed plan or context invalidates approval. Server-side policy remains authoritative; model text and retrieved documentation never grant permissions. Independently verify provider outcomes before marking deliverables successful.
