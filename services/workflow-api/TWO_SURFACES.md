# Customer handoff demo

## Sources and product decision

The original `Ignition Challenge Spotify.txt` was unavailable in this workspace and `/mnt/data`. The user confirmed “No transcript.” No claim here is presented as independently verified transcript fact.

User-supplied call notes describe customer-specific onboarding after a proof of concept, different Backstage familiarity, SSO providers and repository/wiki structures, no standardized onboarding path, and solutions engineers for deep configuration. They describe Chris researching a value hypothesis, translating technical benefits into a business case, mapping decision makers, coordinating trial touchpoints and prioritizing scarce handholding by contract size. The notes contrast a one-month free trial with a much more resource-intensive engineer-supported trial. Those reported rates are not modeled as predictions or promises.

Existing secondary research reviewed: local `outputs/spotify-research/01-chris-evidence.md` and `04-adoption-and-customer-journeys.md`, which map the follow-up document to CRM/call-note fragmentation, customer goals and adoption evidence. Original follow-up source: https://docs.google.com/document/d/1yVfakiACPUX3I2pAwwALe2SUioMoH2J8l63OD83pi6Y/edit . The October 8 notes about building business cases from scratch and later follow-up material about reusable/custom work describe different times; neither justifies a fixed onboarding template.

Implementation inference: reuse Chris’s existing notes, review the developer-visible handoff once, publish the agreed goal with attribution, and reserve direct assistance for unresolved prerequisites. Commercial case-building and stakeholder mapping remain outside this tool. No CRM, adoption tracker or roster is introduced.

## Routes and local run

Use Node 24.12+ within the Node 24 line. Install the existing locked dependencies in `services/workflow-api` and `prototypes/v1`.

**1. Start one fictional customer API per customer** (terminal per customer, from `services/workflow-api`). Each needs a new private directory:

```sh
export DEMO_ROOT="$(mktemp -d /tmp/spotify-portal.XXXXXX)"; mkdir -m 700 "$DEMO_ROOT/aperture" "$DEMO_ROOT/lumen"
ACTIVATION_DEMO_DIR="$DEMO_ROOT/aperture" ACTIVATION_DEMO_CUSTOMER_ID=fictional-aperture-engineering PORT=7007 npm run demo:handoff
# second customer (optional, for isolation checks), in another terminal:
ACTIVATION_DEMO_DIR="$DEMO_ROOT/lumen" ACTIVATION_DEMO_CUSTOMER_ID=fictional-lumen-retail PORT=7008 npm run demo:handoff
```

`ACTIVATION_DEMO_CUSTOMER_ID` is optional (default `fictional-recommendation-demo`) and must start with `fictional-`.

**2. Describe the demo accounts for the Portal sign-in** in a private JSON file (paths and ports from step 1; nothing here is sent to the browser except `label`, `user` and `customerId`):

```sh
cat > "$DEMO_ROOT/accounts.json" <<EOF
[{"id":"aperture","label":"Aperture Engineering","user":"Alex Rivera","customerId":"fictional-aperture-engineering","apiOrigin":"http://127.0.0.1:7007","tokenFile":"$DEMO_ROOT/aperture/token"},
 {"id":"lumen","label":"Lumen Retail","user":"Sam Okafor","customerId":"fictional-lumen-retail","apiOrigin":"http://127.0.0.1:7008","tokenFile":"$DEMO_ROOT/lumen/token"}]
EOF
```

With a single customer you can skip the file: start Vite with `ACTIVATION_DEMO_DIR` (and `ACTIVATION_DEMO_CUSTOMER_ID` if set) instead.

**3. Start the frontend** from `prototypes/v1`: `PORTAL_DEMO_ACCOUNTS="$DEMO_ROOT/accounts.json" npm run dev`.

- Chris's workspace: `http://127.0.0.1:5173/operator` (tabs at `/operator/goal` and `/operator/progress`). It renders inside the same Portal shell as the developer Portal but has its own access: pick the customer and paste that customer's operator token (`ACTIVATION_DEMO_DIR=… npm run demo:operator-token --silent`). The token stays in the tab's memory; no developer sign-in or cookie is used.
- Developer Portal: `http://127.0.0.1:5173/` → Get started → simulated sign-in → Portal home → Onboarding. Direct route: `http://127.0.0.1:5173/activation` (asks for sign-in first).
- Historical fixture UI: `/legacy-portal`.

