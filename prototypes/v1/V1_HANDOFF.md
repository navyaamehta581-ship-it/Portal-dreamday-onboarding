# V1 technical handoff — Portal Assistant

Audited 23 October 2026. Former product name: AI Workflow Architect. This document describes the actual V1 source and a fresh local browser audit, not a proposed implementation. The accompanying `V1_FEATURE_MATRIX.md` inventories implementation and migration decisions.

## 1. Product overview

Portal Assistant explores how Spotify Portal customers could turn an engineering goal into a useful workflow using capabilities their organization already has. Developers may know their task but not the relevant services, owners, templates, approved tools, or configuration dependencies. New engineers need a concrete onboarding path; experienced developers need compatible service-launch workflows. Platform engineers maintain the capabilities and policy. Chris and customer-facing teams are stakeholders who currently help customers discover and adopt this value.

The promise is: “Tell Portal what you're trying to accomplish, and it will help you build a workflow using the tools and capabilities your organization already has.” Less manual guidance is a hypothesis to test, not a measured result.

The intended journey is discovery → confirmed team/environment context → compatible plan → review and approval → generated template and execution → useful-task evidence and value assessment. V1 implements the interface and local rules. It simulates customer data, permissions, infrastructure, execution, and artifacts. It contains no live Claude, ChatGPT, OpenAI, Spotify, or Backstage integration.

The visible product is **Portal Assistant**, with one sidebar entry beside Create and contextual **Ask Portal** buttons. `Architect.tsx` retains the previous implementation name. The surrounding screenshot-referenced portal is a representative React shell, not an installed Backstage application. V2 should run inside the customer's real portal rather than porting this shell.

## 2. Current architecture

### Runtime and dependencies

Browser-only React + TypeScript + Vite application. `src/main.tsx` mounts `Portal` under React StrictMode and imports global `styles.css`. `Portal.tsx` imports the portal styling and composes the integrated experience. There is no backend, database, authentication provider, persistent storage, external API client, LLM SDK, or Backstage package.

| Dependency | Declared range | Audited lockfile version | Role |
|---|---|---|---|
| react / react-dom | ^19.1.0 | 19.3.1 | UI |
| lucide-react | ^0.468.0 | 0.468.0 | Icons |
| yaml | ^2.8.0 | 2.9.1 | YAML serialization |
| tailwindcss / @tailwindcss/vite | ^4.1.0 | 4.3.3 | Styling/Vite integration |
| typescript | ~5.8.3 | 5.8.3 | Strict static checking |
| vite | ^6.3.0 | 6.4.5 | Development server/build |
| @vitejs/plugin-react | ^4.5.0 | 4.7.0 | React transform |
| vitest | ^5.0.5 | 5.0.5 | Unit tests |

`package-lock.json` is lockfile version 3. `vite.config.ts` registers React and Tailwind plugins. `tsconfig.json` uses strict checking, ES2022, bundler resolution, no emit, and includes `src` plus Vite configuration. `package.json` is private ESM; it has no `engines` or `packageManager` declaration.

### Source map

```text
src/
  main.tsx                         Active entry point
  styles.css                       Tailwind import and shared/global styles
  portal/
    Portal.tsx                     Portal shell, fixture pages, navigation, context handoff
    Architect.tsx                  Six-stage planning, approval, simulation, value UI
    ContextPanel.tsx               Team environment and capability corrections
    AssistantDock.tsx              Contextual deterministic chat
    TaskEvidence.tsx               Onboarding evidence form
    portal.css                     Active portal styles
  components/
    Workflow.tsx                   Shared workflow sequence/editor
    Concept.tsx, concept.css       Preserved older, unmounted concept
  domain/models.ts                 Typed planning models
  data/catalog.ts                  Teams, ten services, nine capabilities, action registry
  data/environments.ts             Tools, policies, prerequisites, example setup commands
  logic/
    conversation.ts               Natural-language context proposals
    assistant.ts                  Contextual fixture-grounded answers
    engine.ts                     resolveCapability, recommend, validate
    generate.ts                   generate
    execution.ts                  simulate and Log type
    evidence.ts                   assessEvidence
    *.test.ts                     Four unit-test files
  App.tsx                          Preserved older, unmounted standalone UI
public/backstage-logo-reference.png Screenshot-derived logo asset
```

