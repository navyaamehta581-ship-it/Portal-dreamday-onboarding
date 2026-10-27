# Customer handoff demo

## Sources and product decision

The original `Ignition Challenge Spotify.txt` was unavailable in this workspace and `/mnt/data`. The user confirmed “No transcript.” No claim here is presented as independently verified transcript fact.

User-supplied call notes describe customer-specific onboarding after a proof of concept, different Backstage familiarity, SSO providers and repository/wiki structures, no standardized onboarding path, and solutions engineers for deep configuration. They describe Chris researching a value hypothesis, translating technical benefits into a business case, mapping decision makers, coordinating trial touchpoints and prioritizing scarce handholding by contract size. The notes contrast a one-month free trial with a much more resource-intensive engineer-supported trial. Those reported rates are not modeled as predictions or promises.

Existing secondary research reviewed: local `outputs/spotify-research/01-chris-evidence.md` and `04-adoption-and-customer-journeys.md`, which map the follow-up document to CRM/call-note fragmentation, customer goals and adoption evidence. Original follow-up source: https://docs.google.com/document/d/1yVfakiACPUX3I2pAwwALe2SUioMoH2J8l63OD83pi6Y/edit . The October 8 notes about building business cases from scratch and later follow-up material about reusable/custom work describe different times; neither justifies a fixed onboarding template.

Implementation inference: reuse Chris’s existing notes, review the developer-visible handoff once, publish the agreed goal with attribution, and reserve direct assistance for unresolved prerequisites. Commercial case-building and stakeholder mapping remain outside this tool. No CRM, adoption tracker or roster is introduced.

## Routes and local run

Use Node 24.12+ within the Node 24 line. Install the existing locked dependencies in `services/workflow-api` and `prototypes/v1`.

From `services/workflow-api`, choose a new private directory for a new publication exercise:

```sh
export ACTIVATION_DEMO_DIR="$(mktemp -d /tmp/spotify-handoff.XXXXXX)"
npm run demo:handoff
```

Keep that terminal running. In another terminal, use the same `ACTIVATION_DEMO_DIR` value and run these separately from `services/workflow-api`:

```sh
npm run demo:operator-token --silent
npm run demo:token --silent
```

From `prototypes/v1`, run `npm run dev`. The API is at `http://127.0.0.1:7007` and the frontend at `http://127.0.0.1:5173`.

- External Chris workspace: `http://127.0.0.1:5173/operator`. Use the operator token.
- Developer recording entry: `http://127.0.0.1:5173/` → Get started → simulated login → contextual activation.
- Direct developer/testing entry: `http://127.0.0.1:5173/activation`. Use the developer token.
- Existing historical fixture UI remains at `/legacy-portal`.
- Customer ID: `fictional-recommendation-demo`. Both tokens expire with the eight-hour admission bundle. Neither simulated login nor a URL creates authorization.

`npm run demo` still starts the existing seeded recovery demo. Use a **new** directory and `demo:handoff` to exercise Chris publication. An existing saved session returns a conflict instead of being overwritten. Restart the same command/directory to recover saved published context and reports. Raw notes and champion drafts are local browser drafts and are not recovered. A new account/admission session is needed to republish context; context editing/version publication is not implemented.

Optional alternate ports: set `PORT` and `ACTIVATION_DEMO_FRONTEND_ORIGIN` for the demo API; set `ACTIVATION_API_ORIGIN` and Vite’s `--port` for the frontend. All origins must use explicit loopback addresses.

## Chris or Chris’s agent

Chris can paste up to 60,000 characters of raw notes. Preview copies at most 6,000 characters into an editable developer-visible context, with an explicit truncation warning. This is a verbatim draft, not automatic semantic summarization. Remove private/commercial material, review the whole source, add the agreed outcome and its attribution, then publish. Raw notes never go to the server; only the reviewed handoff is persisted. Do not publish secrets. Operator constraints/unknowns quote reported context, not observed configuration. Optional model interpretation remains bounded by the existing planner.

An authorized agent can prepare the same reviewed handoff and POST `/api/activation/v1/customers/:customerId/intake` using an operator bearer token and JSON:

```json
{"briefing":"Reviewed developer-visible context; max 6000 characters","outcome":"Already agreed activation outcome; max 1000 characters","agreedBy":"Who agreed, when, source; max 200 characters","agreementConfirmed":true}
```

This is the same server path as manual publication. Only the admitted principal/customer can publish. Developer tokens, role headers and simulated login cannot publish or initialize state. A production host must supply an explicit `isOperator` authority check; absence fails closed. Development mode uses distinct `ACTIVATION_DEV_TOKEN` and `ACTIVATION_OPERATOR_TOKEN`, not production identity.

## Test flow and limits

Publish a fictional account with reported Backstage familiarity, SSO, repository/wiki structure and an agreed goal. Load it in Portal using developer access. Review the path; report “I cannot access the repository; ask the technical owner to confirm permissions.” Submit the attributed blocker, wait for recovery, then accept the new onboarding direction. “Bring Your Team Along” becomes available with editable local kickoff text, suggested roles and proposed milestones. Chris refreshes `/operator` to review the evidence-linked help request and follow-up decision. Reports, review acceptance and prepared packets never complete milestones or prove adoption.

Automated real-browser test: install Playwright and its Chromium browser in a local development environment, then run `npm run test:e2e` from `prototypes/v1`. It starts isolated frontend/API processes and a private temporary SQLite database and cleans them up. `PLAYWRIGHT_MODULE_PATH` can select an installed Playwright module; `BROWSER_CHANNEL=chrome` selects installed Chrome. No credentials, screenshots or databases are committed. The check covers manual publication, redaction, developer role denial, direct Portal onboarding, blocker recovery, gated champion plan, Chris review, customer isolation and mobile overflow.

The fictional launcher explicitly disables live model/GitHub credentials, read scopes and approval grants. Existing independently scoped GitHub inspect/prepare functionality is preserved in normal development configuration. A missing scope fails closed. There are no runtime GitHub writes or deployments. Real Portal/AiKA integration, production identity, installed template/action compatibility, real execution proofs and customer outcomes remain unresolved external dependencies. This layer is ready for functional review and later visual polish, not production rollout.
