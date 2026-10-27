# Portal visual references

Original Drive folder: https://drive.google.com/drive/folders/1QqcZQX8GbPEMquR5dXuKN3EujJI4Bqka

# Spotify Portal frontend: decisive visual reference map

Read this file first. Open only the images assigned to the component you are building. Do not survey all 81 screenshots or reclassify them. `ALL-SCREENS.md` is the optional exhaustive index; `manifest.json` preserves original filenames, Drive URLs, IDs and SHA-256 hashes.

## Visual authority

The captures show two visually different Portal presentations. Use **053** as the authority for the main application shell: black top bar, centered global search, profile avatar, wide dark sidebar, selected gray navigation row, and separate dark content surface. **065–066** confirm the same shell around an entity/workflow. Use **001–010** for the pre-Portal login/setup experience and **011–018, 022–037** for setup content and states. The earlier sparse sidebar is a setup-stage reference; do not let it override the fuller shell. This is a deliberate rebuild decision based on visible differences, not a claim about product release dates.

## Screenshot → component map

| Build surface / suggested component | Primary reference | Open only if needed |
|---|---|---|
| Welcome / password login — `WelcomeLogin` | [001](login/001-welcome-password.png): green artwork left, password form right | [002](login/002-usage-consent.png): consent step; [010](welcome/010-portal-ready.png): ready screen |
| Shared shell — `PortalShell`, `TopBar`, `Sidebar` | [053](aika/053-chat-empty.png): full sidebar, search and content framing | [065](workflows/065-entity-fix-aika-sources.png): shell around entity page |
| Home / setup guide — `SetupHome`, `SetupChecklist` | [011](portal-shell/011-setup-home-initial.png): initial checklist | [036](portal-shell/036-setup-home-complete.png): completion banner; [037](portal-shell/037-setup-home-complete-lower.png): lower cards |
| Provider onboarding — `ProviderSetup`, `SetupStepper` | [005](onboarding/005-provider-credentials.png): credentials form + help rail | [004](onboarding/004-provider-options.png): provider menu; [008](onboarding/008-organization-selected.png): organization; [009](onboarding/009-instance-confirmation.png): confirmation |
| Team / catalog onboarding — `TeamPicker`, `ComponentReview` | [012](onboarding/012-team-picker.png), [014](onboarding/014-components-discovered.png) | [015](onboarding/015-add-components-search.png): add menu; [016](onboarding/016-components-reviewed.png): reviewed table; [013](onboarding/013-component-discovery-loading.png): loading |
| GitHub preparation / result — `PullRequestProgress` | [018](workflows/018-catalog-prs-ready.png): per-item result links | [017](workflows/017-catalog-prs-creating.png): in progress; 019–020 only for external GitHub destination context |
| Feature enablement — `EnableFeatureSection`, `ConfirmDialog` | [022](onboarding/022-enable-techdocs.png), [023](onboarding/023-enable-techdocs-confirm.png) | 025–026 Scaffolder; 034–035 Soundcheck; same accordion/modal family |
| AiKA landing / full chat — `AiKAPage`, `ChatComposer` | [053](aika/053-chat-empty.png), [058](aika/058-chat-answer-start.png) | [057](aika/057-chat-loading.png): thinking; [061](aika/061-chat-answer-sources.png): footnotes. 056/059/060 are typed or scrolled variants |
| Contextual AiKA — `FloatingAiKAChat` | [055](workflows/055-docs-article-chat.png): article + chat | [054](workflows/054-docs-list-chat.png): table + chat; [065](workflows/065-entity-fix-aika-sources.png): entity + source evidence |
| Technical action review — `ActionPlanReview` | [066](workflows/066-entity-fix-aika-approval.png): green Approve & run, red Reject plan, collapsed details | [068](workflows/068-entity-fix-aika-proposal.png): proposed PR details; [067](workflows/067-entity-fix-aika-footnotes.png): sources |
| Catalog / entity — `CatalogTable`, `EntityPage` | [045](workflows/045-catalog-table.png), [047](workflows/047-entity-overview.png) | [048](workflows/048-entity-check-pass.png), [049](workflows/049-entity-check-fail.png): check detail states |
| Technical health — `SoundcheckPage` | [043](workflows/043-soundcheck-checks-closer.png): checks; [044](workflows/044-soundcheck-score-matrix.png): matrix | 038 empty; 040 tracks; 041 integrations; 042 check templates; 051 progress charts |
| Plugin administration — `PluginsPage`, `AddPluginDialog` | [069](workflows/069-plugins-installed.png), [070](workflows/070-plugins-add-dialog.png) | 071 updates; 072 configuration; 073 modules. 028/031/032 only if preserving the earlier install wizard |
| App settings / agent connection — `SettingsPage`, `MCPConnectDialog` | [062](workflows/062-app-settings-general.png), [064](workflows/064-mcp-connect-dialog.png) | [063](workflows/063-app-settings-mcp.png): MCP settings |
| Optional analytics — outside the core rebuild unless required | 075–081 | 075 headlines; 076 usage; 077–078 DevEx; 079 team picker; 080–081 drawers |

## Shared design-system references (reuse; no extra image copies)

- **053:** global frame, sidebar spacing, muted icons, selected navigation, page toolbar, composer and suggestion cards.
- **001 / 005:** bright green rounded primary actions, outlined fields, muted help text, progress stepper. Login artwork is specific to entry/setup screens.
- **023 / 070:** dark dialog surface, dimmed backdrop, field rows and footer actions. Use 070 for dialogs in the fuller shell.
- **045 / 047:** dense tables, filter rail, entity title/meta row, tabs, thin separators and card grids. Adapt inner components to the 053 shell.
- **058 / 061 / 066:** code blocks, green inline sources, answer actions, plan disclosure and approval/rejection buttons.
- **065 / 066:** failed-check banner, colored status rings, horizontal entity tabs, split check/detail area and floating contextual chat.