Root configuration: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, and `README.md`. There are no Scaffolder skeleton directories, action implementations, Backstage `app-config.yaml`, plugin registration files, or API routes.

### State and lifecycle

State uses React `useState` and `useRef`; there is no central store, URL router, or persistence. `Portal` owns the selected page, catalog filters, stars, service/document/group selection, and contextual assistant handoff. The workflow page stays mounted in a hidden container when other pages are visited, preserving its current local task. Starting a contextual task increments the Architect instance key and initializes a fresh task. Reloading loses all state.

`Architect` owns selected team, request, stage, editable steps, approval, messages, customer notes, simulated logs, failure injection, and timer. Edits invalidate approval/results. Contextual dock conversations are scoped by a key built from page/service/document/group and reset when that key changes. Closing and reopening the same dock can preserve its current mounted conversation. There is no shared durable chat/task history.

### Domain models

`src/domain/models.ts` defines:

- `Stack`: node, java, python. `Need`: service, onboarding, ci, monitoring, docs.
- `Action`: fetch:template, publish:github, catalog:register.
- `Team`: id/name/initials, preferred stack, allowed stacks, canPublish, existing services, constraints, goal.
- `Capability`: id/title, provided needs, supported stacks, dependencies, action, optional template/publish flag, required configuration keys, description.
- `Service`: name, owner, stack, lifecycle, description, docs reference.
- `Request`: problem, selected needs/stack, name/repository, optional unavailable capabilities and target service.
- `Step`: id, capability metadata, editable title/config, justification.
- `Plan`: ordered steps, blockers, rejected candidates, uncovered needs.

These are compile-time types, not runtime input schemas or security boundaries. `Log` lives in `execution.ts`; evidence types live in `evidence.ts`.

## 3. Implemented feature inventory

See the complete file-by-file matrix in `V1_FEATURE_MATRIX.md`. Status conventions: **working local** means actual browser or pure-function behavior; **simulated** means fictional records or external effects; **partial** means a limited implementation; **reference** means explicit placeholder; **legacy** means source retained but not mounted.

Working local features include the shared navigation, catalog filtering/stars/detail pages, local document guides, contextual task handoff, structured discovery, team selection, conversational field proposals, context inspection/capability corrections, deterministic planning, dependency/configuration validation, workflow editing, local approval, YAML serialization, staged simulation logs, injected failure/retry, value presentation, and evidence completeness form.

Important distinctions:

- Catalog contains ten fictional services. API rows are derived from these service fixtures, not real API entities or OpenAPI documents.
- Documentation pages use fixture metadata and common stack-specific setup commands. The `docs/<service>/index.md` references do not point to bundled service documentation files or a TechDocs backend.
- Create shows capability/template/action references. Its Tasks, Template Editor, and Templating Extensions views do not implement actual task history or editors.
- Tech Radar, MUI to BUI, Visualizer, Notifications, and Settings are reference sections, not implementations of those Backstage plugins.
- Home visit cards are static examples, not analytics. Team ownership is fixture selection, not authenticated identity.
- Customer-call notes are human context displayed with the plan. They do not train a model, ingest CRM data, or affect the planner.
- `App.tsx` and `Concept.tsx` are older unmounted experiences. Do not mistake their simulated scanning or old time-savings controls for active product functionality.

## 4. Developer journeys and reproduction

Start at Portal Assistant in the sidebar. The stages are Discover, Understand context, Architect, Review & customize, Generate & simulate, Demonstrate value.

### A. Orbit Node.js service launch

1. Choose **A · Node.js service launch**. Confirm Orbit Experience, Node, and service/CI/monitoring/docs requirements. Set a lowercase service name and a repository locator such as `github.com?owner=example-org&repo=demo-api`.
2. Review context. The fictional environment permits Node, GitHub, GitHub Actions, Grafana, TechDocs, and the three declared actions.
3. Generate the plan. Expected IDs: `node → ci → monitoring → docs → publish → register`. Dependencies and reasons appear in a linear workflow sequence.
4. In review, inspect/edit configuration. Default runtime is `Node.js 22 LTS`, test command `npm test`, and owner fields `orbit`. A Java runtime, blank required value, missing dependency, or invalid repository blocks approval.
5. Approve. YAML becomes available for inspection, copy, or download. It is a review artifact, not executable bundled infrastructure.
6. Run simulation with no failure. Six local simulated results succeed, including fictional repository/catalog URLs. No repository, pipeline, monitoring, documentation, or deployment is created.
7. Open the value view. It connects the plan to the original problem, lists simulated outputs/capability reuse, assumptions, and evidence needed. Successful simulation does not establish developer productivity or real task completion.

