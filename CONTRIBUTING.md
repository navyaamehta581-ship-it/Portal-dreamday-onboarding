# Team development

## Branches and VS Code

Each teammate clones the repository and opens the root in VS Code. Use a separate branch per small coherent set of ready atoms; avoid editing the same contract without an agreed owner.

```sh
git switch main
git pull --ff-only
git switch -c feat/atom-id-short-description
```

Commit and push that branch, then open a draft PR against `main`. Link atom IDs and issues, request another teammate's review, resolve comments and require current checks before maintainer merge. Do not push directly to `main`, force-push shared branches or merge unreviewed work. Live Share is optional for pairing; Git branches and PRs retain the review record.

## Claim work

Start with the [Activation Intelligence blueprint](docs/blueprint/activation-intelligence.md) and [roadmap](docs/roadmap.md). Use scoped activation issues for current work. The atom process below applies only when explicitly revisiting historical requirements.

Use the [backlog](docs/backlog.md) and GitHub atom issue form. Record one owner and reviewer, dependency IDs, intended files, typed inputs/outputs, operation, failure/recovery behavior, positive and negative tests, capability assumptions and proof. Use the blueprint's full ticket schema for implementation work. Claiming a ticket is not completion; source PASS criteria are acceptance requirements.

Keep `docs/backlog/atoms.json` aligned with issues and PRs. Set `IN_PROGRESS` only after dependencies and applicability are reviewed. `DONE` requires linked proof and reviewer decision. BLOCKED/DEFERRED records need a reason. Do not bulk-close unsupported work or mark all atoms passed after a local build.

## Responsibility areas

| Area | Review partner |
| --- | --- |
| Domain/contracts and planning | Backend policy and adapter reviewers |
| Portal/runtime integration | Identity/security and release reviewers |
| UI/context/recommendations | Domain and accessibility reviewers |
| Adapters/compiler/execution | Policy, recovery and evidence reviewers |
| QA/release/data | Relevant module owner plus independent reviewer |

These are responsibilities, not assigned people. No CODEOWNERS identities are invented. Review contract changes before dependent implementation. The tenant/runtime gate in [setup](docs/setup.md) must precede plugin generation.

## Validation and data

Run the current commands in the [root README](README.md). Record actual runtime, commit and results in the PR. V1 CI runs its tests/build; the activation tests under `tests/activation/` are executable local harnesses; other integration/E2E folders retain historical acceptance plans. Do not introduce passing placeholder checks. Add executable adapter/tenant checks when those contracts exist.

Use fictional fixtures. Never put credentials, private transcripts or production tenant evidence in Git. Store secrets only in an approved facility; never in browser-exposed `VITE_*` variables. Keep V1's lockfile separate until a reviewed workspace decision.

## Maintainer settings

A maintainer should verify protection support and require PR review, resolved conversations and successful current checks; disable force pushes and branch deletion on `main`. This document does not configure protection or repository permissions. Publishing/tenant enablement and real external execution are separate release actions.
