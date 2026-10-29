# Persona demo: one entry for Chris, Maya, Alex and Jordan

Use Node >=24.12.0 <25. From the repository root, once:

```sh
npm ci --ignore-scripts --prefix services/workflow-api
npm ci --prefix prototypes/v1
```

Terminal 1, the fictional customer API (handoff mode starts empty, so Chris publishes first):

```sh
export ACTIVATION_DEMO_DIR="$HOME/.spotify-portal-demo-aperture"   # must not exist yet, or be a previous run of this demo
export ACTIVATION_DEMO_CUSTOMER_ID=fictional-aperture-commerce
PORTAL_LLM_PROVIDER=ollama OLLAMA_MODEL=qwen3:1.7b npm run demo:handoff --prefix services/workflow-api
```

Leave out `PORTAL_LLM_PROVIDER` and `OLLAMA_MODEL` to use rule-based analysis without a model; AiKA then says it isn't connected. To use the model for AiKA only, set `AIKA_LLM_PROVIDER=ollama` instead of `PORTAL_LLM_PROVIDER`. The launcher creates a personal developer credential for each of `ACTIVATION_DEMO_DEVELOPERS` (default `alex=Alex Rivera,jordan=Jordan Lee`).

Terminal 2, the Portal (same `ACTIVATION_DEMO_DIR` and customer ID):

```sh
export ACTIVATION_DEMO_DIR="$HOME/.spotify-portal-demo-aperture"
export ACTIVATION_DEMO_CUSTOMER_ID=fictional-aperture-commerce
PORTAL_DEMO_LABEL="Aperture Commerce (fictional)" npm run dev --prefix prototypes/v1
```

Then:

1. Open http://127.0.0.1:5173/, select **Get started** and choose **Chris**.
2. In **Customer Context**, add the scenario A information from `services/workflow-api/test/fixtures/scenarios.json` as separate entries, choose each entry's category, and select **Save information**.
3. Select **Analyze customer**. The page shows the running stage and elapsed time; with a local model this takes one to three minutes, and you can keep working.
4. Open **Onboarding Draft**, edit the problem, stakeholders, goals, milestones and questions, and select **Save draft**.
5. Add the technical team under **Stakeholders** if the analysis didn't name them (e.g. Maya Chen as Champion, Alex Rivera and Jordan Lee as developers). Then confirm and select **Mark ready for Champion review**. Nothing becomes visible to developers.
6. Sign out and choose **Maya**. Open **Team Coordination → Dream Day**:
   - review the plan;
   - assign each milestone (for Aperture: Alex the repository readiness assessment, Jordan the independent discoverability check);
   - select **Save draft**;
   - then either **Request changes** (Chris sees your reason and resubmits) or confirm and **Approve onboarding plan**.
