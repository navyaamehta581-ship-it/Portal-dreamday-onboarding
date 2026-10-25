# GitHub inspection milestone

## Inspection and source review

Inspected local repository snapshots on 25 October 2026. Origin: https://github.com/navyaamehta581-ship-it/Spotify-portal-solution.git. Baseline: collaboration foundation commit 8f3aa38. Remote freshness could not be verified: shell DNS lookup of github.com failed. No changes were pushed.

The committed V1 is React 19, TypeScript 5.8, Vite 6 and Tailwind 4, with Vitest 5 and a separate npm lockfile. It has deterministic fixture planning, editable workflows, YAML generation and simulated execution. It has no real GitHub inspection backend. A separate local spotify-portal-v2 checkout contains unfinished, uncommitted React 18 and native Backstage frontend/backend work with Zod; it was inspected but not changed or incorporated.

Reviewed the live master specification, version 2.0 dated 25 October 2026, through its Google Docs browser interface: https://docs.google.com/document/d/1LCajkN_u7HyzSJp4B47yZlKhC8Y8pJsJOqDb04vDsJg/edit . In particular Chapters 2, 14 and 15 distinguish advice-only paths, phased read-only rollout, the broader original MVP, and logical/technical/outcome verification.

Reviewed the locally preserved Part 2 corpus at ../outputs/part2-capability-research/Plugin-Training-Reference.txt in the surrounding project (outside this repository). Its delivery record maps it to https://docs.google.com/document/d/1e5jTXvJgoSqevZYHEJhe_wyyXmYKFAKjkagfWKVNIrg/edit . Live access required sign-in and the connector failed; subsequent edits to that document were not verified. Its sections A, D and K require provenance, installed-schema discovery, permission-aware evidence, reuse and accurate outcome claims.

## Plan and pathway

1. Preserve the existing fixture demo and unfinished V2; implement in an isolated checkout.
2. Add one read-only GitHub adapter with server-only credentials, immutable revision evidence and bounded file inspection.
3. Expose a goal/repository form, diagnosis, citations, limitations and structured recommendation.
4. Validate the output and evidence references; test missing/existing CI and unavailable evidence. Extend existing CI.
5. Next, interpret broader goals with a structured need profile and an existing model, retrieve relevant capability records, and compare supported interventions. Benchmark labeled cases before choosing or tuning a model.
6. Add reviewable artifact preparation and correction to demonstrate the master's bootstrap/deployment-gap case. Then verify actual host interfaces before adapting to native Portal/AiKA tools. Add authorized execution and recovery only once the required interfaces and resource authorization are established.

This milestone implements steps 1–4. It is a CI readiness slice, not the complete AI Workflow Architect MVP. It does not train or call a model. A free-text goal is preserved but not semantically interpreted; broader goals are explicitly unassessed. Public capability documentation remains reference evidence, never a live permission grant.

## Contract and behavior

POST /api/diagnose takes `{ "goal": "Check CI readiness", "repository": "owner/name" }`.

Returns version 1, goal, repository, observedAt, recommend-only scope, diagnosis, evidence, actions and limitations. Backend validates the structure and every action citation before returning it. Browser displays the returned evidence as plain text. Repository contents are untrusted data and never executed.

Reads GitHub metadata, resolves the default branch to a commit, reads the complete tree at that immutable revision, recognizes supported CI paths and reads up to four CI/manifest blobs of at most 64 KiB each. Displays at most 4,000 characters per content excerpt; root package.json scripts are inspected. This is not YAML semantic validation or a full stack inference engine. Paths identify additional manifests but their contents are not all inspected.

`missing_ci` means no recognized configuration in the complete tree, not no external CI anywhere. `existing_ci` recommends inspection/reuse and never duplicates the pipeline. Neither establishes valid configuration, passing runs, required checks or permission to write. `blocked` covers permission failure, rate limits, network failure, malformed/incomplete responses, oversized files and unreadable content. A 404 does not disclose whether a private repository exists. Partial evidence may be retained but never yields a missing-CI finding after inspection failure.

Local Node HTTP server binds to loopback, restricts Host/Origin, requires JSON and bounds request size. It has no production authentication/session system. It is for local development; do not expose it as a shared service. Token access is the configured token's access, not delegated Portal-user authorization. Use a narrowly scoped read-only token; do not put tokens in frontend settings, source files or the form.

## Two contributors

- Contributor A: `feat/github-context-backend`, adapter/contract/failure tests. Backend baseline is committed separately.
- Contributor B: `feat/github-context-ui`, form/result presentation, integration and runbook. This branch fast-forwards the backend baseline and carries the completed integrated slice.

Both branches exist locally in this checkout; neither has been pushed. A should synchronize later adapter fixes from the integrated branch before independent follow-up work. Agree on contract changes together. Review and merge through normal PRs; do not overwrite the unrelated V2 checkout or push to main. The isolated clone's origin points to the actual GitHub repository.

## Setup and run

Use Node 24 and npm (checks here used installed Node 26.0.0). From repository root:

```sh
cd prototypes/v1
npm ci
npm run start:inspector
```

In a second terminal, from repository root:

```sh
cd prototypes/v1
npm run dev
```

Open http://127.0.0.1:5173 and select Portal Assistant in the sidebar. Vite proxies only the diagnosis API to http://127.0.0.1:8787 . Both ports must be free. Public repositories can be read anonymously, subject to GitHub limits. For private repositories set GITHUB_TOKEN in the backend terminal using your local secret manager before starting; nothing is needed in the browser. The token must have access to the intended repository and read contents.

```sh
npm test
npm run test:inspector
npm run build
```

These commands run from prototypes/v1. No dependencies were added. Local verification reused the existing collaboration checkout's installed dependencies through an ignored symlink; npm ci is the reproducible fresh-install path but was not newly verified against the registry in this session. The existing lockfile remains unchanged.

## Remaining blockers

Remote repository freshness, push/PR and real GitHub evidence have not been verified in this environment. No tenant, supported Portal host version, actual action/MCP schemas, authenticated per-resource policy, custom-plugin publishing path or AiKA extension was connected. No recommendation is applied, no CI run is triggered, no deployment is made and no productivity benefit is measured. Native integration requires those separate checks. The 13 deterministic inspector tests and existing 39 tests do not satisfy the master's full 20-case reasoning evaluation or execution acceptance suite.

## Verification in this session

- Existing Vitest suite: 39 passed.
- Node inspector suite: 13 passed, including missing CI, existing CI, 401/403/404/429, network failure, truncated evidence, external CI, invalid target, broken citations, unreadable CI and package-script inspection. Provider responses are injected test data, not live success evidence.
- Production TypeScript/Vite build: passed.
- Browser: navigated Home → Portal Assistant, entered backstage/backstage, submitted through the real local backend and observed a structured blocked result with an access citation and no fabricated repository diagnosis. A live successful GitHub response remains unverified.
- The first combined test attempt failed because Vitest discovered a Node test file. Renaming it to diagnose.node-test.mjs separated the runners; both suites then passed.
- Local preview servers required permission to bind loopback ports in this execution environment.