### B. Ledger Platform Java onboarding

1. Choose **B · Java developer onboarding**. Defaults select Ledger, Java, onboarding and documentation. Select an existing Ledger service, initially `ledger-api`.
2. Inspect context: Java 21/Spring Boot/Maven; GitHub Enterprise, Jenkins, Grafana, TechDocs; approved read access; no new repositories or infrastructure. Only `fetch:template` is supported.
3. Generate. Default IDs are `onboard → docs`. Adding monitoring yields `onboard → monitoring → docs`; adding CI uses the Java/Jenkins context. No publishing or registration is added to onboarding.
4. Review `existingService`, `runtime`, and `setupProcedure`. Cross-team targets and incompatible runtime values fail validation. Approve the valid plan.
5. Generated YAML uses `./skeletons/onboarding-java`, Java-specific values, and fetch actions only. It has no `repoUrl` parameter or repository action.
6. Simulate. The two default steps succeed locally. Open outcome/task evidence.
7. The concrete first-task guide asks for approved repository access, cloning according to the organization's instructions, then illustrates `./mvnw -version`, `./mvnw verify`, and `./mvnw spring-boot:run`. Nothing executes on the developer's machine.
8. Record prerequisites, setup, passing test text, and a first change/reviewer. Empty evidence remains incomplete. The sample-result button fills `BUILD SUCCESS`; after all confirmations the result explicitly says simulated sample evidence, with no independent verification.

### Constraint detection and correction

With Ledger selected, request “Launch a Node.js service.” The conversation context resolver retains Ledger and proposes Node. Context shows disallowed-stack and repository-policy blockers; planning cannot proceed. Selecting Java resolves the language blocker but still leaves the new-service policy blocker. Use the offered supported onboarding alternative to change the intent.

In any context, mark a required capability unavailable. The planner reports it and its dependent work as blocked/uncovered rather than inventing an unsupported substitute. Restore capability or change requirements. The editor also detects removed or reordered dependencies, empty fields, and unsupported actions.

Known UX limitation: correcting structured fields or choosing the onboarding alternative does not necessarily rewrite the original problem text. The browser audit produced a valid Java onboarding plan while the original-problem summary still said “Launch a Node.js service.” Structured requirements drive execution; V2 must reconcile contradictory prose and fields explicitly.

### Approval and YAML

Only a valid edited workflow can be approved through the UI. Editing invalidates prior approval/logs. `generate()` independently validates again and throws on invalid input. Approval is only an in-memory boolean; there is no signed/versioned approval, separate approver, or server authorization. Copy uses browser clipboard permissions and download uses a local browser artifact; successful clipboard delivery was not independently confirmed in this audit.

### Failure and recovery

In Generate & simulate, inject failure at `ci`. Expected Node statuses: success, failed, skipped, skipped, skipped, skipped. Inspect inputs/outputs and the fixture error. Choose no failure and retry: all six succeed. Retry repeats the complete local simulation, not a checkpointed job. No rollback or external cleanup occurs.

### Contextual Ask Portal

Open Catalog → `ledger-api` → **Ask Portal** → **Help me set it up locally**. It gives Java prerequisites, ordered Maven commands, fixture catalog/policy/setup sources, and **Prepare a tracked setup task**. That starts the same planner with Ledger and the target service selected. Ownership and setup questions use the current service context; Create can start a service-planning task, with Ledger redirected to supported onboarding. Unsupported arbitrary questions are explicitly declined. This is deterministic retrieval and task preparation, not an LLM conversation or machine execution.

## 5. Technical rules and behavior

### Team/environment fixtures

