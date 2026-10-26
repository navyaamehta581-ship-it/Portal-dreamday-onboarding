# Private Codespaces preview

The localhost-only conversation backend rejected the private Codespaces frontend's Origin header. The Vite development proxy now maps the exact HTTPS origin derived from `CODESPACE_NAME` on port 5173 at `app.github.dev` to the existing localhost UI origin. Its upstream Host is the loopback backend address.

Other origins are forwarded unchanged and continue to be rejected by the backend. With no valid Codespace name, no origin translation is configured. Backend code, contracts, API payloads, CORS and loopback binding are unchanged. This is development routing, not production authentication. Keep forwarded ports **Private**; no public exposure is configured here.

The proxy applies to the existing diagnosis and conversation routes. Restart Vite after pulling the change so it reads the Codespace environment. Use the normal `npm run dev` and `npm run start:inspector` commands from `prototypes/v1` in separate terminals.

Validation on Node 24.22.1: 57 frontend tests passed, including a real HTTP Vite proxy test exercising the Codespace origin, localhost origin, and four rejected origins; production build and all 3 conversation API tests passed; whitespace check passed. Source tree is identical to the merged PR #7 snapshot apart from these proxy files and this note. Browser acceptance in Codespaces still needs to be repeated; browser control was unavailable during this follow-up.
