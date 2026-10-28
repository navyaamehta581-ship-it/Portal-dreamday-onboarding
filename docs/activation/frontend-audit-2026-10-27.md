# Activation frontend acceptance — 27 October 2026

This follow-up supersedes the earlier inspection-only audit. Base: main 71e9fdd8753f56ac0da09c8c91fe8f798b13291a, which includes merged PRs #10, #11 and #12. PR #11 merged into integration; PR #12 brought it into main. Retargeting #11 is no longer applicable.

## Validated behavior

- Original briefing, separately recorded agreement attribution, explicit constraints and unknowns are visible.
- The workspace presents the canonical next action, prerequisite state, escalation reason and revisions.
- Reviewing a note is local. Only explicit attributed-report submission sends it to the server. The saved confirmation appears only after a successful response.
- Pending and failed replans poll canonical state. One request at a time avoids overlapping polling responses. Timed-out commands retain their exact identity and bytes; 409 preserves drafts without silently rebasing.
- Reviewed JSON is checked for customer, session, state and plan revisions before first submission. Retry uses the same accepted/uncertain body for idempotency.
- Action evidence links navigate to evidence records, including colon-containing IDs. HTTPS source/proof references open separately. Proof review exposes action revision, verifier and the admitted metadata; it does not pretend to load a diff or execute an artifact.
- Outcome remains unassessed unless a separate admissible report exists. Technical verification labels explicitly exclude customer outcomes.

## Browser acceptance

Actual in-app browser against loopback services: loaded an admitted contract test-double session, reviewed a local note, submitted an exact admitted blocker, observed pending then ready plan, and reloaded/reconnected to the durable replacement. At 390 × 844, measured document width and viewport width were both 390, including the final long report identifiers. The legacy fixed-height header override was corrected; header and journey no longer overlap.

Injected HTTP 409 retained note and reviewed JSON. A delayed GET exceeded the client's 30-second timeout; the saved state and drafts remained visible, and refresh recovered after the fault was removed. The later attributed-report route was submitted from the browser and produced a new suggested checklist, escalation and durable evidence record, then remained readable after frontend reload. Source links point to a fresh immutable GitHub observation.

Agreement and customer context in these acceptance sessions are explicitly fictional contract test doubles under a local test adapter. The normal frozen contract continues to reject simulated agreement as real session admission. No real customer agreement, external approval or execution receipt was created.

## Automated evidence and limits

72 frontend tests cover canonical outcome labels, contrasting contexts, polling completion, 409 preservation, exact uncertain retry, mismatched reviewed command rejection, honest local review/submitted state, and proof links/metadata. Backend/report, contract, inspector and conversation suites are documented in handoff.md.

A dedicated artifact diff viewer, native Portal/AiKA execution, production identity and customer adoption acceptance remain unavailable. Artifact review currently means inspectable admitted proof metadata plus safe source/reference navigation; missing contents remain missing. Local screenshots and walkthrough output are delivery evidence outside Git, not implementation assets.

## Onboarding refinement and copy cleanup — 28 October 2026

Base: `rollback/pre-ignition-20261028-0001` (3e40c86, same tree as PR #23 merge c685250). Branch `claude/onboarding-refinement-i04hn5`.

**Developer onboarding.** Home and Onboarding › Overview now share one step model (`src/portal-app/onboarding/steps.ts`), following references 011, 023 and 036: setup card with progress and “N of 3 completed”, one row per step (completed rows muted with a check and a “Go to …” action, the current step expanded with its single action, upcoming steps collapsed, steps needing attention marked amber, Team locked until the existing gate opens), and the 036 completion banner. Steps complete only from recorded state:

| Step | Completed when |
|---|---|
| Review your goal and first step | The direction is accepted (a local, per-session choice; no server record) |
| Inspect your repository | A packet is prepared for the current plan revision |
| Share your progress with Chris | An attributed developer report exists |
| Bring your team along | Never counted; unlocked by an accepted direction or a report |

The page heading shows the agreed goal; the generated milestone text appears inside the first step. Team context, unknowns and success criteria sit below the guide as flat sections. Capability availability moved to the Evidence tab.

**Copy moved out of the interface.** These facts remain true but are no longer repeated on screen:
- Accepting a direction selects a proposed direction only and completes nothing.
- The Guide is rule-based over published context; no model answers (the screen keeps a short “Not AiKA” note).
- Reports, blockers and help requests are attributed records; they do not prove repository state, approval, execution or success.
- Prepared packets are local review artifacts; proposal acceptance records consent only and needs a separate grant.
- The kickoff message is not saved or sent; team roles and milestones are proposals, not adoption.
- Chris’s token stays in tab memory; publishing never overwrites an existing session; extraction is keyword-based quoting.

Simulation limits that affect a user’s decision stay visible in short form (demo sign-in, read-only inspection, nothing written to GitHub, kickoff not sent from Portal).

**Guide matching.** Three-letter terms (SSO, API) now match published context; common short words are ignored.

References 013, 015, 016, 022, 025, 026, 034 and 035 are not in the Drive folder and were not used.