| Team | Allowed stack(s) | Services | Tools | Publishing / actions |
|---|---|---|---|---|
| Orbit Experience (`orbit`) | Node | discovery-api, playlist-edge, session-service | GitHub, GitHub Actions, Grafana, TechDocs | Allowed; fetch, publish, register |
| Ledger Platform (`ledger`) | Java | ledger-api, settlement-worker, audit-service, identity-gateway | GitHub Enterprise, Jenkins, Grafana, TechDocs | Prohibited; fetch only |
| Signal Intelligence (`signal`) | Python, Node | feature-store, model-serving, event-pipeline | GitHub, GitHub Actions, Datadog, TechDocs | Allowed; fetch, publish, register |

`catalog.ts` owns teams/services/capability definitions. `environments.ts` owns tool lists, infrastructure descriptions, available capability/action IDs, approvals, priorities and prerequisites. These are fictional policy examples. Approval descriptions are informative strings, not enforced approval workflows. “Existing tools” are loaded from these fixtures, never discovered from a customer network.

### Capability resolution and recommendation

Nine capability IDs: node, java, python, onboard, ci, monitoring, docs, publish, register. Stack skeletons provide `service`; onboard provides `onboarding`; CI/monitoring/docs each provide their named requirement. CI/monitoring/docs depend on `base`; publish depends on `artifacts`; register depends on publish.

`resolveCapability(team, request, id)` clones canonical capability metadata and derives onboarding/CI template paths and tool-aware descriptions. Onboarding requires existingService/runtime/setupProcedure. CI uses `tools[1]`; monitoring uses `tools[2]`, a positional coupling V2 should replace with typed adapters.

`recommend()` first blocks disallowed stacks, empty needs, service+onboarding together, and new services for a nonpublishing team. It chooses the first capability matching each structured need and stack. It is deterministic catalog selection, not scoring, optimization, or an LLM. Prose alone does not drive matching.

Its recursive `add` deduplicates steps; checks environment availability, user-corrected unavailable IDs, action support, stack compatibility, publishing policy; resolves `base` to the selected service skeleton or onboard; adds dependencies first; and blocks dependents whose base is missing. It fills stack-specific runtime/test/setup defaults and owner/target fields. New service plans append publish and register. Coverage and rejected incompatible capabilities are returned separately.

Dependencies are a small hardcoded acyclic model. There is no general cycle detector or arbitrary DAG scheduler. `artifacts` is specially handled by post-edit validation rather than general recursive expansion. Unsupported requirements remain unresolved; there is no supported-alternative search engine beyond the explicit onboarding UI alternative.

### Post-edit validation

`validate()` reruns planner blockers and checks name syntax (3–40 lowercase letters/digits/hyphens, starting with a letter), nonempty steps, unique IDs, canonical action match, declared capabilities/actions, stack, publishing policy, title, required nonblank configuration, exact approved runtime, onboarding ownership, dependency presence/order, requested coverage, and new-service registration. Publishing requires the specific `github.com?owner=...&repo=...` locator syntax.

The workflow editor can edit titles/configuration, remove steps, and move them earlier. Review toggles optional needs and rebuilds the plan while retaining matching-step edits. It does not create arbitrary actions. The linear card view labels dependencies but is not a general graph canvas. Its green step icon does not itself reflect every invalid edit; the validation warning/approval state is authoritative in V1.

These checks are client-side prototype rules, not secure policy enforcement. Runtime schemas, exhaustive action input validation, backend authorization, and actual repository existence/ownership checks are absent. Some supplied metadata remains trusted, extra configuration keys are not rejected, and unknown runtime inputs may throw.

### Conversation and customer-call notes

`resolveConversationContext()` proposes explicit teams and languages using fixed patterns while preserving current context otherwise. `Architect.send` also searches service names and can select the named service's owner, then proposes requirements with regex intent cues. It is not general semantic understanding, reliable negation handling, or a multi-turn clarification planner. Confirmed structured requirements are the planner's input.

`answerInContext()` separately handles setup, workflow/create, ownership, tools, and fallback branches. Named service retrieval is restricted to the selected team's fixtures; missing targets can trigger a question. Its sources are fixture labels and local navigation, not retrieved live documents.

Customer notes are displayed only after human review/application. They are not inputs to `recommend`, `generate`, or `simulate`. Raw note text can remain when switching teams, so this is not tenant-isolated customer-data storage. Do not use sensitive real customer notes in V1.

### YAML generation

`generate()` validates, then uses the `yaml` library to serialize `scaffolder.backstage.io/v1beta3`, kind Template. Owner is `group:default/<team>`, and type is `service` even for onboarding. Parameters name/owner always exist; repoUrl is included only for publishing.

