# Activation Intelligence architecture

The [active blueprint](blueprint/activation-intelligence.md) defines the product journey. The current hosted fictional demo runs one Node 24 Docker service: `services/workflow-api/src/production.ts` serves the built React UI, demo gate, persona sessions and a loopback activation API. SQLite and background jobs live in that process/container. See the [Render guide](deployment/render.md) for deployment and temporary-storage limits. Local development can also run the UI and supporting services separately, as mapped in the [README](../README.md).

The development admission architecture below remains relevant to the lower-level services; its tab-memory credential flow is separate from the hosted persona layer, which keeps credentials server-side.

- Activation UI/client: customer-scoped canonical reads, explicit commands, conflict/timeout recovery, polling and evidence navigation. Credentials remain in tab memory.
- Activation backend: SQLite state/history, exact-record admission, scoped development principal, revision checks, idempotency and durable replan worker. Intake and deterministic blocker recovery preserve goals and constraints; model output never grants authority.
- Inspector/conversation backend: bounded read-only GitHub evidence and preserved conversation/LLM interpretation logic. Observation, suggestion, approval, execution and verification remain distinct.
- Shared contracts: keep `contracts/activation/v1` types, schema, validation, version and digest stable until joint review. Existing Goal and conversation contracts remain intact.

The `/portal` fixture workspace, referenced Architect simulation, pure workflow rules, editor and tests remain supporting capabilities. Dormant App/Concept screens have archive copies and no runtime role. Existing directory and package names are compatibility paths, not active product branding.

Managed Portal architecture A/B/C is still undecided. `plugins/portal-assistant*` and `packages/` remain planning markers. Tenant identity, SDK/runtime, authorization, storage, jobs, secrets, supported surfaces and native AiKA/MCP access require evidence before integration. A local portal shell is not a managed Portal deployment.

See [historical blueprint provenance](blueprint/README.md) and [development admission boundaries](activation/wire-review.md). The fictional Render demo has been deployed and smoke-tested; native managed Portal deployment and real customer adoption remain unverified.
