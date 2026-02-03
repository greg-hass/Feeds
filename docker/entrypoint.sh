#!/bin/sh
set -e

echo "Starting Feeds..."

# Ensure data directory exists
mkdir -p /data

# Start nginx in background
echo "Starting nginx..."
nginx

# Start backend
echo "Starting backend..."
cd /app/backend
exec node dist/index.js