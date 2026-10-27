# Activation and Goal API

For the current Activation Intelligence service, setup and validation, start with the [root README](../../README.md), [active blueprint](../../docs/blueprint/activation-intelligence.md) and [development configuration](../../docs/activation/wire-review.md). Activation is opt-in and uses a separate database with scoped admission. The Goal API foundation below remains supported; its milestone description is historical and does not describe the whole service.

# Goal API — Person B, milestone 1

This is a local, single-user TypeScript backend with real SQLite persistence. It saves and retrieves developer goals. It does not call AI, inspect repositories, validate service ownership, execute workflows or integrate with Spotify Portal. A service ID is a user-supplied label at this stage, not proof that a service exists.

## Start

Use Node 24.12 or later in the Node 24 line (the repository CI baseline).

From the repository root:

```sh
cd services/workflow-api
npm ci --ignore-scripts
npm run check
npm test
npm start
```

The server listens at `http://127.0.0.1:7007`. Runtime and tests use built-in Node HTTP, SQLite and TypeScript support; the install supplies development-only type checking. `node src/server.ts` also starts it without installing development dependencies. Node runs the TypeScript by removing types; `npm run check` separately verifies those types.

The default database is `services/workflow-api/data/goals.sqlite`, independent of the directory from which you launch the script. The ignored data directory may also contain SQLite WAL/SHM files. Keep the database out of Git. Delete it only when you intentionally want to reset local goals, with the server stopped.

Optional environment settings:

| Setting | Default | Meaning |
| --- | --- | --- |
| `PORT` | `7007` | Local listening port |
| `DATABASE_PATH` | Service's `data/goals.sqlite` | SQLite filename; relative overrides resolve from current directory |
| `FRONTEND_ORIGIN` | `http://127.0.0.1:5173` | Exact browser origin permitted to call this service |

The server binds only to `127.0.0.1`. This milestone has no login or per-user access control. All callers on the local machine share the same store. Do not expose its port publicly or use private/production data. CORS and Host checks reduce browser exposure; they are not authentication. A shared deployment, private GitHub integration or Codespaces port-forwarding design needs a separate identity/access-control milestone. This is not a native Portal backend package.

## API contract v1

Shared types and runtime request validator: `contracts/goals.ts` at repository root. Its adjacent package manifest declares module format only; no root workspace or plugin package is generated. Both teammates review changes to this contract before dependent implementation. The example-compatible `/api/goals` paths are frozen for milestone 1; any future versioned path change needs coordinated client migration.

### GET /health

Returns HTTP 200:

```json
{"status":"ok","mode":"local-development","apiVersion":"1"}
```

This reports process readiness, not Portal compatibility or external integration health.

### POST /api/goals

Send `Content-Type: application/json`:

```json
{"serviceId":"payments-api","goal":"Automate CI for my service"}
```

Returns HTTP 201, with a `Location` header pointing to the saved resource:

```json
{
  "serviceId":"payments-api",
  "goal":"Automate CI for my service",
  "id":"goal_<uuid>",
  "status":"received",
  "createdAt":"<UTC ISO timestamp>"
}
```

`received` means saved, not planned, approved or executed. Both fields are required and trimmed. `serviceId` is 3–80 lowercase letters, digits or hyphens starting with a letter; `goal` is 1–2000 characters. Extra fields are rejected. Request bodies are limited to 16 KiB. Creating the same goal twice creates two distinct records: automatic POST retry/deduplication is not implemented.

### GET /api/goals/:id

Returns HTTP 200 with the same saved record, or 404 when absent. There is no list/update/delete endpoint in this milestone.

### Errors

```json
{
  "error": {
    "code":"INVALID_REQUEST",
    "message":"Check the submitted fields.",
    "requestId":"<uuid>",
    "details":[{"field":"goal","message":"Enter a goal between 1 and 2000 characters."}]
  }
}
```

| HTTP status | Codes |
| --- | --- |
| 400 | `INVALID_JSON`, `INVALID_REQUEST` |
| 403 | `ORIGIN_NOT_ALLOWED`, `HOST_NOT_ALLOWED` |
| 404 | `NOT_FOUND`, `GOAL_NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 500 | `INTERNAL_ERROR` |

Every application response carries `X-Request-Id`. Error details never echo submitted values; unexpected errors do not expose database paths or raw SQL errors.

## Frontend handoff for Öykü

No frontend files were changed. Start the prototype at its documented `http://127.0.0.1:5173` origin, then have its API client call the backend:

```ts
import type { CreateGoalRequest, Goal, ApiError } from '../../../../contracts/goals';

// Adjust the relative import for the actual client file location.
const input: CreateGoalRequest = {
  serviceId: 'payments-api',
  goal: 'Automate CI for my service'
};
const response = await fetch('http://127.0.0.1:7007/api/goals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input)
});
if (!response.ok) {
  const failure = await response.json() as ApiError;
  throw new Error(failure.error.message);
}
const saved = await response.json() as Goal;
// Save saved.id in the URL or localStorage, then GET /api/goals/:id on reload.
```

The frontend needs loading, error and saved states. It must retain the returned ID to retrieve the same goal after refresh. Display source mode honestly: this endpoint stores a submitted label and goal; it retrieves no real service context. If the frontend uses `http://localhost:5173`, start the API with `FRONTEND_ORIGIN=http://localhost:5173`. Do not use a wildcard origin.

## Manual test

1. Start the API. Open `http://127.0.0.1:7007/health` in a browser.
2. In a second terminal, save a fictional goal:

```sh
curl -i http://127.0.0.1:7007/api/goals \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":"payments-api","goal":"Automate CI for my service"}'
```

3. Copy its returned ID and retrieve it:

```sh
curl http://127.0.0.1:7007/api/goals/PASTE_RETURNED_ID
```

4. Stop the API with Ctrl+C and start it again. Repeat the GET: the record must be identical.
5. Submit `{}`: expect HTTP 400 with field errors. Retrieve an unknown ID: expect HTTP 404.
6. After Öykü connects the frontend, repeat submission and reload through the actual screen. Backend tests alone do not establish that frontend journey.

## How the files work

- `contracts/goals.ts`: the shared message shapes and runtime validator. Types alone cannot validate untrusted JSON.
- `src/app.ts`: routes HTTP requests, applies local browser/Host restrictions and returns consistent responses.
- `src/store.ts`: owns the SQLite connection, parameterized queries and initial versioned migration. Saved data lives here rather than in React memory.
- `src/server.ts`: reads local settings, starts listening and closes the database on shutdown.
- `test/api.test.ts`: exercises real HTTP requests and persistence across separate server processes.
- `tsconfig.json` and the package manifests/lockfile: reproducible type-checking tools and commands.
- `.github/workflows/goal-api-ci.yml`: runs backend checks independently of the existing prototype checks.

## Scope and review

This independently runnable companion-service foundation is authorized by the current Person B milestone request; it does not select a managed Portal architecture or satisfy the tenant gate. Related blueprint areas are FND-019–FND-023, but their full dependency chain and tenant applicability remain unverified. No atom is marked DONE or claimed as a completed managed plugin capability. Navyaa owns this proposed milestone; Öykü is the proposed review partner, not an automatically requested GitHub reviewer. Contract acceptance and frontend integration remain for joint review.
