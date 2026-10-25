# Conversation workspace review

Branch: `feat/frontend-conversation-workspace`, based on `feat/goal-api` at `af1aa64a5522e608f96f404001d7255b3ab4df4a`. PR #6 was already merged into that base when inspected. No cherry-pick or reimplementation of its backend was necessary.

## Behavior and implementation

Portal Assistant opens the conversation workspace above the existing read-only GitHub diagnosis form. The legacy simulated builder is retained behind an expandable section and explicitly remains separate from chat.

- Create or resume a conversation using the existing `conversationClient` and version 1.0.0 request shapes. The browser saves only the latest conversation ID. Resume is explicit; local draft text is not persisted across refresh.
- Send messages, explicit constraints and, when present, `answersQuestionId`. Confirmed constraints and conversation revisions come from the server; the frontend does not invent or reinterpret them.
- Display role-separated messages, returned stage, completed operation history, developer need, evidence/provenance, hypotheses, capabilities, candidate solutions, and optional artifact content/diff/validation. Artifact presentation never executes anything.
- A network wait is labeled as a server wait, never fabricated investigation progress. Live chat currently records inputs deterministically without an LLM.
- Shared fixture snapshots have a persistent synthetic-example banner. They cannot send, create, resume, or overwrite live state. Switching back preserves the live draft. Existing fixtures and contracts remain unchanged.
- Structured HTTP errors retain their code and status. On revision conflict, reload the latest server state and retain the draft, without automatic resubmission. On uncertain send failures, require a successful reload before retrying because the request might have been saved. Concurrent clicks are guarded synchronously as well as through disabled controls.
- A draft disables new-conversation creation until sent or explicitly discarded. Model/repository text is React-escaped; source links permit only HTTP(S). Styles are scoped to the workspace and collapse the sidebar below the conversation on narrower screens.

`happy-dom` is a development-only dependency for executable React interaction tests. No runtime dependency was added. Existing optional-platform lockfile metadata was preserved.

## Validation

Node 24.22.1:

- `npm test`: 55 passed, including 9 rendered workspace tests and 2 additional client tests.
- `npm run build`: TypeScript and production Vite build passed.
- `npm run test:inspector`: 13 passed.
- `npm run test:phase-a`: 3 passed, including real HTTP/persistence/concurrency checks.
- `git diff --check`: passed.

Rendered tests cover create/send, constraints, resume, conflict recovery, uncertain failure recovery, fixture/live isolation, untrusted evidence, duplicate-send prevention, clarification answer IDs and draft discard. Existing error fixtures all retain their structured codes.

Visual browser acceptance remains outstanding: the environment has no Chromium executable, and Playwright's browser download returned invalid/truncated archives. No screenshot or browser-verified layout is claimed. DOM interaction tests passed; responsive CSS still needs human visual review.

## Review locally

From `prototypes/v1`, run `npm ci`, then `npm run start:inspector` and `npm run dev` in separate terminals. Open `http://127.0.0.1:5173`, choose Portal Assistant, and:

1. Start a conversation; send a goal with a confirmed constraint.
2. Refresh, open Portal Assistant again, and resume the saved conversation.
3. Open the same conversation in two tabs. Send in one, then send from the stale tab; verify latest messages load and its draft remains for review.
4. Switch through example views, inspect evidence and recommendation provenance, then return to live chat and confirm the live state/draft is intact.
5. Check narrow and desktop widths, keyboard focus, long messages and expanded context sections.

The shared contract, controller, fixture corpus, server, goal API and native integration are unchanged. The current backend supports only `unclassified` intent and `phase_a_deterministic` mode; agreed future enum extensions belong to the shared-contract owner. No streaming, LLM, automatic repository investigation, execution or native Portal integration was added.
