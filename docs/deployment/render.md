# Deploying the hosted demo on Render (free)

One Render **free** web service runs the whole prototype from `./Dockerfile`, as described in `render.yaml`. There is no persistent disk and no paid AI. Deploys are manual (`autoDeploy: false`).

**Status checked 29 October 2026:** `spotify-portal-demo` is deployed on Render Free. Its health check and a real Gemini PDF analysis succeeded. Credentials are configured only in the hosting dashboard; never copy values into this guide. This is a dated observation, not a live status guarantee.

The working service reported `GEMINI_MODEL=gemini-3.5-flash-lite`; `render.yaml` currently defaults to `gemini-2.5-flash`. When recreating the service, explicitly select a model available on your Gemini project’s free tier and verify a real generation request. Do not assume a Blueprint default matches an existing dashboard setting.

## What it costs

| Part | Plan | Cost |
|---|---|---|
| Render web service | `plan: free` | $0. No payment method is needed for a free web service. |
| Storage | SQLite in `/tmp/spotify-portal-demo`, inside the container | $0. No disk is declared. |
| PDF reading | pdf.js (Mozilla, open source), installed in the image; runs inside the service | $0. No document-processing service. A worker thread with a 192 MB memory cap and a 20 s limit; one PDF at a time. |
| AI | Gemini API free tier (model selected with `GEMINI_MODEL`), optional | $0 when the key's Google Cloud project has **no billing enabled**. |

Nothing in `render.yaml` or the server turns on a paid service. Keep billing off on the key's Google project: with billing off, Google refuses requests above the free quota rather than charging for them.

## What "free" means for the demo

- **Demo data is temporary.** Free Render services have no persistent disk, so rooms, sign-ins and work live in the container's filesystem. They're lost when the service:
  - **sleeps** (a free service spins down after about 15 minutes without traffic, and the next visit takes roughly a minute to wake it);
  - **redeploys** (every manual deploy starts a new container);
  - **restarts** (crash, config change, or a Render maintenance move).
- **This is said to visitors.**
  - The welcome screen, the passphrase step and persona selection all show a "Temporary demo data" notice.
  - Inside the Portal, the **Fictional demo** menu in the top bar repeats it, next to the room code.
  - Someone whose room disappeared is sent back to the gate with "Your previous demo room is no longer available… Enter again to start a fresh room", rather than an error or an empty Portal that looks broken.
- **For a live presentation:** open the URL a minute or two beforehand to wake the service. Run the whole walkthrough in one sitting, so it doesn't sleep in between.
- **AI is paced to the free tier.**
  - `PORTAL_AI_REQUESTS_PER_MINUTE=8` and `PORTAL_AI_DAILY_REQUEST_LIMIT=200` keep the service below Gemini's free-tier quotas. Google publishes them per model and project and changes them from time to time; check the current numbers in AI Studio and lower these values if needed.
  - If Google still answers `429`, the server waits for the `retryDelay` Google gives before trying again.
  - When AI is limited or unavailable, Chris's analysis falls back to rule-based results that say so, and AiKA says it's unavailable. Customer information is always saved.
- **The public demo is fictional only.** The fictional customer is Aperture Commerce, and the repository data is labelled sample data. On the free tier, Google may use prompts and responses to improve its products, and people may review them. Don't enter real customer information. The entry screens and the **Fictional demo** menu say so.

## What runs

```
visitor ─HTTPS─▶ Render ─▶ production server (services/workflow-api/src/production.ts)
                             ├─ /healthz          health check (Render)
                             ├─ /demo-gate        welcome → passphrase → demo room (then /login: persona selection)
                             ├─ /portal-auth, /portal-api, /operator-api → Portal session layer → activation API (loopback only)
                             └─ everything else   built Portal frontend
```

These protections are the same as on a paid host:

- **Demo rooms.** Passing the gate gives each visitor their own room: a separate data partition with a code like `K7M2Q-9XRTB`.
  - Anyone with the passphrase and that code can join the room, so an evaluation panel can share one while the service is awake.
  - Rooms end after `PORTAL_DEMO_ROOM_TTL_HOURS`, and their data is then deleted.
  - At most `PORTAL_DEMO_ROOM_LIMIT` rooms can be active at once.
- **Signed cookies.**
  - Gate and persona cookies are signed with `PORTAL_SESSION_SECRET` and are `HttpOnly`, `Secure` and `SameSite`.
  - There are no tokens in the browser. The activation API listens on loopback only, with credentials created at each start.
- **Limits:**
  - 10 gate attempts per IP every 15 minutes;
  - per room, 120 changes and 600 reads per minute, 15 analyses and 60 AiKA questions per day;
  - the per-minute and daily AI limits above, across the whole service.
- **Headers.** Strict CSP, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and an Origin check on every write.
- **Logs.** JSON, with codes only. No passphrase, key, room code or customer text.

## Environment variables (all in `render.yaml`)

