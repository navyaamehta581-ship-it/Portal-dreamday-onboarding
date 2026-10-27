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
