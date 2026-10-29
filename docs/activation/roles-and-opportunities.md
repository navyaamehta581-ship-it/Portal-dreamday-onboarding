# Roles, opportunities and adoption (role redesign)

This page describes what each persona sees and does after the role redesign. Where an older page ([chris-workspace.md](chris-workspace.md), [dream-day.md](dream-day.md), [developer-work.md](developer-work.md), [team-coordination.md](team-coordination.md), [repository-evidence.md](repository-evidence.md), [aika-and-insights.md](aika-and-insights.md)) disagrees, this page is current.

```
Chris uploads a PDF → edits the draft → Finalize and publish
  → the Champion and developers have the goals and milestones at once (nobody approves them)
    → the Portal observes the team's repositories itself (read-only)
      → developers see goals, engineering opportunities and milestones, and choose what to work on
        → Maya prioritises and recommends (Dream Day is an optional read-only view of the plan)
          → everyone sees adoption from the same recorded activity
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
- **Finalize and publish.** "Finalize the onboarding plan" publishes the goals and milestones to the Champion and developers straight away. Nobody approves the plan, and developers are never blocked waiting for the Champion.
  - Open questions and unknowns can stay open.
  - The one confirmation is a privacy check: "I checked this plan. It contains no commercial details, internal notes or private comments." The privacy and completeness screen still runs on the server and can refuse publishing with field labels.
  - A published plan is final: Chris can no longer edit it or upload a new PDF for that customer (existing behaviour).
  - Afterwards the draft tab shows "Published by Chris on …" and the suggested owners. The page loads the published onboarding straight away.
- **Priorities aren't Chris's.** Chris edits goals, milestones and customer context; the Champion sets priorities and recommends opportunities.
- **Records from the earlier review flow.** A draft that was sent for Champion review before this change shows "Sent for review under an earlier version" with **Withdraw to make changes**; Chris then finalizes it himself. Older Champion edits still show as a **Champion updates** banner and "Changed by the Champion" in the plan history.
- **No technical setup.** Nothing asks Chris to connect or inspect repositories, upload wikis, set up SSO or use integration tools. That work belongs to Spotify's solutions engineers.
- **Progress & updates and Insights (read-only).** Chris doesn't need to stay involved after publishing; these views are there if he wants to follow along. Progress & updates shows:
  - adoption (the same numbers as the Champion's);
  - company goals;
  - engineering opportunities, with who pursued them and the Champion's priority;
  - milestone progress.

  It has no controls. Insights says "Read-only: the Champion and developers make every change, so nothing here needs your follow-up." 

## Maya (Champion)

### Dream Day (`/champion`): optional and read-only

Dream Day is where Maya can look at the plan Chris published. She never has to open it: developers already have the plan. The page is ordered:

1. **Your team's onboarding plan.** "Published by Chris on …", "nothing here needs your approval", a **Set priorities and recommend opportunities** button (to Team overview) and the plan history.
2. **Plan at a glance.** Goals and milestones, with suggested owners and order.
3. **Read-only sections.** Technical goals (open), Onboarding milestones (open, with done-when and dependencies) and Clarification questions.
4. **Supporting context, collapsed.** Engineering problems, Known facts (with backing) and Technical stakeholders.

There is no approval checkbox, approve, send-back or save, and no repository inspection. Before Chris publishes, Dream Day and Home say "Chris hasn't published your team's onboarding plan yet".

The plan text itself is not edited after publishing: Maya's influence is through priorities, recommendations and milestone coordination. (Editing a published plan would need republishing, which this prototype doesn't do.)

### Team overview (`/champion/team`) and Home

The Team overview shows:
- **Company goals**, with progress from linked milestones. Maya can set a priority for each goal (High, Normal, Later).
- **Improvement opportunities.** Maya can set a priority and **Recommend to developers**. Recommended opportunities appear first on developers' pages, marked "Recommended by your Champion". Maya prioritises; she never assigns.
- **Adoption and developer engagement.** Stat tiles, a weekly activity chart (with a screen-reader table), who is engaged, and plain suggestions such as "No developer has picked up work yet".
- **Milestone progress and discussion.** A collapsed section with the existing coordination: answers, reviews and follow-ups.

Home says the plan isn't published yet until Chris publishes it. After that it shows company goals, adoption and recommended improvements.

The Portal has no messaging feature. The encouragement tools are recommending opportunities and answering milestone questions.

## Developers (Alex, Jordan, Sam)

- **Nothing is assigned.** Every published milestone is visible to every developer on the team, with its outline: description, system, actions and done-when.
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

After Chris publishes a plan, the server observes every configured repository the plan relies on, read-only. It also does this when the opportunities view is first opened, waiting at most 8 s. The inspection is recorded with `requestedBy: "Spotify integration"`. Recent observations are reused within the cooldown, and failures are recorded, not thrown.

`canInspect` is `false` for everyone, and no page offers an inspect button. The `POST repository-inspections` API route still exists for compatibility; the UI does not call it.

## Opportunities: how they are computed

`services/workflow-api/src/activation/opportunities.ts` builds them on the server from the published plan (goals and milestones) and the latest repository observations. This logic is unchanged; it is not part of Chris's LLM analysis. Nothing is stored except the Champion's priorities and recommendations and developers' pursuits (SQLite table `activation_opportunity_state`).

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

It reports goals with progress, completed milestones, pursued and recommended opportunities, each engaged developer (last active, active this week), six weekly buckets, and plain suggestions. `scope: "onboarding_activity"` says what it covers. Everything counted is something a developer or the Champion did in Portal (chose, marked, noted, pursued). **Nothing is detected automatically from repositories, commits or tools, and no wider Portal usage data is connected in this demo.** The UI says so wherever activity is shown (adoption, team progress, Insights).

## Insights (Champion and Chris)

Insights counts the same recorded activity. It shows:
- **Onboarding plan.** "Published by Chris on …", or "Not published yet" before he finalizes.
- **Completion.** A Champion review of a milestone is optional and never required to complete it.
- **Milestones.** A "Working on it" column (who chose it, else the suggested owner, else "Nobody yet") instead of an assignee.
- **Activity recorded in Portal.** Per person, from what they recorded.
- **Repository evidence coverage.** "Last observed by the Portal".

Chris's view adds that nothing there needs his follow-up.

## API (additive)

| Route | Who | What |
|---|---|---|
| `GET opportunities` | Developer, Champion, Chris | Goals and opportunities for the viewer. |
| `POST opportunity-priorities` `{id, priority?, highlighted?}` | Champion | Priority for a goal or opportunity; recommend an opportunity. |
| `POST opportunity-pursuits` `{id, pursue}` | Developer with their own identity | Pursue or stop pursuing an opportunity. |
| `GET adoption` | Champion, Chris | Adoption summary. |
| `POST milestone-updates` `{milestoneId, expectedRevision, pursue}` | Any developer with their own identity | Choose or stop a milestone. |
| `POST handoff-submissions` `{draft, reviewRevision, action:'submit', confirmed:true}` | Chris | Finalize: publishes the plan (`status: published`, `developer.approval = {by: Chris, at}`). On a server that doesn't publish, `status: approved` (finalized). |
| `GET champion-review` | Champion | Read-only Dream Day view of the published plan. `champion-reviews` and `champion-decisions` remain for older records only; on a published plan they answer `NOT_UNDER_REVIEW` / `ALREADY_APPROVED`. |

Contract additions (`contracts/activation/v1/handoff.ts`):
- `Opportunity`, `GoalView`, `Opportunities` and `Adoption`;
- `MilestoneWorkRecord.workingOn`;
- `Insights.milestones[].workingOn`;
- `DeveloperHandoff.approval` now records who published the plan (Chris), not a Champion approval;
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