7. Sign out and choose **Alex** or **Jordan**: each sees only the work assigned to them. **Chris** sees that Champion approval is complete.
8. As **Alex**, select **Open my work**: set action statuses, record an update or blocker (with an optional reference), and mark the milestone ready for review once every action is completed and no blocker is open. Select **Ask AiKA about this milestone** to ask AiKA. As **Jordan**, work on the dependent milestone: it can't be marked completed until Alex's is. **Maya** (Team overview) and **Chris** (Developer Progress) see the consolidated progress.
9. As **Maya**, open **Team Coordination → Team overview**: check **Needs your attention**, **Respond** to a question or blocker (optionally marking the blocker resolved), add a coordination note or **Request follow-up**, and **Mark reviewed** once a developer marks their milestone ready for review. Reviewing doesn't complete the milestone. Alex or Jordan reply from **My work**; Chris sees it all read-only.
10. In **My work**, select **Inspect repository (read-only)** on a milestone. The demo uses labelled **sample data** for the fictional `payments-api` (it doesn't exist on GitHub), so the panel says so and AiKA labels claims from it "Sample data". To inspect a real repository read-only instead, start Terminal 1 with `ACTIVATION_REPOSITORIES_PATH` pointing to a file like `[{"customerId":"fictional-aperture-commerce","id":"payments-api","label":"payments-api","repository":"<owner>/<repo>","mode":"live","services":["payments-api"]}]` and, for a private repository, `ACTIVATION_GITHUB_REPOSITORY_TOKEN` (a fine-grained token with read-only Contents and Metadata). See [docs/activation/repository-evidence.md](../../docs/activation/repository-evidence.md).
11. Open **AiKA**: the full page from the left navigation, or the **Open AiKA** panel at the bottom right of any page. Type `/` in the question box for the commands you can use: `/onboarding`, `/my-work` (developers), `/repository` and `/team`. Each chosen command becomes a removable chip and limits what AiKA reads to those records; with no command, AiKA reads everything you may see. `/docs` is listed but unavailable because no documentation source is connected. AiKA answers from records, says where it has no evidence, and points to Maya for decisions.
12. Open **Insights** in the left navigation (`/insights`; for Chris `/operator/insights`). Maya and Chris see plan status, progress, milestones, everyone's recorded activity and repository evidence coverage; a developer sees the team's totals and only their own activity. Every number counts stored records.

No tokens are copied or pasted: the Portal's local session layer reads them from `ACTIVATION_DEMO_DIR` on the server side.

See [docs/activation/personas.md](../../docs/activation/personas.md) for routing, the access model and what is still a placeholder.

# Unblock the local activation screen

Use Node >=24.12.0 <25. From the repository root:

```sh
npm ci --ignore-scripts --prefix services/workflow-api
npm ci --prefix prototypes/v1
npm run demo --prefix services/workflow-api
```

Leave that terminal running. In a second terminal:

```sh
npm run dev --prefix prototypes/v1
```

Open http://127.0.0.1:5173/activation. Customer ID is
`fictional-recommendation-demo`. To copy your generated token on macOS:

```sh
npm run demo:token --silent --prefix services/workflow-api | pbcopy
```

On other systems, run the same command without `| pbcopy` and privately copy
the result. Paste it into **Development access token**, then select
**Load / refresh saved session**. The token command intentionally reveals only
your local demo token to you; do not paste it into chat or commit it.

The launcher creates a 256-bit random token, an exact single-principal admission
bundle and separate SQLite databases in the private temporary directory printed
at startup. Files have owner-only permissions. It seeds a fictional suggested
plan once. Progress reports and blockers use existing backend paths; restarting
the same command reloads saved state without replacing it or rotating its token.
Browser reload clears credentials: re-enter the same ID/token. The fictional
agreement is an exercise, never evidence of actual customer consent. Outcomes
start unassessed; no technical receipts or execution approvals are fabricated.

The demo expires after eight hours. It deliberately does not refresh admissions
or evidence timestamps on restart. For a new exercise, stop the old server and
set `ACTIVATION_DEMO_DIR` to a fresh private directory, using the same value in
both the start and token terminals. Keep the old directory to retain old data.
Default storage is temporary: your OS may remove it. The demo refuses
`NODE_ENV=production`, binds only 127.0.0.1, requires bearer authorization and
ignores inherited GitHub read scopes, setup grants and provider credentials.
Intake is disabled: load the seeded session rather than submit a new customer.
No inspector is required for this saved-session exercise. No external repository
inspection, hosted model, runtime write, deployment or adoption is claimed.
Keep forwarded ports private. Simulated Portal login does not authorize the API.

## Existing operator-managed development configuration

`npm start --prefix services/workflow-api` alone starts the Goal API and leaves
activation unavailable. To enable the existing development adapter, configure
these server-side variables yourself; the normal start command does not load
`.env` files:

| Variable | Meaning |
| --- | --- |
| `ACTIVATION_DEV=1` | Explicit activation development opt-in |
| `ACTIVATION_DEV_TOKEN` | Operator-generated secret, at least 32 characters; generate with `node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))'` |
| `ACTIVATION_ADMISSION_PATH` | Absolute filename containing exactly one operator-reviewed AdmissionBundle |
| `ACTIVATION_DATABASE_PATH` | Dedicated SQLite file, different from `DATABASE_PATH`; default `data/activation-dev.sqlite` relative to backend cwd |
| `DATABASE_PATH` | Goal database; default `services/workflow-api/data/goals.sqlite` |
| `PORT` | API port, default 7007; changing it also requires adjusting Vite's activation proxy |
| `FRONTEND_ORIGIN` | Exact loopback HTTP origin; default `http://127.0.0.1:5173` |
| `ACTIVATION_INTAKE=1` | Optional reported-agreement intake; does not bypass evidence admission |
| `ACTIVATION_GITHUB_READ_SCOPES` / `GITHUB_READ_TOKEN` | Optional operator-owned scope-file path / server credential for activation GitHub preparation; not required to load a session |
| `ACTIVATION_SETUP_APPROVAL_GRANTS` | Optional operator-reviewed exact-scope grant file; not needed for session loading |

Bundle shape:

```text
[{principal:{tenantId,customerId,sessionId}, context, plans:[], evidence:[], expiresAt}]
```

Customer IDs are not registered by typing them into the UI. The exact ID must
match `principal.customerId`, `context.customerId`, and the plan customer. The
server assigns tenant/session from the bundle; the browser cannot select them.
Context/plans/evidence require exact matches to the operator-owned records.
New evidence must be no more than 24 hours old and not future-dated; bundles
must be unexpired. Changes require an API restart. Do not retimestamp captured
real evidence or relabel fixtures to admit a real customer.

Authorization and initialization are separate: GET of an authorized but not yet
initialized session returns NOT_FOUND. Initialize through the reviewed context/
plan flow or optional admitted intake. The demo launcher performs this once
for its fictional customer. Wrong credentials/customer or expired bundle give
FORBIDDEN; activation not configured leaves the route unavailable (404), while
unavailable optional adapters return ADAPTER_UNAVAILABLE (503). Credentials stay
in browser memory, while saved state stays in SQLite.

These are local prototype controls, not production identity. The demo does not
modify the normal server, registry, store admission rules, or frontend.
