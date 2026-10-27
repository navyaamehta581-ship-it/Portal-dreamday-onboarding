# Phase 2.5: concrete setup proposal and review acceptance

Phase 2's read-only preparation API is preserved. New successful inspections add `setupProposal` to the packet and include its full JSON and proposed unified file diff in the SHA-256-bound artifact. The proposed file is `.portal/recommendation-service.setup.json`. It is an explicitly fictional review artifact, not a Scaffolder execution payload. Customer owner and repository URL remain null rather than copying example-org or Orbit defaults into an actual setup.

The semantic profile is intentionally limited to exact Git blob `838a456dd71d76a1ab6a46ea4e114fe09f9f997f`. That blob was read and independently matched through the existing inspector. The reviewed profile records four local skeleton paths resolved relative to the actual template location, their presence/absence in the complete pinned Git tree, the source tree SHA, target directories, the publish/register dependency and required action schemas. Changed or unknown template bytes produce an unsupported-template proposal with unresolved prerequisites, not guessed semantics. No general YAML parser or template evaluation is performed.

A directory with regular child files is only `present_uninspected`; it is never called ready. Symlinks, arbitrary repository files, source manifests and a matching template hash cannot establish installed action versions, skeleton correctness, generated catalog metadata, runtime compatibility, credentials or customer approval. `readyToRun` and `remoteWritesAuthorized` always remain false. Older Phase 2 packets are readable and need a new explicit inspection to gain a proposal; stored history is never rewritten.

## Explicit review gate

`POST /api/activation/v1/customers/:customerId/setup-approvals` accepts exactly:

```json
{
  "id": "approval:unique-command",
  "expectedRevision": 2,
  "preparationId": "prepare:existing-command",
  "artifactDigest": "COPY_THE_EXACT_64_HEX_ARTIFACT_DIGEST",
  "sourceCommit": "COPY_THE_EXACT_40_HEX_SOURCE_COMMIT",
  "planRevision": 0,
  "actionRevision": 0,
  "decision": "accept_proposal_only"
}
```

The request is revision checked and idempotent. Changed retries conflict. Unknown fields, execution decisions, stale plans/actions, blocked actions, unknown packets and mismatched digests/commits are rejected. An exact retry of an accepted command returns canonical state without another acceptance, including after restart. A second command cannot approve the same packet again. Independent SQLite connections converge on one saved decision.

Session authentication is insufficient to accept a new proposal. `ACTIVATION_SETUP_APPROVAL_GRANTS` optionally points to an operator-owned JSON array of exact grants. No file means deny all new acceptance. A grant contains `principal` (tenantId, customerId, sessionId), `preparationId`, `artifactDigest`, `sourceCommit`, `planRevision`, `actionId`, `actionRevision`, and `expiresAt`. Copy these from a reviewed canonical packet; never construct grants from a browser body or model output. Grants are loaded on startup, cloned, and checked for exact scope and expiry during acceptance. Keep them, tokens and databases outside Git. Development identity remains loopback-only and unsuitable for production.

Successful acceptance adds only `packet.proposalApproval`, with the exact digest/source/revisions and acceptance time. The principal is bound by its durable session/event key. The original packet's `approved:false`, `executed:false`, `verified:false`, `prUrl:null`, content/digest, unresolved blockers, evidence, plan actions, milestone and customer outcome remain unchanged. This decision accepts a proposal for review only and cannot authorize even an eventual runtime write. There is no execution or deployment endpoint.

Chris's dashboard separately shows the prepared artifact/diff, pending or accepted proposal review, unresolved prerequisites, dependency source links, historical plans and absent execution/verification. The checkbox confirms review of one exact packet. The approval command is preserved across timeout/conflict; refresh and exact retry are safe. Clearing it is explicit. Customer or token changes clear all preparation/approval drafts and customer state.

## Verification and boundaries

Node 24.12.0: 199 tests pass (59 workflow API, 84 frontend, 37 activation contract, 15 existing GitHub inspector, 4 conversation/HTTP). Strict backend/contract/frontend checks, production build, blueprint validation and diff whitespace checks pass. Dependencies reused from temporary installations match every installed lockfile version; missing optional binaries are for other operating systems/architectures.

Browser walkthrough used prominently labeled fictional reports and temporary SQLite files. Fresh authenticated connected-GitHub GET results for main `871cb2a3de59fde06c5ea26e47db4fe9126209c7` were replayed by an uncommitted test transport, with connector-decoded blob bytes re-encoded for the production adapter's independent hash check. This does not verify the native private-repository `GITHUB_READ_TOKEN` transport. Preparation persisted revision 2 and three read observations; acceptance without a grant returned FORBIDDEN. After an operator test grant and API restart, browser acceptance saved revision 3 with all runtime blockers intact. Restart and customer isolation were checked separately. Test acceptance is not user approval of an implementation merge or a real customer setup.

No Google Docs, Navyaa-owned project documentation, frozen request schemas, live Spotify Portal/AiKA integration, customer repository or deployment was changed. Publishing this implementation PR is separate from runtime authority. PR #16 and this PR require explicit merge authorization.
