# Roles, opportunities and adoption (role redesign)

This page describes what each persona sees and does after the role redesign. Where an older page ([chris-workspace.md](chris-workspace.md), [dream-day.md](dream-day.md), [developer-work.md](developer-work.md), [team-coordination.md](team-coordination.md), [repository-evidence.md](repository-evidence.md), [aika-and-insights.md](aika-and-insights.md)) disagrees, this page is current.

```
Chris uploads a PDF → reads the proposed plan → sends it to the Champion
  → Maya reviews it at a glance, edits what she wants, approves it (owners optional)
    → the Portal observes the team's repositories itself (read-only)
      → developers see goals, engineering opportunities and milestones, and choose what to work on
        → Maya prioritises and recommends; everyone sees adoption from the same records
```

## Chris (Spotify account operator)

- **One way in.** Chris uploads a PDF (or uses the built-in fictional sample). The analysis starts by itself. When it finishes, Chris is taken to the **Onboarding Draft**; "How this document was read" stays collapsed on Customer Context.
- **The draft reads as an overview first.** The **Draft overview** card lists:
  - the engineering problems (one line each);
  - the technical goals;
  - the proposed milestones, with suggested owner and order when known.

  Below it are collapsible sections, each with a count and a one-line summary:

  | Section | Default | What it holds |
  |---|---|---|
  | Engineering problems | Closed | Each problem separately: summary, challenges, systems, supporting notes (contradictions and unknowns) and the suggestion's origin. |
  | Technical goals | Open | The goals. |
  | Onboarding milestones | Open | Compact rows; **Edit** opens one milestone. A suggested owner and dependencies are optional. |
  | Known facts | Closed | Each fact with its backing (verified, reported or unconfirmed) and source. |
  | Stakeholders | Closed | The customer's technical team, and people kept with Chris. When the sources don't state a responsibility, the row says "Responsibility not specified in the sources" instead of inventing one. |
  | Questions for the customer | Closed | Open questions. |

  A section holding something that must be fixed opens by itself, and so does a flagged milestone row, so a toggle never hides an error.
