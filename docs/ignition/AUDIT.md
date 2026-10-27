# Northstar audit — 28 October 2026 (Istanbul)

GitHub reported PR #24 already merged on 27 October 2026 at 21:23 UTC. Audited branch baseline: ed2c433c6e64312f04ceef7e1fa5b1025af9b89f. No merge was performed by this audit.

## Implemented

Direct entries /ignition/chris, /ignition/champion, /ignition/developer and /ignition/developer/jordan. They auto-enter fictional Chris, Maya, Alex and Jordan, respectively. Persona-scoped API endpoints and independent HttpOnly SameSite cookies preserve identity across simultaneously open browser tabs while sharing one Northstar store. Insights links preserve persona scope. The original selector and Portal routes remain available.

## Executed checks

- Production build passed. 89 frontend tests passed. Seven domain/HTTP tests passed, including added simultaneous persona cookies, mismatched session scope and missing scoped cookie checks. HTTP tests needed local socket permission; initial restricted run could not bind sockets, then all passed with local access.
- Manual in-app browser walkthrough on port 5187: Chris extraction, simulated import, held-back commercial content, reviewed v1 publication; Alex ownership before Maya participation; wrong-answer rejection; Maya docs priority, goal and two simulated invites; Jordan receiving that priority/goal; contextual AiKA and unsent support draft; Chris v2 publication; original v1 evidence retained after reload; both developers completing both workflows; developer Insights containing only their own row; concurrent tabs retaining identities.
- Observed stale revision rejection and successful refresh/retry. Changes to server code restarted the volatile store during development; the final walkthrough was repeated on the restarted store.
- Current desktop screenshots visually inspected and saved in audit-screenshots/. Current compact-width verification was not performed. Existing baseline compact screenshot is historical evidence only.
- Updated e2e/ignition.mjs to navigate the direct persona routes. This automated browser script was not executed in this audit; browser interactions were performed through the in-app browser.

## Remaining refinements / limits

No public preview URL verified. The application intentionally rejects non-loopback hosts and the demo backend lives in Vite middleware; static deployment alone will not work. Local links require the server running on the same computer. All connectors, invitations, help, support and outcome telemetry are simulated. Demo personas are not production authentication. Server restart erases data; separate views refresh manually.

Handoff history exists but there is no visual diff or explicit per-outcome revalidation flag. Re-verifying a workflow overwrites its prior result rather than appending evidence. Long helper content requires internal scrolling. These are specified in CLAUDE_CODE_PROMPT.md, alongside compact-screen and keyboard checks.

## Follow-up: separate sign-ins and presentation

Supersedes the auto-entry/switcher behavior above. Removed visible “fictional” copy and the global scenario warning; kept action-specific simulation labels. Removed persona selection and cross-role navigation. Each account now has an explicit /login page, account-matched demo email sign-in, scoped session and independent sign-out. Workspace navigation and logo stay in that surface. These are no-password local demo sign-ins, not production authentication. Shared data remains behind the separate visible experiences.

Original reference folder found through Drive: https://drive.google.com/drive/folders/1QqcZQX8GbPEMquR5dXuKN3EujJI4Bqka . Added DESIGN_REFERENCES.md with the existing screenshot map and direct image links; rewrote Claude instructions to apply those references and preserve separate logins. Inspected reference 001 and the new login screenshot.

Browser checks executed: all three separate login pages; wrong-account rejection on Chris; Chris/Maya/Alex sign-in; role-specific workspace navigation; Chris/Alex staying signed in after Maya sign-out; approval gate; published Chris handoff arriving in Alex's workspace on refresh. Updated automated browser script for email login; script itself was not run. Build, 89 frontend tests and seven HTTP/domain checks pass; added HTTP assertions for account mismatch, scoped logout and other accounts remaining active. Existing default Portal navigation remains unchanged; the shared Shell now permits surface-specific secondary navigation.