| Variable | Set by | Notes |
|---|---|---|
| `NODE_ENV`, `PORTAL_STORAGE=ephemeral`, `PORTAL_DATA_DIR=/tmp/spotify-portal-demo`, `PORTAL_LLM_PROVIDER=gemini`, `GEMINI_MODEL`, `PORTAL_AI_REQUESTS_PER_MINUTE`, `PORTAL_AI_DAILY_REQUEST_LIMIT`, `PORTAL_DEMO_ROOM_LIMIT`, `PORTAL_DEMO_ROOM_TTL_HOURS`, `ACTIVATION_EVIDENCE_MAX_AGE_HOURS` | `render.yaml` | Change them in Render → service → Environment if needed. |
| `PORTAL_SESSION_SECRET` | Render generates it | Keep it. Changing it signs everyone out of their room. |
| `PORTAL_DEMO_PASSPHRASE` | **You**, in the Render dashboard | At least 12 characters. Share it privately with reviewers. |
| `GEMINI_API_KEY` | **You**, in the Render dashboard | Optional. Without it, the demo runs rule-based and AiKA is unavailable. |

- `PORT` is set by Render, and `RENDER_GIT_COMMIT` is shown in `/healthz`.
- Nothing refers to `/var/data`.
- `PORTAL_STORAGE=persistent` is only for a host with a real disk. It changes the notices, not the security.

If the passphrase or the secret is missing or too short, the server still starts. `/healthz` then answers `503` and names the missing variable, and the site shows "This demo isn't configured yet". Render therefore reports the deploy as failing until both are set.

## One-time setup

### GitHub (the repository owner)
1. Merge the branch into `main`. Render deploys `main`.
2. When Render asks, install Render's GitHub app on `navyaamehta581-ship-it/Spotify-portal-solution`. Read access to that one repository is enough.

### Gemini key (optional, free)
1. In Google AI Studio, select **Get API key** and create a key in a new Google Cloud project, or in one **without billing**.
2. Don't enable billing on that project. Check the free-tier limits for `gemini-2.5-flash` that AI Studio shows for the project. If they're lower than 8 requests a minute or 200 a day, lower `PORTAL_AI_REQUESTS_PER_MINUTE` and `PORTAL_AI_DAILY_REQUEST_LIMIT` to match.
3. Keep the key out of chat, email and the repository. It goes only into Render's dashboard (step 4 below).

### Render
1. Sign in to Render, using GitHub sign-in or email. No payment method is needed for a free web service.
2. Go to **New → Blueprint**, choose the repository and branch `main`. Render reads `render.yaml`.
3. Review the resources. There should be one web service, `spotify-portal-demo`: Docker, **Free**, Frankfurt, health check `/healthz`, with **no disk**.
   - If Render shows any paid plan or a disk, stop. The Blueprint wasn't read from the updated `main`.
4. Enter the dashboard values:
   - `PORTAL_DEMO_PASSPHRASE`: your chosen passphrase.
   - `GEMINI_API_KEY`: your key.
     - If you don't have one yet and Render accepts an empty value, leave it empty. Otherwise, add the variable later under Environment.
     - **Don't enter a placeholder.** It would be tried as a real key, and every AI request would fail.
5. Apply. Render builds the image, which takes a few minutes, and deploys it. The service is healthy once `/healthz` returns 200.

### Check it
- `https://<your-service>.onrender.com/healthz` should show:
  - `"status":"ok"`, `"storage":"ok"` and `"storageMode":"ephemeral"`;
  - `"ai":"gemini:gemini-2.5-flash"`, or `not_configured` without a key;
  - `"aiRequestsPerMinute":8`.
  - `"aiCheck":"ok"`: at startup the server asks Gemini whether it accepts the key and model (a metadata request; nothing is generated). Anything else names the problem; see *AI troubleshooting* below.
- `https://<your-service>.onrender.com/` should open the welcome screen with the fictional-data and temporary-data notices. Choose **Get started**, enter the passphrase, then choose a persona.
- To check real AI: as Chris, upload the fictional sample PDF (link under the upload area). The analysis starts by itself.
  - The banner should say "produced by the AI model".
  - If it says rule-based, the banner names the reason code. For example, `MODEL_RATE_LIMITED` means the free quota is in use, and `AI_DAILY_LIMIT` means the service's own daily cap was reached.

## AI troubleshooting

If Chris's analysis says *"The AI model isn't set up correctly on this server … (MODEL_NOT_CONFIGURED: …)"*, Google refused the key or model, so the draft came from rule-based analysis. Trying again won't help until the setting is fixed. Open `/healthz` and read `checks.aiCheck`:

