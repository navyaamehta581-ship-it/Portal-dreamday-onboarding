# Portal Assistant — integrated portal prototype

A local React + TypeScript + Vite + Tailwind application demonstrating a proposed Portal workflow feature. The screenshot-referenced shell is representative, **not a Backstage installation or a production Spotify Portal integration**. All customer records, permissions, APIs, templates and execution outputs are simulated. No API keys, credentials, backend, external infrastructure or deployments are required.

## Run

Requires Node.js 22.12+ and npm. From this directory:

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://127.0.0.1:5173/. The local server must remain running. State is held in memory and resets on reload.

```sh
npm test
npm run build
```

Production output: `dist/`. Application assets are local. Initial dependency installation needs package-registry access.

## Integration and demonstration

The shared portal sidebar follows the supplied screenshot structure, with one **Portal Assistant** entry beside Create. Home, Catalog, My Group, APIs, Docs, Create and Explore use the original fictional fixtures. Catalog filters, stars, service details and local documentation work. Catalog service details and Create link to the same Architect with preselected context. Other navigation entries remain explicitly scoped reference sections. No second sidebar or standalone AI shell appears. The legacy `App.tsx` and `components/Concept.tsx` remain preserved in source; their working engines and workflow editor are reused in the integrated page.

The six stages are Discover → Understand context → Architect → Review & customize → Generate & simulate → Demonstrate value.

**Scenario A:** Open Portal Assistant and choose “A · Node.js service launch.” Review context, generate the plan, inspect justifications and configuration, review/edit, approve, inspect/copy/download YAML and simulate. Orbit permits a Node service skeleton, CI/CD, monitoring, docs, publishing and registration. Simulated results are visible individually; no repository or deployment exists.

**Scenario B:** Choose “B · Java developer onboarding.” The Ledger team uses Java 21/Spring Boot/Maven, existing services, Jenkins, Grafana and TechDocs. Its action registry permits `fetch:template` only. The default onboarding path prepares local setup, ownership and documentation, with no new repositories or infrastructure. After successful simulation, follow the example setup guide and record prerequisites, setup, a passing test result and a reviewable first change. “Check task evidence” distinguishes incomplete from complete. Sample results are labeled simulated; pasted evidence is self-reported and never independently verified.

**Third team:** Signal uses Python/FastAPI and distinct tools and services. Node is also allowed. Runtime, test commands, template references, target services, ownership and monitoring context change with the team and requirements.

**Failure/recovery:** Inject a failure at any simulated step. Downstream steps are skipped; inspect inputs, outputs and explanation. Choose None and rerun. Changes invalidate prior approval/results. No rollback is needed because no external state is changed.

**Constraint demonstration:** Select Java plus New service to see a blocker and supported onboarding alternative. Mark a required capability unavailable in the context panel to block generation until the requirement or assumption is corrected. Remove/reorder a required step or clear a required configuration value to block approval. Optional capability toggles update requirements and revalidate.

## Architecture

- `src/portal/Portal.tsx`, `portal.css`: screenshot-referenced shared shell, portal navigation, existing fixture pages and contextual entry points.
- `src/portal/Architect.tsx`: connected six-stage workflow interface and deterministic conversational proposal layer.
- `src/portal/ContextPanel.tsx`: inspectable catalog, capability, action, prerequisite and policy context.
- `src/portal/TaskEvidence.tsx`: concrete onboarding guide and user-reported completion evidence.
- `src/domain/models.ts`: reusable typed domain models.
- `src/data/catalog.ts`: 10 fictional services, three teams, nine capabilities and action registry.
- `src/data/environments.ts`: team-specific tools, frameworks, infrastructure restrictions, supported actions, prerequisites, approvals and setup examples.
- `src/logic/engine.ts`: structured eligibility, dependency resolution, canonical capability metadata and post-edit validation.
- `src/logic/generate.ts`: validated Scaffolder YAML serialization using canonical action metadata.
- `src/logic/execution.ts`: deterministic simulated success, failure, skip, inputs and outputs.
- `src/logic/evidence.ts`: local evidence completeness rules, distinct from execution success.
- `src/components/Workflow.tsx`: reused workflow sequence/editor.
- Tests: capability/constraint matching, post-edit policy, YAML, simulation and evidence completeness.

Conversation proposes structured fields using simple local intent cues and exact service retrieval. Users confirm them. **Recommendations do not rely solely on keywords**: eligibility uses explicit requirements, stack, canonical capability metadata, environment action availability, dependencies, restrictions and coverage. No LLM is necessary or called. Reviewed customer-call notes can accompany the plan as human context; they do not override policy or become verified facts.

## Actual versus simulated

Actual: local interface/navigation, catalog filtering and retrieval, structured recommendation/validation, editing/approval, YAML serialization/copy/download, timed logs, and evidence-form completeness checks.

Simulated: identity, ownership records, permissions, tool discovery, catalog APIs, repository operations, CI/CD, monitoring, documentation publication, Scaffolder execution and artifacts. Task evidence is self-reported or explicitly supplied sample evidence. It is not machine-verified proof of task completion.

Hypotheses: less manual guidance, clearer onboarding, fewer missed configurations. The Value stage names assumptions and pilot evidence needed. No productivity gains, financial ROI or adoption outcomes are measured or claimed.

## YAML boundaries

Generated YAML follows `scaffolder.backstage.io/v1beta3`, using only simulated supported actions (`fetch:template`, `publish:github`, `catalog:register`, subject to team restrictions). Registration consumes the publish output. Java onboarding uses only fetch actions and omits repository parameters.

**The YAML is plausible, not ready-to-run infrastructure.** Paths such as `./skeletons/onboarding-java` are illustrative references and are not executable skeletons bundled with this React app. Real use requires authored/reviewed skeleton contents, file merge/layout rules, installed action modules and schemas, permissions, approved integrations and platform review. Configuration generation does not activate a pipeline, deploy a service, connect telemetry or publish documentation.

Reference: [Official Backstage template documentation](https://backstage.io/docs/features/software-templates/writing-templates/). The screenshot references govern the representative shell; no connection to the live demo is required.

## Contextual assistance

Catalog, service detail, Docs, Create, My Group and APIs offer a small “Ask Portal” chat button. It uses the current page, selected service, fixture ownership, guides and team policy. Answers name their fixture sources and can open documentation or continue a concrete setup/service-planning task in the same Portal Assistant, with context preselected. This is deterministic local retrieval, not a live Claude/ChatGPT integration. It does not execute commands.
