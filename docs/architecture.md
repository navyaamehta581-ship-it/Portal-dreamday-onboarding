# Collaboration architecture and module contracts

## Current implementation

`prototypes/v1/` is the audited V1 snapshot, unpacked without application source changes. Its domain/planning/generation/simulation are local pure TypeScript functions; its portal UI is React with in-memory state. All customer identities, policies, tools and external effects are fictional. See [V1 handoff](v1/V1_HANDOFF.md).

## Planned V2 layout

`packages/app` and `packages/backend` will compose the real host. `plugins/portal-assistant` will supply native UI; `plugins/portal-assistant-backend` will handle context, policy and orchestration; `plugins/portal-assistant-common` will hold portable types/rules. Current folders contain planning notes only, not manifests or a runnable native plugin. Follow the chosen host version rather than guessing API compatibility.

[Backstage project conventions](https://backstage.io/docs/contribute/project-structure/) separate host packages and plugins. [Frontend plugin guidance](https://backstage.io/docs/frontend-system/building-plugins/index/) assumes a Backstage workspace; generator output/frontend APIs must be checked against the target host.

## Proposed contract boundary (not an API already implemented)

1. Context discovery returns an authorized context snapshot: subject/team entityRefs, visible service entityRefs, source references, allowed capabilities/actions, restrictions, version and timestamp. A selected team is never proof of permission.
2. Planning consumes a structured request and that snapshot, returning ordered steps, dependencies, configuration schemas, coverage, explanations and blockers. Prose/model output proposes fields; deterministic validation decides eligibility.
3. Compilation consumes a validated versioned plan and reviewed template/action registry, returning a review artifact or explicit errors. It must not invent action IDs, missing templates or unsupported capabilities.
4. Approval binds actor and exact plan/context versions. Execution rechecks server-side authorization and submits a supported reviewed template through the host's task infrastructure.
5. Task events and evidence retain provenance. Simulated, self-reported and independently verified results remain distinct. Retrying requires explicit idempotency/task semantics.

Agree on serializable schemas, error codes and fixtures in a contract PR before parallel module implementation. Do not create actual HTTP endpoints until identity, permissions and host routing are understood. Optional model requests belong on the backend with bounded tools and no browser secrets.

## Ownership

Context discovery and workflow planning review each other's request/context contracts. The compiler/task workstream reviews planner configuration/dependency semantics. Frontend/testing reviews user correction, approval invalidation and error display across all contracts. Host wiring and shared contracts need a second module's review. People claim work through issues; no individual is assigned by this proposal.

## V1 boundary

Keep V1 runnable with its own npm lockfile. Do not move V1 React components into native plugin folders wholesale. Reuse pure rules after removing fixture coupling and adding runtime schemas/cycle handling. Replace browser authorization, regex evidence verification, mock task events, absent skeletons and static tool discovery before real execution.
