#!/bin/sh
set -e

# Fix permissions for data directory if running as root
if [ "$(id -u)" = "0" ]; then
    chown -R feeds:feeds /data 2>/dev/null || true
fi

# Start backend in background
cd /app/backend
node dist/index.js &

# Start nginx in foreground
if [ "$(id -u)" = "0" ]; then
    # Drop to non-root user for nginx
    exec su-exec feeds:feeds nginx -g "daemon off;"
else
    exec nginx -g "daemon off;"
fi
