#!/bin/sh
set -e

# Fix permissions for non-root user
chown -R feeds:feeds /app /data

# Start nginx as root so it can bind to port 80, then daemonize.
nginx

# Start backend as feeds user
su-exec feeds node /app/backend/dist/index.js
