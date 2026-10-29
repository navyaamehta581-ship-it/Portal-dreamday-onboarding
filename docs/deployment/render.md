# Deploying the hosted demo on Render

One Render web service runs the whole prototype from `./Dockerfile`, as described in `render.yaml`. All data is SQLite on a 1 GB persistent disk at `/var/data`. Deploys are manual (`autoDeploy: false`).

**Status:** nothing has been deployed, and no secrets have been configured anywhere.

## What runs

```
visitor ─HTTPS─▶ Render ─▶ production server (services/workflow-api/src/production.ts)
                             ├─ /healthz          health check (Render)
                             ├─ /demo-gate        passphrase gate → demo room
                             ├─ /portal-auth, /portal-api, /operator-api → Portal session layer → activation API (loopback only)
                             └─ everything else   built Portal frontend
```

- **Demo rooms.** Passing the gate gives each visitor their own room: a separate data partition with a code like `K7M2Q-9XRTB`.
  - Anyone with the passphrase and that code can join the room, so an evaluation panel can share one.
  - Rooms end after `PORTAL_DEMO_ROOM_TTL_HOURS`, and their data is then deleted.
  - At most `PORTAL_DEMO_ROOM_LIMIT` rooms can be active at once.
  - A "Leave room" control is always visible in the bottom-left corner.
- **Sign-ins survive restarts and redeploys.** Gate and persona cookies are signed with `PORTAL_SESSION_SECRET`.
- **Limits:**
  - 10 gate attempts per IP every 15 minutes;
  - per room, 120 changes and 600 reads per minute, 15 analyses and 60 AiKA questions per day;
  - `PORTAL_AI_DAILY_REQUEST_LIMIT` model requests per UTC day across the whole service.
- **AI.** With `PORTAL_LLM_PROVIDER=gemini` and a `GEMINI_API_KEY`, Chris's analysis and AiKA use Gemini (`GEMINI_MODEL`).
  - Without a key, or when the AI limit, a provider rate limit or an outage applies, the analysis falls back to rule-based results labelled as such. Customer information is always saved.
  - AiKA says it is unavailable rather than inventing answers.
- **The public demo is fictional only.** It contains a fictional customer and labelled sample repository data. Don't enter real customer information. On Gemini's free tier, Google may use prompts to improve its products.

## Environment variables (all in `render.yaml`)

| Variable | Set by | Notes |
|---|---|---|
| `NODE_ENV`, `PORTAL_DATA_DIR`, `PORTAL_LLM_PROVIDER`, `GEMINI_MODEL`, `PORTAL_AI_DAILY_REQUEST_LIMIT`, `PORTAL_DEMO_ROOM_LIMIT`, `PORTAL_DEMO_ROOM_TTL_HOURS`, `ACTIVATION_EVIDENCE_MAX_AGE_HOURS` | `render.yaml` | Change them in Render → service → Environment, if needed |
| `PORTAL_SESSION_SECRET` | Render generates it | Keep it; changing it signs everyone out of their room |
| `PORTAL_DEMO_PASSPHRASE` | **You**, in the dashboard | At least 12 characters. Share it privately with reviewers |
| `GEMINI_API_KEY` | **You**, in the dashboard | Optional. Without it the demo runs rule-based and AiKA is unavailable |

`PORT` is set by Render, and `RENDER_GIT_COMMIT` is shown in `/healthz`.

If the passphrase or the secret is missing or too short, the server still starts: `/healthz` answers `503` and names the missing variable, and the site shows "This demo isn't configured yet". Render will therefore report the deploy as failing until they're set.

## One-time setup

### GitHub (the repository owner)
1. Merge the branch with the production server into `main`; Render deploys `main`.
2. When Render asks, install Render's GitHub app on `navyaamehta581-ship-it/Spotify-portal-solution`. Read access to that one repository is enough.