The simulated sign-in only selects an operator-configured demo account. A dev-only session layer in the Vite server (`prototypes/v1/server/portal-session.mjs`) sets an HttpOnly, SameSite=Strict cookie and attaches that account's developer token server-side to `/portal-api/activation/...` requests; the token never reaches the browser. The signed-in account fixes the customer ID (another ID gets 403 without being forwarded), cross-site POSTs are refused, and the workflow API still enforces bearer scope, customer binding and operator-only routes unchanged. This is not Spotify authentication and must not be deployed.

`npm run demo` still starts the existing seeded recovery demo. Restart the same command/directory to recover saved published context and reports. Raw notes and champion drafts are local browser drafts and are not recovered. A new account/admission session is needed to republish context; context editing/version publication is not implemented.

## Chris or Chris’s agent

Chris can paste up to 60,000 characters of raw notes. “Organize notes” holds back lines that look commercial or private (pricing, contract, discount, confidential…), copies the rest (max 6,000 characters, with a truncation warning) into an editable developer-visible context, quotes keyword-detected technical signals and the topics still unstated, and suggests outcome sentences. This is keyword-based assistance, not semantic summarization. Remove private/commercial material, review the whole source, add the agreed outcome and its attribution, then publish. Raw notes never go to the server; only the reviewed handoff is persisted. Do not publish secrets. Operator constraints/unknowns quote reported context, not observed configuration. Optional model interpretation remains bounded by the existing planner.

An authorized agent can prepare the same reviewed handoff and POST `/api/activation/v1/customers/:customerId/intake` using an operator bearer token and JSON:

```json
{"briefing":"Reviewed developer-visible context; max 6000 characters","outcome":"Already agreed activation outcome; max 1000 characters","agreedBy":"Who agreed, when, source; max 200 characters","agreementConfirmed":true}
```

This is the same server path as manual publication. Only the admitted principal/customer can publish. Developer tokens, role headers and simulated login cannot publish or initialize state. A production host must supply an explicit `isOperator` authority check; absence fails closed. Development mode uses distinct `ACTIVATION_DEV_TOKEN` and `ACTIVATION_OPERATOR_TOKEN`, not production identity.

## Test flow and limits

Publish a fictional account with reported Backstage familiarity, SSO, repository/wiki structure and an agreed goal. Load it in Portal using developer access. Review the path; report “I cannot access the repository; ask the technical owner to confirm permissions.” Submit the attributed blocker, wait for recovery, then accept the new onboarding direction. “Bring Your Team Along” becomes available with editable local kickoff text, suggested roles and proposed milestones. Chris refreshes `/operator` to review the evidence-linked help request and follow-up decision. Reports, review acceptance and prepared packets never complete milestones or prove adoption.

Automated real-browser test: install Playwright and its Chromium browser in a local development environment, then run `npm run test:e2e` from `prototypes/v1`. It starts two isolated customer APIs, the frontend and private temporary SQLite databases, and cleans them up. `PLAYWRIGHT_MODULE_PATH` can select an installed Playwright module; `BROWSER_CHANNEL=chrome` selects installed Chrome. No credentials, screenshots or databases are committed. The check covers publication with held-back private notes, Portal welcome and simulated sign-in, no bearer tokens in the developer browser, developer role denial, guide question and blocker replanning, gated champion plan surviving refresh, GitHub fail-closed, Chris review, two-customer isolation, sign-out and mobile overflow.

The fictional launcher explicitly disables live model/GitHub credentials, read scopes and approval grants. Existing independently scoped GitHub inspect/prepare functionality is preserved in normal development configuration. A missing scope fails closed. There are no runtime GitHub writes or deployments. Real Portal/AiKA integration, production identity, installed template/action compatibility, real execution proofs and customer outcomes remain unresolved external dependencies. This layer is ready for functional review and later visual polish, not production rollout.
