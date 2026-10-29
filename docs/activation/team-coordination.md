# Team Coordination (Phase 6)

Maya, the customer's Champion, coordinates the approved technical onboarding from **Team Coordination → Team overview** (`/champion/team`). This sits beside Dream Day inside the Portal. It uses the same milestone progress records as the developers' **My work** ([developer-work.md](developer-work.md)); there is no second progress system.

## What Maya sees

The **Team progress** summary:
- milestones completed, in progress and blocked;
- milestones awaiting her review;
- open blockers and open questions, including follow-ups waiting on a developer;
- actions done.

The approved plan has no deadlines, so nothing is shown as overdue. The server reports `overdue: null` until deadlines exist.

**Needs your attention** lists every milestone the server flags:
- blocked, or with an open blocker;
- an unanswered question;
- ready for her review, or changed since her review;
- started while waiting on a dependency.

**Evidence** has two kinds:
- **Verified**: only GitHub observations the Portal backend recorded itself. Nothing else is ever marked verified.
- **Reported**: references developers add to their notes. They appear with each milestone and are never checked.

**One card per approved milestone.** Each shows:
- the assignee, status and review state;
- actions completed, open blockers and questions, and the latest entry (person, time);
- dependencies with their status;
- the actions and completion criteria, with who changed each and when;
- the evidence references;
- the review;
- the milestone's discussion.

## What Maya can do

Everything is attributed to Maya. Her name comes from the Portal session layer, never from the browser.

- **Respond** to a developer's question, blocker, update or reply.
  - On an open blocker she can also **mark it resolved** (for example once she has granted access). The resolution records her as the person who resolved it.
- **Add a coordination note** to a milestone.
- **Request follow-up** from the assignee. It stays open until the assignee replies.
- **Mark reviewed**, only after the assignee has marked the milestone ready for review (or completed). Otherwise the server answers `REVIEW_NOT_READY`.
  - The review is stored separately from the developer's status: reviewing **never** completes a milestone. Completing it stays the developer's action, under the Phase 5 checks.
  - If the developer changes the work afterwards (actions, status, an update or a blocker), the review shows as **Changed since review** and can be repeated. Questions and replies don't count as changes.
  - Reviewing an unchanged milestone twice is refused (`ALREADY_REVIEWED`).

None of Maya's entries change a milestone's status. A coordination note on untouched work leaves it *not started*.

## Discussion

Each milestone's discussion holds its updates, blockers, questions, replies, coordination notes and follow-up requests, oldest first. Each entry shows who wrote it, in which role and when.

- **The assignee** (Alex or Jordan) raises questions, reports blockers and replies to Maya's entries, all from **My work**.
- **Maya** responds, adds notes and requests follow-up from Team overview.
- **Chris** reads it in Developer Progress.
- **Other developers** see only the milestone's title, assignee and status. A developer's discussion stays with their milestone, as in Phase 5.

Chris's sources, notes and commercial information never enter these records. The views are built only from the approved developer handoff and the progress records.

## One source of truth

- **The server computes everything.** All statuses, review states, attention reasons and counts are computed in `services/workflow-api/src/activation/handoff/work.ts`. Maya's view, Chris's view and the developers' views show the same numbers, and the frontend only displays them.
- **Changes appear in place.** A change by Alex or Jordan shows on Maya's page and in Chris's **Developer Progress → Approved milestone progress** when it reloads (Refresh progress, or reopening the page).

## Authorization

| Who | Milestone work (`milestone-work`) | Developer updates (`milestone-updates`) | Coordination (`milestone-coordination`) |
|---|---|---|---|
| Alex, Jordan (own credential) | Read: own milestones in full, others by status | Own milestones only (`NOT_ASSIGNEE` otherwise) | Refused (`CHAMPION_REQUIRED`) |
| Shared developer token | Read | Refused (`DEVELOPER_IDENTITY_REQUIRED`) | Refused |
| Maya (Champion) | Read, full | Refused | Allowed |
| Chris (operator) | Read, full | Refused | Refused |
| Another customer's credential | Refused | Refused | Refused |

- **Revision-checked writes.** Every write from a developer or from Maya names the milestone revision the writer saw. A stale page gets `REVISION_CONFLICT` and reloads the latest version; it never overwrites. Maya's note therefore makes a developer's open page stale, and the other way round.
- **Role boundaries unchanged.** Developers still can't approve plans (Dream Day is Champion-only) or reach operator-only routes.

## Data model (additive)

Contract `contracts/activation/v1/handoff.ts`:
- `WorkUpdate` gains `role` (`developer`, `champion`) and `replyTo`, and the kinds `response`, `coordination` and `follow_up`;
- `MilestoneWorkRecord` gains `developerRevision` and `review`;
- new types `MilestoneReview`, `ReviewState`, `AttentionReason` and `ProgressSummary`;
- `MilestoneProgress` gains `openQuestions`, `openFollowUps`, `actionsCompleted`, `actionsTotal`, `reviewState`, `review`, `attention` and `latest`;
- `TeamProgress` gains `summary` and `verifiedEvidence` (Champion and Chris only).

Older records are read as all-developer entries with no review.

New route: `POST …/milestone-coordination`. It takes exactly one of `note`, `followUp`, `respond` (with an optional `resolve`) or `review`, plus `milestoneId` and `expectedRevision`. New codes: `REVIEW_NOT_READY` (409) and `ALREADY_REVIEWED` (409).

## Limitations

- **No deadlines.** The approved plan has none, so "overdue" is never shown. Adding target dates would be a Dream Day plan change.
- **Reloads, not live updates.** Maya's and Chris's pages pick up developer changes when they reload; there is no push.
- **Reported evidence stays reported.** Developer references are recorded but never checked. Verified evidence appears only when the backend has recorded a GitHub observation, which the local demo usually hasn't.
- **One review decision.** Maya can mark a milestone reviewed or request follow-up. There is no "reject" decision that changes the developer's status.
- **No cross-milestone discussion.** Developers can't post on a teammate's milestone, so Jordan asks Maya about a dependency on his own milestone.
- **Older tabs unchanged.** The Phase 5 limitations still apply: the older Guide, repository and team-plan tabs use a team-level session.
