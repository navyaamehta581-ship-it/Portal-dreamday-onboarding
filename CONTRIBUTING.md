# Contributing

## One repository, one agreed host

Work from this repository. V1 lives in `prototypes/v1/` and remains a runnable reference. Native V2 code will live in `plugins/`; the host's application and backend wiring belong in `packages/`. Agree on the host Backstage version, frontend system, backend APIs, Node version and package manager in the host-setup issue before generating packages. Do not mix V1's npm lockfile with a future host workspace lockfile.

## Branch and pull request workflow

1. Open an issue describing the developer problem, module, acceptance criteria and dependencies. Claim it before changing a shared contract.
2. Update your checkout from `main`, then create a short branch such as `feat/catalog-context`, `feat/planner-constraints`, `feat/scaffolder-compiler`, `feat/assistant-experience`, `test/onboarding-journey` or `docs/architecture`.
3. Keep the change focused. Discuss domain/API contract changes first; include typed input/output examples, permissions, failure cases and another module's review.
4. Commit source and relevant lockfile changes. Exclude credentials, customer transcripts, dependencies, build outputs and local configuration.
5. Open a draft PR early and link the issue. Explain what now works, actual versus simulated behavior, checks run and limitations. Include screenshots for visible UI changes with fictional data only.
6. Request a teammate's review, resolve comments and conflicts, and check CI on the current commit. Maintainers merge after review; delete the branch through normal GitHub cleanup if no longer needed. Do not push directly to `main`.

Suggested local start:

```sh
git switch main
git pull --ff-only
git switch -c feat/catalog-context
```

Do not use force pushes to shared branches. Never commit credentials or change repository access as part of a feature PR.

## Module split and review

| Module | Primary scope | Review dependency |
|---|---|---|
| Catalog/context | Identity/ownership, authorized catalog entities, documentation provenance, capability inventory | Planner and backend policy reviewers |
| Planning/constraints | Structured requests, eligibility, dependency ordering, coverage and explanations | Context and compiler reviewers |
| Scaffolder/CI | Reviewed template compilation, action schemas, task events, CI and simulation adapter | Backend policy and testing reviewers |
| Frontend/testing | Native page/dock/entity entry, context review, plan editing, approval and journey tests | Owners of the touched API/domain contracts |

These are workstreams, not assigned people. No usernames are invented in CODEOWNERS. Each teammate can claim a module in an issue. Changes to shared contracts, host wiring or root workspace configuration need cross-module review. Unit tests should be colocated with V2 packages; cross-package integration and browser journeys belong under `tests/`.

## Validation

For changes touching V1 or its dependencies:

```sh
cd prototypes/v1
npm ci
npm test
npm run build
```

For docs-only work, check relative links, paths and factual claims. The current CI runs V1 unit tests/build on every PR and push to main. There are no V2 integration/E2E tests or V2 build scripts yet. Add real scripts and CI when the host/plugins exist; do not add passing placeholders. Never treat a successful fixture simulation as an actual repository, deployment or verified developer task.

## Configuration and data

V1 needs no environment variables. `.env.example` intentionally contains no working credential or invented active setting. Configure V2 through the chosen host's validated `app-config` schema and backend environment substitutions. Use fictional fixtures in examples/screenshots. Do not place provider tokens in browser-exposed `VITE_*` settings. Review backend logs and evidence for sensitive data before uploading.

## Maintainer settings checklist

A maintainer should protect `main`: require pull requests, at least one approval, resolution of conversations, and the `V1 tests and build` status check after its first successful run. Disable force pushes/deletions and constrain bypasses according to the team's policy. Verify feature availability for this private repository/plan first. No protection rule is created or enforced by this file. Do not claim V2 checks are required until those checks exist.

Templates become GitHub defaults after this PR is merged into the default branch. This setup PR should be reviewed, not automatically merged.
