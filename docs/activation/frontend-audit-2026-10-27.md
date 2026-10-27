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
