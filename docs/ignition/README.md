# Northstar Ignition Challenge

Implemented from main `c685250` on `feat/northstar-ignition`.

## Start and demo

```sh
cd prototypes/v1
npm ci
IGNITION_DEMO=1 npm run dev -- --port 5186
```

Open http://127.0.0.1:5186/ignition. The existing `/`, `/portal`, `/activation` and `/operator` routes are preserved. This extension uses their shared Shell, tokens, typeface and navigation. It does not replace the existing authenticated activation API.

1. Choose Chris and Enter demo. Expand the three private source records. Add a manual source or click Simulate Claude Agent import. No agent is contacted.
2. Extract a review draft. Inspect held-back commercial material, source citations, developer context and unresolved Okta/GitHub claims. Review both fields, check the approval box, and publish v1.
3. Optionally choose Maya. Team Activation already contains the agreed workflows. Prioritize documentation or ownership, add an optional goal, and simulate inviting Alex/Jordan. No questionnaire, email or discovery duplication. Developers can start without this step.
4. Choose Alex. Open a fixture, follow the steps and enter `team-payments` for ownership or `Payments recovery` for docs. A wrong answer is rejected. A correct answer creates a server-validated simulated outcome.
5. Open the floating AiKA helper for workflow-specific scripted guidance. Technical support prepares a copyable, unsent draft. Chris is an account escalation after support triage, not a technical inbox.
6. Choose Jordan and verify another outcome. Return to Chris, revise the approved handoff and approve v2. Open Adoption overview: the v1 outcomes remain intact with their original timestamps and version.
7. Refresh to see server-held state. Restarting the server resets this fictional demonstration.

## Scope and trust boundaries

Northstar Engineering is fictional: 500 employees, 80 engineers, 30-day POC, approximately $100K potential. Maya is champion; Alex and Jordan form the two-developer demo cohort. The goal is service ownership and documentation for payments-api on GitHub. Okta remains unverified with conflicting notes. Commercial details stay in Chris's projected response and are not sent to champion/developer views.

The demo API is opt-in (`IGNITION_DEMO=1`), localhost-only, same-origin for writes, with HttpOnly SameSite cookies, session expiry, server-selected role/tenant, per-role mutations, response projection, body limits and optimistic revision checks. The browser cannot assign a tenant or grant itself operator rights through a mutation body. The explicit demo persona selector deliberately permits switching fictional roles. It is **not production authentication** and must never accept real customer data. The existing Portal authentication is untouched.

Handoffs append immutable approved snapshots. A new snapshot does not erase previous outcomes. Individual developers see their own evidence; Chris and Maya see cohort summaries. An invite is never counted as adoption. Outcomes mean correct answers against synthetic fixtures, not real access checks, live usage, or production readiness. Extraction is a conservative heuristic plus mandatory human review, not a security-grade DLP system. Both published fields reject obvious commercial/secret markers, but human review is still essential.

No live Spotify Insights, HubSpot, Gong, Claude Agent, GitHub, Okta or AiKA connection exists in this extension. It does not send invitations or support tickets. Its state is process memory, not durable storage. It is a Vite local middleware prototype, not a deployed backend. Refresh is manual across separate views. Production work requires durable tenant storage, real authorization, auditing, connector consent and evidence-based telemetry.

## Phases and files

- Phase 1: `server/ignition.mjs`, declaration and HTTP/domain tests: private sources, role projection, revisions, optional preferences and per-developer outcomes.
- Phase 2: `src/ignition/`: extraction, customer files, champion preferences, developer workflows, contextual helper and adoption summaries; `src/main.tsx` and `vite.config.ts` wire the separate demo route.
- Phase 3: `e2e/ignition.mjs`, extraction test and this guide: repeatable walkthrough, screenshots and refinement prompt.

Paths above are relative to `prototypes/v1`. The baseline already had extensive unit/HTTP tests. Existing Portal screenshots in the adjacent local `spotify-portal-references` folder informed preservation of the shell and welcome. The referenced chat's image attachments and full history were unavailable; the user's explicit implementation brief is authoritative.

## Verification

```sh
npm run build
npm test
node --test server/ignition.node-test.mjs server/portal-session.node-test.mjs
# With the demo running, and Playwright installed:
node e2e/ignition.mjs
```

The browser script accepts `PLAYWRIGHT_MODULE_PATH`, `CHROME_PATH`, `IGNITION_URL`, and `IGNITION_EVIDENCE` for a local browser installation and output directory. It is intended for a fresh demo server. Browser captures are in `screenshots/`.
