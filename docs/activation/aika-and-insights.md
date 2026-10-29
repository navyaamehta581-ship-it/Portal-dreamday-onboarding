# AiKA commands and Insights (Phase 8)

> **Updated by the role redesign.** Where this page talks about assigned work, the Repository, Evidence or Team tabs, inspecting repositories by hand, "Ask Chris" or developer Insights, [roles-and-opportunities.md](roles-and-opportunities.md) is current: developers choose their work, the Portal observes repositories itself, and developers have **My progress**.

## AiKA: the original assistant, plus onboarding

The Portal's existing AiKA is preserved:

- the full page (`/aika`, design 053), with the greeting, the suggestion grid and the composer;
- the contextual panel (design 055), which opens from **Open AiKA** at the bottom right of every other page.

Onboarding is an additional capability on top of it, not a replacement.

### Slash commands

Typing `/` in the question box opens a command menu.

- **Using the menu.** It's filtered by what follows the `/`, and you can move through it with ↑/↓, Enter or Tab, and Esc. A chosen command becomes a removable chip. You can choose up to four.
- **Who decides.** The list comes from the server (`GET aika-capabilities`). The server works out what is available for the signed-in person and the approved plan, and the menu only offers commands that person can use.
- **Checked again on every question.** The server re-checks each question (`POST aika-questions` with `capabilities`).
  - A command the person may not use is refused with `403 AIKA_CAPABILITY_FORBIDDEN`.
  - An unknown command is refused with `INVALID_REQUEST`.
  - The refusal applies whatever the page sent.

| Command | Retrieves | Available to |
|---|---|---|
| `/onboarding` | Approved plan: problem, goals, facts, open questions | Everyone on the customer's team once the plan is approved |
| `/my-work` | The person's own milestones: actions, criteria, dependencies, their notes | Developers with assigned milestones |
| `/repository` | Repository observations the Portal backend recorded (live or labelled sample), with ids to cite | When the operator configured a repository for the customer |
| `/team` | Developers: other milestones by status only, plus team totals. Maya: full coordination detail | Everyone on the team |
| `/docs` | Nothing yet | Listed as unavailable: "No documentation source is connected to this Portal yet." |

- **With no command,** AiKA reads everything the person may see, as before.
- **With commands,** only those records are retrieved. The prompt tells the model to call anything else unknown.
- **Chris** (the operator) doesn't use AiKA: "AiKA is for the customer's team."

### Answers

Every answer is split into labelled sections:

- **Known:** from the approved plan.
- **Verified:** cites a live repository observation.
- **Sample data:** cites a fixture observation.
- **Reported:** someone said it, and it isn't verified.
- **Suggestion:** AiKA's own advice.
- **Unknown:** with who could answer it.

The server enforces these labels:

- A "verified" claim without a valid citation is removed. One that cites sample data is relabelled **Sample data**.
- "Known" text that isn't grounded in the context becomes a suggestion.
- Any first-person claim that AiKA inspected, checked or ran something is removed. AiKA never inspects anything; only the Portal backend records observations.

The page also says plainly, under the composer, that you're asking AiKA, not a person. Decisions and approvals go to the Champion (Maya), through **Question for your Champion** in My work.

## Insights

- **Where.** `/insights` in the Portal, and `/operator/insights` for Chris. Served by `GET insights`.
- **Computed on the server from stored records only:**
  - plan approval;
  - milestone status;
  - action completion;
  - updates, blockers, questions, replies, coordination and reviews, each attributed to the person who recorded it;
  - repository evidence coverage (observed, not found, not readable, not inspected), labelled live or sample.
- **Nothing is estimated.** Anything not recorded is shown as missing.
- **Who sees what:**
  - **Maya and Chris** see everyone's activity and the review stage.
  - **A developer** sees the same team totals and milestone statuses, but only their own activity in detail. There's no review-workflow stage and no other developer's last-activity times.
- **Labelling.** On the fictional demo customer, a banner says the numbers come from fictional demo activity, and repository evidence is marked "Sample data" unless it's live.