| `aiCheck` | Meaning | Fix |
|---|---|---|
| `ok` | Key and model accepted | — |
| `not_configured` | No `GEMINI_API_KEY` | Add the key under Render → Environment |
| `MODEL_NOT_CONFIGURED:invalid_api_key` | Google doesn't recognise the key | Copy the key again from AI Studio (**Get API key**), the whole value, with nothing else. Spaces, line breaks and surrounding quotes are removed automatically. Make sure it wasn't deleted or regenerated since. |
| `MODEL_NOT_CONFIGURED:permission_denied` | The key exists but can't use the Gemini API | Create the key in AI Studio, or enable the *Generative Language API* in the key's Google Cloud project and remove API restrictions that exclude it |
| `MODEL_NOT_CONFIGURED:model_not_found` | `GEMINI_MODEL` isn't available to this key | Use `gemini-2.5-flash` (the Blueprint's value) or another model listed in AI Studio |
| `MODEL_NOT_CONFIGURED:precondition_failed` | Google won't serve this key from here, for example the free tier isn't offered in the server's region | Check Google's list of available regions; the Blueprint runs in Frankfurt |
| `MODEL_RATE_LIMITED` / `MODEL_UNAVAILABLE:…` | Quota in use, or Google unreachable | Usually temporary |

After changing a variable, Render restarts the service, which runs the check again. On the free plan the restart also clears demo rooms.

### One Gemini model for the analysis and AiKA

The same `GEMINI_API_KEY` and `GEMINI_MODEL` power Chris's analysis and AiKA's answers, and both count against `PORTAL_AI_DAILY_REQUEST_LIMIT`. Without a key, the analysis is labelled rule-based and AiKA says it isn't connected to a model.

For local development, `PORTAL_LLM_PROVIDER=gemini` with `GEMINI_API_KEY` (and optional `GEMINI_MODEL`) uses Gemini for both in the dev server too. `AIKA_LLM_PROVIDER=gemini` uses it for AiKA only.

### Live check with the fictional sample PDF

With a real key in the environment (never on the command line), run this from `services/workflow-api`:

```
npm run verify:gemini
```

It starts the hosted server in-process and goes through the workflow with the fictional sample PDF:
1. Gemini accepts the key and model.
2. The analysis is produced by Gemini, not the rule-based fallback.
3. Chris finalizes and publishes.
4. AiKA answers a developer's question through Gemini.

It makes about 4–8 real requests and prints only codes, counts and AiKA's first sentence; the key, prompts and document text are never printed. It exits non-zero if any step fails, with the code from the table above.

## Day-to-day

| Task | How |
|---|---|
| Share | Send the URL and the passphrase. For a shared session, also send a room code (top bar → **Fictional demo** → copy), and say it lasts only while the service is awake. |
| Before presenting | Open `/healthz` a minute or two early to wake the service. |
| Deploy changes | Merge to `main`, then go to Render → service → **Manual Deploy → Deploy latest commit**. **All rooms are cleared.** |
| Reset one demo | Top bar → **Fictional demo** → **Start a new room**: an empty room, back at persona selection. Others in the old room keep their work. **Leave demo** returns to the welcome screen. |
| Reset everything | Render → service → **Manual Deploy → Restart service**, or wait for it to sleep. Free services start with empty storage. |
| Change limits or model | Render → service → **Environment**, then save. The service restarts, and rooms are cleared. |
| Rotate the passphrase | Change `PORTAL_DEMO_PASSPHRASE`. This restarts the service, so rooms are cleared too. |
| Logs | Render → service → **Logs**. |
| Stop it | Suspend or delete the service in Render. There's no disk or other resource left behind. |

## Local check of the production server (no Docker)

```sh
npm ci --prefix prototypes/v1 && npm run build --prefix prototypes/v1
NODE_ENV=production PORTAL_ALLOW_HTTP=1 PORT=10000 \
PORTAL_DEMO_PASSPHRASE='a long local passphrase' PORTAL_SESSION_SECRET="$(openssl rand -base64 32)" \
node services/workflow-api/src/production.ts      # open http://127.0.0.1:10000 (data in the OS temp dir)
npm run test:production --prefix prototypes/v1   # browser test against the production server
```

`PORTAL_ALLOW_HTTP=1` is for local HTTP only. Never set it on Render.

## What is verified and what isn't

- **Verified in this repository:**
  - The production server's tests:
    - configuration, including the free-tier defaults and `render.yaml`'s free plan without a disk or `/var/data`;
    - the gate, rooms, expiry, a lost room ending with an explanation, and rate limits;
    - AI pacing per minute and per day;
    - Gemini request handling, including free-tier `429` backoff, against a stand-in.
  - A browser test against the production server:
    - the entry flow (welcome → passphrase → persona) with the notices on each step, and the top-bar demo menu (room code, new room, leave) on desktop and phone widths;
    - a process restart keeping work;
    - a redeploy with empty storage ending the room honestly.
  - The Dockerfile's steps reproduced without Docker, from a build context filtered by `.dockerignore` (the frontend stage, `npm ci` of the runtime's one package, then a PDF upload against the server started from only the runtime files). An earlier, unfiltered reproduction missed two build failures that a real `docker build` found; both are fixed in the Dockerfile and `.dockerignore`.
- **Not verified:**
  - a real `docker build`;
  - a Render deploy, or Render's free-plan behaviour (sleep and wake time);
  - a call to the real Gemini API, since no key was available. Free-tier quotas weren't confirmed either.

  The first Render build is the first real image build.