### Gemini key (optional, recommended)
1. In Google AI Studio, create an API key for a Google Cloud project.
2. For a demo shown to a client, enable billing on that project. Google's terms say paid-tier prompts aren't used to improve its products; free-tier prompts may be, and may be read by human reviewers.
3. At demo volume, cost is bounded by `PORTAL_AI_DAILY_REQUEST_LIMIT` (300 requests a day). Check current prices before enabling billing.

### Render
1. Sign in to Render and add a payment method. The Starter instance (about $7 a month) and the disk (about $0.25 per GB per month) are paid; disks aren't available on free instances.
2. Go to **New → Blueprint**, choose the repository and branch `main`. Render reads `render.yaml`.
3. Review the resources: one web service `spotify-portal-demo` (Docker, Starter, Frankfurt) and a 1 GB disk at `/var/data`.
4. Enter the dashboard values:
   - `PORTAL_DEMO_PASSPHRASE`: your chosen passphrase.
   - `GEMINI_API_KEY`: your key. If you don't have one yet and Render accepts an empty value, leave it empty; otherwise add the variable later under Environment. **Don't enter a placeholder**: it would be tried as a real key and every AI request would fail.
5. Apply. Render builds the image (a few minutes) and deploys. The service is healthy once `/healthz` returns 200.

### Check it
- `https://<your-service>.onrender.com/healthz` should show:
  - `"status":"ok"` and `"storage":"ok"`;
  - `"ai":"gemini:gemini-2.5-flash"`, or `not_configured` without a key.
- `https://<your-service>.onrender.com/` should open the gate. Enter the passphrase, then choose **Get started** and a persona.
- To check real AI: as Chris, add information and select **Analyze customer**. The banner should say "produced by the AI model". If it says rule-based, the banner names the reason code.

## Day-to-day

| Task | How |
|---|---|
| Share | Send the URL and the passphrase. For a shared session, also send a room code (bottom-left bar). |
| Deploy changes | Merge to `main`, then Render → service → **Manual Deploy → Deploy latest commit**. Rooms and data stay on the disk. |
| Reset one demo | Visitors select **Leave room** and enter again for a fresh room. Old rooms are deleted after their lifetime. |
| Reset everything | Render → service → **Shell**: `rm /var/data/activation.sqlite /var/data/goals.sqlite`, then **Restart**. This deletes all rooms. |
| Change limits or model | Render → service → **Environment**, then save. The service restarts. |
| Rotate the passphrase | Change `PORTAL_DEMO_PASSPHRASE`. Existing rooms keep working; new visitors need the new passphrase. |
| Logs | Render → service → **Logs**. One JSON line per request or event, with codes only; no passphrase, key, room code or customer text. |
| Pause costs | Suspend the service in Render. The disk, and its billing, remains until the service is deleted. |

## Local check of the production server (no Docker)

```sh
npm ci --prefix prototypes/v1 && npm run build --prefix prototypes/v1
NODE_ENV=production PORTAL_ALLOW_HTTP=1 PORT=10000 PORTAL_DATA_DIR=/tmp/portal-data \
PORTAL_DEMO_PASSPHRASE='a long local passphrase' PORTAL_SESSION_SECRET="$(openssl rand -base64 32)" \
node services/workflow-api/src/production.ts      # open http://127.0.0.1:10000
npm run test:production --prefix prototypes/v1   # browser test against the production server
```

`PORTAL_ALLOW_HTTP=1` is for local http only. Never set it on Render.

## What is verified and what isn't

- **Verified in this repository:** the production server's tests (configuration, gate, rooms, persistence across restarts, expiry, rate limits, Gemini request handling against a stand-in, `render.yaml` consistency). Also a browser test against the production server, and the Dockerfile's steps reproduced without Docker: the frontend build stage, then the server started from only the files the runtime stage copies.
- **Not verified:**
  - a real `docker build`, including the `setpriv` privilege drop in the official Node image;
  - a Render deploy;
  - a call to the real Gemini API, since no key was available.
  
  The first Render build is the first real image build.
