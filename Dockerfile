# Hosted Spotify Portal demo: one container serving the built Portal, the demo gate, the Portal session layer and the
# activation API (loopback only). Used by render.yaml (Render free plan). State is SQLite in PORTAL_DATA_DIR, a
# temporary directory inside the container: it is lost on restart, redeploy or sleep (PORTAL_STORAGE=ephemeral).

# ---- Build the Portal frontend ----
FROM node:24-bookworm-slim AS frontend
WORKDIR /app/prototypes/v1
COPY prototypes/v1/package.json prototypes/v1/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prototypes/v1/ ./
COPY contracts/ /app/contracts/
# Frontend typechecking includes tests that import backend source.
COPY services/workflow-api/src/ /app/services/workflow-api/src/
RUN npm run build

# ---- Runtime: Node 24 runs the API's TypeScript directly; one npm package (pdf.js, for PDF text) ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=10000 \
    PORTAL_STORAGE=ephemeral \
    PORTAL_DATA_DIR=/tmp/spotify-portal-demo
WORKDIR /app
COPY contracts/ contracts/
COPY services/workflow-api/package.json services/workflow-api/package-lock.json services/workflow-api/
# Production dependencies only, without install scripts or pdf.js's optional native canvas (text extraction needs neither).
RUN npm ci --prefix services/workflow-api --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
COPY services/workflow-api/src/ services/workflow-api/src/
COPY services/workflow-api/fixtures/ services/workflow-api/fixtures/
COPY prototypes/v1/server/portal-session.mjs prototypes/v1/server/portal-session.mjs
COPY --from=frontend /app/prototypes/v1/dist/ prototypes/v1/dist/
# No disk to take ownership of: run as the unprivileged `node` user from the start. /tmp is writable.
USER node
EXPOSE 10000
CMD ["node", "services/workflow-api/src/production.ts"]
