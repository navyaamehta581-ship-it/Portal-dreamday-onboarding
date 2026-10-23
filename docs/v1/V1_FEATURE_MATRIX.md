# V1 feature matrix — Portal Assistant

Audited 23 October 2026 against the actual V1 source, 39 passing unit tests, production build and selected browser journeys. Read `V1_HANDOFF.md` for rules, reproduction, evidence and security limitations.

**Working local** = implemented behavior in the prototype. **Simulated** = fictional data/external effects. **Partial** = restricted functionality. **Reference** = placeholder section. **Legacy** = retained but unmounted source. V2 status below is a recommendation, not completed migration.

| Feature | Implementation files / functions | V1 status and boundary | V2 migration status / required work |
|---|---|---|---|
| Application bootstrap | `src/main.tsx` | Working local; mounts Portal in StrictMode | Replace standalone bootstrap with native plugin registration |
| Shared portal shell/sidebar/logo | `src/portal/Portal.tsx`, `portal.css`, `src/styles.css`, `public/backstage-logo-reference.png` | Working local; representative screenshot-based shell, raster branding | Do not migrate fake shell/global CSS; use host components/branding after rights review |
| Portal Assistant navigation | `Portal.tsx` | Working local entry beside Create | Adapt to host plugin route/navigation APIs |
| Home dashboard | `Portal.tsx` | Working navigation; static visit/clock/example cards, not analytics | Keep real host home; optional lightweight entry only |
| Software catalog | `Portal.tsx`, `src/data/catalog.ts` | Working local filters/search/ownership/lifecycle; ten fictional services | Replace fixtures with authorized Catalog API/entityRefs |
| Catalog starring | `Portal.tsx` | Working in-memory toggles; lost on reload | Use host starred-entity APIs if supported |
| Service detail | `Portal.tsx` | Working local ownership/stack/lifecycle/context CTA | Native entity extension/card; real entity context |
| Catalog/Docs search | `Portal.tsx` | Working small string filters, not enterprise search | Host Search/catalog APIs; enforce visibility |
| API explorer | `Portal.tsx`, `catalog.ts` | Partial/simulated rows derived from services, no API schemas | Replace with real API entities; do not carry invented definitions |
| Docs listing/local guide | `Portal.tsx`, `catalog.ts`, `src/data/environments.ts` | Working local pages; fixture references/common setup commands, not TechDocs retrieval | Authorized TechDocs/source retrieval with provenance |
| Create template cards | `Portal.tsx`, `catalog.ts` | Partial; capability references, contextual planner entry | Real Template entities, eligibility and installed action schema discovery |
| Action registry display | `Portal.tsx`, `catalog.ts`, `environments.ts` | Simulated declared fetch/publish/register registry | Read supported installed actions via authorized backend/host services |
| Create Tasks/Editor/Extensions | `Portal.tsx` | Reference views, no real history/editor | Use existing Scaffolder pages; do not duplicate |
| My Group/ownership | `Portal.tsx`, `catalog.ts` | Working fixture selection/counts, not logged-in identity | Identity/ownership APIs with permissions |
| Explore | `Portal.tsx` | Working fictional group/domain navigation | Preserve host Explore; contextual entry only if useful |
| Tech Radar/MUI to BUI/Visualizer | `Portal.tsx` | Reference placeholders | Do not migrate placeholders |
| Notifications/Settings/Support | `Portal.tsx` | Reference/explanatory behavior; no operational plugin/settings backend | Use host equivalents |
| Contextual Ask Portal button/dock | `Portal.tsx`, `src/portal/AssistantDock.tsx` | Working local on relevant portal pages; no model call | Adapt dock/entity context to host UI; one coherent assistant |
| Contextual grounded answers | `src/logic/assistant.ts`: `answerInContext` | Working deterministic setup/owner/tools/task answers from fixtures; scoped same-team service search; unsupported-question fallback | Reuse source/citation/task concepts; replace fixture retrieval and regex understanding |
| Task handoff from page/dock | `Portal.tsx`, `AssistantDock.tsx`, `Architect.tsx` | Working local team/service/intent preselection, new Architect instance | Typed plugin route/context contract; preserve provenance and authorization |
| Six-stage journey | `src/portal/Architect.tsx` | Working local connected discovery/context/plan/review/generate/value | Reuse journey; adapt component system and persistence |
| Natural-language discovery | `Architect.tsx`: `send`; `src/logic/conversation.ts`: `resolveConversationContext` | Partial; regex cues and service-name matching propose fields; not general LLM reasoning | Optional backend model with typed tool output; deterministic fallback; reconcile prose/fields |
| Structured requirements | `Architect.tsx`, `src/domain/models.ts`: `Request`, `Need`, `Stack` | Working local; explicit selected needs/stack drive planner | Reuse concepts; add runtime schemas/versioning |
| Three engineering teams | `catalog.ts`: `teams`; `environments.ts`: `environments` | Simulated Orbit/Node, Ledger/Java, Signal/Python+Node | Retain as dev/test fixtures only; real environment provider in V2 |
| Existing-tool identification | `ContextPanel.tsx`, `environments.ts` | Simulated fixture load/inspection; no actual scanning/discovery | Catalog/integration/action adapters with declared provenance |
| Context inspection | `src/portal/ContextPanel.tsx` | Working local tools/actions/services/prerequisites/policy display | Reuse presentation; authenticated contextual source data |
| Capability corrections | `ContextPanel.tsx`, `Request.unavailableCapabilities`, `engine.ts` | Working local assumptions can mark capabilities unavailable and block plans | Persist explicit overrides; validate policy server-side |
| Customer-call notes | `Architect.tsx`, `ContextPanel.tsx` | Partial reviewed human note display only; does not affect planner; raw notes can persist across team changes | Redesign tenancy, retention, provenance/consent before real customer data; no implied training |
| Capability metadata | `catalog.ts`: `capabilities`; `models.ts`: `Capability` | Nine structured fictional capabilities, requirements/dependencies/action/configuration | Reuse model concepts; typed versioned registry grounded in reviewed installed templates/actions |
| Capability specialization | `src/logic/engine.ts`: `resolveCapability` | Working local canonical lookup, stack-specific paths/descriptions; positional tool indexes | Extract pure resolver; replace positional metadata and fixture paths |
| Deterministic recommendations | `engine.ts`: `recommend` | Working local first structured match, eligibility/coverage/policy; no ranking/LLM | Reuse rules approach/tests; server-authoritative planner with real capabilities |
| Team constraints | `engine.ts`: `recommend`, `validate` | Working local stack and publishing/action restrictions; not secure authorization | Replace fixture policy with authenticated backend checks |
| Dependency resolution | `engine.ts`: recursive `add` inside `recommend`, `validate` | Working limited ordered dependencies/dedup; hardcoded acyclic graph, no general cycle handling | Add explicit DAG/cycle validation and typed dependency semantics |
| Missing requirements/rejections | `engine.ts`: `Plan.blocked/rejected/uncovered`; `Architect.tsx` | Working local explanations; explicit onboarding alternative, no general alternative search | Reuse explainability; typed alternatives and unresolved requirements |
| Workflow visualization | `src/components/Workflow.tsx` | Working linear cards/arrows/dependency labels; not arbitrary graph; green icons may coexist with validation warnings | Adapt host UI; derive per-step validity explicitly |
| Editable plan | `Workflow.tsx`, `Architect.tsx` | Working title/config edits, remove/move earlier, optional requirement toggles/restore | Reuse editor concepts; typed action schemas and versioned draft |
| Revalidation | `engine.ts`: `validate`; `Architect.tsx` | Working local canonical action/runtime/ownership/config/dependency/coverage checks | Move authoritative checks backend; runtime schemas and adversarial tests |
| Approval/invalidation | `Architect.tsx` | Working local valid-only approval; edits clear approval/results; memory boolean only | Replace with identity-bound approval of exact plan hash/version and audit record |
| Scaffolder YAML serialization | `src/logic/generate.ts`: `generate` | Working local v1beta3 YAML using declared actions and publish output dependency | Reuse serialization/tests after schema/host integration; execute only reviewed supported templates |
| Actual skeleton files/CI/docs/config content | `generate.ts` references `./skeletons/*` | Missing; plausible references only, not executable skeletons | Author/review real templates, layouts, catalog-info/TechDocs and action contracts |
| YAML inspect/copy/download | `Architect.tsx` | Inspect verified; clipboard/download code implemented, fresh delivery unconfirmed; browser permissions apply | Adapt host code viewer/artifact/download with visible error handling |
| Execution logs/inputs/outputs | `src/logic/execution.ts`: `simulate`; `Architect.tsx` | Working local timer UI with simulated outputs; no external actions | Preserve mock adapter; replace live path with Scaffolder task event/status API |
| Failure injection/skipping | `execution.ts`: `simulate` | Working local deterministic failure; every later step skips, independent or not | Retain fixtures for tests; real error semantics/task dependencies |
| Retry/recovery | `Architect.tsx`, `execution.ts` | Working full rerun after clearing injection; no resume/rollback/external recovery | Durable task identity, idempotency and supported retry/cancellation policies |
| Outcome/artifact summary | `Architect.tsx` | Working local summaries/fake simulated:// artifacts; no actual files/repository produced | Bind to real task artifacts/status with provenance |
| Ordered local setup guide | `TaskEvidence.tsx`, `environments.ts`: `setupCommands` | Working illustrative Node/Java/Python commands; never executed | Retrieve reviewed service-specific guide; no local execution without separate authorized design |
| Task evidence checks | `src/portal/TaskEvidence.tsx`, `src/logic/evidence.ts`: `assessEvidence` | Working completeness check; three self-confirmations and permissive test regex; sample explicitly simulated | Replace verification with trusted CI/task/review evidence; retain self-report as distinct category |
| Value hypotheses | `Architect.tsx` value stage | Working assumptions/evidence/manual-step discussion, no measured ROI | Reuse framing; actual baseline/pilot measurement with consent/provenance |
| State/history | `Portal.tsx`, `Architect.tsx`, `AssistantDock.tsx`, `TaskEvidence.tsx` | Partial in-memory lifecycle only; reload loses task/evidence; no database | Versioned backend persistence; tenant/user scoping and audit retention |
| Authentication/permissions/secrets | No backend or auth module | Simulated team permissions; no real identity/security boundary; no API keys required | Implement host auth/permissions and secret handling before any external action |
| Unit tests | `src/logic/engine.test.ts`, `assistant.test.ts`, `conversation.test.ts`, `evidence.test.ts` | Working: 39 tests/4 files pass; pure logic coverage only | Port useful cases; add component, host integration, policy/security and real template tests |
| Build/dependency reproducibility | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` | Working TypeScript/Vite build; no CI/lint/coverage gate | Use host toolchain/version constraints; retain lockfile for V1 reproducibility |
| Older standalone application | `src/App.tsx` | Legacy unmounted; older workflow/value UI, not current portal | Preserve in V1 snapshot; do not migrate shell or hypothetical savings controls |
| Older AI concept/mock scanning | `src/components/Concept.tsx`, `concept.css` | Legacy unmounted; visual simulated scanning, not active discovery | Do not migrate fake scanning as integration |
| Handoff/audit evidence | `V1_HANDOFF.md`, this file, `handoff-evidence/` | Actual audit documentation and sanitized outputs; no real execution proof | Keep as V1 baseline and migration acceptance reference |

## Migration priorities

1. Confirm the real Backstage/managed Portal host contract and supported custom plugin APIs.
2. Package domain logic behind typed providers and move authoritative validation/permissions to a backend.
3. Replace fictional context with authorized catalog/docs/actions/templates; implement real reviewed skeletons.
4. Register native page/contextual UI; persist versioned drafts/approvals and connect actual Scaffolder tasks.
5. Add optional model orchestration through approved backend tools; verify outcomes with trusted evidence.

The complete source snapshot is required to inspect implementation details. This matrix does not claim any V2 integration is already built.
