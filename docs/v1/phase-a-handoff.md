# Phase A checkpoint — contract 1.0.0

**Latest continuation:** see `docs/v1/checkpoint-1-review.md`. It supersedes the original HTTP-error, fixture-availability, test-count and live-transport limitations below.

## Inspection and preservation

25 October 2026. Inspected `docs/v1/github-inspection.md`, source modules, package scripts, Git branches/status, and the complete attached `Untitled.txt` Thinking Frameworks plan recovered through the referenced conversation. Prior assistant answers were returned as unavailable content references; they were not used as implementation evidence.

V1 started clean on `feat/github-context-ui` at e66d2743cbc97f37bea8c65a5e4b78684bdbd774. Local backend branch: `feat/github-context-backend` at 569c6b8; collaboration branch: 8f3aa38. No branch was switched, reset, committed or pushed. The new work remains uncommitted and reviewable here. `git ls-remote --heads origin` failed because github.com could not resolve; remote freshness remains unknown. Origin is https://github.com/navyaamehta581-ship-it/Spotify-portal-solution.git.

Separate `../spotify-portal-v2` remains on `feat/portal-experience` at 9cd4082, with tracked edits and untracked native Backstage packages, configuration, verification and browser tests. Its before/after porcelain statuses match. No files there were written. This is preservation of unfinished work, not verification of V2 functionality.

## Implementation/reuse map

| Existing implementation | Reuse and boundary |
| --- | --- |
| `server/diagnose.mjs` | Keep read-only immutable-revision GitHub inspection, citation validation and failure handling. Phase C will adapt this into conversation evidence; not called by chat yet. |
| `server/index.mjs` | Reuse loopback HTTP server, Host/Origin checks, bounded JSON requests and server-only credentials; add versioned conversation dispatch. |
| `src/portal/RepositoryDiagnosis.tsx` | Keep existing diagnosis form/evidence display independently usable. |
| `src/portal/Portal.tsx` | Mount new conversation panel beside existing tools, without replacing Architect. |
| `src/portal/Architect.tsx`, `src/logic/conversation.ts` | Existing fixture/task conversation and team-policy context remain separate; do not mistake fixture context switching for general language interpretation. |
| `src/logic/engine.ts`, `assistant.ts`, `evidence.ts` | Preserve deterministic workflow planning and evidence logic; review suitability during Phases C/D rather than porting fictional claims into live state. |
| `src/logic/generate.ts`, `execution.ts` | Preserve generation/simulated execution demo. Not connected to new chat. Phase E must introduce grounded artifact validation; simulation is not deployment evidence. |
| `src/phase-a/contract.ts` | New single TypeScript contract consumed by both workstreams. |
| `src/phase-a/controller.ts`, `server/phase-a/` | New deterministic state reducer, durable local storage and routes. No model or repository mutation tools. |
| `src/phase-a/client.ts`, `ConversationPanel.tsx`, `fixtures.ts` | New frontend client, panel and stable fixture responses; frontend can work without a running backend through fixtures. |
| unfinished Backstage V2 | Deferred host adaptation; do not copy dependencies or overwrite packages. |

## Shared interface

Canonical source: `prototypes/v1/src/phase-a/contract.ts`. Pin `contractVersion: "1.0.0"` in requests and responses. Breaking changes require `/v2`; coordinate optional additions before use. TypeScript describes the wire format, while the backend validates message inputs at runtime. This is not yet a general runtime schema validator for all future model outputs.

- POST `/api/conversations/v1` with `{ "contractVersion": "1.0.0" }`: 201 StateResponse.
- GET `/api/conversations/v1/:id`: 200 StateResponse.
- POST `/api/conversations/v1/:id/messages` with `{ "contractVersion": "1.0.0", "expectedRevision": 0, "content": "Automate deployment", "confirmedConstraints": ["Keep existing tests unchanged"] }`: 200 StateResponse.
- `answersQuestionId` is accepted only for the currently pending question; Phase A does not invent clarifications. Later intelligence must set a justified question.
- Application errors: INVALID_REQUEST/UNSUPPORTED_VERSION → 400; NOT_FOUND → 404; REVISION_CONFLICT → 409; INTERNAL_ERROR → 500. Response shape is `{contractVersion,error:{code,message}}`. Existing outer HTTP transport rejection paths (Host/Origin, media type, body size) retain their earlier responses and are not application contract errors.
- Fixtures: `src/phase-a/fixtures.ts` exports a full successful multi-turn-ready StateResponse plus a conflict ErrorResponse. Use these imports rather than manually duplicating JSON.

