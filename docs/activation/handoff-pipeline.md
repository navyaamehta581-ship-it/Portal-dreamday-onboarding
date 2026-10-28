# Customer context → developer handoff pipeline

Chris pastes unstructured customer sources; the server turns them into a reviewed, developer-safe technical milestone. Developers never receive the sources or Chris's research.

```
sources (CRM, transcripts, notes, account prep, requirements, repository observations)
  → interpret        handoff/interpret.ts (rule-based) or handoff/hosted.ts (optional model)
  → understanding    findings + goals + entities + contradictions + ranked unknowns, with provenance
  → propose          handoff/milestones.ts — playbook milestones, or the information Chris must collect
  → Chris reviews    Activation Goal tab: edit objective, why, actions, output, completion criteria
  → publish          handoff/service.ts — confidential-content check, then admission through the existing store
  → project          handoff/project.ts — developer view applied server-side to every state response
```

## Data and storage

| Data | Where | Who can read it |
|---|---|---|
| Raw sources, full understanding, proposals, drafts | `activation_handoffs` table (one row per draft) | Operator token only (`GET /handoff`, `POST /handoff-drafts`) |
| Published developer handoff | Same row, `developer` field | Attached to state responses |
| Session state (context, plan, evidence) | `activation_sessions` | Operator: as stored. Developer: projected |

Types: `contracts/activation/v1/handoff.ts` (additive, outside the frozen 1.0.0 schema). Publication still produces contract-valid `CustomerContext` and `ActivationPlan` records and goes through the existing exact-admission path (`intake.stage`).

## Interpretation

**Rule-based (default; always used by the local demo).** Statements are split per line and sentence; transcript timestamps and speaker prefixes are removed and the speaker kept for provenance. Each statement is classified as commercial, stakeholder, evaluation, internal note, business need, technical fact, technical requirement or repository observation. Internal categories win, so a sentence that mentions money is never treated as technical. Technical facts are *restated from extracted entities* (service names, repositories, source control, sign-in, docs, CI, runtime, ownership, catalog metadata) rather than quoted. Hedged statements become *unconfirmed*, superseded platforms (“we used to run Jenkins”) *outdated*, disagreeing sources *conflicting*, and repository observations *verified*. Recognised needs (for example, a platform team repeatedly walking teams through the same setup) map to a playbook. This is pattern matching over a fixed vocabulary, not general language understanding; statements it cannot classify stay internal for Chris and are never passed on.

**Model-assisted (optional).** When the server has `PORTAL_LLM_ENDPOINT`/`PORTAL_LLM_MODEL` and a key (`PORTAL_LLM_API_KEY`, or `OPENAI_API_KEY` for the OpenAI endpoint), `hosted.ts` asks for structured findings and goals against a strict JSON schema. Every quote must be a literal substring of its source and every service/repository name must appear in the sources; any violation or provider error falls back to the rule-based result. Model findings are shown to Chris only; developer text is still template-generated. The demo launcher clears model credentials, so it always uses rule-based interpretation. Sources are sent to the configured provider only when an operator configures one.

## Local model (Ollama) — Phase 1

`services/workflow-api/src/llm/ollama.ts` is the shared server-side client (customer interpretation, planning, and later AiKA). Configuration, all server-side:

| Variable | Default | Meaning |
|---|---|---|
| `PORTAL_LLM_PROVIDER` | unset | `ollama` turns the local model on; unset means rule-based only |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Loopback HTTP or HTTPS only |
| `OLLAMA_MODEL` | `qwen3:4b` | Any pulled Ollama model |
| `OLLAMA_TIMEOUT_MS` | `180000` | Per request; a timeout is not retried |
| `OLLAMA_RETRIES` | `1` | Retries after invalid output or an unavailable server |
| `OLLAMA_NUM_CTX` | `16384` | Context window requested from Ollama |

Requests use `/api/chat` with `stream:false`, `think:false`, `temperature:0` and the task's JSON schema as `format`. Prompts and responses are never logged. The browser never talks to Ollama.