Fetch inputs use canonical template references; the stack base targets `.` and other artifacts target `./<step-id>`. Values contain name/owner parameter expressions and configuration. Publishing uses `publish:github`, main/private. Registration uses `${{ steps.publish.output.repoContentsUrl }}` and `/catalog-info.yaml`. A warning header and review-required output are included.

No referenced skeleton content is bundled. A CI folder is not automatically a real GitHub Actions/Jenkins layout. There is no guaranteed catalog-info file, TechDocs annotation, instrumented monitoring, validated installed action schema, or registered template. Generated parameter schemas do not enforce all UI rules. Extra config can override fetch values. This YAML must not be represented as ready for real Scaffolder execution.

### Simulation and evidence

`simulate(steps, failAt)` synchronously creates success/failed/skipped logs, inputs, fake `simulated://` outputs and `SIMULATED_PREREQUISITE_FAILURE`. After one injected failure all later steps skip, even if independent. It does not validate inputs or execute actions itself. The UI gates execution and reveals results with a 450ms timer.

`assessEvidence()` requires three confirmations and passing-text regex: a line with optional `[INFO]` then `BUILD SUCCESS`, a numeric `test(s) passed`, or `Tests: <number> passed`. This is deliberately limited form completeness. It can accept zero tests and a passing line amid other failure text. It cannot verify access, commands, tests, a reviewer, or a change. The UI distinguishes simulated sample evidence from self-reported evidence. No evidence is persisted or independently verified.

## 6. Limitations and security boundary

- All identities, ownership, tools, catalog records, capabilities, action availability and policy are hardcoded. Team selection is not authentication or permission checking.
- No backend, real integration, persistent task state, server audit trail, tenant isolation, model calls, tool execution, deployment, or telemetry exists.
- Generated skeleton references are absent; actual setup instructions are illustrative. Publishing configuration does not create a repository. No Scaffolder plugin/action module is installed.
- Browser approval can be bypassed by code manipulation; client validation cannot secure external actions. Types are not runtime validation. There is no rate limiting, access-token management, secret redaction pipeline, or malicious-content/tool-injection defense for future LLM use.
- Workflow execution is sequential fixture output, not reliable orchestration. No durable retries, idempotency, cancellation, concurrent jobs, rollback, timeout, or external error taxonomy.
- UI state resets on reload; task context is not a versioned entity. Customer notes are not isolated or sent to a real AI.
- API/docs/template pages are representative local fixtures, not full Backstage features. Several sections are placeholders. Copy needs browser permissions; browser download delivery was not freshly checked.
- Completion evidence is untrusted text and checkboxes. No ROI or productivity measurement exists. Legacy unmounted UI includes older hypothetical savings controls; these are not measured current results.
- No license is present for project source. Logo asset is screenshot-derived; permission to redistribute branding must be established separately.

## 7. V1 → V2 migration recommendations

### Establish the host contract first

Confirm target Backstage version, frontend system, backend system, available plugin APIs, Scaffolder modules, and whether the intended managed Spotify Portal environment permits this custom frontend/backend extension. V1 proves none of those deployment capabilities. Do not assume arbitrary private plugin deployment is supported.

