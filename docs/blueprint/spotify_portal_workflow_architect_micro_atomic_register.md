# Spotify Portal AI Workflow Architect — Micro-Atomic Implementation Register

**Version:** 1.0 · **Evidence checked:** 23 October 2026 · **Status:** implementation plan, no implementation or tenant certification claimed.

**Target:** Spotify-managed Portal. Backstage is its underlying framework, not a substitute deployment target. The Architect is an advanced backend capability with thin interaction surfaces. The dashboard, contextual Ask Portal, proactive recommendations, and optional digest use the same durable planning and verification engine.

**Source preservation:** all 355 original atom IDs are retained, in their original 00–13 sections. Portal-specific wording supersedes deployment assumptions. New prefixes are additive. An ID continues to name the same intent; adaptations are recorded below. No GitHub repository is changed by this document.

## How to use this register

Each atom makes one verifiable change. Every entry supplies an ID, explicit dependency IDs, and a PASS assertion. A PASS assertion is an implementation acceptance criterion, not a present-tense test result. All tickets start `NOT_STARTED`; research records can be `UNKNOWN`, `VERIFIED`, `UNAVAILABLE`, `DENIED`, or `STALE`. Never convert an inaccessible resource into evidence of absence.

Expand each entry into the ticket schema at the end before implementation. Inherit its section input/output and safety contract, then provide exact files, test fixtures, negative test, and proof. A ticket cannot become DONE from prose, a mock response, or a screenshot alone. Use evidence at the layer claimed: unit for pure logic; contract tests for adapters; authenticated staging observations for tenant integration; independent provider reads for deliverables.

Dependencies are a conservative implementation DAG, not a runtime call sequence. Chains inside sections deliberately serialize work to make ownership and proof review explicit; independent work may be split after a reviewed DAG amendment. QA depends on functional atoms, not vice versa; write checks alongside changes rather than waiting for the QA phase. Optional or unavailable branches remain tracked as DEFERRED/BLOCKED with a reason, not falsely passed.

## Evidence and compatibility boundary

Public documentation and access to a particular tenant are different evidence classes. The following public claims were inspected on the date above; no tenant credentials, publishing tokens, private contract, enabled APIs, repository commit, or installed versions were available for this document.

| Question | Public evidence | What is still unknown / release gate |
|---|---|---|
| Can managed Portal support custom plugins? | Yes: official development documentation describes custom plugins for Portal [S1]. | Whether this tenant grants the team custom-plugin development and production publishing rights. |
| Is there a managed deployment mechanism? | New publishing documentation describes workspace releases containing compatible frontend/backend features, new framework systems, Studio testing, and publishing sources [S2]. | Tenant rollout state, exact compatible packages, runtime restrictions, network, database, scheduler, and secrets facilities. |
| Is direct installation from this GitHub URL established? | No. The documented workflow builds and publishes compatible workspace features [S2]. | Repository structure, provenance, package metadata, approval and release pipeline. A repository URL is not an installable artifact. |
| Which publishing flow applies? | New flow is gradual; its Custom Plugins tab selects that workflow [S2]. Older registry publishing is being phased out [S3]. | Inspect tenant UI with admin authorization. Do not combine flows or invent a registry URL. |
| Is an in-context chat surface available? | AiKA documents a contextual side panel and per-plugin MCP tool configuration [S4]. | Tenant enablement, safe identity propagation, allowable tools and whether the team may extend that surface. Do not claim the Architect is Spotify's native assistant. |
| Are Software Templates a Portal feature? | Official Portal comparison lists Software Templates/Scaffolder and TechDocs [S5]. | Action schemas, programmatic task creation, dry-run, cancellation, event streaming, and authorization exposed to this integration. UI presence does not establish backend API access. |
| Is a paid API or model entitlement available? | Not established. Portal is a commercial product [S5]; that does not define an API entitlement. | Contract, quotas, scopes, service-account support, allowed model, billing owner, and approved data processing. |
| Does Spotify provide an external agent integration? | Official Portal AI Plugins repository describes CLI-based catalog search and action workflows [S6]. | Installed CLI version, authenticated tenant access, exact commands and action contracts. A coding-agent plugin is not the same as a backend plugin hosted by Portal. |
| Is the referenced solution repo verified? | Web retrieval failed during this research. No contents or HEAD were certified. | Authorized read-only inventory and exact commit during REP phase. Existing local prototypes are not treated as that repository's current contents. |

Sources establish only the narrow statements cited. They are not an assurance of service availability or a promise about this implementation.

## Integration architectures and selection gate

### A — Managed Portal custom plugin, preferred when verified

A compatible workspace contains `architect-core` (pure domain logic), `architect-contracts`, a backend plugin, an optional thin frontend plugin, and adapter modules. Proposed names are design choices, not existing repository paths. Studio provides development feedback; tenant-approved publishing releases the compatible features. The backend owns sessions, snapshots, requirements, policy decisions, versioned plans, compiler outputs, approvals, attempts, evidence and analytics. State storage, jobs and secrets use only facilities proven in the target runtime.

Portal UI → authenticated backend → deterministic authorization/policy → authorized retrieval → planner → compiler/validator → immutable revision review → approval → execution adapter → independent verifier. The model proposes; the backend decides whether a request is allowed. Approvals bind tenant, actor, target, revision hash, permission scope and expiry.

Use the existing AiKA side panel through an approved MCP adapter if its identity and tool contracts pass validation. Otherwise use an approved Architect page/entity extension. Neither path assumes arbitrary global page injection or DOM access. The complete Architect review workspace remains available through the supported page or a linked companion.

### B — External Architect service with supported Portal bridge

If the tenant cannot host this backend, deploy the same domain engine in an organization-managed service with its own database, worker, secret store, audit stream, SSO and frontend. Connect through documented and entitled Portal API/MCP/CLI contracts only after contract and authorization tests. An approved Portal link, extension, or MCP registration is optional. Do not tunnel private browser cookies or rely on hidden internal endpoints.

If only a thin frontend is supported, it calls the external service through a verified identity bridge. If only MCP registration is supported, expose narrowly scoped Architect tools there and link to the external review page. A broad integration service account never supplies an ordinary user's authorization: intersect resource permissions with the user scope or deny disclosure/execution.

### C — Companion with explicit manual handoff

If no supported Portal bridge is accessible, use an external SSO companion with admin-approved, scoped catalog/docs exports. Show capture time and limitations. It still performs intake, environment reasoning, constraints, reuse-versus-create comparison, planning, editing, compiler validation, recovery guidance, saved workflow reuse and evidence tracking. Template files are reviewable exports; a human submits them through Portal's supported UI. The companion cannot silently create tasks, capture Portal page context, or verify hidden outcomes. Manual attestations remain separate from provider verification. This preserves the capabilities as tracked requirements while accurately marking automation and embedded UX unavailable until unlocked.

**Selection:** choose A only after tenant compatibility proofs; choose B when the external bridge is verified; otherwise C. Architecture changes must preserve plan IDs and evidence semantics through tested migration/export contracts. Do not build a second self-hosted Backstage instance and label it managed Portal.

## Capability preservation and definition of done

| Original capability | Retained atoms | Portal-specific treatment |
|---|---|---|
| Goal intake, confirmation and corrections | INT | Full session flow in any interaction surface. |
| Team/environment discovery with provenance | ENV | Adapter-based, scoped and freshness-aware; unknowns remain unknown. |
| Constraints and grounded alternatives | CON | Deterministic policy, authoritative sources, no invented availability. |
| Reuse versus create; dependency graph plans | PLAN | Full multi-step Architect planning, not merely question answering. |
| Review, edit, diff, approval | REV | Full review workspace, including when launched from Ask Portal. |
| Generated template YAML and validation | COMP | Version/schema locked; unsupported execution stays export-only. |
| Dry run and real workflow orchestration | EXEC | Separate capability gates; no guessed Scaffolder endpoints. |
| Failure recovery and side-effect reconciliation | REC | Immutable attempts; explicit compensation approval. |
| Deliverable evidence, analytics and ROI discipline | EVD | Task success, repo existence, catalog registration, CI and deployment are distinct. |
| Contextual assistance | CTX + ASK | Context launch and grounded answers lead into the complete Architect. |
| Durable saved workflow reuse | SAVE | Added explicit lifecycle so the original reuse analytics has a real producer. |
| Proactive workflow discovery | SUG | Permission-filtered, explained, dismissible; creates a draft only. |
| Weekly team digest | DIG | Optional opt-in, team-authorized summaries and safe return links. |

A capability can be implemented without being tenant-enabled. The release coverage matrix must track `implemented`, `verified-in-target`, `enabled`, `blocked reason` and `manual fallback` separately. Preserve uncovered requirements rather than declaring functional parity where automation is blocked.

## Phase plan and section contracts

| Phase | Sections / gate | Input → output | Exit evidence |
|---|---|---|---|
| P0 | REP, PORT, 00 | Reference + read-only repo inventory + tenant access → compatibility decision | Commit and lock inventory, entitlement ledger, chosen A/B/C; unknowns visible. |
| P1 | 01–02 | Chosen architecture → authenticated service and isolated persistence | Health, denied identity, restricted data, migration proofs. |
| P2 | 03–05 | Confirmed objective + permitted sources → immutable snapshot and constraints | Grounded discovery and critical UNKNOWN handling. |
| P3 | 06–08 | Requirements/snapshot/policy → editable plan and validated artifact | Revision invalidation, DAG, schema and approved-hash checks. |
| P4 | 09–11 | Reviewed artifact → attempt, recovery and independent outcome evidence | Dry-run and live gates separate; failure and duplication tests. |
| P5 | 12, ASK, SAVE, SUG | Permitted context → contextual full planning and reusable drafts | No write from suggestion click or question; provenance retained. |
| P6 optional | DIG | Consented team/week → reviewed or delivered digest | Consent, authorization, deduplication and unsubscribe tests. |
| P7 | AI, OPS, 13, PQA | Frozen candidate → release decision | Evaluation, operational readiness, branch-specific staging proof. |

**Shared contract:** input includes tenant ID and authenticated actor; output includes correlation ID, schema version and evidence status. Each read is authorized before disclosure, including caches and vector retrieval. Each mutation is authorized before state change. Failure returns a stable non-sensitive error and no unapproved external side effect. Unknown downstream execution outcomes require reconciliation before retry.

**Operation capabilities:** `catalog.read`, `docs.read`, `actions.discover`, `templates.schema`, `templates.export`, `tasks.preview`, `tasks.submit`, `tasks.status`, `tasks.cancel`, `mcp.bridge`, `ui.entity`, `ui.page`, `jobs.schedule`, `email.send`. Each has status, version, scope, provider, proof and expiry; one working capability never implies another. These are proposed internal contract names, not claimed Portal endpoints.

**Execution states:** DRAFT → VALIDATING → READY_FOR_REVIEW → APPROVED → QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELLED / OUTCOME_UNKNOWN. Verified outcomes have a separate state machine. Edits, changed policy, expired approval or materially changed context return the plan to review. Preview is not execution approval.

## Additional atoms — read-only baseline and Portal gates

### REP — Repository provenance and preservation

- **REP-001** — Record reference attachment SHA-256. **dependsOn:** []. → **PASS:** Reference digest and filename appear in provenance manifest.
- **REP-002** — Record referenced repository accessibility. **dependsOn:** [REP-001]. → **PASS:** Read-only fetch result records accessible or unknown without changing remote.
- **REP-003** — Pin inspected repository commit. **dependsOn:** [REP-002]. → **PASS:** Full commit SHA is recorded or repository-dependent work remains blocked.
- **REP-004** — Inventory repository packages. **dependsOn:** [REP-003]. → **PASS:** Package paths and roles are sourced from the pinned commit; no inferred backend is marked implemented.
- **REP-005** — Inventory existing capability behavior. **dependsOn:** [REP-004]. → **PASS:** Each claimed Architect behavior links to code or is labeled requirement-only.
- **REP-006** — Inventory existing test evidence. **dependsOn:** [REP-005]. → **PASS:** Each existing test claim names a run/commit or is labeled unverified.
- **REP-007** — Create original-ID coverage ledger. **dependsOn:** [REP-006]. → **PASS:** All 355 source IDs appear exactly once with original wording and Portal adaptation.
- **REP-008** — Record repository write prohibition. **dependsOn:** [REP-007]. → **PASS:** Work scope declares document-only and no remote mutations occurred.

