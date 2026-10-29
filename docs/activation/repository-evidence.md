# Repository evidence (Phase 7)

Alex, Jordan and Maya can see read-only evidence about the repositories their approved milestones rely on. Chris sees the same evidence without being able to start an inspection. The evidence appears in **My work**, in **Team Coordination → Team overview** and in Chris's **Developer Progress**, and AiKA can cite it.

## Three kinds of information, never mixed

| Kind | What it is | How it is shown |
|---|---|---|
| **Observed** | Something the Portal backend retrieved from the repository itself, read-only | "Observed" (live) or "Sample · observed" (fixture), with source, path, commit and time |
| **Reported** | Something a developer or the customer said, including references in developers' notes | "Reported, not verified" on the milestone's discussion |
| **Unknown** | Not checked, not readable, or can't be established | "Not inspected" or "Not readable"; nothing is inferred |

AI output is never a repository fact. AiKA's "Verified" parts must cite a recorded observation (see below).

## Configuration and modes

The operator configures repositories per customer in a JSON file named by `ACTIVATION_REPOSITORIES_PATH`:

```json
[{"customerId":"fictional-aperture-commerce","id":"payments-api","label":"payments-api",
  "repository":"aperture-commerce/payments-api","mode":"fixture","fixture":"aperture-payments-api","services":["payments-api"]}]
```

- **`services`** links a repository to approved milestones: a milestone is relevant when its system (service or repository) matches.
- **Who sees what.** Developers see only repositories relevant to their own approved milestones. Maya and Chris see all of the customer's.
- **No free-form requests.** Requests name a configured `id`; a repository name or URL in a request is ignored or refused.

There are two modes:

- **Live read-only mode** (`"mode":"live"`). The backend reads GitHub with GET requests only. An optional read-only token comes from `ACTIVATION_GITHUB_REPOSITORY_TOKEN`; it stays on the server and is never sent to the browser or logged. `ACTIVATION_GITHUB_API_ORIGIN` may only be `https://api.github.com` or a loopback test origin.
- **Fixture demo mode** (`"mode":"fixture"`). The same analysis runs on a sample file, either built in (`fixtures/repositories/<name>.json`) or given as an absolute path.
  - Every observation is marked `fixture`, its source says "Sample fixture …", and there are no GitHub links.
  - The panel reads "Sample data · fictional repository, not live".
  - AiKA labels claims citing it "Sample data", never "Verified".
  - The fictional Aperture `payments-api` **does not exist on GitHub**. The demo launcher uses the built-in `aperture-payments-api` sample by default.

## What is inspected (live and fixture alike)

1. **Repository identity**: full name, visibility, archived flag, last push.
2. **Default branch and commit**: the head commit and its date. Every later read is pinned to that commit.
3. **File listing** at that commit. If GitHub returns a truncated listing, absence can't be established, so those signals are "not inspected", never "missing".

From the listing, plus at most three small files (up to 64 KiB each, Git blob hash checked):

| Signal | What's looked for | What's kept | What it doesn't prove |
|---|---|---|---|
| README | `README*` at the root | size, first heading | — |
| Documentation | `docs/**/*.md`, `mkdocs.yml` | file paths | content quality |
| CODEOWNERS | `.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS` | rule count, @-handles (no e-mail addresses) | that the owners are active; a missing file isn't proof nobody owns the service |
| CI configuration | `.github/workflows/*.yml`, Jenkinsfile, GitLab, CircleCI, Azure, Travis, Bitbucket, Buildkite files | file paths | that CI runs or passes |
| Deployment | Dockerfile, compose, Helm `Chart.yaml`, k8s/deploy manifests, Terraform, Procfile and similar | file paths | where or whether it's deployed |
| Backstage metadata | `catalog-info.yaml` (up to depth 3) | kind, name, owner, lifecycle, type, system | that it matches the Backstage catalog |
| Runbooks | file names containing runbook, playbook, on-call, incident | file paths | content; runbooks may live elsewhere |
| CI run results | — | — | **never inspected**; always "not inspected" |

Nothing is executed, cloned, written, opened or triggered. No issues, branches, pull requests or workflow runs are created. File contents are not stored; only the short fields above are kept.

## Evidence records

Each inspection is stored in SQLite (`activation_repository_inspections`, keyed by tenant, customer, session and repository; the last 10 per repository are kept). It survives restarts.

An inspection records:
- mode;
- status: `succeeded`, `partial` (some file unreadable) or `failed`;
- error code and retry time;
- default branch and commit;
- start and end times;
- who requested it;
- its observations.

