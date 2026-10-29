# Hosted Spotify Portal demo: one container serving the built Portal, the demo gate, the Portal session layer and the
# activation API (loopback only). Used by render.yaml. All state lives in PORTAL_DATA_DIR (Render disk at /var/data).

# ---- Build the Portal frontend ----
FROM node:24-bookworm-slim AS frontend
WORKDIR /app/prototypes/v1
COPY prototypes/v1/package.json prototypes/v1/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prototypes/v1/ ./
COPY contracts/ /app/contracts/
RUN npm run build

# ---- Runtime: no npm packages; Node 24 runs the API's TypeScript directly ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=10000 \
    PORTAL_DATA_DIR=/var/data
WORKDIR /app
COPY contracts/ contracts/
COPY services/workflow-api/package.json services/workflow-api/package.json
COPY services/workflow-api/src/ services/workflow-api/src/
COPY services/workflow-api/fixtures/ services/workflow-api/fixtures/
COPY prototypes/v1/server/portal-session.mjs prototypes/v1/server/portal-session.mjs
COPY --from=frontend /app/prototypes/v1/dist/ prototypes/v1/dist/
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh && mkdir -p /var/data && chown node:node /var/data
EXPOSE 10000
# Starts as root only to make the mounted disk writable, then runs the server as the unprivileged `node` user.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "services/workflow-api/src/production.ts"]
