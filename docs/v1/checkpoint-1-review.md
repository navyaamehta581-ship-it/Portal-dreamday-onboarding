# Checkpoint 1 continuation — 25 October 2026

**Final completion update:** all Checkpoint 1 fixture and browser acceptance tasks are now complete. The dedicated publishing branch is `feat/checkpoint-1-foundation`, targeting `feat/goal-api` as explicitly selected by the user.

## Inspection result

Inspected the uncommitted previous-session implementation, `phase-a-handoff.md`, source, tests, scripts and CI on `feat/github-context-ui` (base e66d274). Reused all existing implementations. No LLM, new reasoning, artifact generation, repository access or execution was added.

| Requested area | Status on arrival | Work completed now |
| --- | --- | --- |
| Message, AgentState, DeveloperNeedProfile, Evidence, Capability, CandidateSolution, WorkflowArtifact | Implemented, versioned 1.0.0 | Added compile-time negative checks and fixture/provenance/preservation tests; retained existing types. Added named creation-request and fixture-response envelopes, plus transport-error codes. |
| Chat create/read/message endpoints and persistence | Implemented, previously tested in process | Tested real HTTP requests, local storage reload, multi-turn constraints and concurrent revision rejection. Reused durable storage unchanged. |
| Backend stages and read-only boundary | Implemented as backend operation history | Added tests rejecting client-supplied stage/evidence/boundary fields. Added non-negative integer revision validation. |
| Consistent errors | Partial: transport errors returned empty objects | All conversation HTTP error paths now use the versioned ErrorResponse envelope, including Host/Origin rejection, media type, size, JSON parsing and unexpected failures. Legacy inspector response shape preserved. |
| Frontend example fixtures | Implemented as imports | Reused those fixtures; added typed development bundle and GET fixture endpoint. |
| Backend development integration support | Real no-model API existed; no fixture endpoint | Added read-only GET `/api/conversations/v1/fixtures`, tested without a model/token. |
| Automated checks | Existing frontend and in-process backend tests | Added HTTP/error cases, contract boundary checks and Phase A CI step. |

## GitHub and VS Code handoff

The team will work from GitHub in VS Code. No local Backstage installation is required or configured. After checking out `feat/checkpoint-1-foundation`, open the repository in VS Code. Frontend work can begin directly with the fixture imports below; running the V1 prototype is optional. The temporary preview servers used for acceptance verification have been stopped.

## Teammate integration

Canonical contract: `prototypes/v1/src/phase-a/contract.ts`, version `1.0.0`. Runtime imports in shared fixture/controller modules use `.ts` extensions so both Vite and Node's native TypeScript support can consume the same files. No new dependencies or lockfile changes.

Two independent options:

1. **Frontend only:** import `developmentFixtures` from `src/phase-a/fixtures.ts`. Its `examples.empty` and `examples.confirmedConstraint` are full StateResponses; `examples.conflict` is an ErrorResponse. Existing `fixtureResponse` and `conflictFixture` exports remain compatible. Additional optional examples now include `multiTurn`, `clarification`, `investigation`, `recommendation`, and `errors` (all eight error codes). These are deterministic synthetic examples, not live findings. Each scenario retains the confirmed constraint; evidence, capability, hypothesis and solution references are tested for consistency. The backend route returns the same scenarios.
2. **Local backend integration:** from `prototypes/v1`, run `npm run start:inspector` and, separately, `npm run dev`. Use relative `/api/conversations/v1` URLs through Vite on http://127.0.0.1:5173. No LLM or GitHub token is needed for conversation routes or fixtures. The diagnosis endpoint remains separately available.

Routes:

| Method/path | Request | Response |
| --- | --- | --- |
| GET `/api/conversations/v1/fixtures` | none | 200 FixtureResponse: `{contractVersion,mode:"development_fixture",examples}` |
| POST `/api/conversations/v1` | `{contractVersion:"1.0.0"}` | 201 StateResponse |
| GET `/api/conversations/v1/:id` | none | 200 StateResponse |
| POST `/api/conversations/v1/:id/messages` | `{contractVersion:"1.0.0",expectedRevision:0,content:"Deploy service",confirmedConstraints:["Keep tests unchanged"]}` | 200 StateResponse |

Use the existing `conversationClient` for create/read/send; fetch the fixture endpoint directly when desired. IDs in static fixtures do not identify persisted conversations: create a real conversation for interactive send/resume. On 409, GET the latest state before resubmitting the user's draft. Save only the conversation ID in the browser; message/constraint state belongs to the backend.

