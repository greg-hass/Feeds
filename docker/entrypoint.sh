#!/bin/sh
set -e

# Fix permissions for the writable data volume only.
# /app is already owned correctly at build time, and chowning it on every boot
# adds a lot of unnecessary startup time.
chown -R feeds:feeds /data

# Start nginx as root so it can bind to port 80, then daemonize.
nginx

# Start backend as feeds user
su-exec feeds node /app/backend/dist/index.js
