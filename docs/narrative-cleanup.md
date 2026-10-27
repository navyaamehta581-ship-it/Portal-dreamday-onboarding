# Narrative cleanup — 27 October 2026

Base: current main `da2c320c21d542c8b379dacea2bf8fe6ffe5e2a2`, which merges PR #13. Branch: `cleanup/spotify-activation-narrative`.

## Scope and deletion evidence

Activation Intelligence is the active product in root/frontend/service documentation, architecture, roadmap and blueprint navigation. `/` and `/activation` select ActivationPage; `/portal` preserves the existing fixture workspace. The Portal sidebar links back to activation. The six journey labels and demonstration limits are visible on the landing page.

Import/route/test inspection found no runtime/test imports of `src/App.tsx` or `src/components/Concept.tsx`; only Concept imported `concept.css`. All three files matched their existing archive copies byte-for-byte before deletion. Those copies and the original transfer ZIP remain. Shared workflow/domain logic, backend, LLM/provider code, contracts, fixtures and tests remain unchanged. `portal/Architect.tsx` is still imported by Portal and its EntryContext type is used by AssistantDock; deleting it would break the supporting workspace, so it remains labeled legacy simulation.

Historical source hashes, backlog statuses, core paths, package names, API contracts and lockfiles are unchanged. Historical documents now point to the active narrative where needed. Earlier prototype README content is preserved in `docs/v1/portal-prototype-history.md` with a historical notice. Existing dirty checkouts and synced `sources/` were not edited.

## Validation

Node 24.12.0 using existing installed dependencies through ignored links in this isolated worktree; no fresh installation or lockfile change claimed.

- Frontend: 72 tests; contracts: 37; inspector: 15; backend/Goal/activation: 37; conversation/HTTP: 4. Total: 165 passed.
- Frontend typecheck/production build, backend typecheck, strict activation-contract typecheck and immutable blueprint/backlog validation passed.
- Backend and conversation HTTP suites initially failed because local listeners were restricted; permitted loopback reruns passed.
- Browser smoke: `/` rendered activation positioning, six steps and limits; its `/portal` link opened the preserved fixture workspace; the sidebar activation link returned to `/activation`. No customer session was loaded; no new end-to-end customer acceptance is claimed.
- Whitespace and changed-document local file-link checks passed. Added-line secret-pattern review found no credentials. This is a scoped review, not certification of the inherited repository.

## Exact changed files

- `.env.example`
- `CONTRIBUTING.md`
- `README.md`
- `archive/workflow-architect-v1/README.md`
- `docs/architecture.md`
- `docs/backlog.md`
- `docs/blueprint/README.md`
- `docs/blueprint/activation-intelligence.md`
- `docs/cleanup-audit.md`
- `docs/narrative-cleanup.md`
- `docs/repository-inventory.md`
- `docs/roadmap.md`
- `docs/setup.md`
- `docs/v1/portal-prototype-history.md`
- `packages/README.md`
- `plugins/portal-assistant-backend/README.md`
- `plugins/portal-assistant-common/README.md`
- `plugins/portal-assistant/README.md`
- `prototypes/v1/README.md`
- `prototypes/v1/index.html`
- `prototypes/v1/src/App.tsx` (removed; exact archive copy retained)
- `prototypes/v1/src/activation/ActivationPage.tsx`
- `prototypes/v1/src/activation/activation.css`
- `prototypes/v1/src/components/Concept.tsx` (removed; exact archive copy retained)
- `prototypes/v1/src/components/concept.css` (removed; exact archive copy retained)
- `prototypes/v1/src/main.tsx`
- `prototypes/v1/src/portal/Portal.tsx`
- `services/workflow-api/README.md`

## Remaining literal Architect references

These non-archive text files contain the word `architect` (case insensitive; lockfiles excluded). They retain compatibility package identifiers, referenced fixture code/styles, historical source/evidence/backlog/provenance, or explicit preservation explanations. This is not a second active product. `archive/workflow-architect-v1/` and `V1_SOURCE_HANDOFF.zip` retain original names/content; lockfiles retain package identifiers.

- `README.md`
- `contracts/package.json`
- `docs/activation-preservation.md`
- `docs/activation/integration-session.md`
- `docs/architecture.md`
- `docs/backlog.md`
- `docs/backlog/atoms.json`
- `docs/blueprint/README.md`
- `docs/blueprint/activation-intelligence.md`
- `docs/blueprint/atom-coverage-and-dependencies.json`
- `docs/blueprint/spotify_portal_workflow_architect_micro_atomic_register.md`
- `docs/cleanup-audit.md`
- `docs/cleanup-inventory.json`
- `docs/narrative-cleanup.md`
- `docs/repository-inventory.md`
- `docs/setup.md`
- `docs/v1/V1_FEATURE_MATRIX.md`
- `docs/v1/V1_HANDOFF.md`
- `docs/v1/github-inspection.md`
- `docs/v1/phase-a-handoff.md`
- `docs/v1/portal-prototype-history.md`
- `packages/README.md`
- `plugins/portal-assistant-backend/README.md`
- `plugins/portal-assistant-common/README.md`
- `plugins/portal-assistant/README.md`
- `prototypes/v1/README.md`
- `prototypes/v1/handoff-evidence/source-sha256.json`
- `prototypes/v1/package.json`
- `prototypes/v1/src/phase-a/ConversationPanel.tsx`
- `prototypes/v1/src/portal/Architect.tsx`
- `prototypes/v1/src/portal/AssistantDock.tsx`
- `prototypes/v1/src/portal/Portal.tsx`
- `prototypes/v1/src/portal/portal.css`
- `services/workflow-api/package.json`
