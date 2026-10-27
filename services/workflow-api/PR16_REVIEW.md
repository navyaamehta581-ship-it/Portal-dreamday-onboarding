# PR #16 review at e8d5a29

Reviewed `e8d5a2917349d7fa3b2c32a1c37921939a9673d0` against main `871cb2a3de59fde06c5ea26e47db4fe9126209c7`. PR #16 was independently confirmed open, unmerged and unchanged. No merge was attempted.

No actionable merge-blocking code defect was found within the declared inspect/prepare-only boundary. Accordingly there is no separate corrective PR. Phase 2.5 is an additive PR based on the reviewed commit, not a change to PR #16.

| Review area | Finding |
| --- | --- |
| Read authorization | Operator scopes bind all principal fields, action/plan revisions, repository, immutable commit and exact content paths; expiry is checked before and after inspection. Client-supplied authority is rejected. Only current, unblocked inspect/prepare actions begin. |
| Provenance | GitHub metadata, pinned default head before/after, immutable commit/tree, complete tree, regular-file mode, byte bounds and independent Git blob hashing are checked. Trust remains in GitHub's commit/tree API, not an independently reconstructed full Git object chain. |
| Retry/restart durability | SQLite saves intent before reads and atomically admits result/evidence. Terminal exact retries return saved state; changed commands conflict. Interrupted inspection resumes only under matching live scope. Concurrent session mutations invalidate preparation. Multi-process conflicts require canonical refresh/exact retry. |
| Failure sanitization | API error bodies and thrown network details are never persisted. Bounded known codes become durable failures; partial observations are discarded. No false readiness or execution follows failure. |
| Customer isolation | Authorization compares customer route and complete scoped principal; database session/history/event keys include tenant, customer and session. Identity changes clear browser state/drafts. |
| Action proof | Read observations have proof none/not_checked; prepared packet does not advance action, milestone or outcome. Approval/executed/verified flags remain false and runtime PR null. |
| Compatibility/security | Existing request schemas, APIs and receipt admission are preserved; new response fields are optional. No GitHub writes, redirects, template evaluation or deployment path exists. Production identity and private token transport remain deployment prerequisites. |

Reproduced all 191 tests at the exact reviewed head: 53 backend + 82 frontend + 37 activation contracts + 15 inspector + 4 conversation/HTTP.

The substantive limitation is acknowledged in PR #16: its artifact is a checklist, and file presence/hash cannot validate template semantics or dependency completeness. The actual demonstration template references four absent skeleton directories, uses `./ci` rather than `.github/workflows`, and requires installed action-schema review. The current repository manifests do not establish the generated service's dependencies. These are Phase 2.5 scope, not a basis to claim the old packet is runnable.

No review comment, review submission or merge was posted on PR #16; this report records the requested review findings without messaging repository participants.