- **Several problems.** The analysis groups customer needs by topic. The first topic is the main problem; the others become further problems with their own challenges and the systems they mention (`ReviewDraft.moreProblems`, at most 6). Chris can add or remove problems.
- **Sending is a proposal.** "Send this proposed plan to your Champion" states that Chris is not certifying that every stakeholder or detail is complete. Open questions and unknowns can stay open. The confirmation is "I checked this proposal. It contains no commercial details, internal notes or private comments." The privacy screen still runs on the server.
- **Champion changes reach Chris without re-approval.** Each Champion save records a history event (`edited`) with a count summary, for example "Edited 1 milestone, added 1 question." Chris's draft shows a **Champion updates** banner and "Changed by the Champion" in the review history. Nothing asks Chris to approve these changes.
- **No technical setup.** Nothing asks Chris to connect or inspect repositories, upload wikis, set up SSO or use integration tools. That work belongs to Spotify's solutions engineers.
- **Progress & updates (read-only).** This tab shows:
  - adoption (the same numbers as the Champion's);
  - company goals;
  - engineering opportunities, with who pursued them and the Champion's priority;
  - milestone progress.

  It has no controls.

## Maya (Champion)

### Dream Day (`/champion`)

The page is ordered:

1. **Plan review.** Status and history.
2. **Proposed plan at a glance.** Goals and milestones, each marked *Proposed*, *Proposed · edited* or *Added by you*, with "Your last saved changes" from the server.
3. **Editable sections.** Technical goals (open), Onboarding milestones (open) and Clarification questions.
4. **Your decision.**
5. **Supporting context, collapsed.** Engineering problems, Known facts (with backing) and Technical stakeholders.

Maya's options:
- **Targeted edits.** Add, edit or remove goals, milestones and questions; suggest an owner (optional); set dependencies; **Save draft**. Saving approves nothing.
- **Approval needs no owner on every milestone.** "I reviewed the technical goals and milestones." → **Approve onboarding plan**. Approval still runs the completeness and privacy checks (`approvalIssues` = `reviewIssues`).
- **Sending it back is optional.** It sits under "Send it back to Chris instead (optional)" and needs a reason. Maya never has to send the plan back just to correct one part.
- **No repository inspection.** Repository inspection was removed from the Champion's pages.

### Team overview (`/champion/team`) and Home

The Team overview shows:
- **Company goals**, with progress from linked milestones. Maya can set a priority for each goal (High, Normal, Later).
- **Improvement opportunities.** Maya can set a priority and **Recommend to developers**. Recommended opportunities appear first on developers' pages, marked "Recommended by your Champion". Maya prioritises; she never assigns.
- **Adoption and developer engagement.** Stat tiles, a weekly activity chart (with a screen-reader table), who is engaged, and plain suggestions such as "No developer has picked up work yet".
- **Milestone progress and discussion.** A collapsed section with the existing coordination: answers, reviews and follow-ups.

Home shows the Dream Day card until the plan is approved. After approval it shows company goals, adoption and recommended improvements.

The Portal has no messaging feature. The encouragement tools are recommending opportunities and answering milestone questions.

## Developers (Alex, Jordan, Sam)

- **Nothing is assigned.** Every approved milestone is visible to every developer on the team, with its outline: description, system, actions and done-when.
  - **Choose this milestone** adds the developer to `workingOn`. Any developer may do this; the request carries the record's `revision`, which every milestone now exposes.
  - A Champion's suggested owner shows as "Suggested for you" or "Suggested for <name>".
  - Only the suggested owner or someone working on a milestone can change its work (`NOT_ASSIGNEE` otherwise). Their notes stay theirs.
- **Onboarding** has three tabs:

  | Tab | What it shows |
  |---|---|
  | Overview | Goals, engineering opportunities and milestones to choose. |
  | My milestones | The developer's own milestones, with optional notes and questions to the Champion. |
  | Guide | Step-by-step guides per opportunity, pursued ones first, with **Ask AiKA about this**. |

  The Repository, Evidence and Team tabs, the guide chat, "Share your progress", uploads, the kickoff message and every reference to Chris are gone.
- **Engineering opportunities.** Each is an integration, migration, new build or improvement. Each is labelled with what backs it:

  | Label | Meaning |
  |---|---|
  | Verified | A live read-only observation backs it. |
  | Sample data | Fictional fixture data backs it. |
  | Hypothesis | It comes from the plan and nothing has confirmed it. |

  **Pursue this** records the developer's choice. Developers see how many people pursue an opportunity, not who.
- **AiKA is contextual.** "What AiKA should focus on" can name a milestone or an opportunity (`/aika?opportunity=…`). The server adds the goals, the opportunities and the chosen one's steps to AiKA's context.
  - The privacy screen treats the word "opportunity" as commercial, so in the model context these appear as `ENGINEERING SUGGESTION`.
- **My progress** (`/progress`; a developer opening `/insights` gets the same page) shows the developer's own milestones (steps done, the next step) and the opportunities they pursue. It shows no team metrics.

## The Portal observes repositories itself

After an approval publishes a plan, the server observes every configured repository the plan relies on, read-only. It also does this when the opportunities view is first opened, waiting at most 8 s. The inspection is recorded with `requestedBy: "Spotify integration"`. Recent observations are reused within the cooldown, and failures are recorded, not thrown.

`canInspect` is `false` for everyone, and no page offers an inspect button. The `POST repository-inspections` API route still exists for compatibility; the UI does not call it.

## Opportunities: how they are computed

`services/workflow-api/src/activation/opportunities.ts` builds them on the server from the approved plan and the latest repository observations. Nothing is stored except the Champion's priorities and recommendations and developers' pursuits (SQLite table `activation_opportunity_state`).

| Source | Rule | Kind |
|---|---|---|
| `catalog_info` missing | Register the service in the Catalog | improvement |
| `codeowners` missing | Record who owns the code | improvement |
| `docs` observed or missing | Bring existing docs into TechDocs, or start them | integration |
| `runbooks` missing | Add a runbook | improvement |
| `ci_config` observed or missing | Connect CI, or set it up | integration or new build |
| Plan wording (ownership, catalog, docs, pipeline, scaffolder) | The same suggestions, labelled **hypothesis** | as above or migration |

A plan rule is skipped when the Portal has already looked at that signal, so a hypothesis never contradicts an observation. A goal links to the milestones that share at least two words with it, and its progress counts those milestones.

## Adoption

`GET adoption` is available to the Champion and Chris only. It counts activity recorded in this onboarding:
- milestones chosen;
- action changes and notes;
- opportunities pursued.

It reports goals with progress, completed milestones, pursued and recommended opportunities, each engaged developer (last active, active this week), six weekly buckets, and plain suggestions. `scope: "onboarding_activity"` says what it covers. **No wider Portal usage data is connected in this demo, so team-level usage isn't shown.**

## API (additive)

| Route | Who | What |
|---|---|---|
| `GET opportunities` | Developer, Champion, Chris | Goals and opportunities for the viewer. |
| `POST opportunity-priorities` `{id, priority?, highlighted?}` | Champion | Priority for a goal or opportunity; recommend an opportunity. |
| `POST opportunity-pursuits` `{id, pursue}` | Developer with their own identity | Pursue or stop pursuing an opportunity. |
| `GET adoption` | Champion, Chris | Adoption summary. |
| `POST milestone-updates` `{milestoneId, expectedRevision, pursue}` | Any developer with their own identity | Choose or stop a milestone. |

Contract additions (`contracts/activation/v1/handoff.ts`):
- `Opportunity`, `GoalView`, `Opportunities` and `Adoption`;
- `MilestoneWorkRecord.workingOn`;
- `MilestoneProgress.workingOn`, `suggestedForMe`, `outline` and `revision`;
- `ReviewEvent.action: 'edited'`;
- `ReviewDraft.moreProblems` and `ChampionPlan.moreProblems`.

## What is not decided

The brief left these open, so nothing was invented for them:
- the exact stakeholder layout;
- the name "Dream Day" (kept);
- team-level integrations;
- the final name and layout of the progress page;
- a solution-engineer interface.