Official references checked during the audit: [frontend plugins](https://backstage.io/docs/frontend-system/building-plugins/index/), [frontend architecture](https://backstage.io/docs/frontend-system/architecture/index/), [backend core services](https://backstage.io/docs/next/backend-system/core-services/index/), [HTTP authentication](https://backstage.io/docs/next/backend-system/core-services/http-auth/), and [Scaffolder authorization](https://backstage.io/docs/next/features/software-templates/authorizing-scaffolder-template-details/). Some links are Next documentation: verify applicability to the chosen host release.

### Reuse after adaptation

Reuse the product journey, structured requirement concepts, rule-based planning approach, explanation model, dependency/coverage checks, and useful portions of pure-function unit tests. Extract these independently of fixtures and React. Preserve the simulator as a clearly labeled development/test adapter. Retain the distinction between execution success and useful-task evidence.

Adapt workflow/editor, context panel, dock and value concepts to the host component system, entity pages, routes and accessibility conventions. Register a plugin page and contextual entity/document/Create entry points using actual host extension APIs. Do not transplant the fake portal navigation or global CSS.

### Replace before external execution

1. Build typed catalog/environment providers. Resolve authenticated identity, ownership entityRefs, actual authorized catalog entities, reviewed documents, template entities, installed action schemas and explicit capability policies. Replace positional tool arrays and handcrafted permissions.
2. Move authoritative validation/policy enforcement to a backend plugin. Validate runtime inputs, trusted configuration schemas, entity access and allowed actions. A model may propose structured requests; deterministic server rules must still constrain execution.
3. Add an optional backend model adapter with approved tools, bounded context, source provenance, redacted logs, secrets outside the browser, prompt-injection defenses, timeouts, rate/cost limits and data-retention policy. The prototype regex assistant can remain a development fallback, not a claim of general AI understanding.
4. Author and review real skeletons/templates with correct CI/docs/catalog layouts and installed action input schemas. Integrate actual Scaffolder task APIs for supported, registered templates. Do not assume arbitrary generated inline YAML can be executed. Treat dry-run support as action/host dependent; it is not a blanket guarantee of no side effects.
5. Persist versioned requests/plans, context snapshots, validation results, approval bound to a plan hash, actor identity, tasks and redacted logs. Revalidate server-side immediately before execution. Edits must invalidate approval for that exact version.
6. Track durable task IDs/status, retries, cancellation and idempotency against real task infrastructure. Replace timer success output with task events and external error handling.
7. Verify completion through trusted task/CI/artifact/review evidence with provenance and timestamps. Keep self-report distinct. Do not execute local commands without a separately designed, authorized mechanism.

Do not carry forward fixture-derived API definitions, fake tool discovery, browser-only authorization, customer-note state leakage, unconditional green compatibility icons, permissive evidence regex, missing skeletons, static activity metrics, or legacy standalone dashboards as production implementation.

Suggested V2 gates: real host plugin loads; context remains user/team scoped; forbidden operations are denied server-side; schema-invalid plans fail; dependency cycles fail safely; approval binds exact plan; real template dry-run/task tests pass; logs contain no secrets; failures/retries persist correctly; evidence distinguishes verified from self-report; contextual handoff retains target service; unsupported requests are explained. Establish a baseline for time to first reviewed change/useful-task completion and measure corrections/failures/support effort before claiming benefit.

## 8. Testing and verified results

Fresh audit on 23 October 2026, Node v26.0.0 / npm 11.12.1:

| Check | Actual result |
|---|---|
| `npm test` | PASS: 39 tests, 4 files |
| `npm run build` | PASS: TypeScript project checking and Vite production bundle |
| `npm audit --json` | 0 reported vulnerabilities at audit time; not a security certification |
| Targeted source credential scan | No high-confidence pattern match or .env configuration file in scanned application text; not exhaustive |
| Browser Node launch | Six expected steps; wrong edited runtime blocked approval; restored runtime allowed approval; YAML rendered |
| Browser failure/retry | CI injected failure: one success, one failed, four skipped; successful fresh retry: six successes |
| Browser Ledger restrictions | Incompatible Node and new-service requests blocked; Java alone did not bypass publishing policy; onboarding alternative allowed |
| Browser Java onboarding | Two fetch steps, Java YAML, no repository parameter/action, successful simulation |
| Browser evidence | Empty form incomplete; all confirmations plus sample BUILD SUCCESS completed with explicit simulated-evidence label |
| Browser Ask Portal | ledger-api setup returned Java/Maven prerequisites, fixture sources, and tracked-task handoff button |

No application source was changed for this handoff. Generated build output and documentation/evidence were produced. Existing installed dependencies were used; a clean-machine `npm ci` was not independently repeated in this audit. No current automated test failure was observed. Clipboard success, download delivery, every placeholder page, real integration, and real Backstage execution were not verified.

Test locations and scope:

- `src/logic/engine.test.ts`: 27 tests covering fixture counts, structured matching, all three teams, policy/stack constraints, shared dependencies, edit validation, YAML serialization/refusal, simulation failure/recovery, unavailable capabilities, target service, runtime, canonical actions and fake outputs.
- `src/logic/assistant.test.ts`: 5 tests for Java setup, constrained alternative, named same-team target, missing target question and unsupported question.
- `src/logic/conversation.test.ts`: 4 tests preserving team versus incompatible language, explicit team changes and retained context.
- `src/logic/evidence.test.ts`: 3 tests distinguishing execution from evidence and requiring valid-looking passing text plus confirmations.

These are pure unit tests, not mounted component/accessibility tests or committed browser end-to-end automation. There is no coverage threshold, lint script, CI pipeline, actual Scaffolder schema integration test, or production security test. Existing tests do not close the limitations above.

`handoff-evidence/` includes actual browser-derived Node/Java YAML, npm audit output, credential-scan summary, verification summary and source SHA-256 manifest. Prior `chris-feedback-demo` screenshots are historical, not proof of this audit and not needed to run V1.

## 9. Exact local setup

Use a Node version compatible with the lockfile tools: Node 22.12+ within the 22 series, Node 24, or Node 26+. Vitest 5.0.5 declares `^22.12.0 || ^24.0.0 || >=26.0.0`; “Node 22+” alone is imprecise because it includes unsupported odd majors. Audit used Node 26.0.0. npm is required; audit used npm 11.12.1.

Extract the source archive, enter its `backstage-workflow` directory (or enter this repository's V1 app directory), then:

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173/` and leave the server running. Dependency installation requires package-registry access; application operation uses local assets and fixtures and requires no API keys, accounts or external infrastructure. A busy port makes strict-port startup fail: stop the other server or choose a different port.

Verification/build:

```sh
npm test
npm run build
```

Build writes `dist/`. There is no `preview` script; a local production preview can be started with the installed Vite binary:

```sh
npx --no-install vite preview --host 127.0.0.1 --port 4173 --strictPort
```

No environment variables, migration, database, or Spotify credential setup is needed. A reload clears task/chat/approval/evidence state. The root README remains the original usage guide; this handoff records the more precise audit and boundaries.

## 10. GitHub readiness and transfer checklist

Commit the entire `src/` tree (including currently unmounted files, because TypeScript still checks them), `public/` assets, `package.json`, **package-lock.json**, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `README.md`, this handoff, the feature matrix, and useful sanitized evidence. Preserve the lockfile and use `npm ci`; do not replace dependency versions casually during migration.

Existing `.gitignore` contains only `node_modules/`, `dist/`, and `*.tsbuildinfo`. Before wider development add rules appropriate to the repository, for example:

```gitignore
node_modules/
dist/
*.tsbuildinfo
.env
.env.*
!.env.example
npm-debug.log*
.DS_Store
coverage/
```

Only commit a deliberately sanitized `.env.example` if future V2 needs one. Exclude access tokens, API keys, service credentials, private keys, real customer call transcripts, personal browsing data, unsanitized logs, dependency directories, generated bundles, editor caches and unrelated project files. No secret is needed for V1. The limited scan found none, but review additions and history before publishing. The original local app directory was not initialized as a Git repository during this audit, so there is no local Git history to transfer.

No LICENSE file is present; do not invent an open-source license or infer one from `private: true`. Obtain ownership/licensing approval for project code and the screenshot-derived Backstage logo before public distribution. Major locked packages use MIT, ISC, or Apache-2.0; review complete dependency notices and branding independently before release. Repository upload does not establish those rights.

### Files for the new V2 development chat

Provide both Markdown documents and the complete source snapshot, preferably `V1_SOURCE_HANDOFF.zip`. The archive contains the V1 app under `backstage-workflow/`, source, public asset, configuration/lockfile, README, handoff documents and sanitized audit evidence. It omits dependencies, builds, unrelated synced sources and private data. Extract before installing or running. `handoff-evidence/source-sha256.json` identifies audited source files.

If uploading files individually, provide `src/**`, `public/**`, all root files listed above, and `handoff-evidence/**`. Screenshots/Chris feedback are optional design context and should be explicitly labeled historical. Do not provide `node_modules`, `dist`, `.git`, credentials or unrelated TKS materials.

Separately provide the actual V2 Backstage repository or its exact version, package manager/lockfile, frontend/backend plugin conventions, `packages/app` and backend wiring, sanitized app configuration, installed action list/schemas, permission model and deployment constraints. Those host files do not exist in V1 and cannot be inferred from this prototype. Tell the new chat to preserve the useful journey and deterministic constraints, implement a native plugin against the confirmed host, and treat every V1 external effect as simulated until replaced and tested.