### PORT — Managed compatibility and architecture gate

- **PORT-001** — Record tenant identity. **dependsOn:** [REP-008]. → **PASS:** Exact instance identifier is stored without credentials or unknown is explicit.
- **PORT-002** — Record tenant publishing rollout mode. **dependsOn:** [PORT-001]. → **PASS:** Admin-observed Custom Plugins availability or unknown selects no speculative publishing flow.
- **PORT-003** — Record custom backend entitlement. **dependsOn:** [PORT-002]. → **PASS:** Administrator or contract evidence states allowed scope or unknown.
- **PORT-004** — Record frontend extension entitlement. **dependsOn:** [PORT-003]. → **PASS:** Permitted page/entity slots are named or unknown.
- **PORT-005** — Record supported runtime contract. **dependsOn:** [PORT-004]. → **PASS:** Node/package/framework constraints are sourced or unknown.
- **PORT-006** — Record identity propagation contract. **dependsOn:** [PORT-005]. → **PASS:** Token audience and subject mapping contract are named or unknown.
- **PORT-007** — Record authorization delegation contract. **dependsOn:** [PORT-006]. → **PASS:** Resource authorization model is documented or integration remains fail-closed.
- **PORT-008** — Record persistence facility. **dependsOn:** [PORT-007]. → **PASS:** Supported storage and lifecycle are identified or external persistence is required.
- **PORT-009** — Record background job facility. **dependsOn:** [PORT-008]. → **PASS:** Supported scheduler contract is identified or external worker is selected.
- **PORT-010** — Record secret facility. **dependsOn:** [PORT-009]. → **PASS:** Approved credential injection facility is identified or deployment is blocked.
- **PORT-011** — Record outbound network policy. **dependsOn:** [PORT-010]. → **PASS:** Required destinations are approved or marked unavailable.
- **PORT-012** — Record catalog read entitlement. **dependsOn:** [PORT-011]. → **PASS:** Scope and authenticated staging probe are captured or unknown.
- **PORT-013** — Record documentation read entitlement. **dependsOn:** [PORT-012]. → **PASS:** Scope and authenticated staging probe are captured or unknown.
- **PORT-014** — Record template schema access. **dependsOn:** [PORT-013]. → **PASS:** Exact schema source/version is captured or compilation is export-only and unverified.
- **PORT-015** — Record action discovery access. **dependsOn:** [PORT-014]. → **PASS:** Exact supported contract and authorization proof are captured or unknown.
- **PORT-016** — Record dry-run access. **dependsOn:** [PORT-015]. → **PASS:** Independent supported preview contract is captured or unavailable.
- **PORT-017** — Record task submission access. **dependsOn:** [PORT-016]. → **PASS:** Supported submission contract is captured or live execution is unavailable.
- **PORT-018** — Record task observation access. **dependsOn:** [PORT-017]. → **PASS:** Status/events contract is captured or outcomes require manual reconciliation.
- **PORT-019** — Record AiKA/MCP integration access. **dependsOn:** [PORT-018]. → **PASS:** Registration and caller identity contract are proven or bridge disabled.
- **PORT-020** — Record model entitlement. **dependsOn:** [PORT-019]. → **PASS:** Approved provider, data terms, quota and billing owner are named or model calls disabled.
- **PORT-021** — Record email delivery entitlement. **dependsOn:** [PORT-020]. → **PASS:** Approved sender/provider scope is captured or digest delivery disabled.
- **PORT-022** — Create versioned capability ledger. **dependsOn:** [PORT-021]. → **PASS:** Each internal capability has status, proof, observation time and expiry.
- **PORT-023** — Select architecture A B or C. **dependsOn:** [PORT-022]. → **PASS:** Decision cites gates and lists retained/manual/blocked capability coverage.
- **PORT-024** — Approve integration threat model. **dependsOn:** [PORT-023]. → **PASS:** Reviewer records trust boundaries and fail-closed policy for chosen architecture.
- **PORT-025** — Freeze compatibility baseline. **dependsOn:** [PORT-024]. → **PASS:** Versioned baseline hash covers capabilities and architecture decision.

## 00 Baseline and contracts

- **BASE-001** — Record Portal runtime core compatibility version. **dependsOn:** [PORT-025]. → **PASS:** Exact vendor-supported core version or UNKNOWN recorded; never infer from a local demo.
- **BASE-002** — Record compatible frontend API version. **dependsOn:** [BASE-001]. → **PASS:** Version from approved workspace lockfile or UNKNOWN recorded.
- **BASE-003** — Record compatible backend API version. **dependsOn:** [BASE-002]. → **PASS:** Version from approved workspace lockfile or UNKNOWN recorded.
- **BASE-004** — Record available template frontend contract version. **dependsOn:** [BASE-003]. → **PASS:** Version or UNKNOWN recorded without assuming package access.
- **BASE-005** — Record available template backend contract version. **dependsOn:** [BASE-004]. → **PASS:** Version or UNKNOWN recorded without assuming server introspection.
- **BASE-006** — Record catalog adapter contract version. **dependsOn:** [BASE-005]. → **PASS:** Supported version or UNKNOWN recorded.
- **BASE-007** — Record Node.js runtime version. **dependsOn:** [BASE-006]. → **PASS:** Runtime version is recorded.
- **BASE-008** — Record package manager and lockfile type. **dependsOn:** [BASE-007]. → **PASS:** One package manager is recorded.
- **BASE-009** — Record chosen backend host architecture. **dependsOn:** [BASE-008]. → **PASS:** Managed plugin or external service matches PORT-023.
- **BASE-010** — Record authentication provider configuration. **dependsOn:** [BASE-009]. → **PASS:** Configured provider or absent state recorded.
- **BASE-011** — Record permission policy availability. **dependsOn:** [BASE-010]. → **PASS:** Active policy interface identified.
- **BASE-012** — Record source control integration kind. **dependsOn:** [BASE-011]. → **PASS:** Configured provider or absent state recorded.
- **BASE-013** — Record database engine. **dependsOn:** [BASE-012]. → **PASS:** Engine and version recorded.
- **BASE-014** — Record environment deployment mode. **dependsOn:** [BASE-013]. → **PASS:** Local staging or production recorded.
- **BASE-015** — Verify selected Architect host starts. **dependsOn:** [BASE-014]. → **PASS:** Local selected host health responds; this is not Portal deployment certification.
- **BASE-016** — Verify authorized catalog access in chosen integration mode. **dependsOn:** [BASE-015]. → **PASS:** Target read proof recorded; manual export mode explicitly identifies its capture source.
- **BASE-017** — Create capability compatibility manifest. **dependsOn:** [BASE-016]. → **PASS:** Manifest lists exact known versions and explicit unknown fields.
- **BASE-018** — Record supported task interface compatibility. **dependsOn:** [BASE-017]. → **PASS:** Documented and entitled contract named or UNAVAILABLE/UNKNOWN recorded.
- **BASE-019** — Record preview permission compatibility. **dependsOn:** [BASE-018]. → **PASS:** Independent preview policy contract or UNKNOWN recorded.
- **BASE-020** — Record package naming convention for selected host. **dependsOn:** [BASE-019]. → **PASS:** Names pass selected workspace rules without claiming tenant installability.
## 01 Plugin foundation

- **FND-001** — Create thin Architect frontend package. **dependsOn:** [BASE-020]. → **PASS:** Selected workspace resolves frontend package; managed feature uses supported frontend system.
- **FND-002** — Create Architect backend host package. **dependsOn:** [FND-001]. → **PASS:** Selected workspace resolves managed compatible backend or external host.
- **FND-003** — Export backend plugin entrypoint. **dependsOn:** [FND-002]. → **PASS:** Import resolves.
- **FND-004** — Register backend in selected host. **dependsOn:** [FND-003]. → **PASS:** Selected host initializes feature; no edit to Spotify-managed application source assumed.
- **FND-005** — Register frontend in selected interaction host. **dependsOn:** [FND-004]. → **PASS:** Supported Portal feature or companion route loads.
- **FND-006** — Declare workflow architect frontend route. **dependsOn:** [FND-005]. → **PASS:** Route resolves.
- **FND-007** — Attach route to application router. **dependsOn:** [FND-006]. → **PASS:** Navigation renders page.
- **FND-008** — Add navigation label. **dependsOn:** [FND-007]. → **PASS:** Expected label appears.
- **FND-009** — Add navigation icon. **dependsOn:** [FND-008]. → **PASS:** Icon renders.
- **FND-010** — Bind supported HTTP router dependency. **dependsOn:** [FND-009]. → **PASS:** Managed compatible router or external server router resolves.
- **FND-011** — Create GET health handler. **dependsOn:** [FND-010]. → **PASS:** GET returns 200 healthy.
- **FND-012** — Create backend API client binding. **dependsOn:** [FND-011]. → **PASS:** Client resolves approved service origin and version prefix.
- **FND-013** — Send authenticated health request to selected backend. **dependsOn:** [FND-012]. → **PASS:** Backend validates intended audience and actor; browser cookie forwarding is not assumed.
- **FND-014** — Render health error in frontend. **dependsOn:** [FND-013]. → **PASS:** Error visible without crash.
- **FND-015** — Define backend configuration schema. **dependsOn:** [FND-014]. → **PASS:** Unknown mandatory settings are rejected.
- **FND-016** — Define feature flag for real execution. **dependsOn:** [FND-015]. → **PASS:** Flag defaults disabled.
- **FND-017** — Read real execution feature flag. **dependsOn:** [FND-016]. → **PASS:** Runtime value is correct.
- **FND-018** — Block execute endpoint while flag disabled. **dependsOn:** [FND-017]. → **PASS:** POST rejected safely.
- **FND-019** — Create plugin-owned database schema. **dependsOn:** [FND-018]. → **PASS:** Tables created.
- **FND-020** — Run database migration. **dependsOn:** [FND-019]. → **PASS:** Schema version advances.
- **FND-021** — Verify persistence after backend restart. **dependsOn:** [FND-020]. → **PASS:** Saved row remains.
- **FND-022** — Register structured backend error handler. **dependsOn:** [FND-021]. → **PASS:** Errors have stable code.
- **FND-023** — Define API version prefix. **dependsOn:** [FND-022]. → **PASS:** All custom endpoints share prefix.
- **FND-024** — Define frontend loading component. **dependsOn:** [FND-023]. → **PASS:** Loading state renders.
- **FND-025** — Define frontend empty state component. **dependsOn:** [FND-024]. → **PASS:** Empty data state renders.
- **FND-026** — Define frontend fatal error boundary. **dependsOn:** [FND-025]. → **PASS:** Component failure is contained.
- **FND-027** — Create backend logger context for request IDs. **dependsOn:** [FND-026]. → **PASS:** Log contains request ID.
- **FND-028** — Return correlation ID to frontend. **dependsOn:** [FND-027]. → **PASS:** UI error displays correlation ID.
## 02 Identity authorization