Colors and spacing are visual references, not measured tokens. Infer a small consistent token set once; do not keep rereading screenshots to decide individual colors. Screenshots contain no font files or reliable mobile layouts.

## Repetition and reading budget

There are **zero byte-identical duplicates** (SHA-256 checked). Keep all originals. The following are redundant for initial implementation, not deleted images:

- 028/029: same Config Manager composition with pointer/hover changes → use 028.
- 039/043: same Checks view, different framing → use 043.
- 040/050: same Tracks view → use 040.
- 069/071: same Plugins grid, but 071 adds the updates action → use 069; 071 only for updates.
- Scroll continuations: 046→045, 052→051, 059–061→058, 074→073, 078→077. Open only to implement the lower content.
- 065–068 share the entity background but expose different chat states. Use 066 for approval and 065 for evidence; these are not interchangeable duplicates.
- 003–009, 012–018, 022–037, 056–061, and 079–081 include meaningful state changes. Do not turn each capture into a separate route or component.

## Instructions for the rebuild

Rebuild the actual Portal visual hierarchy around the existing project's behavior. Keep existing data contracts, customer onboarding decisions, blocker replanning, review logic and GitHub inspect/prepare behavior. Treat component names above as suggested UI boundaries, not assertions about existing code names. Preserve Chris's operator workspace as a distinct surface; these images do **not** show that workspace or a champion plan, so their exact layouts are unreferenced. Use shared Portal tokens for those surfaces without claiming screenshot fidelity.

The password welcome screen is the only login shown; there is no Spotify consumer OAuth/account-login reference. Setup screenshots depict provider/admin setup, not evidence of the project's customer-specific onboarding logic. Use their visual language while preserving the project's required flow. The AiKA screenshots show chat and action review, not proof of a working backend integration.

Do not reproduce the presenter's webcam tile (053–081), mouse cursors, screen-recording artifacts, demo personal details or literal credentials. Build real editable components; never use full screenshots as page backgrounds. Do not imitate GitHub's light UI inside Portal. Do not build every sidebar product just because its label appears. The full Portal Home content is not shown; 011/036 provide setup-home content only. The source mixes wording such as observability v2/v3; copy required project content deliberately rather than treating demo text as requirements.

## Files and preservation

This is a local organized copy; the Drive folder was not renamed, moved or otherwise changed. `originals/001.png` through `081.png` preserve downloaded image bytes; original source filenames and links are in `manifest.json`. Category folders contain descriptively named copies. The ZIP excludes `originals/` to avoid packaging the same bytes twice; its categorized PNGs retain the originals' bytes, and the manifest retains provenance. Contact sheets are inspection aids, not visual authority. No frontend code was created.


## Direct primary image links

- 001: Welcome split layout; green geometric artwork, password and Sign in — https://drive.google.com/file/d/1-DucnkT0oUY0vDv8oCp51IbX7XN4yPT2/view?usp=drivesdk
- 005: Access token, client ID and client secret form — https://drive.google.com/file/d/1dP4d4XooMjh1wIIjK3syRpJhuHRIYyN3/view?usp=drivesdk
- 011: Welcome to Portal; setup checklist and sparse sidebar — https://drive.google.com/file/d/1AG444ZNsDrOID2WHQKoVpWuT8C3O77QY/view?usp=drivesdk
- 012: Step one of three; choose team — https://drive.google.com/file/d/1RBjfr5ZGREceSxNTHaKitMlyJL8a5W5c/view?usp=drivesdk
- 014: Discovered components table; Type and Lifecycle selectors — https://drive.google.com/file/d/1nw7qBerpPAXEXpNzSUkPu0cAG6T2Hu45/view?usp=drivesdk
- 036: You are all done banner; four of four complete — https://drive.google.com/file/d/1mWeuaCAhwgnz5PnRSavszMlMHQiSb6vP/view?usp=drivesdk
- 045: Acme Catalog; filter rail and dense entity table — https://drive.google.com/file/d/1SI7tEPHUD4CpduYQtKUKK_fIAxEVNFZV/view?usp=drivesdk
- 047: wayback-archive; About, Relations graph and dependency tables — https://drive.google.com/file/d/1G8KIMKycIghm4QuPMcDQxzuL-yAgWlDY/view?usp=drivesdk
- 053: Full Portal shell; AiKA greeting, composer, MCP selector and suggestion grid — https://drive.google.com/file/d/1yEPJcGHcdG5hk81F7nYnH1Y-vAvSUwBD/view?usp=drivesdk
- 055: Migration article; table of contents and floating contextual chat — https://drive.google.com/file/d/14q3I3glKOrIwYfOO7SOBxdzVjCErWPCQ/view?usp=drivesdk
- 058: Migration steps; headings, source links and code blocks — https://drive.google.com/file/d/1KPz_O5Xo7MUgVqs-1yTUIzP_NQmaNncX/view?usp=drivesdk
- 061: Answer footnotes and source links; bottom continuation — https://drive.google.com/file/d/16_ZUB8A3gwihPunrH8CgWaS4uUNIMYxW/view?usp=drivesdk
- 065: metadata-service failed Soundcheck; Fix with AiKA and source-linked chat — https://drive.google.com/file/d/1puhRquNn0memAuVdLHNa1r2QlCqUPf4j/view?usp=drivesdk
- 066: Same entity; Approve and run, Reject plan and Plan details — https://drive.google.com/file/d/1GpZDwoIlgtL1ugG5gcTXv3qDibxusGJw/view?usp=drivesdk
