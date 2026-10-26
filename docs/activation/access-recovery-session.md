# Authenticated access recovery — 27 October 2026

**GitHub access recovered through the signed-in browser and connected account. Freeze remains HOLD.** The earlier report's uncertainty about repository existence is resolved. No full real-customer demo is claimed.

## Exact 404 cause and resolution

The Chrome session already had access to `navyaamehta581-ship-it/Spotify-portal-solution`, visibly labeled **Private**. The slug is correct; the repository exists. Its main view pointed to `a32e3c1fd2da2f24f80ec8d6c4e238746754f76a`. The standalone Node inspector had no GITHUB_TOKEN and was making anonymous GitHub REST requests. That explains the masked metadata 404. It was not a local route, branch, path or request-encoding problem.

The user installed/connected GitHub during this session. Installation was confirmed through plugin management. A read-only connected-account diagnostics request then succeeded for PR #8, returning:

| Check | Head commit | Result |
| --- | --- | --- |
| goal-api | `65bd2b2f849756dca936e67bb96d1bc44e5428dc` | completed / success |
| V1 tests and build | `65bd2b2f849756dca936e67bb96d1bc44e5428dc` | completed / success |

Authenticated browser inspection read `.github/workflows/goal-api-ci.yml` and `v1-ci.yml` pinned to main commit `a32e3c1fd2da2f24f80ec8d6c4e238746754f76a`. Both already exist and should be reused. No complete-tree claim, new workflow execution, branch protection verification or deployment claim is made. PR #8 CI is historical evidence about its own head, not the current uncommitted activation work.

Connecting Codex does **not** export an OAuth credential into the separate local Node server. Fresh automatic reads through the standalone `/api/diagnose` still require its own server-side credential. This session instead used the authenticated browser and connected-account read capabilities to collect exact observations. No cookie, OAuth token, password or other secret was extracted, printed, copied into source or passed to the local API. A future direct-inspector credential must be configured server-side; the successful connected read must not be described as a repaired standalone token configuration.

## Actual evidence admission

`evidence/authenticated-project-inspection.json` contains four real observation records: two pinned workflow-file observations and two remote CI check-result observations. Producers distinguish browser inspection from connected-account diagnostics. Every record has its actual source, commit, collection time, technical scope, `proof:none` and `result:not_checked`. Describing the observed GitHub result as success does not mint an activation verification receipt.

These exact records were admitted through the existing scoped `registryPolicy`, then authenticated POST `/progress`, into SQLite in an **explicitly test-owned customer session**. The request returned 200 at revision 1 with four GitHub observations and outcome unassessed. Tampered record rejection and reopen persistence are covered by a new regression test using the real captured bytes. The test clock is fixed at collection time; it does not refresh old evidence timestamps.

The customer context, agreement, blocker and plans for this browser validation are test doubles, visibly labeled in the page. No real customer agreement or Chris approval was inferred. Real GitHub evidence was not converted into business-outcome proof. No live customer ledger was created.

## Small initial-plan integration fix

POST `/api/activation/v1/customers/:customerId/state` now accepts `{context}` in addition to `{context,plan}`. An optional server-side initialPlan adapter selects an exact reviewed initial plan. Development mode matches principal and exact context, contextRevision, plan revision 0 and null supersedesRevision in the operator-owned bundle. Normal store plan/context/evidence admission remains authoritative; no matching adapter/plan returns ADAPTER_UNAVAILABLE/503. The browser client and isolated initialization control support omission of the plan.

This removes client-side plan copying for reviewed sessions. It is **reviewed-plan selection**, not arbitrary plan generation. No intent-extraction adapter was misrepresented as a planner, and no authority was added to a model response. Full initial/free-text replacement generation remains open.

Changed implementation files in this follow-up: `services/workflow-api/src/activation/{routes.ts,dev.ts}`, `services/workflow-api/test/activation.test.ts`, `prototypes/v1/src/activation/{client.ts,client.test.ts,ActivationPage.tsx}`. New evidence and this report are under `docs/activation/`. Prior work remains preserved and uncommitted.

## Real browser/API/restart verification

Used the actual ActivationPage/client -> Vite proxy -> createApp handler -> registryPolicy -> SQLite and replan worker, with no mocked browser transport. Harness and test SQLite are isolated under an isolated temporary verification location; no customer database was touched.

1. Context-only HTTP initialization selected the reviewed initial plan, returned 201/revision 0.
2. Actual collected observations were admitted with authenticated progress, returned 200/revision 1.
3. Browser loaded the admitted test session and rendered all four actual observations with source and revision.
4. Browser submitted the exact admitted test blocker. Revision 2 showed the original action blocked, replan pending, and submission acknowledged/disabled.
5. Browser refresh showed revision 3, planRevision 1, replan ready, and changed next action: prepare a checklist for developer-provided configuration. Replacement remained suggested; outcome unassessed.
6. Stopped and restarted the API process on the same test database; reloaded the browser, re-entered the in-memory test credential and loaded the saved session. Revision 3, replacement, all four observations and unassessed outcome survived.

The temporary browser validation record and screenshot remain local and are excluded from the handoff. This is a real browser test of the admitted **test** session mechanics, not a full customer activation demo. No real customer intake, arbitrary generation, automatic connector-to-server collection or independently verified customer outcome was demonstrated.

## Validation and preservation

Node **24.12.0**, **146 distinct tests passed**: backend 28 (19 activation + 9 Goal), contracts 37, inspector 15, conversation/local-route 4, frontend 62. Backend and frontend strict typechecks and production build passed; contract strict check remained passing from the prior run (contract code unchanged). Build: 1676 modules. No package or lockfile changes. Validation reused previously installed temporary dependencies.

The browser scenario is additional manual verification, not added to the unit-test count. Source checks and all seven original checkouts still match the recorded hashes, status and commit tips. HEAD remains `4fd85d5`; all work is uncommitted. No push, merge, deploy, deletion, teammate message or change to Navyaa's Portal/conversation screens.

## Current MVP and freeze

| Criterion | Current evidence / remaining gate |
| --- | --- |
| Briefing/agreed goal | Canonical test initialization; real customer intake/agreement still needed |
| Initial plan | Server-selected reviewed initial plan now works; arbitrary generation absent |
| Developer view | Real browser loaded canonical state and actual observation ledger |
| Blocker/replan | Real browser submission, changed action, refresh and process restart demonstrated with test-owned context |
| Project GitHub evidence | Authenticated project files and live connected check results collected; exact observation admission demonstrated; standalone inspector credential still absent |
| Chris outcome | Unassessed projection remains truthful; real customer report/ownership review absent |

Freeze **HOLD** for real customer intake, bounded arbitrary planning, native production integration/identity, full response runtime validation and Navyaa's contract/view ownership approval. The earlier blanket "no authorized project inspection" blocker is resolved; do not keep reporting it. The narrower standalone server credential/automatic collection limitation remains explicit.
