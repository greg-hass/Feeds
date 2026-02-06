#!/bin/sh
set -e

echo "Starting Feeds..."

# Fix permissions for data directory (entrypoint runs as root)
mkdir -p /data
chown -R feeds:feeds /data

# Start nginx in background (as feeds user)
echo "Starting nginx..."
su-exec feeds nginx

# Start backend (as feeds user)
echo "Starting backend..."
cd /app/backend
exec su-exec feeds node dist/index.js