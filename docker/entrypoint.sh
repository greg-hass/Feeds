#!/bin/sh
set -e

# Fix permissions for data directory if running as root
if [ "$(id -u)" = "0" ]; then
    chown -R feeds:feeds /data 2>/dev/null || true
    # Drop to non-root user
    exec su-exec feeds:feeds "$@"
fi

# Start backend in background
cd /app/backend
node dist/index.js &

# Start nginx in foreground
exec nginx -g "daemon off;"
