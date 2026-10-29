# Persona entry and routing (Phase 2)

One entry URL serves every persona: `/` (Welcome) → **Get started** → `/login` (persona sign-in) → that persona's Portal.

| Persona | Role | Starts at | What opens |
|---|---|---|---|
| Chris | `operator` | `/operator` | Customer Onboarding: the existing activation and handoff workspace (Customer Context, Activation Goal, Developer Progress) for the customers listed for Chris |
| Maya Chen | `champion` | `/portal` | The developer Portal (Home, Onboarding) plus **Team Coordination** (`/champion`) |
| Alex Rivera, Jordan Lee | `developer` | `/portal` | The developer Portal: Home with **Your assigned work** and the team's onboarding, and Onboarding (`/activation`) |

All surfaces use the existing Portal shell, navigation and components (`src/portal-app/Shell.tsx`, `portal.css`). The sign-in page reuses the existing entry layout; Team Coordination adds one navigation entry for the Champion.

## Session and routing

- `src/portal-app/App.tsx` is the single root for `/`, `/login`, `/portal…`, `/activation…`, `/champion` and `/operator…`. It reads the signed-in persona from the server session (`/portal-auth/session`) on load and chooses the surface on every navigation.
- **Persistence.** The persona lives in an HttpOnly, SameSite=Strict cookie session on the local server (8 hours). A reload, a typed URL or browser navigation never changes the persona; only **Sign out** does. Signing in again replaces the earlier session.
- **Typed URLs for another surface** show an explanation inside the persona's own shell ("This workspace is for the Spotify account operator" or "This is the customer's developer Portal") and make no API call for that surface. `/login` while signed in returns to the persona's start page. A deep link opened while signed out leads there after sign-in when that persona may use it, otherwise to the persona's start page.
- **Another tab signs in as someone else.** Every API request carries `X-Portal-Persona`. The session layer answers `409 PERSONA_CHANGED` when it no longer matches the cookie, and the page re-checks the session when it regains focus. The tab then stops, shows "You signed in as … in another tab" and loads that persona's Portal. It never keeps acting under the old identity.

## Access model: the persona selector is not a security boundary

Choosing a persona is a simulated sign-in for fictional people. It is not authentication: anyone using the local demo can pick any persona, and the page says so. Hiding or showing a surface in the browser grants nothing. What a persona can do is decided on the server:

1. `server/portal-session.mjs` maps the cookie to a persona and holds that persona's credential. Customer personas (champion, developer) use their customer's **developer** token through `/portal-api/…`. The operator uses each listed customer's **operator** token through `/operator-api/<customer>/…`. The browser never holds a token, and a pasted `Authorization` header is ignored.
2. The session layer refuses before forwarding:
   - an operator persona on `/portal-api` (`WRONG_SURFACE`);
   - a customer persona on `/operator-api` (`FORBIDDEN`);
   - another customer's ID;
   - a customer not listed for the operator;
   - cross-site POSTs.
3. The workflow API still authorizes every request by token, binds it to one customer, rejects developer tokens on operator-only routes (handoff drafts, publication, intake), and applies the developer-safe projection to every non-operator response. Maya has developer access only; the backend has no Champion role yet.

## Configuration

- **Demo directory.** Without a config file, `ACTIVATION_DEMO_DIR` (the demo launcher's private directory) yields one customer and the four challenge personas. Optional `ACTIVATION_DEMO_CUSTOMER_ID` and `PORTAL_DEMO_LABEL` name the customer.
- **Config file.** `PORTAL_DEMO_ACCOUNTS` names a JSON file of the form `{customers:[{id,label,customerId,apiOrigin,tokenFile,operatorTokenFile}], personas:[{id,name,role,title,customers:[…]}]}`. A customer persona belongs to exactly one customer; the operator may list several. The older array of accounts still works as developer personas.

## Placeholders and honest states (not built yet)

- **Approvals.**
  - Team Coordination lists the technical team and the published milestones as **"Proposed — not approved"**.
  - Assignees are hidden until approved; the server projection already enforces this.
  - There are no approve or reject controls. The page says "Nothing has been approved".
- **Assigned work.** "Your assigned work" shows only approved assignments for the signed-in developer. Until the Champion approval step exists, it says "Nothing is assigned to you yet" and points to the team's shared onboarding.
- **Shared onboarding state.** The backend keeps one developer session per customer. Maya, Alex and Jordan therefore see and change the same onboarding progress, and actions are not attributed per person. Per-person sessions need a backend change.
- **Other features.** Portal entries such as Catalog, Docs, Insights and AiKA keep the existing "isn't available in this demo" page.
- **Chris's workflow.** Information entry, background analysis, the editable draft and submission for Champion review are described in [chris-workspace.md](chris-workspace.md). Champion review and approval (Phase 4) are not built: a submitted draft is visible only to Chris.
