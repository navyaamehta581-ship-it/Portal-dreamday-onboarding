# Activation Intelligence architecture

The [active blueprint](blueprint/activation-intelligence.md) defines the product journey. The runnable implementation is a local React UI, two loopback services and shared provisional contracts, as mapped in the [README](../README.md).

- Activation UI/client: customer-scoped canonical reads, explicit commands, conflict/timeout recovery, polling and evidence navigation. Credentials remain in tab memory.
- Activation backend: SQLite state/history, exact-record admission, scoped development principal, revision checks, idempotency and durable replan worker. Intake and deterministic blocker recovery preserve goals and constraints; model output never grants authority.
- Inspector/conversation backend: bounded read-only GitHub evidence and preserved conversation/LLM interpretation logic. Observation, suggestion, approval, execution and verification remain distinct.
- Shared contracts: keep `contracts/activation/v1` types, schema, validation, version and digest stable until joint review. Existing Goal and conversation contracts remain intact.

The `/portal` fixture workspace, referenced Architect simulation, pure workflow rules, editor and tests remain supporting capabilities. Dormant App/Concept screens have archive copies and no runtime role. Existing directory and package names are compatibility paths, not active product branding.

Managed Portal architecture A/B/C is still undecided. `plugins/portal-assistant*` and `packages/` remain planning markers. Tenant identity, SDK/runtime, authorization, storage, jobs, secrets, supported surfaces and native AiKA/MCP access require evidence before integration. A local portal shell is not a managed Portal deployment.

See [historical blueprint provenance](blueprint/README.md) and [development admission boundaries](activation/wire-review.md). No production deployment or adoption is verified.
