#!/bin/sh
# Render mounts the persistent disk at PORTAL_DATA_DIR owned by root. Hand it to the unprivileged `node` user, then
# run the server as that user. (If the container already runs as non-root, start directly.)
set -eu
DATA="${PORTAL_DATA_DIR:-/var/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  chown -R node:node "$DATA"
  chmod 0700 "$DATA"
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups "$@"
  fi
  echo '{"level":"warn","event":"running_as_root","reason":"setpriv not available"}'
fi
exec "$@"
