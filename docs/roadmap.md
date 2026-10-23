# Blueprint implementation order

The full backlog is [516 atoms](backlog.md); the phases and per-atom dependency graph in the blueprint are authoritative. This page records sequencing, not completion.

1. **P0: repository and Portal gates.** Pin the baseline, preserve reusable behavior, collect tenant evidence and review A/B/C. See the [inventory](repository-inventory.md) and scope amendment for REP-008. Do not infer capabilities from the local prototype.
2. **Foundation and vertical slice.** Resolve runtime/contracts, identity, authorized snapshots and durable state. Complete confirmed goal → permitted context → grounded plan → reviewed revision → static validation → artifact export.
3. **Execution and recovery.** Unlock preview and live submission independently, after their own supported contracts and authorization proofs. Add idempotency, reconciliation, failures and independent evidence.
4. **Shared interaction surfaces.** Dashboard, contextual assistance and recommendations use the same engine; unsupported surfaces remain explicit.
5. **Verification and release.** Contract tests and authenticated staging evidence, immutable release artifacts and rollback. Digest is optional and must retain explicit consent and delivery gates.

Select ready atoms from dependencies rather than assigning broad phases as single tickets. One owner and another reviewer per atom; shared contracts need cross-module review. Deferred capabilities remain tracked with reasons. No managed plugin release is claimed by repository preparation.