- **SEC-001** — Read authenticated principal from incoming request. **dependsOn:** [FND-028]. → **PASS:** Missing principal fails closed.
- **SEC-002** — Normalize user entity reference. **dependsOn:** [SEC-001]. → **PASS:** Canonical reference returned.
- **SEC-003** — Read signed-in user's group membership. **dependsOn:** [SEC-002]. → **PASS:** Membership is available or unknown.
- **SEC-004** — Reject unauthenticated session creation. **dependsOn:** [SEC-003]. → **PASS:** Request denied.
- **SEC-005** — Authorize session read against owner. **dependsOn:** [SEC-004]. → **PASS:** Nonowner rejected.
- **SEC-006** — Authorize session edit against owner. **dependsOn:** [SEC-005]. → **PASS:** Nonowner rejected.
- **SEC-007** — Authorize team selection against membership policy. **dependsOn:** [SEC-006]. → **PASS:** Disallowed team rejected.
- **SEC-008** — Authorize entity lookup before returning data. **dependsOn:** [SEC-007]. → **PASS:** Restricted entity not disclosed.
- **SEC-009** — Authorize documentation snippet disclosure. **dependsOn:** [SEC-008]. → **PASS:** Restricted snippet excluded.
- **SEC-010** — Authorize plan creation. **dependsOn:** [SEC-009]. → **PASS:** Unauthorized request rejected.
- **SEC-011** — Authorize plan edit. **dependsOn:** [SEC-010]. → **PASS:** Unauthorized request rejected.
- **SEC-012** — Authorize plan approval. **dependsOn:** [SEC-011]. → **PASS:** Unauthorized request rejected.
- **SEC-013** — Authorize execution attempt creation. **dependsOn:** [SEC-012]. → **PASS:** Unauthorized request rejected.
- **SEC-014** — Verify actor may use proposed template. **dependsOn:** [SEC-013]. → **PASS:** Denied template blocked.
- **SEC-015** — Verify actor may execute proposed Scaffolder actions. **dependsOn:** [SEC-014]. → **PASS:** Denied action blocked.
- **SEC-016** — Reevaluate permissions before real execution. **dependsOn:** [SEC-015]. → **PASS:** Revoked actor cannot execute.
- **SEC-017** — Scrub credential patterns from logs. **dependsOn:** [SEC-016]. → **PASS:** Known secrets absent.
- **SEC-018** — Exclude raw secrets from model context. **dependsOn:** [SEC-017]. → **PASS:** Secret canary never enters prompt.
- **SEC-019** — Reject user-supplied raw API token fields. **dependsOn:** [SEC-018]. → **PASS:** Token field rejected.
- **SEC-020** — Write audit record for plan approval. **dependsOn:** [SEC-019]. → **PASS:** Actor revision and timestamp persist.
- **SEC-021** — Write audit record for execution request. **dependsOn:** [SEC-020]. → **PASS:** Execution audit entry persists.
- **SEC-022** — Enforce maximum session query page size. **dependsOn:** [SEC-021]. → **PASS:** Oversized page request rejected.
- **SEC-023** — Deny cross-team session reads. **dependsOn:** [SEC-022]. → **PASS:** Unauthorized team data not returned.
- **SEC-024** — Deny access to unapproved generated YAML from another user. **dependsOn:** [SEC-023]. → **PASS:** YAML not returned.
- **SEC-025** — Reject retrieved document instructions as authority. **dependsOn:** [SEC-024]. → **PASS:** Document cannot grant permissions.
## 03 Intake

- **INT-001** — Allocate unique session identifier. **dependsOn:** [SEC-025]. → **PASS:** Two sessions have different IDs.
- **INT-002** — Store session owner reference. **dependsOn:** [INT-001]. → **PASS:** Saved owner matches user.
- **INT-003** — Store session team reference. **dependsOn:** [INT-002]. → **PASS:** Team reference persists.
- **INT-004** — Store original objective text. **dependsOn:** [INT-003]. → **PASS:** Original bytes preserved.
- **INT-005** — Reject blank objective. **dependsOn:** [INT-004]. → **PASS:** Validation error shown.
- **INT-006** — Enforce maximum objective length. **dependsOn:** [INT-005]. → **PASS:** Oversized text rejected.
- **INT-007** — Trim leading and trailing whitespace in canonical objective. **dependsOn:** [INT-006]. → **PASS:** Canonical value normalized.
- **INT-008** — Store user-provided project type. **dependsOn:** [INT-007]. → **PASS:** Field persists.
- **INT-009** — Store user-requested technology. **dependsOn:** [INT-008]. → **PASS:** Technology persists.
- **INT-010** — Store each explicitly requested outcome separately. **dependsOn:** [INT-009]. → **PASS:** Outcome list count correct.
- **INT-011** — Classify new versus existing service intent. **dependsOn:** [INT-010]. → **PASS:** Intent enum returned.
- **INT-012** — Mark AI-extracted requirement as inferred. **dependsOn:** [INT-011]. → **PASS:** Confirmation flag false.
- **INT-013** — Capture source of each requirement. **dependsOn:** [INT-012]. → **PASS:** Source field present.
- **INT-014** — Capture developer correction to requirement. **dependsOn:** [INT-013]. → **PASS:** Revision records correction.
- **INT-015** — Mark corrected requirement as confirmed. **dependsOn:** [INT-014]. → **PASS:** Confirmed field true.
- **INT-016** — Generate one missing-information question. **dependsOn:** [INT-015]. → **PASS:** Question has targeted missing field.
- **INT-017** — Save answer to missing-information question. **dependsOn:** [INT-016]. → **PASS:** Required field updated.
- **INT-018** — Reject malformed requirements JSON. **dependsOn:** [INT-017]. → **PASS:** Schema error returned.
- **INT-019** — Return requirements summary to UI. **dependsOn:** [INT-018]. → **PASS:** Stored fields appear accurately.
- **INT-020** — Require explicit confirmation of requirements. **dependsOn:** [INT-019]. → **PASS:** Unconfirmed session cannot advance.
- **INT-021** — Record confirmation timestamp. **dependsOn:** [INT-020]. → **PASS:** Timestamp persisted.
- **INT-022** — Mark intent changed after confirmation. **dependsOn:** [INT-021]. → **PASS:** Confirmation invalidated.
- **INT-023** — Avoid creating duplicate session on repeated submit. **dependsOn:** [INT-022]. → **PASS:** Idempotency key returns same session.
## 04 Environment discovery

- **ENV-001** — Resolve selected Group catalog entity. **dependsOn:** [INT-023, SEC-008]. → **PASS:** Correct group entity returned.
- **ENV-002** — Handle missing Group entity. **dependsOn:** [ENV-001, SEC-008]. → **PASS:** NOT_FOUND returned.
- **ENV-003** — Extract Group member references. **dependsOn:** [ENV-002, SEC-008]. → **PASS:** References normalized.
- **ENV-004** — Query components with ownership relation. **dependsOn:** [ENV-003, SEC-008]. → **PASS:** Authorized components returned.
- **ENV-005** — Normalize component entity reference. **dependsOn:** [ENV-004, SEC-008]. → **PASS:** Canonical ref returned.
- **ENV-006** — Retrieve component by exact reference. **dependsOn:** [ENV-005, SEC-008]. → **PASS:** Correct entity returned.
- **ENV-007** — Handle unavailable catalog service. **dependsOn:** [ENV-006, SEC-008]. → **PASS:** Dependency error returned.
- **ENV-008** — Extract metadata name from component. **dependsOn:** [ENV-007, SEC-008]. → **PASS:** Name returned.
- **ENV-009** — Extract component kind. **dependsOn:** [ENV-008, SEC-008]. → **PASS:** Kind returned.
- **ENV-010** — Extract component type when present. **dependsOn:** [ENV-009, SEC-008]. → **PASS:** Type or unknown returned.
- **ENV-011** — Extract component lifecycle when present. **dependsOn:** [ENV-010, SEC-008]. → **PASS:** Lifecycle or unknown returned.
- **ENV-012** — Extract component owner reference. **dependsOn:** [ENV-011, SEC-008]. → **PASS:** Owner or unknown returned.
- **ENV-013** — Extract declared dependsOn relationships. **dependsOn:** [ENV-012, SEC-008]. → **PASS:** Dependency refs returned.
- **ENV-014** — Extract reverse dependency relationships. **dependsOn:** [ENV-013, SEC-008]. → **PASS:** Dependent refs returned.
- **ENV-015** — Extract source location annotation. **dependsOn:** [ENV-014, SEC-008]. → **PASS:** Location or unknown returned.
- **ENV-016** — Extract repository annotation. **dependsOn:** [ENV-015, SEC-008]. → **PASS:** Repository or unknown returned.
- **ENV-017** — Query related API entities. **dependsOn:** [ENV-016, SEC-008]. → **PASS:** Accessible API refs returned.
- **ENV-018** — List authorized Template entities. **dependsOn:** [ENV-017, SEC-008]. → **PASS:** Template refs returned.
- **ENV-019** — Read Template entity details. **dependsOn:** [ENV-018, SEC-008]. → **PASS:** Template metadata returned.
- **ENV-020** — Filter templates by declared template type. **dependsOn:** [ENV-019, SEC-008]. → **PASS:** Correct subset returned.
- **ENV-021** — Filter templates by user permission. **dependsOn:** [ENV-020, SEC-008]. → **PASS:** Forbidden templates excluded.
- **ENV-022** — Detect supported action discovery interface. **dependsOn:** [ENV-021, SEC-008]. → **PASS:** Entitled contract resolved or explicitly unavailable; no endpoint guessing.
- **ENV-023** — Query actions through verified adapter. **dependsOn:** [ENV-022, SEC-008]. → **PASS:** Actual identifiers carry source version; unavailable interface returns capability error.
- **ENV-024** — Store action schema for each returned action. **dependsOn:** [ENV-023, SEC-008]. → **PASS:** Input schema attached to ID.
- **ENV-025** — Store action output schema if exposed. **dependsOn:** [ENV-024, SEC-008]. → **PASS:** Output schema or unknown recorded.
- **ENV-026** — Mark undocumented action outputs unknown. **dependsOn:** [ENV-025, SEC-008]. → **PASS:** No fabricated output schema.
- **ENV-027** — Resolve repository provider configuration. **dependsOn:** [ENV-026, SEC-008]. → **PASS:** Provider or unknown recorded.
- **ENV-028** — Resolve approved template asset location. **dependsOn:** [ENV-027, SEC-008]. → **PASS:** Asset ref captured.
- **ENV-029** — Fetch accessible TechDocs content. **dependsOn:** [ENV-028, SEC-008]. → **PASS:** Content with source returned.
- **ENV-030** — Handle unavailable TechDocs source. **dependsOn:** [ENV-029, SEC-008]. → **PASS:** Source marked unavailable.
- **ENV-031** — Check documentation access restriction. **dependsOn:** [ENV-030, SEC-008]. → **PASS:** Restricted text excluded.
- **ENV-032** — Store source URI for every retrieved fact. **dependsOn:** [ENV-031, SEC-008]. → **PASS:** Fact has provenance.
- **ENV-033** — Store capture timestamp for retrieved fact. **dependsOn:** [ENV-032, SEC-008]. → **PASS:** Timestamp present.
- **ENV-034** — Store evidence status verified versus inferred. **dependsOn:** [ENV-033, SEC-008]. → **PASS:** Status present.
- **ENV-035** — Mark inaccessible external infrastructure as unknown. **dependsOn:** [ENV-034, SEC-008]. → **PASS:** No false unsupported status.
- **ENV-036** — Create immutable environment snapshot identifier. **dependsOn:** [ENV-035, SEC-008]. → **PASS:** Unique snapshot exists.
- **ENV-037** — Persist snapshot source versions. **dependsOn:** [ENV-036, SEC-008]. → **PASS:** Version metadata stored.
- **ENV-038** — Refresh snapshot on explicit command. **dependsOn:** [ENV-037, SEC-008]. → **PASS:** New ID and timestamp returned.
- **ENV-039** — Flag stale snapshot after configured age. **dependsOn:** [ENV-038, SEC-008]. → **PASS:** Staleness boolean true.
- **ENV-040** — Prevent other user's private context from retrieval. **dependsOn:** [ENV-039, SEC-008]. → **PASS:** Tenant isolation test passes.
## 05 Constraints

