#!/bin/sh
set -e

# Fix permissions for non-root user
chown -R feeds:feeds /app /data

# Start nginx in background
su-exec feeds nginx

# Start backend as feeds user
su-exec feeds node /app/backend/dist/index.js
