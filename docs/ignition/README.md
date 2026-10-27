# Northstar workspaces

Start from prototypes/v1:

```sh
npm ci
IGNITION_DEMO=1 npm run dev -- --port 5187
```

Each surface has its own sign-in and workspace, with no persona switcher or cross-role navigation:

| Surface | Login | Demo email | Workspace |
|---|---|---|---|
| Chris | http://127.0.0.1:5187/ignition/chris/login | chris@northstar.example | /ignition/chris |
| Champion Maya | http://127.0.0.1:5187/ignition/champion/login | maya@northstar.example | /ignition/champion |
| Developer Alex | http://127.0.0.1:5187/ignition/developer/login | alex@northstar.example | /ignition/developer |
| Developer Jordan | http://127.0.0.1:5187/ignition/developer/jordan/login | jordan@northstar.example | /ignition/developer/jordan |

No password is required for these local demo accounts. These are account-bound demo sessions, not production authentication. Never enter real credentials. Each role has a separate HttpOnly SameSite cookie and server-validated account scope. Sign out through the profile menu. Other roles remain signed in. The original /ignition entry now asks for a workspace link and does not offer a role chooser. Existing /portal, /activation and /operator surfaces remain available independently.

The visible experiences are separate; one shared Northstar store carries approved handoffs, team preferences and adoption results behind the scenes. Only Chris receives raw sources and commercial context. Developers receive only their own progress. Chris and Maya receive cohort summaries. All integrations and outcome evidence are simulated; no external invites, support tickets or agent calls are sent. State is held in memory and resets on server restart. The API stays opt-in and localhost-only. Local URLs require this server on the same computer; no public preview verified.

Demo: sign in Chris, add/review sources, extract and approve v1; optionally sign in Maya and save team preferences; sign in Alex/Jordan independently and complete ownership/docs workflows. Answers: team-payments and Payments recovery. Test a wrong answer. Prepare an unsent support draft through contextual AiKA. Return to Chris, publish v2 and inspect retained outcome versions in adoption. Refresh separate views after changes; stale mutations are rejected and need review/retry.

Design reference folder:
https://drive.google.com/drive/folders/1QqcZQX8GbPEMquR5dXuKN3EujJI4Bqka

Read DESIGN_REFERENCES.md for the screenshot map and direct image links. CLAUDE_CODE_PROMPT.md contains the updated implementation brief. AUDIT.md records executed checks and limitations.

```sh
npm run build
npm test
node --test server/ignition.node-test.mjs server/portal-session.node-test.mjs
# Fresh demo server required; Playwright must be installed:
IGNITION_URL=http://127.0.0.1:5187 node e2e/ignition.mjs
```