- **CON-001** — Load configured team technology policy. **dependsOn:** [ENV-040]. → **PASS:** Policy or UNKNOWN returned.
- **CON-002** — Parse approved language identifiers. **dependsOn:** [CON-001]. → **PASS:** Normalized language set returned.
- **CON-003** — Compare requested language with allowed set. **dependsOn:** [CON-002]. → **PASS:** ALLOW DENY or UNKNOWN returned.
- **CON-004** — Compare requested runtime with allowed runtime set. **dependsOn:** [CON-003]. → **PASS:** Result returned.
- **CON-005** — Check selected template exists in accessible catalog. **dependsOn:** [CON-004]. → **PASS:** Missing template is blocked.
- **CON-006** — Check selected action exists in installed action list. **dependsOn:** [CON-005]. → **PASS:** Unknown action blocked.
- **CON-007** — Validate required action input names. **dependsOn:** [CON-006]. → **PASS:** Missing names identified.
- **CON-008** — Validate known required integrations. **dependsOn:** [CON-007]. → **PASS:** Absent verified integration blocked.
- **CON-009** — Mark unverified integration UNKNOWN. **dependsOn:** [CON-008]. → **PASS:** No assumption of availability.
- **CON-010** — Validate output dependency source exists. **dependsOn:** [CON-009]. → **PASS:** Unresolved output flagged.
- **CON-011** — Normalize repository name against policy. **dependsOn:** [CON-010]. → **PASS:** Invalid name rejected.
- **CON-012** — Check required approval policy. **dependsOn:** [CON-011]. → **PASS:** Required approver set returned.
- **CON-013** — Mark blocker as hard or advisory. **dependsOn:** [CON-012]. → **PASS:** Severity assigned.
- **CON-014** — Preserve authoritative rule source. **dependsOn:** [CON-013]. → **PASS:** Source identifier stored.
- **CON-015** — Propose an approved substitute technology. **dependsOn:** [CON-014]. → **PASS:** Substitute backed by source.
- **CON-016** — Return NO_ALTERNATIVE when none verified. **dependsOn:** [CON-015]. → **PASS:** No invented proposal.
- **CON-017** — Invalidate prior validation after changed requirement. **dependsOn:** [CON-016]. → **PASS:** Validation becomes stale.
- **CON-018** — Reject plan release with hard blockers. **dependsOn:** [CON-017]. → **PASS:** Release denied.
- **CON-019** — Ask user to resolve critical UNKNOWN. **dependsOn:** [CON-018]. → **PASS:** Clarification rendered.
- **CON-020** — Record timestamp of constraint evaluation. **dependsOn:** [CON-019]. → **PASS:** Result has timestamp.
## 06 Planning

- **PLAN-001** — Enumerate existing service candidates. **dependsOn:** [CON-020]. → **PASS:** Candidate refs returned.
- **PLAN-002** — Score candidate service relevance with reasons. **dependsOn:** [PLAN-001]. → **PASS:** Reason attached per candidate.
- **PLAN-003** — Form reuse option. **dependsOn:** [PLAN-002]. → **PASS:** Reuse option has existing entity ref.
- **PLAN-004** — Form create-new option. **dependsOn:** [PLAN-003]. → **PASS:** Create option has template candidate.
- **PLAN-005** — Compare reuse and create alternatives. **dependsOn:** [PLAN-004]. → **PASS:** Comparison contains both when valid.
- **PLAN-006** — Choose one proposed approach. **dependsOn:** [PLAN-005]. → **PASS:** Approach enum returned.
- **PLAN-007** — Record rejected option reason. **dependsOn:** [PLAN-006]. → **PASS:** Explanation persists.
- **PLAN-008** — Allocate plan identifier. **dependsOn:** [PLAN-007]. → **PASS:** Unique ID created.
- **PLAN-009** — Associate plan with intent ID. **dependsOn:** [PLAN-008]. → **PASS:** Relationship stored.
- **PLAN-010** — Associate plan with snapshot ID. **dependsOn:** [PLAN-009]. → **PASS:** Relationship stored.
- **PLAN-011** — Allocate step identifier. **dependsOn:** [PLAN-010]. → **PASS:** Unique within plan.
- **PLAN-012** — Specify operation type for step. **dependsOn:** [PLAN-011]. → **PASS:** Operation identifier present.
- **PLAN-013** — Distinguish manual step from Scaffolder step. **dependsOn:** [PLAN-012]. → **PASS:** Execution mode explicit.
- **PLAN-014** — Attach validated action ID to automated step. **dependsOn:** [PLAN-013]. → **PASS:** Installed action ID present.
- **PLAN-015** — Attach typed input map to step. **dependsOn:** [PLAN-014]. → **PASS:** Inputs pass contract.
- **PLAN-016** — Declare step expected output keys. **dependsOn:** [PLAN-015]. → **PASS:** Output list explicit.
- **PLAN-017** — Add dependency edge between steps. **dependsOn:** [PLAN-016]. → **PASS:** Edge stored.
- **PLAN-018** — Reject edge pointing to missing step. **dependsOn:** [PLAN-017]. → **PASS:** Validation fails.
- **PLAN-019** — Reject dependency cycle. **dependsOn:** [PLAN-018]. → **PASS:** Cycle detected.
- **PLAN-020** — Topologically sort automated steps. **dependsOn:** [PLAN-019]. → **PASS:** Prerequisite comes first.
- **PLAN-021** — Mark optional step. **dependsOn:** [PLAN-020]. → **PASS:** Optional flag present.
- **PLAN-022** — Record reason for step inclusion. **dependsOn:** [PLAN-021]. → **PASS:** Reason nonblank.
- **PLAN-023** — Attach evidence to recommendation. **dependsOn:** [PLAN-022]. → **PASS:** At least one source or assumption flag.
- **PLAN-024** — Mark side-effect class for operation. **dependsOn:** [PLAN-023]. → **PASS:** read write destructive or unknown.
- **PLAN-025** — Mark dangerous unknown side effects as requiring review. **dependsOn:** [PLAN-024]. → **PASS:** Gate set.
- **PLAN-026** — Identify unsatisfied prerequisite. **dependsOn:** [PLAN-025]. → **PASS:** Blocker present.
- **PLAN-027** — Mark unsupported action as guidance-only. **dependsOn:** [PLAN-026]. → **PASS:** No executable representation fabricated.
- **PLAN-028** — Reject AI output outside plan schema. **dependsOn:** [PLAN-027]. → **PASS:** Structured error returned.
- **PLAN-029** — Reject generated action ID outside allowlist. **dependsOn:** [PLAN-028]. → **PASS:** Plan not accepted.
- **PLAN-030** — Record planner model identifier. **dependsOn:** [PLAN-029]. → **PASS:** Model identifier stored.
- **PLAN-031** — Record planner prompt configuration revision. **dependsOn:** [PLAN-030]. → **PASS:** Prompt revision stored.
- **PLAN-032** — Save immutable plan revision. **dependsOn:** [PLAN-031]. → **PASS:** Previous revision remains unchanged.
- **PLAN-033** — Classify entire plan as executable partial or guidance. **dependsOn:** [PLAN-032]. → **PASS:** Classification returned.
- **PLAN-034** — Record uncovered developer requirement. **dependsOn:** [PLAN-033]. → **PASS:** Gap list includes requirement.
- **PLAN-035** — Require deterministic policy evaluation after planning. **dependsOn:** [PLAN-034]. → **PASS:** Planning cannot self-approve.
## 07 Editing approval

- **REV-001** — Render every plan step in order. **dependsOn:** [PLAN-035]. → **PASS:** Visible count matches plan.
- **REV-002** — Show selected step input values. **dependsOn:** [REV-001]. → **PASS:** Values match revision.
- **REV-003** — Show selected step expected outputs. **dependsOn:** [REV-002]. → **PASS:** Outputs match revision.
- **REV-004** — Show selected step dependencies. **dependsOn:** [REV-003]. → **PASS:** Dependency list matches graph.
- **REV-005** — Show each step reason. **dependsOn:** [REV-004]. → **PASS:** Reason displayed.
- **REV-006** — Update editable input value. **dependsOn:** [REV-005]. → **PASS:** New value in draft.
- **REV-007** — Reject input outside action schema. **dependsOn:** [REV-006]. → **PASS:** Inline validation error.
- **REV-008** — Remove optional step without dependents. **dependsOn:** [REV-007]. → **PASS:** Step absent from next revision.
- **REV-009** — Reject deletion of required producer step. **dependsOn:** [REV-008]. → **PASS:** Action blocked.
- **REV-010** — Insert supported step. **dependsOn:** [REV-009]. → **PASS:** Step assigned ID.
- **REV-011** — Reorder independent steps. **dependsOn:** [REV-010]. → **PASS:** Valid new order saved.
- **REV-012** — Reject invalid dependency reorder. **dependsOn:** [REV-011]. → **PASS:** Save prevented.
- **REV-013** — Save revision with optimistic version check. **dependsOn:** [REV-012]. → **PASS:** Stale update conflicts.
- **REV-014** — Show revision-to-revision diff. **dependsOn:** [REV-013]. → **PASS:** Changes enumerated.
- **REV-015** — Undo local unsaved edit. **dependsOn:** [REV-014]. → **PASS:** Draft restored.
- **REV-016** — Re-run validation after edit. **dependsOn:** [REV-015]. → **PASS:** New report linked.
- **REV-017** — Invalidate approval on material edit. **dependsOn:** [REV-016]. → **PASS:** Approval no longer valid.
- **REV-018** — Record approval actor reference. **dependsOn:** [REV-017]. → **PASS:** Actor persisted.
- **REV-019** — Record approval plan hash. **dependsOn:** [REV-018]. → **PASS:** Hash persisted.
- **REV-020** — Record approval timestamp. **dependsOn:** [REV-019]. → **PASS:** Timestamp persisted.
- **REV-021** — Reject approval with blocking errors. **dependsOn:** [REV-020]. → **PASS:** Approval refused.
- **REV-022** — Reject approval by unauthorized actor. **dependsOn:** [REV-021]. → **PASS:** Approval refused.
- **REV-023** — Reject execution with mismatched approved hash. **dependsOn:** [REV-022]. → **PASS:** Execution refused.
## 08 Compilation validation

- **COMP-001** — Check plan is eligible for compilation. **dependsOn:** [REV-023, PORT-014, PORT-015]. → **PASS:** Invalid plan refused.
- **COMP-002** — Set Template apiVersion from compatible version. **dependsOn:** [COMP-001, PORT-014, PORT-015]. → **PASS:** Correct value serialized.
- **COMP-003** — Set Template kind to Template. **dependsOn:** [COMP-002, PORT-014, PORT-015]. → **PASS:** Kind field correct.
- **COMP-004** — Generate safe template metadata name. **dependsOn:** [COMP-003, PORT-014, PORT-015]. → **PASS:** Name passes normalization.
- **COMP-005** — Generate template title. **dependsOn:** [COMP-004, PORT-014, PORT-015]. → **PASS:** Title nonblank.
- **COMP-006** — Assign template owner. **dependsOn:** [COMP-005, PORT-014, PORT-015]. → **PASS:** Owner reference valid.
- **COMP-007** — Assign template type. **dependsOn:** [COMP-006, PORT-014, PORT-015]. → **PASS:** Type present.
- **COMP-008** — Generate parameters schema. **dependsOn:** [COMP-007, PORT-014, PORT-015]. → **PASS:** Schema validates.
- **COMP-009** — Mark required parameters. **dependsOn:** [COMP-008, PORT-014, PORT-015]. → **PASS:** required array correct.
- **COMP-010** — Generate one Scaffolder step per supported operation. **dependsOn:** [COMP-009, PORT-014, PORT-015]. → **PASS:** Count matches operations.
- **COMP-011** — Map operation to registered Scaffolder action ID. **dependsOn:** [COMP-010, PORT-014, PORT-015]. → **PASS:** Exact ID used.
- **COMP-012** — Generate schema-compliant action input object. **dependsOn:** [COMP-011, PORT-014, PORT-015]. → **PASS:** Inputs validate.
- **COMP-013** — Generate expression for preceding step output. **dependsOn:** [COMP-012, PORT-014, PORT-015]. → **PASS:** Expression references known step.
- **COMP-014** — Reject unknown output expression. **dependsOn:** [COMP-013, PORT-014, PORT-015]. → **PASS:** Compile error returned.
- **COMP-015** — Avoid minus-containing step IDs in dot-notation expressions. **dependsOn:** [COMP-014, PORT-014, PORT-015]. → **PASS:** Expression uses safe form.
- **COMP-016** — Resolve approved skeleton asset source. **dependsOn:** [COMP-015, PORT-014, PORT-015]. → **PASS:** Asset exists.
- **COMP-017** — Generate fetch:template step only when needed. **dependsOn:** [COMP-016, PORT-014, PORT-015]. → **PASS:** No redundant fetch step.
- **COMP-018** — Generate publish action only with authorized repository target. **dependsOn:** [COMP-017, PORT-014, PORT-015]. → **PASS:** Target restricted.
- **COMP-019** — Generate catalog register action when requested and supported. **dependsOn:** [COMP-018, PORT-014, PORT-015]. → **PASS:** Correct registration step emitted.
- **COMP-020** — Emit output links only for produced outputs. **dependsOn:** [COMP-019, PORT-014, PORT-015]. → **PASS:** No dangling link.
- **COMP-021** — Separate manual tasks from executable Scaffolder YAML. **dependsOn:** [COMP-020, PORT-014, PORT-015]. → **PASS:** Manual task not emitted as fake action.
- **COMP-022** — Serialize generated document as YAML. **dependsOn:** [COMP-021, PORT-014, PORT-015]. → **PASS:** Parser accepts YAML.
- **COMP-023** — Validate YAML parses back to expected object. **dependsOn:** [COMP-022, PORT-014, PORT-015]. → **PASS:** Roundtrip equivalent.
- **COMP-024** — Validate Template top-level schema. **dependsOn:** [COMP-023, PORT-014, PORT-015]. → **PASS:** Schema passes.
- **COMP-025** — Validate unique step IDs. **dependsOn:** [COMP-024, PORT-014, PORT-015]. → **PASS:** Duplicates rejected.
- **COMP-026** — Validate all action IDs against installed Scaffolder actions. **dependsOn:** [COMP-025, PORT-014, PORT-015]. → **PASS:** Unknown action rejected.
- **COMP-027** — Validate every required action input. **dependsOn:** [COMP-026, PORT-014, PORT-015]. → **PASS:** Missing input identified.
- **COMP-028** — Validate output reference producer. **dependsOn:** [COMP-027, PORT-014, PORT-015]. → **PASS:** Missing producer rejected.
- **COMP-029** — Validate template asset existence. **dependsOn:** [COMP-028, PORT-014, PORT-015]. → **PASS:** Missing asset rejected.
- **COMP-030** — Validate catalog metadata format. **dependsOn:** [COMP-029, PORT-014, PORT-015]. → **PASS:** Invalid entity rejected.
- **COMP-031** — Validate integration prerequisites. **dependsOn:** [COMP-030, PORT-014, PORT-015]. → **PASS:** Missing integration reported.
- **COMP-032** — Validate user task permissions. **dependsOn:** [COMP-031, PORT-014, PORT-015]. → **PASS:** Unauthorized release blocked.
- **COMP-033** — Compute content hash of generated YAML. **dependsOn:** [COMP-032, PORT-014, PORT-015]. → **PASS:** Stable hash recorded.
- **COMP-034** — Store YAML with immutable plan revision. **dependsOn:** [COMP-033, PORT-014, PORT-015]. → **PASS:** Correct association persists.
- **COMP-035** — Produce step-specific validation errors. **dependsOn:** [COMP-034, PORT-014, PORT-015]. → **PASS:** Message includes step ID.
- **COMP-036** — Produce readable validation report. **dependsOn:** [COMP-035, PORT-014, PORT-015]. → **PASS:** Per-check status displayed.
## 09 Dry run and execution

