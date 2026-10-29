# Evaluation: could the demo run on Vercel Hobby later?

**Status, 29 October 2026:** migration is no longer planned. Render Free remains the deployment target (`render.yaml`, [render.md](render.md)). This earlier evaluation is retained as historical reference; nothing was migrated by this work.

**What was checked:**
- Everything about *our* code below was checked against the repository.
- Vercel's plan limits could **not** be checked from this environment, because vercel.com is blocked by its network policy.
- The Vercel limits named here come from what was known before October 2026. Confirm each one on Vercel's current pricing and limits pages before deciding.

## Short answer

Not as a drop-in move. The frontend would deploy to Vercel easily. The backend would need real changes:

- Today it's one long-running Node process that holds state in memory and writes SQLite to local disk.
- Vercel runs it as short-lived serverless functions, with no shared memory and no persistent disk.

The changes are below. About half are also worth making for Render, because they remove in-process state.

There's also a plan question. Vercel's Hobby plan has historically been limited to **personal, non-commercial use**. A demo for a company challenge may or may not count, so check Vercel's current terms first. If it doesn't qualify, Hobby isn't an option, whatever the technical fit.

## What the demo relies on today, and how Vercel differs

| Today (`services/workflow-api/src/production.ts`) | On Vercel Hobby | Change needed |
|---|---|---|
| **One process** serves the gate, the Portal session layer, the activation API (on a loopback port) and the static frontend. | Static files come from the CDN; each API route is a separate serverless function invocation. There's no loopback port between them. | Call the activation routes in-process from the functions, not over loopback HTTP. Serve `dist/` as Vercel static output. |
| **SQLite file** in `PORTAL_DATA_DIR` (`node:sqlite`) for rooms, workspaces, drafts, milestone work, repository evidence and the AI budget. | No persistent filesystem. `/tmp` exists per instance but isn't shared and disappears, which is worse than Render free, where data at least lasts while the one instance is awake. | Move storage to a hosted database with a free tier (see *Storage options* below). Every store in `src/activation/*store*.ts` and `hosted.ts` needs an adapter. |
| **Background analysis**: `startAnalysis` returns `202` and keeps working after the response (`handoff/service.ts`); the browser polls. | A function can't keep running after its response, beyond the limited `waitUntil`-style extension within its maximum duration. Hobby's maximum duration per invocation is short: historically 10–60 s, longer with Vercel's newer "fluid compute". Verify the current value. | Either run the analysis inside the request (if the maximum duration allows a Gemini call plus the fallback), or persist the job and process it in a follow-up invocation. |
| **In-memory state**: analysis jobs (`Map` in `handoff/service.ts`), rate limiters (`limiter()` in `production.ts`), AiKA jobs, per-boot API credentials (`hosted.ts`), the Gemini 429 backoff (`llm/gemini.ts`). | Each invocation may land on a different instance, so in-memory maps aren't shared. | Keep jobs, rate-limit counters and provider backoff in the database (or a free Redis), and drop the per-boot loopback tokens, since there's no loopback API. |
| **Background room cleanup** on a timer. | No timers between requests. Hobby cron jobs have historically been limited to about once a day. | Clean up expired rooms lazily on access, plus a daily cron. |
| **Request bodies**: small JSON today; a PDF upload is planned (a few MB). | Function request bodies have historically been capped at about 4.5 MB. | Keep the PDF limit below that, or upload straight to free object storage. |
| **Cookies, CSP, Origin checks, gate rate limit by IP** | Work the same. The client IP comes from Vercel's forwarding headers. | Read the IP from Vercel's header; the rest is unchanged. |
| **Gemini free tier** (server-side key) | Works the same; the key goes in Vercel's environment variables. | None, apart from moving the AI budget counter to the database. |

## Storage options with free tiers (no paid services)

- **Turso (libSQL):** SQLite-compatible, so the least code change, since our stores are SQLite already. Statements would become async.
- **Neon or Supabase (Postgres):** more change, because the SQL dialect and transactions differ.
- **Upstash Redis:** good for rate limits and job state, not for the main records.

Free tiers change, so check limits (storage, requests, inactivity pauses) when choosing. Any of them would also make Render data survive restarts. That's the main benefit of doing this work, whichever host is used.

## Suggested order, if Vercel is pursued later

1. **Confirm eligibility and limits.** Check that Hobby allows this use, and note the current function duration, body size and cron limits.
2. **Separate state from the process** (useful on Render too): a storage interface with the SQLite implementation kept for local and Render use; database-backed rate limits, jobs and backoff; no loopback API.
3. **Add a hosted database adapter** (for example libSQL) behind the same interface, and run the existing test suite against both.
4. **Make long work fit the function limits:** synchronous or resumable analysis, lazy room cleanup.
5. **Add a Vercel build config:** static output from `prototypes/v1/dist`, and functions for `/demo-gate*`, `/portal-auth/*`, `/portal-api/*`, `/operator-api/*` and `/healthz`.
6. **Run both e2e suites** (`test:e2e`, `test:production`) against a Vercel preview before switching anyone over. Keep Render working until then.

## What stays the same

Demo rooms and their isolation (a room is part of every record's key), the passphrase gate, signed cookies, persona permissions enforced on the server, the privacy screening of analysis output, the fictional-data and temporary-data notices, and the Portal frontend.