Each observation records:
- signal and status: `observed`, `missing`, `inaccessible` or `not_inspected`;
- mode;
- summary and details;
- limitation;
- source: the API request or fixture file, the path, and a GitHub link for live observations;
- repository, commit and retrieval time.

## Failures, freshness and limits

- **GitHub errors are recorded as codes, never response bodies:**
  - `GITHUB_RATE_LIMITED` (with retry time);
  - `GITHUB_NOT_ACCESSIBLE` (a 404 may mean private; it isn't reported as "doesn't exist");
  - `GITHUB_AUTH_FAILED`, `GITHUB_FORBIDDEN`;
  - `GITHUB_UNAVAILABLE`, `GITHUB_TIMEOUT`;
  - `GITHUB_INVALID_RESPONSE`, `GITHUB_RESPONSE_TOO_LARGE`, `GITHUB_BLOB_MISMATCH`, `FILE_TOO_LARGE`.

  A failed inspection claims nothing: all its signals are "not inspected". The earlier successful evidence stays visible and is labelled as earlier. The onboarding workflow is unaffected.
- **Request limits.** Each request has an 8-second timeout. Responses are capped at 5 MB and the listing at 50,000 entries.
- **No hammering GitHub.** A request within the cooldown (`ACTIVATION_INSPECTION_COOLDOWN_SECONDS`, default 30) returns the recorded inspection. Concurrent requests share one inspection.
- **Stale evidence.** Evidence older than `ACTIVATION_EVIDENCE_MAX_AGE_HOURS` (default 24) is shown as stale with a warning, and AiKA doesn't use it.

## Authorization

| Who | View evidence | Start an inspection |
|---|---|---|
| Alex, Jordan (own credential) | Repositories relevant to their own approved milestones | Yes, for those |
| Shared developer token | Yes | No (`DEVELOPER_IDENTITY_REQUIRED`) |
| Maya (Champion) | All of the customer's configured repositories | Yes |
| Chris (operator) | All, read-only | No (`FORBIDDEN`) |
| Another customer's credential | No | No |

Nothing is available before the plan is approved (`NO_APPROVED_PLAN`).

## In the Portal

- **My work.** Each milestone card shows its repository's evidence, with the signals that matter for that milestone first. The order is derived from the milestone's own words, not from the person:
  - readiness, ownership and CI for Alex's repository-readiness work;
  - Backstage metadata and documentation for Jordan's discoverability work.
  
  Each action shows "Related evidence" with the status of the signals it mentions. Inspecting never changes an action or milestone; developers interpret the evidence and record their work.
- **Team overview.** The Evidence card explains observed versus reported. Each repository's panel shows who inspected it, when, at which commit, and any failure or stale warning. Maya can inspect.
- **Chris's Developer Progress.** The same panels, without the inspect button.

## AiKA grounding

AiKA's context carries the viewer's current, non-stale observations, each as a line with its id, for example:

`[obs-1a2b3c4d5e] OBSERVED (live, read-only) owner/repo@<commit> codeowners: … Limitation: …`

Each line is labelled OBSERVED, NOT FOUND, NOT READABLE, NOT INSPECTED, or SAMPLE (fixture). The server checks every answer:

- **Verified parts must cite.** A "verified" part must cite ids present in that context, pointing to observations that were found or not found. Otherwise it is removed.
- **Sample data is labelled.** A verified part citing fixture data becomes "Sample data".
- **Uncited repository facts are removed.** A "known" part stating repository facts (CODEOWNERS, catalog-info, workflows, README and so on) without a citation is removed.
- **No inspection claims.** First-person claims to have inspected or verified anything are always removed: AiKA inspects nothing itself.
- **With no inspection, nothing to cite.** The context says "No repository has been inspected", so a "verified" part has nothing to cite and is removed.

The AiKA page shows each cited observation: its signal, whether it is live or sample, the repository, commit and retrieval time.

## What remains simulated or unavailable

- **No real GitHub call has been tested.** Live mode was exercised only against mocked GitHub responses: a stand-in `fetch` in the backend tests and a loopback test double in the browser e2e. No call to the real `api.github.com` was made in this environment; its outbound network is restricted.
- **Aperture's repository is fictional.** Its `payments-api` evidence is sample data only.
- **CI results aren't read.** Run results, required checks, branch protection and deployments are never inspected.
- **Monorepos are read whole.** Signals are repository-wide; a service subdirectory isn't isolated.
- **Older views keep their own evidence.** The Phase 2 Repository tab (inspection packets for the recommendation-service flow) is unchanged. Its observations still appear to Maya and Chris as "Other observations recorded by the Portal", and to AiKA as packet observations.