- **EXEC-001** — Detect supported template preview interface. **dependsOn:** [COMP-036, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Independent capability record states availability; CLI publication dry-run is not template preview.
- **EXEC-002** — Check caller dry-run permission. **dependsOn:** [EXEC-001, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Unauthorized request blocked.
- **EXEC-003** — Check caller task creation permission. **dependsOn:** [EXEC-002, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Unauthorized request blocked.
- **EXEC-004** — Check applicable action execution permissions. **dependsOn:** [EXEC-003, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Forbidden action blocked.
- **EXEC-005** — Submit candidate template to dry-run endpoint. **dependsOn:** [EXEC-004, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Dry-run response received.
- **EXEC-006** — Capture dry-run generated file paths. **dependsOn:** [EXEC-005, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Paths listed.
- **EXEC-007** — Capture dry-run step logs. **dependsOn:** [EXEC-006, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Logs linked to step IDs.
- **EXEC-008** — Redact dry-run logs. **dependsOn:** [EXEC-007, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Secret canary not shown.
- **EXEC-009** — Mark unsupported dry-run action as unverified. **dependsOn:** [EXEC-008, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** No false pass.
- **EXEC-010** — Distinguish dry-run success from live success. **dependsOn:** [EXEC-009, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** UI wording accurate.
- **EXEC-011** — Require approved revision for execution. **dependsOn:** [EXEC-010, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Draft request rejected.
- **EXEC-012** — Revalidate execution permission at submission. **dependsOn:** [EXEC-011, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Revoked actor rejected.
- **EXEC-013** — Verify environment snapshot freshness. **dependsOn:** [EXEC-012, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Stale inputs blocked or revalidated.
- **EXEC-014** — Check live execution feature flag. **dependsOn:** [EXEC-013, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Disabled mode blocked.
- **EXEC-015** — Allocate immutable execution attempt ID. **dependsOn:** [EXEC-014, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Attempt persisted.
- **EXEC-016** — Persist request idempotency key. **dependsOn:** [EXEC-015, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Duplicate submission recognized.
- **EXEC-017** — Reject conflicting idempotency payload. **dependsOn:** [EXEC-016, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Conflict response returned.
- **EXEC-018** — Submit workflow through verified execution adapter. **dependsOn:** [EXEC-017, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Authorized supported task interface returns task ID; otherwise capability error with no submission.
- **EXEC-019** — Persist provider task identifier. **dependsOn:** [EXEC-018, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Provider reference and adapter type stored; never fabricate Scaffolder ID.
- **EXEC-020** — Poll or subscribe to task status. **dependsOn:** [EXEC-019, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Updates received.
- **EXEC-021** — Link task event to step ID. **dependsOn:** [EXEC-020, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Step association correct.
- **EXEC-022** — Persist step progress events. **dependsOn:** [EXEC-021, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Events reload.
- **EXEC-023** — Recover task status after connection interruption. **dependsOn:** [EXEC-022, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Latest status retrieved.
- **EXEC-024** — Display task outputs. **dependsOn:** [EXEC-023, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Declared links shown.
- **EXEC-025** — Record provider task terminal outcome. **dependsOn:** [EXEC-024, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Success failure cancel or unknown reflects provider evidence.
- **EXEC-026** — Do not claim application deployment from repository creation. **dependsOn:** [EXEC-025, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Outcome remains unverified.
- **EXEC-027** — Scrub execution logs of secrets. **dependsOn:** [EXEC-026, PORT-016, PORT-017, PORT-018, SEC-016]. → **PASS:** Canary absent.
## 10 Recovery

- **REC-001** — Identify first failed task step. **dependsOn:** [EXEC-027]. → **PASS:** Failed step ID stored.
- **REC-002** — Capture error category. **dependsOn:** [REC-001]. → **PASS:** Category enum stored.
- **REC-003** — Sanitize error detail. **dependsOn:** [REC-002]. → **PASS:** Secret omitted.
- **REC-004** — List downstream blocked steps. **dependsOn:** [REC-003]. → **PASS:** Dependents returned.
- **REC-005** — Record confirmed completed side effects. **dependsOn:** [REC-004]. → **PASS:** Resource IDs stored.
- **REC-006** — Mark uncertain side effects UNKNOWN. **dependsOn:** [REC-005]. → **PASS:** No assumption of nonexistence.
- **REC-007** — Check retry eligibility from operation metadata. **dependsOn:** [REC-006]. → **PASS:** Boolean with reason returned.
- **REC-008** — Disallow blind reexecution of non-idempotent step. **dependsOn:** [REC-007]. → **PASS:** Retry rejected.
- **REC-009** — Detect already-created repository through authorized read. **dependsOn:** [REC-008]. → **PASS:** Existence result returned.
- **REC-010** — Propose recovery step without executing it. **dependsOn:** [REC-009]. → **PASS:** Plan shown for review.
- **REC-011** — Record authorization of proposed recovery. **dependsOn:** [REC-010]. → **PASS:** Actor and scope stored.
- **REC-012** — Create new recovery attempt ID. **dependsOn:** [REC-011]. → **PASS:** Original attempt immutable.
- **REC-013** — Persist recovery-to-parent relationship. **dependsOn:** [REC-012]. → **PASS:** Parent ID saved.
- **REC-014** — Record compensating cleanup request. **dependsOn:** [REC-013]. → **PASS:** Audit entry stored.
- **REC-015** — Verify compensating action result. **dependsOn:** [REC-014]. → **PASS:** Evidence attached.
- **REC-016** — Mark unresolved failure for human escalation. **dependsOn:** [REC-015]. → **PASS:** Status set needs-review.
## 11 Evidence analytics

- **EVD-001** — Define acceptance criterion for expected repository. **dependsOn:** [REC-016]. → **PASS:** Criterion saved.
- **EVD-002** — Define acceptance criterion for catalog registration. **dependsOn:** [EVD-001]. → **PASS:** Criterion saved.
- **EVD-003** — Define acceptance criterion for CI pipeline status. **dependsOn:** [EVD-002]. → **PASS:** Criterion saved.
- **EVD-004** — Identify verifier for each criterion. **dependsOn:** [EVD-003]. → **PASS:** Verifier ref stored.
- **EVD-005** — Verify repository exists through approved provider. **dependsOn:** [EVD-004]. → **PASS:** Result with timestamp saved.
- **EVD-006** — Verify registered catalog entity exists. **dependsOn:** [EVD-005]. → **PASS:** Result with timestamp saved.
- **EVD-007** — Verify pipeline exists where provider supports it. **dependsOn:** [EVD-006]. → **PASS:** Result or UNKNOWN saved.
- **EVD-008** — Record production deployment only when independently verified. **dependsOn:** [EVD-007]. → **PASS:** No inferred deployment status.
- **EVD-009** — Store evidence source and observation time. **dependsOn:** [EVD-008]. → **PASS:** Provenance persists.
- **EVD-010** — Mark manual developer claim separately from verified result. **dependsOn:** [EVD-009]. → **PASS:** Evidence type visible.
- **EVD-011** — Flag evidence exceeding freshness threshold. **dependsOn:** [EVD-010]. → **PASS:** Stale flag true.
- **EVD-012** — Link evidence record to workflow step. **dependsOn:** [EVD-011]. → **PASS:** Step relation correct.
- **EVD-013** — Compute verified outcome completion. **dependsOn:** [EVD-012]. → **PASS:** All required criteria evaluated.
- **EVD-014** — Compute partial completion state. **dependsOn:** [EVD-013]. → **PASS:** Incomplete criteria listed.
- **EVD-015** — Emit session-start analytics event. **dependsOn:** [EVD-014]. → **PASS:** Event persisted once.
- **EVD-016** — Emit plan-validation event. **dependsOn:** [EVD-015]. → **PASS:** Event persisted once.
- **EVD-017** — Emit execution-success event. **dependsOn:** [EVD-016]. → **PASS:** Event tied to task.
- **EVD-018** — Emit verified-deliverable event. **dependsOn:** [EVD-017]. → **PASS:** Event tied to evidence.
- **EVD-019** — Emit saved-workflow-reuse event. **dependsOn:** [EVD-018]. → **PASS:** Reuse context attached.
- **EVD-020** — Exclude synthetic test actors from aggregate metrics. **dependsOn:** [EVD-019]. → **PASS:** Demo events excluded.
- **EVD-021** — Calculate started-to-verified conversion denominator. **dependsOn:** [EVD-020]. → **PASS:** Denominator defined.
- **EVD-022** — Calculate verified completion rate. **dependsOn:** [EVD-021]. → **PASS:** Numerator documented.
- **EVD-023** — Collect optional usefulness feedback. **dependsOn:** [EVD-022]. → **PASS:** Feedback saved.
- **EVD-024** — Label projected saving as estimate. **dependsOn:** [EVD-023]. → **PASS:** Report label correct.
- **EVD-025** — Avoid unproven ROI claim. **dependsOn:** [EVD-024]. → **PASS:** No claimed measured impact without observations.
- **EVD-026** — Enforce aggregation access controls. **dependsOn:** [EVD-025]. → **PASS:** Unauthorized viewer denied.
## 12 Contextual assistance

- **CTX-001** — Register Ask Portal launch in approved surface. **dependsOn:** [EVD-026, PORT-004, SEC-009]. → **PASS:** Verified entity slot launches assistant, or companion launch is explicitly labeled as fallback.
- **CTX-002** — Obtain current entity reference. **dependsOn:** [CTX-001, PORT-004, SEC-009]. → **PASS:** Correct reference captured.
- **CTX-003** — Open session with entity preselection. **dependsOn:** [CTX-002, PORT-004, SEC-009]. → **PASS:** Entity context saved.
- **CTX-004** — Fetch readable entity metadata. **dependsOn:** [CTX-003, PORT-004, SEC-009]. → **PASS:** Accessible fields returned.
- **CTX-005** — Fetch authorized documentation snippets. **dependsOn:** [CTX-004, PORT-004, SEC-009]. → **PASS:** Snippets have citations.
- **CTX-006** — Ask a contextual question. **dependsOn:** [CTX-005, PORT-004, SEC-009]. → **PASS:** Message persisted.
- **CTX-007** — Classify ask as explain diagnose or plan. **dependsOn:** [CTX-006, PORT-004, SEC-009]. → **PASS:** Mode selected.
- **CTX-008** — Return grounded answer with evidence references. **dependsOn:** [CTX-007, PORT-004, SEC-009]. → **PASS:** References present.
- **CTX-009** — Mark answer uncertainty when evidence absent. **dependsOn:** [CTX-008, PORT-004, SEC-009]. → **PASS:** Unknown stated.
- **CTX-010** — Reject model-proposed write without approval. **dependsOn:** [CTX-009, PORT-004, SEC-009]. → **PASS:** No external side effect.
- **CTX-011** — Turn suggested manual action into saved task. **dependsOn:** [CTX-010, PORT-004, SEC-009]. → **PASS:** Task stored.
- **CTX-012** — Record developer completion attestation. **dependsOn:** [CTX-011, PORT-004, SEC-009]. → **PASS:** Attestation attributed.
- **CTX-013** — Request independent verification when available. **dependsOn:** [CTX-012, PORT-004, SEC-009]. → **PASS:** Pending evidence state displayed.
- **CTX-014** — Preserve entity context on assistant navigation. **dependsOn:** [CTX-013, PORT-004, SEC-009]. → **PASS:** Context survives page change.
- **CTX-015** — Reject embedded docs prompting tool escalation. **dependsOn:** [CTX-014, PORT-004, SEC-009]. → **PASS:** Permission boundary holds.
- **CTX-016** — Create full planning session from context. **dependsOn:** [CTX-015, PORT-004, SEC-009]. → **PASS:** Initial entity retained.
## 13 Verification and release

- **QA-001** — Unit test plugin health handler. **dependsOn:** [CTX-016]. → **PASS:** 200 asserted.
- **QA-002** — Integration test authenticated API request. **dependsOn:** [QA-001]. → **PASS:** 200 with valid identity asserted.
- **QA-003** — Integration test missing authentication. **dependsOn:** [QA-002]. → **PASS:** Denied asserted.
- **QA-004** — Test restricted entity query. **dependsOn:** [QA-003]. → **PASS:** No restricted fields leaked.
- **QA-005** — Test unsupported Scaffolder action. **dependsOn:** [QA-004]. → **PASS:** Compiler rejects.
- **QA-006** — Test cyclic plan. **dependsOn:** [QA-005]. → **PASS:** Planner validation rejects.
- **QA-007** — Test failed publish action. **dependsOn:** [QA-006]. → **PASS:** Failure recorded.
- **QA-008** — Test duplicate execute submission. **dependsOn:** [QA-007]. → **PASS:** At most one effective task created.
- **QA-009** — Test partial side effect uncertainty. **dependsOn:** [QA-008]. → **PASS:** Unknown status preserved.
- **QA-010** — Test permission revocation before task submission. **dependsOn:** [QA-009]. → **PASS:** Execution denied.
- **QA-011** — Test stale environment snapshot. **dependsOn:** [QA-010]. → **PASS:** Refresh required.
- **QA-012** — Test log secret redaction. **dependsOn:** [QA-011]. → **PASS:** Canary absent.
- **QA-013** — Test recoverable connection drop. **dependsOn:** [QA-012]. → **PASS:** State resumes.
- **QA-014** — Test incompatible target contract version. **dependsOn:** [QA-013]. → **PASS:** Managed runtime or external adapter compatibility gate fails.
- **QA-015** — Test database migration rollback plan. **dependsOn:** [QA-014]. → **PASS:** Backup or reversal procedure verified.
- **QA-016** — Run staging scaffold against verified adapter. **dependsOn:** [QA-015]. → **PASS:** Repository and catalog independently verified; unavailable automation stays blocked, not passed.
- **QA-017** — Run end-to-end denied-policy scenario. **dependsOn:** [QA-016]. → **PASS:** No task submitted.
- **QA-018** — Run end-to-end manual approval scenario. **dependsOn:** [QA-017]. → **PASS:** Execution blocked until approved.
- **QA-019** — Capture test evidence URLs in release record. **dependsOn:** [QA-018]. → **PASS:** Evidence present.
- **QA-020** — Record release and supported target contracts. **dependsOn:** [QA-019]. → **PASS:** Manifest names host, adapter/runtime versions and unresolved capability restrictions.

## Portal interpretation rules for retained atoms

- BASE package inspection records UNKNOWN where managed runtime internals are not exposed. A public product version is not a lockfile version. Unknown values can pass the act of recording, but cannot satisfy runtime compatibility for release.
- FND framework registration targets the approved workspace feature entrypoints or external host. It never implies direct access to Spotify's app source. Frontend routes, navigation icons and entity buttons require a supported extension slot; the fallback is the companion's own UI.
- SEC user/group/catalog references are normalized domain identifiers. Actual credential validation uses the selected host's verified contract. Unknown membership is not membership approval.
- ENV Catalog, Group, Template and TechDocs refer to logical data sources through adapters. Limited exports retain scope and capture provenance. Unavailable data yields structured capability errors rather than fabricated empty successful inventories.
- COMP remains the template compiler capability. Executable Scaffolder YAML requires a verified schema, installed action inventory, asset policy and output contracts. No supported schema means a blocked executable compiler; a draft export is visibly unverified. Existing names such as `fetch:template` are candidates from the reference, never assumed installed.
- EXEC Scaffolder refers only to a verified Portal execution adapter. For an approved alternative provider, retain equivalent typed contracts and record its own identifiers. A manual UI handoff is never an automated submission. A publishing CLI dry-run is unrelated to workflow dry-run. Unsupported dry-run does not silently authorize live execution.
- REC compensation is a separately reviewed plan, not automatic destructive rollback. Unknown provider state is reconciled by authorized read before retry.
- EVD unavailable verifiers produce UNKNOWN; they do not pass delivery criteria. Observed usage, successful tasks, verified deliverables and estimated time savings have different metrics.
- CTX never assumes a new global Ask Portal control can be injected. A supported AiKA adapter or approved page/entity surface is required; external mode reports its manual context limitations.
- QA source tests are retained. An inapplicable test is DEFERRED with a mapped branch-specific equivalent and release impact. A fixture-only PASS cannot certify production or target tenant access.

Each retained ID's exact original operation and PASS text is included in the companion coverage JSON. This is the audit trail for changes, not a claim that inherited tasks are already implemented.

## Additional implementation sections

### ASK — Contextual Ask Portal integration

- **ASK-001** — Select approved contextual surface. **dependsOn:** [CTX-016, PORT-025]. → **PASS:** Decision records AiKA bridge, supported custom extension or companion without claiming global injection.
- **ASK-002** — Define contextual request envelope. **dependsOn:** [ASK-001]. → **PASS:** Schema admits entityRef, page type and intent while rejecting credentials and arbitrary executable content.
- **ASK-003** — Validate context origin. **dependsOn:** [ASK-002]. → **PASS:** Untrusted origin or forged tenant is rejected.
- **ASK-004** — Reauthorize contextual entity. **dependsOn:** [ASK-003]. → **PASS:** Restricted entity context yields no metadata.
- **ASK-005** — Minimize page context. **dependsOn:** [ASK-004]. → **PASS:** Test fixture excludes secrets and unnecessary personal data.
- **ASK-006** — Attach context provenance. **dependsOn:** [ASK-005]. → **PASS:** Every context fact has source, capture time and trust classification.
- **ASK-007** — Render Ask Portal launcher. **dependsOn:** [ASK-006]. → **PASS:** Chosen supported surface opens with accessible name and no automatic writes.
- **ASK-008** — Preserve active work on launch. **dependsOn:** [ASK-007]. → **PASS:** Existing draft remains unchanged after opening assistant.
- **ASK-009** — Route explain requests to grounded answer. **dependsOn:** [ASK-008]. → **PASS:** Explain fixture returns source-backed answer or explicit unknown.
- **ASK-010** — Route diagnose requests to evidence checks. **dependsOn:** [ASK-009]. → **PASS:** Diagnosis separates observations from hypotheses.
- **ASK-011** — Route plan requests to full Architect. **dependsOn:** [ASK-010]. → **PASS:** Created session retains objective and entity context.
- **ASK-012** — Expose narrow Architect MCP read tool. **dependsOn:** [ASK-011]. → **PASS:** Tool rejects unauthorized tenant and returns only allowed session fields.
- **ASK-013** — Expose draft-planning tool. **dependsOn:** [ASK-012]. → **PASS:** Invocation creates a draft without approval or execution.
- **ASK-014** — Require backend approval at MCP write boundary. **dependsOn:** [ASK-013]. → **PASS:** Model confirmation text cannot bypass approved revision checks.
- **ASK-015** — Handle unavailable contextual bridge. **dependsOn:** [ASK-014]. → **PASS:** Supported companion link or unavailable explanation appears without false embedding claim.
- **ASK-016** — Test keyboard return to source. **dependsOn:** [ASK-015]. → **PASS:** Closing assistant restores focus to launcher.

### SAVE — Saved workflow lifecycle

- **SAVE-001** — Allocate saved workflow ID. **dependsOn:** [REV-023, EVD-019]. → **PASS:** New workflow ID is unique.
- **SAVE-002** — Save workflow revision reference. **dependsOn:** [SAVE-001]. → **PASS:** Exact immutable plan revision is linked.
- **SAVE-003** — Store reusable parameter schema. **dependsOn:** [SAVE-002]. → **PASS:** Schema omits credentials and environment-bound secret values.
- **SAVE-004** — Authorize saved workflow read. **dependsOn:** [SAVE-003]. → **PASS:** Nonmember cannot view private workflow.
- **SAVE-005** — Version saved workflow updates. **dependsOn:** [SAVE-004]. → **PASS:** Prior version remains immutable.
- **SAVE-006** — Clone saved workflow into new session. **dependsOn:** [SAVE-005]. → **PASS:** New session ID preserves source lineage.
- **SAVE-007** — Rebind clone to current environment. **dependsOn:** [SAVE-006]. → **PASS:** New snapshot replaces stale environment reference.
- **SAVE-008** — Invalidate inherited approval on clone. **dependsOn:** [SAVE-007]. → **PASS:** Reused workflow cannot execute using source approval.
- **SAVE-009** — Revalidate cloned operation capabilities. **dependsOn:** [SAVE-008]. → **PASS:** Removed action makes clone guidance-only or blocked.
- **SAVE-010** — Archive saved workflow. **dependsOn:** [SAVE-009]. → **PASS:** Archived workflow disappears from active reuse selection.

### SUG — Proactive suggestions

- **SUG-001** — Define suggestion trigger allowlist. **dependsOn:** [ASK-016, SAVE-010]. → **PASS:** Only approved first-party context/events can create candidates.
- **SUG-002** — Record consent for behavioral signals. **dependsOn:** [SUG-001]. → **PASS:** Disabled collection produces no behavioral events.
- **SUG-003** — Construct candidate from verified workflow. **dependsOn:** [SUG-002]. → **PASS:** Candidate includes workflow version and evidence source.
- **SUG-004** — Filter candidates by entity authorization. **dependsOn:** [SUG-003]. → **PASS:** Forbidden service/workflow never appears in candidates.
- **SUG-005** — Filter candidates by operation capability. **dependsOn:** [SUG-004]. → **PASS:** Unsupported automation is labeled manual guidance.
- **SUG-006** — Score candidate relevance. **dependsOn:** [SUG-005]. → **PASS:** Deterministic fixture yields ordered candidates with reasons.
- **SUG-007** — Reject stale candidate evidence. **dependsOn:** [SUG-006]. → **PASS:** Expired fact prevents confident recommendation.
- **SUG-008** — Suppress duplicate suggestion. **dependsOn:** [SUG-007]. → **PASS:** Same user/context/workflow key appears at most once per cooldown.
- **SUG-009** — Apply per-user frequency cap. **dependsOn:** [SUG-008]. → **PASS:** Above-limit candidate is suppressed.
- **SUG-010** — Render why-this suggestion text. **dependsOn:** [SUG-009]. → **PASS:** User can inspect evidence and trigger reason.
- **SUG-011** — Dismiss suggestion. **dependsOn:** [SUG-010]. → **PASS:** Dismissed candidate stays hidden for configured scope.
- **SUG-012** — Snooze suggestion category. **dependsOn:** [SUG-011]. → **PASS:** Category is suppressed until stored expiry.
- **SUG-013** — Disable proactive suggestions. **dependsOn:** [SUG-012]. → **PASS:** Preference stops subsequent presentation.
- **SUG-014** — Open suggestion as draft. **dependsOn:** [SUG-013]. → **PASS:** Clicking creates no approval or external write.
- **SUG-015** — Record accepted-suggestion event. **dependsOn:** [SUG-014]. → **PASS:** Event references suggestion and resulting draft once.
- **SUG-016** — Record rejected-suggestion feedback. **dependsOn:** [SUG-015]. → **PASS:** Feedback is optional and scoped to permitted analytics.
- **SUG-017** — Invalidate suggestion after permission revocation. **dependsOn:** [SUG-016]. → **PASS:** Revoked user no longer sees previously cached suggestion.
- **SUG-018** — Measure suggestion-to-verified conversion. **dependsOn:** [SUG-017]. → **PASS:** Denominator and independently verified numerator are explicit.

### DIG — Optional weekly digest

- **DIG-001** — Create digest feature flag. **dependsOn:** [SUG-018, EVD-026, PORT-021]. → **PASS:** Default is disabled.
- **DIG-002** — Store recipient opt-in. **dependsOn:** [DIG-001]. → **PASS:** Consent includes actor time team scope and channel.
- **DIG-003** — Validate recipient identity. **dependsOn:** [DIG-002]. → **PASS:** Only verified approved email destination is accepted.
- **DIG-004** — Store weekly schedule timezone. **dependsOn:** [DIG-003]. → **PASS:** IANA timezone and local delivery time persist.
- **DIG-005** — Compute weekly reporting window. **dependsOn:** [DIG-004]. → **PASS:** Boundary tests include timezone changes and no double-counted events.
- **DIG-006** — Authorize team summary. **dependsOn:** [DIG-005]. → **PASS:** Only events visible to intended audience enter summary.
- **DIG-007** — Enforce minimum aggregation cohort. **dependsOn:** [DIG-006]. → **PASS:** Below-threshold groups omit identifying usage detail.
- **DIG-008** — Aggregate weekly workflow use. **dependsOn:** [DIG-007]. → **PASS:** Counts exclude synthetic actors and duplicate events.
- **DIG-009** — Select new workflow recommendation. **dependsOn:** [DIG-008]. → **PASS:** Suggested workflow is permitted, relevant and not falsely claimed unused when telemetry is incomplete.
- **DIG-010** — Generate digest text from approved aggregate. **dependsOn:** [DIG-009]. → **PASS:** Unsupported claims or raw prompts are absent.
- **DIG-011** — Generate safe return link. **dependsOn:** [DIG-010]. → **PASS:** Allowlisted link opens authenticated preview; GET performs no mutation.
- **DIG-012** — Reject tampered return context. **dependsOn:** [DIG-011]. → **PASS:** Invalid signature or mismatched tenant is denied.
- **DIG-013** — Render digest preview. **dependsOn:** [DIG-012]. → **PASS:** Preview shows reporting window and separates usage from verified outcomes.
- **DIG-014** — Claim unique weekly delivery key. **dependsOn:** [DIG-013]. → **PASS:** Concurrent jobs produce one pending recipient/team/week record.
- **DIG-015** — Recheck consent immediately before send. **dependsOn:** [DIG-014]. → **PASS:** Unsubscribed recipient receives no email.
- **DIG-016** — Send via approved provider. **dependsOn:** [DIG-015]. → **PASS:** Enabled authorized job records provider receipt without treating it as read or click proof.
- **DIG-017** — Reconcile ambiguous delivery. **dependsOn:** [DIG-016]. → **PASS:** Unknown provider result is checked before retry; duplicate delivery is not assumed safe.
- **DIG-018** — Process unsubscribe. **dependsOn:** [DIG-017]. → **PASS:** Preference disables future delivery without exposing tenant data.
- **DIG-019** — Apply bounce suppression. **dependsOn:** [DIG-018]. → **PASS:** Permanent bounce prevents later attempts.
- **DIG-020** — Expire digest link. **dependsOn:** [DIG-019]. → **PASS:** Expired link reveals no private context.
- **DIG-021** — Record minimal delivery audit. **dependsOn:** [DIG-020]. → **PASS:** Audit omits message body and secret tokens.
- **DIG-022** — Test disabled digest path. **dependsOn:** [DIG-021]. → **PASS:** Disabled feature creates neither send request nor scheduled delivery.

### AI — Model configuration and evaluation

- **AI-001** — Define structured planner response schema. **dependsOn:** [PLAN-035, ASK-016]. → **PASS:** Extra operation types and malformed graphs are rejected.
- **AI-002** — Pin prompt configuration revision. **dependsOn:** [AI-001]. → **PASS:** Every generation links an immutable prompt hash.
- **AI-003** — Configure approved model adapter. **dependsOn:** [AI-002]. → **PASS:** Only allowlisted provider/model and data region can be called.
- **AI-004** — Enforce retrieval authorization before embedding lookup. **dependsOn:** [AI-003]. → **PASS:** Unauthorized snippets never enter retrieval context.
- **AI-005** — Attach citations to model factual claims. **dependsOn:** [AI-004]. → **PASS:** Each environment claim resolves to permitted snapshot evidence or explicit inference.
- **AI-006** — Cap model token budget. **dependsOn:** [AI-005]. → **PASS:** Over-budget request fails safely before uncontrolled spend.
- **AI-007** — Set model call timeout. **dependsOn:** [AI-006]. → **PASS:** Hung call returns stable timeout and no execution.
- **AI-008** — Bound model retry count. **dependsOn:** [AI-007]. → **PASS:** Transient failures never exceed configured attempt limit.
- **AI-009** — Block tool instructions in retrieved content. **dependsOn:** [AI-008]. → **PASS:** Injection fixture cannot grant tools or override policy.
- **AI-010** — Build new-service evaluation case. **dependsOn:** [AI-009]. → **PASS:** Golden fixture covers confirmed constraints and valid plan outputs.
- **AI-011** — Build reuse-service evaluation case. **dependsOn:** [AI-010]. → **PASS:** Golden fixture prefers source-supported reuse with explanation.
- **AI-012** — Build unsupported-capability evaluation case. **dependsOn:** [AI-011]. → **PASS:** Fixture produces explicit guidance rather than invented action.
- **AI-013** — Build contradictory-evidence evaluation case. **dependsOn:** [AI-012]. → **PASS:** Fixture records conflict rather than silently picking convenient evidence.
- **AI-014** — Define evaluation release thresholds. **dependsOn:** [AI-013]. → **PASS:** Reviewable minimum correctness/citation scores and zero authorization bypasses are fixed before scoring.
- **AI-015** — Run fixed evaluation suite. **dependsOn:** [AI-014]. → **PASS:** Results include model prompt dataset and source versions plus threshold decision.
- **AI-016** — Record tuning decision from feedback. **dependsOn:** [AI-015]. → **PASS:** Feedback changes prompts/rules only after review; no automatic training on private user content.
- **AI-017** — Invalidate model result cache across actors. **dependsOn:** [AI-016]. → **PASS:** Different permission scopes cannot share restricted outputs.
- **AI-018** — Test model outage fallback. **dependsOn:** [AI-017]. → **PASS:** Existing plans remain readable and manual editing remains available.

### OPS — External fallback and operations

- **OPS-001** — Define external adapter interface. **dependsOn:** [PORT-025, FND-028, SEC-025]. → **PASS:** Same domain contract accepts managed and external implementations.
- **OPS-002** — Configure external service SSO. **dependsOn:** [OPS-001]. → **PASS:** Invalid audience token is rejected.
- **OPS-003** — Intersect bridge scopes with end-user rights. **dependsOn:** [OPS-002]. → **PASS:** Broad service credential cannot reveal user-forbidden data.
- **OPS-004** — Validate approved export import schema. **dependsOn:** [OPS-003]. → **PASS:** Malformed or unsigned untrusted export is rejected or quarantined.
- **OPS-005** — Label imported snapshot age. **dependsOn:** [OPS-004]. → **PASS:** Companion shows original capture time and missing live access.
- **OPS-006** — Export reviewable template artifact. **dependsOn:** [OPS-005]. → **PASS:** Download bytes match approved revision hash without execution claim.
- **OPS-007** — Record manual handoff. **dependsOn:** [OPS-006]. → **PASS:** Handoff links artifact revision and user without fabricated task ID.
- **OPS-008** — Record manual completion claim. **dependsOn:** [OPS-007]. → **PASS:** Claim remains attestation pending independent evidence.
- **OPS-009** — Validate Portal return URL. **dependsOn:** [OPS-008]. → **PASS:** Unsupported URL cannot trigger open redirect.
- **OPS-010** — Configure outbound request allowlist. **dependsOn:** [OPS-009]. → **PASS:** Private arbitrary URL and redirect bypass fixtures are blocked.
- **OPS-011** — Enforce tenant-scoped database keys. **dependsOn:** [OPS-010]. → **PASS:** Cross-tenant identifier lookup cannot return row.
- **OPS-012** — Encrypt persisted sensitive state. **dependsOn:** [OPS-011]. → **PASS:** Storage inspection confirms configured encryption and approved key reference.
- **OPS-013** — Define retention period. **dependsOn:** [OPS-012]. → **PASS:** Policy names expiration for prompts snapshots events and audit.
- **OPS-014** — Execute authorized retention deletion. **dependsOn:** [OPS-013]. → **PASS:** Expired private records disappear while permitted audit tombstone remains.
- **OPS-015** — Test backup restore. **dependsOn:** [OPS-014]. → **PASS:** Restored revision hash and attempt evidence match backup.
- **OPS-016** — Limit endpoint request rates. **dependsOn:** [OPS-015]. → **PASS:** Excess requests receive bounded retry guidance.
- **OPS-017** — Instrument queue latency. **dependsOn:** [OPS-016]. → **PASS:** Metric exposes age without prompt or entity secret content.
- **OPS-018** — Instrument adapter failure rate. **dependsOn:** [OPS-017]. → **PASS:** Dashboard separates dependency failures from policy denials.
- **OPS-019** — Create global execution kill switch. **dependsOn:** [OPS-018]. → **PASS:** Disabled switch prevents new submissions independently of UI.
- **OPS-020** — Reconcile in-flight attempts after restart. **dependsOn:** [OPS-019]. → **PASS:** Existing provider task is read rather than submitted again.
- **OPS-021** — Document deployment rollback procedure. **dependsOn:** [OPS-020]. → **PASS:** Procedure names known-good artifact and schema compatibility requirement.
- **OPS-022** — Verify backward-compatible migration. **dependsOn:** [OPS-021]. → **PASS:** Prior app reads supported data after rollback rehearsal.
- **OPS-023** — Package immutable release manifest. **dependsOn:** [OPS-022]. → **PASS:** Build hash covers selected feature set and dependency lock.
- **OPS-024** — Record tenant publication readiness. **dependsOn:** [OPS-023]. → **PASS:** Applicable publishing source/admin proof or external deploy readiness is linked.
- **OPS-025** — Verify staging authentication after deployment. **dependsOn:** [OPS-024]. → **PASS:** Fresh staging session reaches intended backend identity.
- **OPS-026** — Document incident escalation ownership. **dependsOn:** [OPS-025]. → **PASS:** On-call and security contacts and evidence location are recorded.
- **OPS-027** — Disable integration credentials on retirement. **dependsOn:** [OPS-026]. → **PASS:** Revoked credential no longer reaches source or target.
- **OPS-028** — Export portable Architect state. **dependsOn:** [OPS-027]. → **PASS:** Export retains plan lineage while excluding live credentials.

### PQA — Portal-specific acceptance and release gates

- **PQA-001** — Test complete new-service journey. **dependsOn:** [QA-020, AI-018, OPS-028]. → **PASS:** Goal through independent repo/catalog verification passes on selected supported architecture.
- **PQA-002** — Test complete reuse-service journey. **dependsOn:** [PQA-001]. → **PASS:** Existing component plan retains evidence and avoids unnecessary creation.
- **PQA-003** — Test contextual full-Architect handoff. **dependsOn:** [PQA-002]. → **PASS:** Ask Portal session reaches editable multi-step plan with original context.
- **PQA-004** — Test unavailable Portal backend hosting. **dependsOn:** [PQA-003]. → **PASS:** Same core runs in external mode with explicit capability limitations.
- **PQA-005** — Test no entitled API scenario. **dependsOn:** [PQA-004]. → **PASS:** Manual handoff works and no undocumented endpoint is called.
- **PQA-006** — Test unsupported preview scenario. **dependsOn:** [PQA-005]. → **PASS:** Static validation is labeled accurately and no dry-run success is fabricated.
- **PQA-007** — Test digest team revocation. **dependsOn:** [PQA-006]. → **PASS:** Former member receives no new summary and cannot resolve protected link.
- **PQA-008** — Test suggestion authorization cache. **dependsOn:** [PQA-007]. → **PASS:** Changed rights immediately remove forbidden recommendation.
- **PQA-009** — Test publish release feature completeness. **dependsOn:** [PQA-008]. → **PASS:** Manifest identifies omitted frontend/backend/shared packages before activation.
- **PQA-010** — Test publishing rollback selection. **dependsOn:** [PQA-009]. → **PASS:** Applicable staging rollback restores known-good feature version or blocks release with reason.
- **PQA-011** — Test task timeout ambiguity. **dependsOn:** [PQA-010]. → **PASS:** Unknown outcome blocks blind duplicate submission.
- **PQA-012** — Test provider success versus deployment evidence. **dependsOn:** [PQA-011]. → **PASS:** Repository success cannot satisfy production deployment criterion.
- **PQA-013** — Test accessibility of review workspace. **dependsOn:** [PQA-012]. → **PASS:** Keyboard-only planning approval and error recovery have no blocking issue.
- **PQA-014** — Test observability secret canaries. **dependsOn:** [PQA-013]. → **PASS:** Logs traces metrics and analytics contain no canary.
- **PQA-015** — Approve capability coverage report. **dependsOn:** [PQA-014]. → **PASS:** Every original ID maps to implementation proof or explicit unresolved/manual state.
- **PQA-016** — Record production release decision. **dependsOn:** [PQA-015]. → **PASS:** Named reviewer records approved scope, residual blockers, rollback artifact and date.

## Standard per-atom implementation ticket

```yaml
id: ENV-006
status: NOT_STARTED
phase: P2
owner: backend
reviewer: identity-and-catalog-reviewer
file: TO_BE_RESOLVED_AGAINST_PINNED_TARGET_WORKSPACE
sourceAtom: ENV-006
architecture: A_or_B_or_C_from_PORT-023
dependsOn: [ENV-005, SEC-008]
capabilityRequires: [catalog.read]
input:
  tenantId: authenticated_tenant
  entityRef: canonical_entity_reference
  actorCredentials: validated_subject_and_audience
operation: Retrieve exactly one authorized catalog component
output:
  entity: AuthorizedCatalogEntity_or_null
  evidence: source_version_captureTime_scope
  errorCode: stable_code_or_null
failure:
  code: FORBIDDEN_or_NOT_FOUND_or_CAPABILITY_UNAVAILABLE_or_CATALOG_UNAVAILABLE
  sideEffects: none
permission: reauthorize_actor_for_entity_before_disclosure
safety:
  secretHandling: no_credentials_in_response_prompt_or_logs
  promptInjection: retrieved_content_is_data_only
  tenantBoundary: tenant_and_actor_scoped_cache_key
  sideEffectClass: read
  approvalRequired: false
  rollback: disable_adapter_and_invalidate_affected_cache
provenance:
  reference: workflow_architect_micro_atomic_register(5).md#ENV-006
  sourceHash: use_reference_sha256_from_provenance_manifest
  repositoryCommit: unresolved_until_REP-003
  contractVersion: unresolved_until_PORT-012
  observedAt: unresolved_until_authenticated_probe
  evidenceStatus: UNKNOWN
test: Authorized known entity returns matching canonical entity reference
testNegative: Unauthorized entity discloses no protected metadata
testCapabilityAbsent: Returns CAPABILITY_UNAVAILABLE_without_claiming_empty_catalog
testLayer: adapter_contract_and_authenticated_staging
passCriterion: Correct entity returned
proof:
  testRun: REQUIRED_link_and_commit
  capturedResponse: REQUIRED_sanitized_artifact
  targetProbe: REQUIRED_for_tenant_verified_claim
  reviewerDecision: REQUIRED_before_DONE
```

Every ticket must retain `id`, `owner`, `file`, `dependsOn`, `input`, `operation`, `output`, `failure`, `test`, `testNegative`, and `proof` from the reference method. Added fields make Portal compatibility, safety and provenance explicit. One ticket cannot bundle a broad feature under a single untestable acceptance statement. If implementation reveals several independent changes, create child IDs such as `ENV-006a`; keep the parent as a coverage anchor and amend the DAG before coding. Never recycle a retired ID.

### Conditional branch gates

The dependency DAG tracks implementation prerequisites. Applicability is a second explicit ticket field: `appliesWhen`. DIG atoms apply only when digest delivery is in the release scope; PQA-007 requires DIG-022 only in that case and is otherwise DEFERRED with `optional feature disabled`. PQA-009 and PQA-010 apply to managed publishing; external releases require the OPS deployment and rollback equivalents. PQA-004 and PQA-005 prove fallback behavior in a test environment even when A is selected. A branch exclusion must cite its architecture decision and reviewer. Exclusion never converts unavailable automation into PASS. Core releases require 355-ID coverage and explicit unresolved capability disclosure; they do not require digest activation.

### Acceptance by work type

| Atom type | Positive proof | Negative proof | Recovery |
|---|---|---|---|
| Record/configure | Schema-valid manifest with authoritative source or explicit unknown | Missing evidence cannot enable capability | Revert manifest revision; disable dependent automation. |
| Read/retrieve | Exact authorized fixture or staged resource with timestamp | Denied actor, stale source, source outage, cross-tenant ID | Stable error, no restricted cache fallback. |
| Plan/edit/compile | Typed deterministic artifact, immutable revision/hash | Invalid action, policy deny, cycle, concurrent edit, injection | Retain prior immutable revision; invalidate approval. |
| Execute/recover | One supported provider task correlated to attempt | Duplicate key, revoked actor, changed hash, network ambiguity | Reconcile provider state; reviewed compensating plan. |
| UI/context | Accessible launch and correct saved context | Unsupported slot, stale entity, unauthorized context | Explicit unavailable state and permitted companion link. |
| Suggest/digest | Authorized grounded recommendation and scoped audit | Opt-out, permission change, stale evidence, duplicate job | Suppress/reconcile; do not repeat blindly. |
| Release/operate | Immutable artifact and target-specific staged proof | Incompatible runtime or missing feature dependency | Verified rollback with compatible schema and retained evidence. |

## Team workflow and implementation order

Assign one owner and one reviewer per atom. Backend/domain, Portal integration, UI, security/data and QA are responsibility areas; one person may cover several. Use the dependency ledger to select ready tickets. A coding assistant can draft code and checks in the same repository workflow, but cannot establish Portal entitlement by reasoning from generic Backstage examples. VS Code and Codex can both work on a pinned Git checkout; Git branches, reviews, contract tests and evidence provide collaboration discipline. Tool choice is not a deployment architecture.

Open one branch for a small coherent set of ready atoms; avoid simultaneous edits to shared contracts without an agreed owner. Keep integration credentials in the approved secret facility. A review includes the atom's behavior, failure behavior, proof and capability assumptions. Merge only after required checks and human review. Publication, production enablement, external email delivery and real execution are separate actions from preparing a candidate. This document authorizes none of those actions now.

Start with P0 so that scaffolding targets the verified host. Then finish a vertical slice: confirmed goal → permitted snapshot → grounded plan → revision review → static validation → artifact export. Unlock preview and live execution independently. Add context, reuse and suggestions to that engine. Digest remains optional and can be deferred without suppressing core Architect completion.

## Model building versus training

The initial implementation configures an approved model, permission-filtered retrieval, structured outputs, deterministic constraints, tool contracts and evaluation cases. It does not require training a foundation model. Treat user feedback as review input for prompt/rule changes. Fine-tuning is a separate future decision requiring approved data, consent, a measurable gap, an evaluation baseline and rollback; it is not implied by saving conversations. Source documents never become policy authority merely because the model retrieves them.

## Required lock decisions before code generation

1. Pin the actual repository commit and inspect its dependency locks; identify existing prototype versus production behavior.
2. Confirm tenant custom publishing rollout, access rights, new frontend/backend compatibility and permitted extension slots.
3. Resolve A/B/C with identity delegation, authorized read interfaces, storage, secrets, network and job contracts.
4. Resolve separate template schema, action inventory, preview, task submit/status/cancel and task permission capabilities. Do not guess URLs.
5. Record the approved SCM app/provider, organization/repository scope, template assets and catalog management mode.
6. Agree independent success criteria for repo, catalog, CI and deployment; define freshness and reconciliation policies.
7. Approve model data handling, source ACL enforcement, budgets and evaluation thresholds.
8. Approve optional digest consent, audience scope, sending provider, unsubscribe and timezone behavior.
9. Resolve release ownership, staging scope, retained artifact versions, schema compatibility and rollback evidence.

Unknowns can be recorded while document work continues. They block only dependent implementation or release claims. The complete Architect backlog remains intact when a capability is unavailable.

## Provenance and primary references

- **R0:** User-designated attachment `workflow_architect_micro_atomic_register(5).md`. Structural and methodological source, not evidence of managed Portal compatibility. SHA-256 is in `provenance.json`.
- **R1:** Referenced chat `6ac4ef23-71fc-83ed-b9f8-a9b71abc7036`, read 23 October 2026. User text establishes the Portal target and requested additions. Cached assistant messages were content-reference placeholders; they supply no verified technical claims.
- **R2:** [Referenced solution repository](https://github.com/navyaamehta581-ship-it/Spotify-portal-solution). Retrieval did not yield contents during this run. No implementation claim depends on an inspected repository commit.
- **S1:** [Developing Portal plugins](https://backstage.spotify.com/docs/portal/portal-plugins). Official technical documentation, inspected 23 October 2026.
- **S2:** [Publish and install custom plugins](https://backstage.spotify.com/docs/portal/portal-plugins/publishing-custom-plugins). Official publishing and rollout documentation, inspected 23 October 2026.
- **S3:** [Registry plugin publishing](https://backstage.spotify.com/docs/portal/portal-plugins/publishing-plugins). Official older publishing method and migration notice, inspected 23 October 2026.
- **S4:** [AiKA Side Panel](https://backstage.spotify.com/docs/portal/core-features-and-plugins/aika/side-panel). Official contextual surface and MCP configuration documentation, inspected 23 October 2026.
- **S5:** [Spotify Portal versus Backstage](https://backstage.spotify.com/portal-vs-backstage). Official product comparison; establishes product features, not this tenant's API rights. Inspected 23 October 2026.
- **S6:** [Spotify Portal AI Plugins README](https://github.com/spotify/portal-ai-plugins/blob/main/README.md). Official public repository describing external agent/CLI workflows; inspected 23 October 2026, no installed version verified.
- **S7:** [Portal documentation index](https://backstage.spotify.com/docs/llms.txt). Used to discover technical documentation. Index summaries do not substitute for target contract testing.

The source attachment also cites generic open-source Backstage backend and template documentation. Those remain useful framework references after a version lock; they are not proof of managed Portal extension, authentication or deployment rights. Some Markdown documentation URLs could not be fetched; corresponding HTML pages were read where cited. No undocumented tenant endpoint was probed.

**Register totals:** 516 atoms = 355 retained source IDs + 161 additive atoms. Every atom has explicit dependencies and one PASS criterion. Zero implementation PASS claims are made by this planning artifact.
