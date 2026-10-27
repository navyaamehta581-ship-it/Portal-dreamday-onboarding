> Current product: [Spotify Portal Activation Intelligence](../README.md) and its [active blueprint](blueprint/activation-intelligence.md). The Architect scope and baseline below are historical reference; use the root README for current setup and validation.

# Setup and managed Portal gate

## Local reference development

Open the repository root in VS Code, use Node 24 and run the V1 commands in the [README](../README.md). V1 has its own lockfile. Commit source changes and relevant lockfile changes together; keep dependencies, build outputs, tokens and private tenant data out of Git. Root directories are not yet an executable workspace.

## Before generating plugin packages

Record evidence for PORT-001 through PORT-025 from the blueprint. Tenant identifier, publishing rollout, entitlement, runtime/package versions, identity delegation, storage, jobs, secrets and outbound network contracts are currently **UNKNOWN**. Catalog/docs read, action/schema discovery, preview, task submit/status/cancel, contextual extension, model and email contracts also remain unverified. Record capability status and sanitized proof; absence of access is not evidence of absence.

Select architecture A (managed custom plugin), B (external service with permitted Portal surface), or C (companion/export fallback) using the blueprint gates and a reviewed decision. A is preferred only when verified. Document supported SDK/package versions, exact development commands, package manager/lockfile, staging and publishing procedures after that decision. Do not independently scaffold a generic Backstage host or guess tenant URLs, registry settings or permissions.

Until then: use pure domain fixtures and explicit simulation/export boundaries; no live execution or publishing. A local build cannot prove tenant compatibility. Production publication and tenant enablement require a separate authorized release action and target-specific evidence.

## Checks

From repository root:

```sh
python3 scripts/validate_blueprint.py
cd prototypes/v1
npm ci
npm test
npm run build
```

The first command checks blueprint/tracker consistency. The remaining commands exercise V1, not a managed Portal integration. Node 24 is the CI baseline; record the actual local runtime with each result.
