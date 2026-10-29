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
| `OLLAMA_NUM_CTX` | `8192` | Upper bound; each run requests the smallest context that fits (4096 for typical inputs), the same for both stages so the model is not reloaded |
| `OLLAMA_KEEP_ALIVE` | `15m` | Keeps the model loaded between stages and runs |

Requests use `/api/chat` with `stream:false`, `think:false`, `temperature:0`, the task's JSON schema as `format`, and an output cap (`num_predict` 1800 for interpretation, 1500 for planning). The schema sent as `format` has its size keywords (`maxLength`, `maxItems`, …) removed: Ollama compiles `format` into a sampling grammar, and those limits become large repetition rules evaluated at every token. The server enforces the limits instead (`fit` in `ollama.ts`, then the validators). Each stage records, summed over attempts: wall time, attempts and each failed attempt's error code, prompt and output tokens, Ollama's own `prompt_eval_duration`, `eval_duration` and `load_duration`, generation speed (output tokens ÷ eval time), thinking characters (expected 0) and truncation. Prompts and responses are never logged. The browser never talks to Ollama.

`handoff/intelligence.ts` runs two tasks with separate prompts and inputs:
1. **Interpret** (sources as numbered lines such as `s2.3`, chunked at about 9,000 characters on line boundaries, results merged; the model cites line ids instead of copying quotes): passages classified into the seven categories (conversation, CRM, Chris's notes, account preparation, technical requirements, repository observation, integration tools), engineering problems, technical facts, stakeholders, contradictions, unknowns and confidential passages. Every item must cite existing lines that share content words with the claim; items that don't are discarded with a reason code (`unknown_line`, `not_supported_by_line`, `name_not_in_sources`, …), never content. Segments may cite a bare source id (`s2`, read as that source's first line); every other item needs a real line id. A person's assigned work is kept only when a cited line makes that person its subject. A transcript speaker (`Maya: Alex can assess the repo`) is not given the work, and work matching someone else's stated work is dropped (`work_not_attributed_to_person`). The same applies to roles: a role label written next to another name on a mixed line (`Champion: Maya. Account owner: Chris`) is replaced by the label the line gives this person (`role_not_attributed_to_person`). People the model skips, and work it dropped, are recalled from the sources when a named person has a stated role or assigned work; nobody is invented. A Champion with no stated work gets the role default "Coordinate the technical evaluation, confirm priorities and approve assignments", marked `workBasis: role_default` so it is never presented as something the customer said. Only repository observations may be *verified*.
2. **Plan** (receives technical facts, problems, stakeholder roles, unknowns and verified repository findings only — never commercial or confidential passages): baseline checks marked verified/reported/suggested/unknown, up to four role-aware milestones, clarification questions. Missing details become investigation actions rather than a reason to skip the milestone. The server drops vague titles (only when no system or technical anchor is named), unsafe list items one by one, and milestones left without two actions, evidence or completion criteria. Each milestone is judged on its own, so one invalid milestone never removes the others. The account owner is not a role the planner can choose, and commercial or executive people never reach the planner. If a model still names the account owner's role or proposes a non-technical person, the milestone is kept but its role becomes `unassigned` or its assignee `null` (`account_owner_role_rejected`, `assignee_not_technical`). Nothing is reassigned automatically: Chris and the Champion decide. A proposed assignee also needs stated work matching the milestone or a role matching the recommended role. Otherwise the assignee is removed (`assignee_role_mismatch`), so a Champion is not handed engineering execution. The customer's engineering problem is shareable technical context. A proposed assignee must be a person named in the sources.

**Developer privacy screen** (`unsafeReason` in `intelligence.ts`). It is applied to every model-written developer field, again in the developer projection (`screenMilestone`) and at publication. It does not rely on what the model marked confidential. It rejects:
- money and commercial terms;
- company headcount figures;
- executive opinions and sponsorship wording (VP, leadership, nice-to-have, budget, …);
- deal stage and evaluation-clock wording (`stage:`, technical validation, a 60-day evaluation, within 60 days);
- non-technical people's names;
- restatements of private passages.

Private passages are Chris's notes, CRM lines, lines the model marked confidential, and lines carrying the wording above. A restatement is detected without exact quotes: a text that reuses three of a private passage's distinctive word stems (stems that occur in no shareable line, rule-based technical finding or technical stakeholder) is rejected. Those stems are derived from the sources only (`Understanding.privateStems`, operator-only), so a model's paraphrase cannot make private words look shareable. A milestone's system must appear in shareable material. An unsafe rationale is removed on its own; the milestone is kept.

**Assignments.** The planner is asked for one milestone per distinct piece of stated work, assigned to that person. The validator enforces the role model:
- An execution milestone (most actions inspect, assess, check, validate, …) is never assigned to the Champion unless the sources give the Champion that work (`champion_not_executor`). Coordination milestones (confirm, approve, schedule) may stay with the Champion.
- When the model's assignee is rejected, the server proposes the one person whose source-stated work clearly matches the milestone (at least two shared stems, a unique best match). It records `assignmentBasis: 'stated_work'` and the code `proposed_from_stated_work`. It stays a proposal like any other.
- Stated work no milestone covers is listed for Chris (`not_covered_by_milestone`); no milestone is invented for it.

**Quality.** A generic Backstage or Portal readiness title that names none of the customer's services or repositories is dropped when such systems are named (`generic_title`). Completion criteria must be observable or countable (`not_measurable` otherwise). Evidence status is limited to verified, reported, suggested or unknown, and *verified* requires a verified repository finding.

Try it: `ollama pull qwen3:4b`, then `PORTAL_LLM_PROVIDER=ollama npm run handoff:scenarios --prefix services/workflow-api` (scenarios A–D in `test/fixtures/scenarios.json`), or start the demo with `PORTAL_LLM_PROVIDER=ollama` set.

Diagnosing a real run (fictional fixtures only):
- `-- --bench` first times one short generation three ways: no format, the grammar the client sends, and the full schema. It then prints how much of the loaded model sits on the GPU (`/api/ps`). Low tok/s in all three means the machine or offload is the limit. A drop only with a format means the grammar is.
- `HANDOFF_CAPTURE_DIR=/some/dir` writes each raw model answer per scenario, stage and attempt, so a discard reason can be traced to the exact output. The server never sets this hook.
- When the developer-view leak check says YES, each matching field is printed with its path and the matched text.
- Model choice: set `OLLAMA_MODEL` (for example `qwen3:1.7b` or `qwen3:4b`); prompts, schema and validation are the same for both.

**Fallback.** Any model failure (`MODEL_UNAVAILABLE`, `MODEL_TIMEOUT`, `INVALID_MODEL_OUTPUT`, `CONTEXT_LIMIT`) produces the rule-based analysis with `understanding.model.ok=false` and the error code. Chris sees “Rule-based analysis · no language model” and a warning naming the error. The rule path proposes no milestone unless a concrete service or repository is named.

**People.** Technical stakeholders (champion, platform, developers, service owners, security) are kept by name and role and reach developers as `handoff.team`. People in commercial or executive roles stay internal, and text naming them is blocked from developer fields.

**Approvals (prepared, no UI).** Each draft carries `approvals` (Chris, Champion: pending) and `assignments` (status `proposed`). Publishing records Chris's approval; the Champion approval stays pending. Developers see an assignee only when its `assignmentStatus` is `approved`, which nothing sets yet. (Now: Chris's **Finalize and publish** sets suggested owners to `approved` and publishes directly, with no Champion approval; see [roles-and-opportunities.md](roles-and-opportunities.md).)

**Tested vs not tested.** Tested against a local stub of Ollama's API:
- request shape, grammar stripping, timeout, unavailable server, invalid JSON with retry, timing sums and non-loopback refusal;
- chunking, line validation, commercial and injection screening, assignment gating, fallback labelling and HTTP-level leak checks;
- replies shaped like the first real retest: bare source ids in segments, a speaker credited with another person's work, a role taken from another name on the same line, and an account-owner milestone next to valid ones.
- replies shaped like the qwen3:1.7b retest: private comments restated in problems, facts, unknowns, rationale, goal and the milestone system, the private line not marked confidential, and both execution milestones given to the Champion.

**Not tested here:** a real model's reasoning, classification accuracy, role-aware planning quality and response times. Ollama is not reachable from the build environment, so those come only from local runs of the scenario script.

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
