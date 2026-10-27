Update the frontend of navyaamehta581-ship-it/Spotify-portal-solution using the user's original Spotify Portal screenshot references. This is an implementation request: inspect, implement, test and show the resulting frontend.

Start by fetching latest main and feat/northstar-ignition. Read AGENTS.md and docs/ignition/{README,AUDIT,DESIGN_REFERENCES}.md. PR #24 is already merged; do not merge or reopen it. Create a new refinement branch from current main and bring across the latest feature-branch persona-login changes if absent. Preserve unrelated work.

DESIGN AUTHORITY
Original image folder (use this exact existing Drive link):
https://drive.google.com/drive/folders/1QqcZQX8GbPEMquR5dXuKN3EujJI4Bqka

Read docs/ignition/DESIGN_REFERENCES.md, which maps screenshot IDs to surfaces and includes direct Drive links. Open the actual images before editing. If Drive access is unavailable, report it and ask for access or the reference pack; do not claim the images were reviewed. Start with 001 for split login; 053 for full Portal shell; 011/036 for activation; 045/047 for tables/entity views; 055 for contextual help; 058/061 for answers and sources; 066 for approval. Use the reference hierarchy, typography scale, spacing rhythm, dark surfaces, borders, green primary actions, field treatments, tables and navigation rules throughout. Rebuild interactive components; do not use screenshots as page backgrounds. Ignore presenter overlays, cursors and any literal credentials in images. Chris and Maya have no exact screenshot equivalent: adapt shared tokens to their distinct tasks. Do not force their pages into the developer dashboard.

THREE SEPARATE DEMO PRODUCTS
1. Chris login /ignition/chris/login → /ignition/chris: customer workspace, messy sources, commercial context, extraction, approval and adoption overview.
2. Champion login /ignition/champion/login → /ignition/champion: Maya's team activation, priorities, optional goal, invitations and cohort adoption.
3. Developer login /ignition/developer/login → /ignition/developer: Alex's onboarding, ownership/docs workflows, contextual AiKA and personal progress. Jordan's separate developer account is /ignition/developer/jordan/login → /ignition/developer/jordan.

No shared persona dropdown, role switcher, role chooser or cross-persona navigation. Never auto-sign in from a URL alone. Each surface needs its own account-bound login, session, sign-out, landing page and task-specific navigation. Signing out Maya must not sign out Chris or Alex. Refreshing/deep-linking must preserve the right signed-in identity or show that surface's login. Existing prototype sign-ins use person@northstar.example with no password and server-validated account matching; these are demo sessions, not production authentication. Keep that distinction in technical documentation. Do not ask for real credentials or imitate working SSO. Preserve server-selected roles/tenant, read projection, per-role writes and individual developer privacy. Test wrong-account login, no-session access, logout and concurrent tabs.

The demos should feel like independent products. Shared backend customer data is still required for approved Chris context → optional Maya preferences → developer outcomes → cohort summary. Separation refers to login, navigation, session and visible role permissions; do not break the handoff flow or duplicate independent Northstar stores.

COPY
Remove all “fictional” labels, scenario banners and internal implementation explanations from the product interface. Use natural task-focused titles. Retain short, local simulated/demo labels only where an action is simulated: agent import, invitations, fixture verification, scripted AiKA and unsent support drafts. Keep detailed technical limitations in documentation, not a persistent page-wide warning. Never imply integrations are live or messages were sent.

PRODUCT CONTRACT
Northstar Engineering; 500 employees; 80 engineers; 30-day POC; approximately $100K potential private to Chris; Maya champion; Alex and Jordan developers; payments-api on GitHub; goals are service ownership and documentation. Okta remains unverified with conflicting notes. Do not mix in another customer or service.

Chris must retain multiple source types and provenance, manual paste and explicitly simulated Claude import. Treat source text as data. Extract a developer-safe briefing and uncertainty list; require review of both fields before publishing immutable versions. Raw sources and commercial information must be absent from champion/developer payloads. Do not count invitations as adoption. Maya participation stays optional and prefilled from Chris; do not add a discovery questionnaire. Developer verification checks synthetic answers (team-payments and Payments recovery) and establishes no real external access. Support escalation: contextual self-service → unsent technical support draft → Chris for account decisions after triage.

REMAINING FUNCTIONAL REFINEMENTS
Add visual handoff diffs, explicit per-outcome revalidation when handoff changes, append-only outcome evidence rather than overwriting prior verification, actionable stale-edit refresh/review without silent data loss, and an accessible copy button for the unsent support draft. Keep helper text and controls reachable on compact screens. Preserve outcome versions/timestamps. Keep persistence local and isolated if added, with schema/reset tests. Do not weaken the localhost guard or claim a static deployment runs the Vite middleware.

ACCEPTANCE AND DELIVERY
Run build, frontend tests and node --test server/ignition.node-test.mjs server/portal-session.node-test.mjs from prototypes/v1. Run e2e/ignition.mjs against a fresh IGNITION_DEMO=1 server with IGNITION_URL pointing to it. Add automated concurrent-login/logout/deep-link coverage. In one browser context sign in all three roles separately; verify no switcher, no “fictional” copy and no identity bleed. Wrong-account login must fail. Publish v1, let Alex start before Maya, save Maya's preferences and confirm Jordan receives them, reject wrong workflow answers, complete both workflows as both developers, prepare but do not send support, publish v2 and inspect preserved evidence/revalidation after reload. Inspect champion/developer payload privacy. Capture and visually inspect desktop and compact screenshots, test keyboard navigation and record browser errors. Do not claim checks were run unless executed.

Deliver working code, exact changed files, screenshots, test evidence, precise three login URLs and remaining limitations. Local URLs require the local server running on the same computer; do not present them as shareable public previews. Do not merge or deploy without a further request.