Errors always use `{contractVersion:"1.0.0",error:{code,message}}` for conversation URLs. Codes/statuses: INVALID_REQUEST and UNSUPPORTED_VERSION 400; FORBIDDEN 403; NOT_FOUND 404; REVISION_CONFLICT 409; PAYLOAD_TOO_LARGE 413; UNSUPPORTED_MEDIA_TYPE 415; INTERNAL_ERROR 500. Render messages as text. Content type must be application/json for non-GET requests; total request-body limit is 8192 bytes, message 4000 characters, at most 20 explicit constraint strings of 500 characters each (the total byte limit still applies).

Confirmed constraints are explicit user inputs and persist across messages/store reloads. Plain text remains developer-statement evidence. Verified evidence, inferred evidence, need-profile assumptions and hypotheses have distinct fields/statuses; user requests cannot populate backend-controlled evidence or stages. Controller tests verify preservation without changing their meaning.

Stages are honest completed backend operations: `understanding_request` records input/constraints, then `ready` assembles the deterministic response. `events` contains their sequence and timestamps. Other declared stages remain unused until corresponding operations exist. There is no live stage stream; do not animate investigation or label the browser's network wait as an agent reasoning stage.

## Verification and remaining work

Actual final results:

- `npm test`: **44 passed**, including three contract/provenance/scenario tests.
- `npm run test:inspector`: **13 passed**, existing injected GitHub-provider suite.
- `npm run test:phase-a`: **3 passed** (durability/concurrency plus two real HTTP integration scenarios with multiple assertions).
- `npm run build`: **passed**, including compile-time negative checks for read-only boundaries, evidence statuses, capability statuses and non-execution artifacts.
- Existing integration goal API: **9 tests passed on Node 24.22.1**, including separate-process restart persistence; `npm run check` **passed**.
- Inspector and conversation suites also passed on Node 24.22.1 (16 combined backend tests); V1 tests/build used installed Node 26.0.0.
- Blueprint/backlog validation: **passed**, 516 unique atoms with consistent dependency tracking.
- `git diff --check`: **passed**.
- Backstage V2 before/after porcelain statuses: **identical**; no V2 files were written.

The first HTTP attempt was blocked from opening a loopback port; rerunning with local-port permission reached the server. A subsequent failure was in the test client's Host override (fetch did not send it); the test now uses Node's HTTP client and passes. These were not silently skipped tests.

Checkpoint 1's requested backend/contract/fixture scope is complete. Browser acceptance passed in the running app: created a synthetic deployment conversation, confirmed "Existing tests must remain unchanged.", refreshed the page, reopened Portal Assistant, resumed the saved conversation and saw the same conversation ID, messages and constraint. A later turn retained the constraint at revision 2. Screenshot: [browser verification](checkpoint-1-browser.png). Rendered component automation and further presentation improvements are optional frontend follow-up; the required refresh/resume acceptance was verified. Production identity, multi-process storage, retention and deployment remain outside this local foundation. The existing store is single-process and persists under ignored `server/phase-a/.data/`; development fixtures are read-only and never saved there.

No LLM or new reasoning is connected. Future interpretation, investigation, recommendation and artifact stages are separate phases. Publication is authorized on the dedicated feature branch, with a PR targeting `feat/goal-api`; no direct push to main. Use the published PR branch as the common source snapshot before branching independently. Do not work in the same dirty checkout simultaneously. Backend owns `server/phase-a/`, `server/http-handler.mjs` and controller; frontend owns panel/client/presentation tests; coordinate shared contract/fixtures changes.

## Integration base and preserved features

The fetched `feat/goal-api` base is b6a23a8 and contains an independent goal-creation service under `services/workflow-api/`, its SQLite store and `contracts/goals.ts`. Those files and their interfaces are preserved. Its default port is 7007; the existing V1 read-only inspector and new conversation API share 8787, proxied through the V1 frontend on 5173. No automatic link from a saved Goal to a conversation is claimed. Goal and conversation contracts describe different resources; no duplicate conversation contract was introduced.

The PR also carries the two previously local read-only inspector prerequisite commits (569c6b8/e66d274) because they were not in the integration branch and the foundation deliberately reuses their server and portal integration. No Backstage V2 work or unrelated cleanup is introduced by the feature branch. Existing integration-branch blueprint changes are retained, not re-authored as feature changes.