AgentState includes message history, need profile, hypotheses, evidence, capabilities, confirmed constraints, candidates, optional selection/artifact/question, revision, stage and append-only operation history. All requested stage names exist, plus `ready`. Only understanding_request and ready actually execute in Phase A: input/constraint recording and response assembly. The frontend shows returned operations; no timers manufacture investigation/generation states. History is delivered after completion, not streamed live. Later long-running operations will need polling or streaming.

Explicit constraint input is the confirmation mechanism. Plain message content is preserved as a developer statement, not silently promoted to a confirmed constraint or verified finding. Constraints retain source-message references and survive later messages and backend restarts. No semantic extraction, intent classification, conflict detection, diagnosis or proposal is claimed. The five intent categories are deliberately unclassified until their authoritative definitions are available for Phase B.

Evidence separates verified/inferred/developer_statement. No live evidence is fabricated. Chat returns no candidate solutions or artifacts. Every conversation has read_only boundary and phase_a_deterministic mode.

## Run and independent work

Use Node 24+ with native TypeScript stripping (verified here on Node 26.0.0). Existing dependencies are available through the pre-existing ignored node_modules symlink; no dependencies/lockfile changes or fresh registry installation were needed.

From `prototypes/v1`, run `npm run start:inspector`, then `npm run dev` in a second terminal. Open http://127.0.0.1:5173 → Portal Assistant → Conversation foundation. New conversation → enter goal and explicit constraint → send another message → resume after refresh/restart. Do not expose this development server publicly.

Local state is atomically saved under ignored `server/phase-a/.data/` with restrictive file permissions. Browser stores only the ID under `portal-conversation-v1`. This is single-process local development storage, without production authentication, multi-process locking, encryption, retention controls or shared-user authorization. Read-only boundary means no target repository mutation; local conversation persistence is intentional.

### User: backend next tasks

1. Review contract/controller/store/routes and the durable multi-turn test. Verify a restart and stale revision manually through the UI.
2. On a separate backend working branch/check-out based on the integrated e66d274 baseline plus these shared files, own `server/phase-a/`, controller and backend tests. Do not start from 569c6b8 without bringing forward the later integration fixes.
3. Before Phase B, obtain the authoritative five intent definitions/boundaries. Add structured runtime schemas for model outputs, constraint contradictions and clarification decisions, then an isolated model adapter. Keep repository/tool permission authority in the backend.
4. Coordinate contract edits first. Phase C should reuse diagnose.mjs through a purpose-linked tool adapter, preserving revision/source/error semantics.

### Teammate: frontend next tasks

1. Own `ConversationPanel.tsx`, `client.ts`, frontend tests and presentation. Start independently using fixtureResponse/conflictFixture; no backend/token required.
2. Add rendered UI tests covering new/resume/send, error recovery, duplicate-send disablement, constraint display and evidence status labels. Exercise the actual browser against the local server before calling the integration checkpoint fully verified.
3. Improve layout/accessibility, explicit clarification answers, confirmed-constraint editing with backend agreement, and evidence presentation. Do not add decorative stage progress; use backend event data only.
4. Use separate branches/check-outs when working asynchronously. Exchange commit IDs and test output rather than switching this dirty checkout. No push, automatic PR or merge is authorized by this checkpoint.

### Shared handoff procedure

Review and commit shared contract/controller fixtures first on an agreed foundation branch, then branch both workstreams from that exact commit. Backend owns persistence/routes, frontend owns panel/client; shared contract/fixtures require both reviews. Changes remain local until the team chooses to publish them. Pass conversation ID, contract version, base commit, test commands/results and known limitations with each handoff; never pass tokens or local conversation data by default.

## Actual verification

- Vitest: 41 passed (39 existing + 2 frontend transport/fixture tests).
- Existing inspector Node suite: 13 passed with injected provider responses.
- New Phase A Node suite: 1 integration test passed, exercising multiple turns, constraint preservation, developer-statement provenance, real event sequence, restart durability, concurrent revision protection, invalid inputs and application routes.
- TypeScript/Vite production build: passed.
- `git diff --check`: passed. V2 status before/after: identical.
- An initial test-file creation attempt used the wrong working directory and failed without creating files; corrected and reran successfully.

Not verified this session: actual browser rendering/interactions, live HTTP transport for new routes, remote branch freshness, live GitHub success, fresh npm ci, multi-user production behavior, or the broader reasoning evaluation. Phase A foundations are implemented and unit/in-process integration tested; browser/transport acceptance remains the next joint checkpoint. No LLM is connected, even though the deterministic foundation is now implemented. Phases B–F remain separate work.
