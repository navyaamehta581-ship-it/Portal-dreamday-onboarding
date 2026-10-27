# GitHub inspection and local preparation

This additive development adapter prepares one review packet for a fictional recommendation-service activation. It never writes to GitHub. Publishing this implementation PR is separate from runtime action authorization. Existing request schemas and admission bundles remain unchanged.

The operator sets `ACTIVATION_GITHUB_READ_SCOPES` to a local JSON file containing an array of exact read scopes:

```json
[{
  "principal": {"tenantId":"fictional-demo","customerId":"recommendation-demo","sessionId":"demo-session"},
  "actionId":"operator-reviewed-action-id",
  "actionRevision":0,
  "planRevision":0,
  "repository":"navyaamehta581-ship-it/Spotify-portal-solution",
  "commit":"871cb2a3de59fde06c5ea26e47db4fe9126209c7",
  "templatePath":"examples/templates/node-launch.yaml",
  "prerequisitePaths":["services/workflow-api/package.json","prototypes/v1/package.json"],
  "expiresAt":"2026-10-28T00:00:00Z"
}]
```

This is an illustrative read scope, not a customer approval or an active grant. The principal and action must match the separately admitted session. The server rejects a mutable default head that differs from the pinned commit. Configure a new scope after reviewing a newer main. Do not put scopes, admission bundles, databases or tokens in version control. `GITHUB_READ_TOKEN` is optional for public repository reads; private access needs only repository metadata/contents read access. No write permission is needed. The browser receives only its existing development session token. The development identity mode remains unsuitable for production.

Start the existing API with its documented `ACTIVATION_DEV`, admission bundle, token and distinct activation database settings, plus this scope-file environment variable. With no scope file, every preparation is forbidden. In the activation workspace, explicitly click **Inspect / retry and prepare locally**. Alternatively POST to `/api/activation/v1/customers/:customerId/github-preparations`:

```json
{"id":"prepare:unique-command","expectedRevision":0,"planRevision":0,"actionId":"operator-reviewed-action-id","actionRevision":0}
```

Unknown fields (including approval, repository, evidence and execution fields) are rejected. Authentication, customer, tenant, session, current plan/action and blocked actions are checked. Only `github_inspect` and `prepare_artifact` action kinds are supported. No model determines scope or authorization.

The SQLite state/history records inspection intent before network access. A successful result and admitted read-only observations commit together. Exact terminal retries return canonical state without another inspection; changed commands conflict. An interrupted `inspecting` record can resume from the same command after restart, provided the operator read scope is unchanged and unexpired. If unrelated state changed, the packet fails conservatively. Failed commands retain their failure; refresh, clear the command and explicitly submit a new ID to retry. No automatic rebasing occurs. Multi-process races can return a conflict; reread canonical state and retry the same command. GitHub reads are repeatable and no remote writes can duplicate.

The inspector performs GET only against `api.github.com`, disallows redirects, bounds each request to five seconds and each response to 2 MB, and checks a complete immutable tree. It admits only regular files, at most eleven unique template/prerequisite files, each up to 64 KiB. It independently hashes downloaded bytes using Git's blob format and matches tree/blob SHAs. It checks the default head again before preparing. Auth, permission, missing resource, rate-limit, malformed response, incomplete tree, missing prerequisite, stale head, timeout and hash failures produce durable sanitized blockers. Partial observations are not admitted on failure. Raw file contents and API error bodies are never persisted or executed.

`state.githubPreparations` is an optional additive response field. Each packet has an immutable source commit/template blob, scope and command digests, evidence IDs, timestamps, a SHA-256 digest of the locally generated review text, status and blockers. Chris's dashboard links the packet to the evidence ledger. Existing clients can ignore this field. It does not promote an existing plan action, milestone or customer outcome: `prepared` describes the local packet only. `approved`, `executed` and `verified` remain false, and `prUrl` is null. The existing reviewed-progress route still requires its own independently admitted proofs.

The artifact is a review checklist, not generated service code or a ready-to-apply diff. The supplied demonstration template explicitly requires missing local skeletons and installed action-schema review. File presence and valid hashes do not establish template semantics, complete dependencies, a successful workflow, deployment or adoption. Operators choose the explicit prerequisite list; the inspector does not resolve template dependencies. Missing requested paths fail the check; unrequested dependencies remain unverified. Separate exact write authorization and independently admitted execution/verification would be required for any future remote artifact or PR. There is no live Spotify Portal or AiKA integration.
