> Follow-up: [recommendation-demo.md](recommendation-demo.md) records the user-supplied simulated recommendation-service fixture. It is a preview only, with no real agreement or canonical customer session.

# Briefing intake vertical slice — 27 October 2026

Freeze: **HOLD**. Phase 1 implementation candidate is reviewable; real Chris/customer acceptance remains open.

## Implemented

An additive disclosure in `/activation` accepts Chris’s pasted existing briefing, a separately agreed activation outcome, who agreed, and an explicit report-of-agreement checkbox. No CRM, questionnaire, inferred agreement, Portal execution or customer verification is introduced. Existing Portal/conversation screens are untouched; the isolated ActivationPage remains a Navyaa review candidate.

POST `/api/activation/v1/customers/:customerId/intake` accepts exactly `{briefing,outcome,agreedBy,agreementConfirmed:true}`. Uses existing scoped bearer authorization and 16 KiB body limit, strict field/length validation, no-store, aggregate ETag, create-only state and duplicate conflict. Current success status is 200. Enabled only with both existing `ACTIVATION_DEV=1` configuration and `ACTIVATION_INTAKE=1`. Existing admission bundle supplies the authorized principal, not a matching briefing/plan. Existing `/state` reviewed-plan selection is unchanged.

Server builds context and structured plan, validates both frozen contracts, and grants ephemeral exact-byte admission only to these server-built objects. Admission is released after initialization, including errors. SQLite stores the authoritative full context, plan, source records, suggested action and unassessed outcome. Reopening does not depend on ephemeral admission entries. No client/model can admit arbitrary execution receipts, plan JSON or capabilities through this endpoint.

The developer welcome and Chris evidence projection consume this same saved state. Prerequisites and capability availability are now visible. The existing blocker command control and worker remain intact; **arbitrary blocker/replacement generation for newly pasted contexts is not implemented**. They still require operator-admitted evidence and exact reviewed replacements. Without those, new blocker/replan operations fail closed. This is an explicit remaining limitation, not an end-to-end arbitrary replan claim.

## Generation and reuse evidence

`interpretation/provider.mjs` and `schema.mjs` are byte-for-byte copies of the older `spotify-portal-github-v1/prototypes/v1/server/phase-b` adapter and validator, read without altering that checkout. Its SYSTEM prompt is also the prompt used by the existing prepare-training workflow. No training examples were uploaded and no fine-tuning occurred. No claim that an intent extractor is a free-text planner: the hosted model supplies only validated intent and ambiguity/missing-information signals; bounded server rules assemble the plan.

The four-entry `capabilities.json` is an explicit ID/title projection of existing `prototypes/v1/src/data/catalog.ts` entries ci/onboard/docs/node, all **representative**, with installation/access unknown. It does not establish real Portal availability. Hosted planning uses existing `PORTAL_LLM_*` server configuration; transport retains credential isolation, redirect rejection, timeout, output-size bound and strict provenance validation. Provider exceptions or invalid output fall back deterministically. Briefing constraints remain original attributed text and are never silently promoted into permissions; actions only propose preparing review checklists.

This path constructs new plans from unseen text, separately reported outcome and catalog rules; it does not look up an exact pre-reviewed plan. Test-owned incident and regulated Java onboarding briefs yield different checklist actions and capabilities. The browser incident plan was generated through the **deterministic fallback**, not a live LLM. A separate injected valid interpretation test exercises the hosted-result branch; it is a test double. **No actual hosted inference, trained model, real customer briefing or independently established agreement is claimed.** The user has been asked for the actual briefing and agreement attribution.

Evidence records distinguish two customer reports (briefing/agreement) from an ai_inference linked to both. All have `proof:none`, `result:not_checked`; inferred intent and fallback/hosted branch are recorded. Capabilities remain representative, action suggested, milestone pending and customer outcome unassessed. Quoted claims in a pasted brief are never independent technical evidence.

## Validation

Node 24.12.0: **151 tests passed** (32 backend, 37 contracts, 15 inspector, 4 conversation/local routes, 63 frontend). Backend strict typecheck and frontend strict typecheck/production build passed (1676 modules). No dependency or lockfile changes; prior temporary dependencies reused. Initial HTTP test attempt was restricted from binding localhost; the approved local-server rerun passed.

New coverage: two substantially contrasting unseen briefs, missing context, missing agreement, invalid model output, valid injected interpretation, exact admission/tamper rejection, provenance links, suggested/unassessed status, duplicate initialization, authenticated HTTP save/reload, persistent database reopen, UI checkbox and payload. Existing tests retain blocker/replan recovery and authorization boundaries.

Real browser: actual ActivationPage → client → Vite proxy → API → SQLite, test-only principal and temporary database an isolated temporary verification location, no mocked browser transport. Submitted explicitly labeled test incident briefing and agreement, observed generated fallback checklist and Chris evidence view. Reloaded browser, stopped/restarted API on same database, reentered in-memory test credential and loaded identical revision 0, plan, evidence IDs, suggested action and unassessed outcome. Temporary browser screenshots remain local and are excluded from the handoff. Browser did not run new-context blocker generation or a live provider. Contrasting and missing-info scenarios were automated tests, not browser runs.

## Updated phase checklist and gates

- [x] Inspect existing uncommitted work and frozen evidence/authority semantics; preserve prior work.
- [x] Add minimal local Chris briefing + separately reported agreement intake.
- [x] Construct bounded structured initial plans for unseen text with labeled safe fallback.
- [x] Persist authoritative plan/context and render developer welcome + Chris evidence projection.
- [x] Test contrasting contexts, missing info, provenance, HTTP refresh, saved-state reopen and real browser/API restart.
- [ ] Phase 1 real-customer acceptance: actual Chris briefing, attributable agreed outcome, customer/developer review of generated first step.
- [ ] Live hosted interpretation evidence; richer context-specific planning beyond bounded review checklists.
- [ ] New-context arbitrary blocker/replan evidence intake and generation (existing reviewed-session flow passes).
- [ ] Navyaa approval of isolated frontend/client and shared boundary; backend/domain owner review of report-based intake admission.
- [ ] Production identity/tenant authorization, full response runtime validation and native Portal integration.

Full contract freeze remains HOLD. Enabling real production intake or native integration is not implied by these local tests. No push, merge, deployment, deletion or changes to other checkouts. HEAD remains 4fd85d5; changes are uncommitted alongside prior work.
