# Persona entry and routing (Phase 2)

One entry URL serves every persona: `/` (Welcome) → **Get started** → `/login` (persona sign-in) → that persona's Portal. On the hosted demo the welcome screen is served by the gate: welcome → passphrase → `/login` → Portal, and the room lives in the top bar's **Fictional demo** menu (see [../deployment/render.md](../deployment/render.md)).

| Persona | Role | Starts at | What opens |
|---|---|---|---|
| Chris | `operator` | `/operator` | Customer Onboarding for the customers listed for Chris: Customer Context (PDF upload), Onboarding Draft (the proposed plan) and Progress & updates (read-only) |
| Maya Chen | `champion` | `/portal` | The developer Portal (Home, Onboarding) plus **Team Coordination**: **Dream Day**, an optional read-only view of the plan Chris published (`/champion`), and the team overview (`/champion/team`): company goals, improvement opportunities she prioritises and recommends, adoption, and milestone coordination |
| Alex Rivera, Jordan Lee | `developer` | `/portal` | The developer Portal: Home with the team's goals, what they can build or improve and their milestones; Onboarding (`/activation`: Overview, My milestones, Guide); **My progress** (`/progress`) and **AiKA** (`/aika`). Nothing is assigned: developers choose |

All surfaces use the existing Portal shell, navigation and components (`src/portal-app/Shell.tsx`, `portal.css`). The sign-in page reuses the existing entry layout; Team Coordination adds one navigation entry for the Champion.

## Session and routing

- `src/portal-app/App.tsx` is the single root for `/`, `/login`, `/portal…`, `/activation…`, `/champion` and `/operator…`. It reads the signed-in persona from the server session (`/portal-auth/session`) on load and chooses the surface on every navigation.
- **Persistence.** The persona lives in an HttpOnly, SameSite=Strict cookie session on the local server (8 hours). A reload, a typed URL or browser navigation never changes the persona; only **Sign out** does. Signing in again replaces the earlier session.
- **Typed URLs for another surface** show an explanation inside the persona's own shell ("This workspace is for the Spotify account operator" or "This is the customer's developer Portal") and make no API call for that surface. `/login` while signed in returns to the persona's start page. A deep link opened while signed out leads there after sign-in when that persona may use it, otherwise to the persona's start page.
- **Another tab signs in as someone else.** Every API request carries `X-Portal-Persona`. The session layer answers `409 PERSONA_CHANGED` when it no longer matches the cookie, and the page re-checks the session when it regains focus. The tab then stops, shows "You signed in as … in another tab" and loads that persona's Portal. It never keeps acting under the old identity.

## Access model: the persona selector is not a security boundary

Choosing a persona is a simulated sign-in for fictional people. It is not authentication: anyone using the local demo can pick any persona, and the page says so. Hiding or showing a surface in the browser grants nothing. What a persona can do is decided on the server:

1. `server/portal-session.mjs` maps the cookie to a persona and holds that persona's credential. Each developer uses their own **developer** token (`developer-token-<persona id>` beside the customer's token, falling back to the shared developer token, which can read but not update work), and the Champion the customer's **Champion** token through `/portal-api/…`. The operator uses each listed customer's **operator** token through `/operator-api/<customer>/…`. The browser never holds a token, and a pasted `Authorization` header is ignored.
2. The session layer refuses before forwarding:
   - an operator persona on `/portal-api` (`WRONG_SURFACE`);
   - a customer persona on `/operator-api` (`FORBIDDEN`);
   - another customer's ID;
   - a customer not listed for the operator;
   - cross-site POSTs.
3. The workflow API still authorizes every request by token, binds it to one customer, rejects developer tokens on operator-only routes (handoff drafts, publication, intake), and applies the developer-safe projection to every non-operator response. The Champion token is the only credential that can review and approve plans (see [dream-day.md](dream-day.md)).

## Configuration

- **Demo directory.** Without a config file, `ACTIVATION_DEMO_DIR` (the demo launcher's private directory) yields one customer and the four challenge personas. Optional `ACTIVATION_DEMO_CUSTOMER_ID` and `PORTAL_DEMO_LABEL` name the customer.
- **Config file.** `PORTAL_DEMO_ACCOUNTS` names a JSON file of the form `{customers:[{id,label,customerId,apiOrigin,tokenFile,operatorTokenFile}], personas:[{id,name,role,title,customers:[…]}]}`. A customer persona belongs to exactly one customer; the operator may list several. The older array of accounts still works as developer personas.

## Placeholders and honest states (not built yet)

- **No approvals.** Chris's **Finalize and publish** makes the plan available to the Champion and developers at once; see [roles-and-opportunities.md](roles-and-opportunities.md).
- **Chosen work.** Once Chris publishes, every developer sees the whole plan and chooses milestones and engineering opportunities; a Champion's suggested owner is only a suggestion. Work is attributed and revision-checked per developer. See [roles-and-opportunities.md](roles-and-opportunities.md) and [developer-work.md](developer-work.md).
- **AiKA, progress and Insights.** AiKA keeps its original page (`/aika`) and its contextual panel on every other page, with `/` commands decided on the server, and can focus on a milestone or an opportunity. Developers have **My progress** (`/progress`); Insights (`/insights` for the Champion, `/operator/insights` for Chris) counts stored records. See [aika-and-insights.md](aika-and-insights.md).
- **Other features.** Portal entries such as Catalog and Docs keep the existing "isn't available in this demo" page.
- **Chris's workflow.** PDF upload, background analysis, the draft (overview first, details collapsed) and finalizing (which publishes) are described in [roles-and-opportunities.md](roles-and-opportunities.md) and, for the earlier steps, [chris-workspace.md](chris-workspace.md).
