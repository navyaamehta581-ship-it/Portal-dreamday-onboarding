# Recommendation-service demonstration — 27 October 2026

**Simulated local demonstration. No real-world approval obtained or verified.** Participants are a fictional customer engineering representative and Chris in simulated roles. The activation outcome is proposed for demo, not approved by Chris.

The supplied briefing and developer message are preserved in `evidence/recommendation-demo-intake.json`. The generated preview remains local; regenerate it from the supplied fixture for review. Generation uses the labeled deterministic fallback, not a live hosted model or pre-reviewed plan lookup.

## Suggested first step

Inspect available Scaffolder templates and their documented prerequisites. Since template access, installed capabilities and permissions are unverified, prepare this template-readiness checklist before selecting any runtime or template:

- Confirm the team's approved runtime and supported version.
- Inspect the actual available Scaffolder template catalog; capture template identifier, revision and source.
- Read each candidate's prerequisites, required parameters and documented output. Check whether it supports the recommendation service requirements.
- Confirm repository creation/write permissions and required human approvals.
- Identify deployment configuration and ownership as unknown; creating or deploying a service is outside the proposed activation success criterion.
- Identify technical checks documented by the selected candidate (for example, descriptor/schema validation or template tests), then record their availability. No check has been executed or passed in this demonstration.
- Assemble a reviewable setup artifact only after sources are available, retaining unresolved questions and constraints.

Developer intent is **new-service creation**, even though the developer also asks for deployment. No existing-service onboarding, runtime choice, template choice, service creation or deployment is asserted. The current action remains **suggested** and customer outcome remains **unassessed/proposed**; this checklist is a review draft, not execution proof.

## Contract and validation

The frozen CustomerContext contract requires customer-report evidence for agreement. This fixture explicitly lacks that agreement. The server's simulated preparation branch therefore emits a preview, validates the ActivationPlan, labels source records portal_simulated, and grants no context/plan admission. It cannot initialize an agreed-customer activation ledger. The normal `/activation` reported-agreement checkbox remains truthful and must not be checked for this fixture. A browser-native demo-preview flow is not added by this follow-up.

New regression verifies creation classification, template-first action, explicit runtime unknown, simulated attribution, suggested status, no customer_report records and rejection from canonical session initialization. Backend: 33 tests passed on Node 24.12.0. Backend strict typecheck and frontend build/tests are rerun for this follow-up; see the final session response for results.

Phase 1 real-intake acceptance remains open. Full freeze remains HOLD for real agreement/customer validation, live-model evidence, arbitrary new-context replanning, and Navyaa/domain review. No push, merge or deployment.
