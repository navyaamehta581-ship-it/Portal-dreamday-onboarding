# Planned integration checks

- Authorized identity/context → catalog/docs retrieval; inaccessible entities never leak.
- Request → constraint/dependency validation → compiler using installed action schemas.
- Plan/context change → previous approval invalidated; execution rejects stale versions.
- Real template/task integration handles success, failure, retry and cancellation without duplicate side effects.
- Server rejects prohibited repository/infrastructure operations despite browser/model manipulation.

No integration harness or passing integration test is included yet. Implement against the verified managed Portal contracts and pinned runtime; see `docs/setup.md`.
