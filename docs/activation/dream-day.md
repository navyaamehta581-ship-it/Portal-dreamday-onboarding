# Dream Day: Champion review and approval (Phase 4)

Dream Day is where the customer's Champion (Maya) reviews the technical onboarding plan Chris proposed, refines it and approves it. Approval is the only way a new plan reaches developers. Since the role redesign, owners are optional suggestions and developers choose their work; see [roles-and-opportunities.md](roles-and-opportunities.md).

```
Chris submits → Maya reviews in Dream Day → Maya edits (optionally suggests owners) → Maya approves → developers see the plan and choose
                                      ↘ optional: Maya sends it back (with a reason) → Chris revises → Chris resubmits ↗
```

## Where it lives

**Team Coordination → Dream Day** (`/champion`), in Maya's Portal. **Team overview** (`/champion/team`) shows the published plan and who does what. Maya's Home card links to both.

The Dream Day page shows, in this order (overview first, supporting context collapsed at the end):
- **Proposed plan at a glance.** Goals and milestones, each marked Proposed, Proposed · edited or Added by you, with her last saved changes.
- **Status and history.** The submission status, with the review history (who submitted, resubmitted, withdrew, requested changes, approved, and when) and Maya's comments.
- **What remains open.** Milestones without a suggested owner (that's fine) and open clarification questions; both can stay open when she approves.
- **Supporting context (read-only, collapsed).**
  - The customer's engineering problem: summary, challenges, systems, contradictions, unknowns.
  - Known facts, with evidence status (verified, reported, unconfirmed) and the *kind* of source.
  - Technical stakeholders.
- **What Maya can edit.**
  - Technical goals.
  - Milestones: title, description, actions, completion criteria, dependencies, add, remove and reorder.
  - Suggested owners (optional), chosen from the technical stakeholders.
  - Clarification questions.
- **Decisions.**
  - **Save draft** stores edits and approves nothing; the server records an `edited` history event that Chris sees as an update he doesn't approve.
  - **Send it back to Chris instead (optional)** needs a written reason.
  - **Approve onboarding plan** needs Maya to confirm "I reviewed the technical goals and milestones." and her edits to be saved first. It does not need an owner on every milestone.

## States

| State | Meaning | Chris | Maya | Developers |
|---|---|---|---|---|
| Draft | Chris is preparing or revising | edits | "Nothing to review yet" or "Chris is revising" (no plan content) | nothing |
| Submitted for Champion review | waiting for Maya | locked (can withdraw) | reviews and edits | nothing |
| Changes requested | Maya sent it back with a reason | sees the reason, edits | sees her comment; no plan content while Chris revises | nothing |
| Resubmitted for Champion review | revised and sent again | locked (can withdraw) | reviews and edits | nothing |
| Approved | approved, but this server doesn't publish (`ACTIVATION_INTAKE` not enabled) | sees approval | sees approval and responsibilities | nothing |
| Published to developers | approved and published by the approval | sees approval, who and when | sees the approved plan | their own approved work |

Every save, submission, withdrawal and decision moves the record's `reviewRevision` forward, and every write must name the revision it was based on. A stale page therefore cannot overwrite newer edits or approve an outdated version (`REVISION_CONFLICT`). A withdrawn or already-decided plan can't be decided again (`NOT_UNDER_REVIEW`, `ALREADY_APPROVED`).

Edits, comments, assignments, history and decisions are stored with the operator-only record, so they survive refreshes and API restarts.

## Authorization (server-side)

- **The Champion credential.** Each customer has a separate Champion credential (`champion-token`, created by the demo launcher, `ACTIVATION_CHAMPION_TOKEN` in the API). The Portal session layer holds it for the Champion persona.
  - The API recognises it (`isChampion`) and binds it to one customer like every other credential.
  - Champion routes (`GET champion-review`, `POST champion-reviews`, `POST champion-decisions`) refuse developer and operator credentials (`CHAMPION_REQUIRED`). Chris cannot approve his own plan, and Alex or Jordan cannot gain approval rights by changing a URL, choosing a persona in the browser or editing requests. The browser never holds a credential.
- **Display names.** The session layer adds `X-Portal-Actor` (the signed-in persona's display name) to every forwarded request and ignores any value from the browser. The API uses it to record who approved or commented, and to give each developer their own work. It is a display name asserted by the trusted local session layer, not a separate credential.
- **What each role receives.** Built on the server; nothing private is sent and then hidden in the browser.
  - **Champion view** (`championPlan`):
    - only technical stakeholders;
    - every text re-screened with the developer-safety screen (anything unsafe is left out and counted as "withheld");
    - source names replaced by categories ("Conversational Transcript"; CRM records, Chris's notes and account preparation become "Spotify account team");
    - no internal findings, commercial details, sources or Chris's working copy while he revises.
  - **Developer view** of an approved plan: every approved milestone with its outline, who approved it and who chose it; a developer's own notes and progress only on milestones they chose or were suggested for.
  - **Champion's state view:** the whole approved plan.
  - **Chris:** sees everything, as before.

After approval, the Portal observes the team's repositories itself (read-only), and developers choose milestones and opportunities; see [roles-and-opportunities.md](roles-and-opportunities.md).

## Approval publishes; the bypass is closed

- **Approval publishes.** Approval runs the completeness and privacy checks (owners are not required). It then publishes through the existing publication path with the approved milestones and `assignmentStatus: approved`. The developer handoff records `approval: {by, at}`.
- **The direct path is closed on the server.** `handoff-publications` always answers `403 CHAMPION_APPROVAL_REQUIRED`. With the Dream Day workflow on (`championApproval`, set whenever the API can publish handoffs), the older `intake` and `POST state` initialization routes are refused too. The "Publish without Champion review" button and the pre-publication integration tools are gone from Chris's workspace.
- **Legacy data.** A record published before Dream Day, with no Champion approval, is shown as "Published before Dream Day" to Chris and Maya, never as approved. Its developers keep the earlier shared view.

## Data model (additive)

Contract `contracts/activation/v1/handoff.ts`:
- `HandoffStatus` adds `changes_requested`, `resubmitted` and `approved`;
- `ReviewEvent` and `HandoffRecord.history`;
- `ReviewOrigin` adds `champion`;
- `ChampionReview` and `ChampionPlan`;
- `DeveloperHandoff.approval`.

API options: `isChampion`, `championApproval`. Error codes: `CHAMPION_REQUIRED`, `CHAMPION_APPROVAL_REQUIRED`, `NOT_UNDER_REVIEW`, `ALREADY_APPROVED`, `COMMENT_REQUIRED`.

Code:
- `services/workflow-api/src/activation/handoff/service.ts`: transitions;
- `review.ts`: Champion view, edits and approval checks;
- `project.ts`: per-developer view;
- `routes.ts`;
- `prototypes/v1/src/portal-app/dreamday/`;
- `src/review/Editors.tsx`: editors shared with Chris's draft.