## Visual refinement — 27 October 2026

Branch claude/spotify-portal-frontend-rebuild-i04hn5, from main a5877a8 plus feat/northstar-ignition (7e529ea, persona sign-ins). No merge or deploy.

Reference access: the Drive folder was searched through the Drive connector and these originals were downloaded and opened: 001, 005, 010, 011, 012, 014, 018, 023, 036, 037, 045, 047, 053, 055, 057, 058, 061, 065, 066, 070, 075, 076, 077. The direct links in DESIGN_REFERENCES.md point to a copy the connector could not open ("not found"); the same filenames in the original folder were used instead.

Audit of the previous ignition UI (before): flat mint login without the 001 artwork or field treatment; developer surface reduced to a two-item sidebar instead of the 053 shell; AiKA as a green pill and generic card; uppercase kicker headers instead of the 047 entity header; a separate palette in ignition.css (#202427, #91edaa, #b5f5c5 metric tiles, bordered workflow cards); filled form fields with plain labels; no approval or dialog pattern.

Shared tokens and components (portal.css, used by all surfaces): outlined fields with bold labels and help text (005, 012); outline pill (014, 018); approve/reject buttons and disclosure (066); dialog (070); step progress bar, step header and table box (012, 014, 018); Insights subtabs, headline blocks and ring (075); docked AiKA panel and launcher (055, 065); provenance/simulation tags; line diff. ignition.css now holds layout only.

| Screen | Reference | Rules applied | Remaining differences | Inspected |
|---|---|---|---|---|
| Sign-in (all four) | 001 | Split layout, artwork panel with logo, 48px heading, outlined 56px field, green pill | Artwork is a CSS approximation (concentric diamonds, no grain); heading copy differs per product; email instead of password (demo accounts) | Desktop + 390px |
| Developer shell | 053 | Full sidebar, black top bar, centered search, selected gray row, separate content surface | Outline icons (lucide) instead of the original icon set; only Home and Insights are functional | Desktop + 390px |
| Developer home | 011, 036 | Welcome title, setup card with progress, black active-step panel, check rows with green actions, locked rows | Card copy and rows come from the approved handoff; no lower "Learn more" cards | Desktop + 390px |
| Guided workflow | 012, 014, 018, 045 | Centered column, green step bar, step-of label, table box, outlined field, Back/Verify actions | Catalog/doc fixture is a single row/article, labelled simulated | Desktop |
| Contextual AiKA | 055, 065, 066 | Bottom-right docked panel, “New AiKA Chat” header with expand/minimize, suggestion rows, filled composer, triangle launcher | No chat-history dropdown or MCP selector (not functional here); responses scripted and labelled | Desktop |
| Chris customer file | 047, 045, 005 | Entity header with meta, horizontal tabs, dense table, right help rail | No screenshot of this workspace exists; layout is derived, not matched | Desktop + 390px |
| Chris approval and versions | 066, 070 | Green Approve / red Discard, disclosure for changes, 070 dialog for simulated import, line diff | Diff colours have no direct reference | Desktop |
| Maya team activation | 047, 014 | Entity header, table box with radio priority and checkbox invites | Derived layout; no screenshot of this workspace exists | Desktop + 390px |
| Insights / adoption | 075 | Insights page bar, boxed subtab, headline blocks, ring | Single tab; no time-series charts (no data) | Desktop |

Executed checks (Node 24.22.1): production build passed; 91 frontend tests (17 files) passed; 7 ignition/session HTTP tests passed; inspector 15/15; phase-A 4/4; workflow-api check + 62 tests passed; blueprint validation passed. e2e/ignition.mjs was rewritten (the previous script raced the lazy login render and failed) and passed against a fresh server: deep link without session shows sign-in, wrong account rejected, concurrent tabs keep identities, Maya sign-out leaves Chris/Alex/Jordan signed in, v1 approval, Alex before Maya, Maya priority/goal reaching Jordan, wrong answer rejected, unsent support draft, v2 with v1 evidence retained and revalidation flags after reload, no sources/commercial data in Maya or developer payloads, no overflow at 390px, no browser errors. e2e/activation.mjs (/, /operator surfaces) also passed after the shared field-style change.

Still open: verification overwrites the prior result on the server (revalidation is flagged in the UI, not appended); no persistence across server restart; AiKA and support are scripted; the Drive reference copy linked from DESIGN_REFERENCES.md is not reachable by the connector.

## Original frontend restoration — 27 October 2026

The previous refinement was rejected as box-heavy and not faithful. This round restores the original developer shell first, then integrates the new functionality as additions. Branch claude/spotify-portal-frontend-rebuild-i04hn5, reset to main 9488ddd (PR #25 merged). No merge or deploy.

| Surface | Reference | Restored | Remaining differences |
|---|---|---|---|
| Sign-in (all four) | 001 | "Welcome to Portal." with the original sign-in copy, work email, green pill; no demo or prototype notes | Email instead of SSO (demo accounts, not production auth) |
| Welcome | 010 | Original welcome page after sign-in for Alex, Jordan and Maya | — |
| Developer shell | 053 | Full original sidebar for Alex, Jordan and Maya (Home, Catalog, Docs, Data Experience, Fleetshift, Notifications, Insights, RBAC, Skill Exchange, Soundcheck, AiKA, Confidence, Tech Radar, Docs Hub, Migration Agent, Create, Add to Bookmarks; App Settings, Plugins, Catalog Settings, Config History, Log Viewer). The extra "Onboarding" entry used by the /portal prototype is not in 053 and is not shown. Unbuilt items open "isn't available in this demo" | Lucide icons instead of the original set |
| Developer home | 011, 023, 036 | Setup checklist card with progress and time chip; 023 accordion rows (round number/check, title, chevron, expanded description with gray pill action); 023-style confirm dialog for Enable TechDocs; 036 gradient "You're all done!" | Step copy comes from the approved handoff |
| Setup steps | 012, 014, 018 | Step 1 team select, step 2 component table with type, step 3 pull request (simulated) | No real GitHub write |
| Catalog / entity / docs | 045, 047, 055 | Filter rail and owned-components table; entity About panel with catalog-info.yaml; docs metadata bar and article; verification inline | One fixture service; filters are visual |
| AiKA | 053, 055, 058, 065/066, 070/075 | Green outlined triangle mark at bottom-right (no pill); docked "New AiKA Chat ⌄" panel with expand/minimize, arrow suggestions, filled composer; full AiKA page with greeting and suggestion grid | Responses scripted and labelled; History disabled |
| Chris | 075, 047 | Insights-only nav; Insights subtabs Customer files / Handoff / Versions / Adoption; flat sections with dividers instead of cards | No original screenshot of this workspace |
| Maya | 053, 023, 075 | Full Portal nav; home checklist "Activate your team"; Insights › Team Activation | No original screenshot; derived |

Personalized onboarding: a new revision-checked `step` action records acknowledged or simulated steps per developer (role-scoped, ordered — register requires prepare, private to each developer, handoff version stamped). Owner and docs steps complete only from verified outcomes. Nothing is completed without a recorded action.

Executed checks (Node 24.22.1): build passed; 91 frontend tests (17 files); 8 ignition/session HTTP tests; inspector 15/15; phase-A 4/4; workflow-api check + 62 tests; blueprint validation; e2e/ignition.mjs and e2e/activation.mjs passed. Browser walkthrough at 1920×1042 and 390×844 across all four workspaces: no page errors, no horizontal overflow at 390px. Compact fixes from inspection: accordion actions wrap below the title; catalog table scrolls horizontally. Renders in refinement/.

Still open: on phones the 053 sidebar is shown above content (shared Shell behaviour); verification overwrites earlier results; in-memory store; AiKA scripted.
