> Latest follow-up: [access-recovery-session.md](access-recovery-session.md) confirms the repository is private, authenticated reads succeeded, four real observations were admitted in a test-owned session, browser blocker/replan/restart passed, and validation reached 146 tests. Earlier sections below are historical.

# Activation troubleshooting — 27 October 2026

Freeze **HOLD**. No full six-step demo. HEAD remains `4fd85d5`; all changes are uncommitted. No push, merge, deploy, teammate message or original-checkout edit.

## Reproduced cause and limits

Direct read-only GET to `https://api.github.com/repos/navyaamehta581-ship-it/Spotify-portal-solution` returned GitHub HTTP 404, including a second retry. The owner API returned 200. The exact owner/repository matches this checkout's origin. A public control repository returned 200 with the same request construction; the actual inspector successfully read `octocat/Hello-World` at `7fd1a60b01f91b314f59955a4e4d4e80d8edf11d`. See the local historical inspection record and the local historical inspection record.

The failing request is the first **metadata** read. No branch, commit, tree, blob or file lookup occurs for the project. Default branch/path encoding cannot cause this observed failure. The source is GitHub, not the Vite proxy or local activation API. Existing inspector handles an upstream failure with HTTP 200 and a `blocked` diagnosis; the upstream status appears in its access evidence. Local API route failures instead have local HTTP 404.

`GITHUB_TOKEN` was absent from the process environment. `gh` is not installed, and the configured `osxkeychain` helper returned no GitHub credential with prompting disabled. No credential value was displayed or saved. The inspector reads only `process.env.GITHUB_TOKEN`; it does not read Git's credential helper or automatically load `.env`. Export a previously authorized credential into the inspector process, or start Node with a private `--env-file`. Keep it out of browser variables and committed files.

**Exact established fault:** repository access is unavailable to the unauthenticated inspector process. **Unresolved:** private repository versus renamed/deleted/mistyped origin. An unauthenticated 404 cannot decide between these. There is no token whose permissions can be tested here. An authorized repository owner must confirm the current slug and provide access through the server environment. For a fine-grained credential, check resource owner, selected repository and required read permissions; do not broaden to write access. GitHub documents masking private resource access with 404: https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource .

## Changes

- `server/diagnose.mjs`: preserve exact failing URL and metadata/default-branch/tree/blob stage; report authentication configured/absent without exposing credentials or exception bodies. Existing branch URL encoding retained and regression-tested.
- `server/http-handler.mjs`: local inspector errors now include `{error:{code,message,source:'local_inspector'}}`, distinguishing route errors from upstream diagnosis evidence. Conversation error contract unchanged.
- `server/activation-evidence.mjs` and `.d.mts`: server/operator collector invokes the actual inspector; successful reads become commit-pinned `github_observation` candidates, proof `none`, result `not_checked`, technical CI-readiness scope. Mutable branch citation replaced with inspected commit SHA. Blocked/partial inspections produce **zero** candidate records. Repository contents remain untrusted observations.
- `server/collect-activation-evidence.mjs`: operator command from `prototypes/v1`: `node server/collect-activation-evidence.mjs owner/repo > candidate.json`. Exit 2 means blocked. Candidate JSON is not admission authority.
- Isolated `ActivationPage`: acknowledge successful blocker submission, disable repeated submission after acknowledgment, and require explicit clear for a new command. Uncertain failures preserve the original command bytes and remain retryable. Navyaa's Portal/conversation screens are unchanged.
- `.env.example`: document server-only credential loading. No secrets included.

## Evidence-to-ledger path and remaining live gate

Collector output is deliberately not trusted automatically. An operator reviews exact candidate records into the existing tenant/customer/session-scoped AdmissionBundle, retaining its expiry and matching customer context/plans; restart development API to load the revised registry. Submit the exact records using existing authenticated `POST /api/activation/v1/customers/:customerId/progress` with a new command ID, canonical expectedRevision, revision=expectedRevision+1, current plan/session/milestone, current milestoneStatus, no transitions, needsChris as appropriate, and narrative only in valueDemonstrated. It must pass normal store/contract validation. Keep each JSON request under 16 KiB; large sets need separate reviewed commands at successive canonical revisions. New records must be within the registry's 24-hour freshness limit. Never edit an old record to refresh its date; recollect instead.

The new integration test invokes collector -> exact registry policy -> existing progress -> durable SQLite ledger -> reopen. It rejects modified claims and confirms action stays suggested and outcome unassessed. Its network is a double. Actual public-control observations were saved separately and are **not evidence about Spotify**. No approved real customer context/bundle was supplied and the project inspection is blocked, so no live Spotify evidence was admitted or fabricated. No execution/verification receipt was manufactured.

## Validation and browser scope

Node **24.12.0**, **143 distinct tests passed**, zero final failures:

| Suite | Passed |
| --- | ---: |
| Backend (17 activation + 9 Goal) | 26 |
| Activation contracts | 37 |
| Inspector | 15 |
| Conversation/local-route HTTP | 4 |
| Frontend | 61 |

Backend strict TypeScript, contract strict TypeScript, frontend TypeScript and Vite production build passed (1676 modules). Dependencies reused from prior temporary verification installations; no install/lockfile changes. Validation used an isolated temporary verification location. Initial runs hit local listener restrictions, a collector proof-none sentinel schema failure (fixed to `none`), and a temporary-copy omission of frontend data (corrected). A later accidental typecheck from the source tree lacked installed dependencies; the isolated-copy check passed. These are not hidden passing results; final suites above passed.

Real browser smoke: `/activation` rendered, disabled connect until test identity/credential entered, sent GET through Vite to a temporary in-memory API using the actual createApp handler, displayed NOT_FOUND for the intentionally nonexistent session, and cleared credentials/customer/error on reload. The first browser tab became unavailable; a fresh tab repeated the check successfully. No mocked browser transport. This verifies page/routing/error/reload behavior only, **not** an admitted-session walkthrough, successful initial plan, browser blocker/replan or project GitHub-ledger flow. Component/backend tests cover those narrower behaviors separately.

## MVP acceptance and freeze

| Criterion | Current state |
| --- | --- |
| Briefing + agreed goal | Exact admitted initialization/persistence tested; real customer intake absent |
| Personalized initial plan | Distinct fixtures and pre-reviewed plan selection work; no arbitrary initial generation |
| Developer next action | Isolated page/client integration and component tests; browser smoke only |
| Blocker/replan | Durable worker/CAS/retry and acknowledgment UX tested; operator JSON remains |
| Real project technical evidence | Still blocked at GitHub metadata 404; collector/admission path tested, no live project evidence |
| Chris evidence-linked outcome | Scoped projection exists; no verified adoption/deployment or actual customer outcome |

Existing adapters do not provide an activation plan generator: development worker selects exact reviewed replacements, frontend recommend() returns a different catalog Plan, and the separate Phase B interpreter extracts intent. Reusing these as arbitrary activation planners would require new mapping and admission semantics; no unsafe shortcut added.

Freeze remains **HOLD** for repository access, approved customer context/intake, bounded initial/arbitrary replan generation, live project evidence admission, full admitted-session browser/restart demonstration, full response validation and Navyaa's screen/contract/ownership approval. No new ownership approval inferred. All seven original checkouts still match the saved source hashes, status and commit tips (`outputs/activation-next-preservation.json`). Existing uncommitted work and synced sources preserved.