`handoff/intelligence.ts` runs two tasks with separate prompts and inputs:
1. **Interpret** (sources, chunked at about 9,000 characters on line boundaries, results merged): passages classified into the seven categories (conversation, CRM, Chris's notes, account preparation, technical requirements, repository observation, integration tools), engineering problems, technical facts, stakeholders, contradictions, unknowns and confidential passages. Every item must quote its source exactly; items that don't are discarded and counted. Only repository observations may be *verified*.
2. **Plan** (receives technical facts, problems, stakeholder roles, unknowns and verified repository findings only — never commercial or confidential passages): baseline checks marked verified/reported/suggested/unknown, up to four role-aware milestones, clarification questions. The server drops vague titles, work assigned to the account owner, commercial text, and milestones without concrete actions, evidence and completion criteria. A proposed assignee must be a person named in the sources.

Try it: `ollama pull qwen3:4b`, then `PORTAL_LLM_PROVIDER=ollama npm run handoff:scenarios --prefix services/workflow-api` (scenarios A–D in `test/fixtures/scenarios.json`), or start the demo with `PORTAL_LLM_PROVIDER=ollama` set.

**Fallback.** Any model failure (`MODEL_UNAVAILABLE`, `MODEL_TIMEOUT`, `INVALID_MODEL_OUTPUT`, `CONTEXT_LIMIT`) produces the rule-based analysis with `understanding.model.ok=false` and the error code. Chris sees “Rule-based analysis · no language model” and a warning naming the error. The rule path proposes no milestone unless a concrete service or repository is named.

**People.** Technical stakeholders (champion, platform, developers, service owners, security) are kept by name and role and reach developers as `handoff.team`. People in commercial or executive roles stay internal, and text naming them is blocked from developer fields.

**Approvals (prepared, no UI).** Each draft carries `approvals` (Chris, Champion: pending) and `assignments` (status `proposed`). Publishing records Chris's approval; the Champion approval stays pending. Developers see an assignee only when its `assignmentStatus` is `approved`, which nothing sets yet.

**Tested vs not tested.** Tested against a local stub of Ollama's API: request shape, timeout, unavailable server, invalid JSON with retry, non-loopback refusal, chunking, quote validation, commercial/injection screening, assignment gating, fallback labelling and HTTP-level leak checks. **Not tested:** a real model's reasoning, classification accuracy, role-aware planning quality and response times — Ollama could not be installed in the build environment.

## Milestones

Playbooks: `service_readiness`, `techdocs`, `scaffolder`, `ci_investigation`. Each milestone has an objective, system (service, repository, platform), why it matters in engineering terms, concrete actions, prerequisites, required information, Portal destinations, expected output, completion criteria, dependencies and developer-resolvable unknowns. If no concrete service or repository is named, no milestone is produced and Chris sees what to collect instead.

## Privacy guarantees

- Developer responses are projected in `routes.ts` for every non-operator principal: briefing → technical summary; constraints → technical notes; unknowns → developer-actionable ones; agreement attribution → “Customer team (via Chris)”; Chris's evidence records → a source category and a short technical conclusion; plan text → the approved milestone. Records created before this pipeline are projected the same way.
- Publication is rejected (`CONFIDENTIAL_CONTENT`) if developer-facing milestone fields contain money/commercial terms or text from internal findings.
- Unknowns are ranked (*blocks the first milestone*, *needed later*, *not needed now*) and assigned to the developer or Chris; only developer-actionable ones reach developers.
- Tests: `services/workflow-api/test/handoff.test.ts` (interpretation, milestones, projection, model validation, HTTP leak checks on state, progress and blocker responses), `prototypes/v1/e2e/activation.mjs` (browser and network-level leak checks).

## Versions

Drafts are numbered (“Draft 2 · not published”); publishing freezes one as “Published version 1”. Plan versions are shown from 1 (“Version 2 · updated after a blocker”). A published plan is never overwritten; republishing a changed handoff for an existing session is not supported yet.

## Not in this change

Champion approval UI, Champion Insights, task assignment UI, AiKA integration, Developer Insights, automatic progress events, workflow notifications, role selection and deeper repository analysis are separate, later steps.
