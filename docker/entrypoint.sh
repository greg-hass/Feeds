#!/bin/sh
set -e

echo "Starting Feeds..."

# Ensure data directory exists
mkdir -p /data /data/backups

# Daily backup of database (keep last 7)
if [ -f "/data/feeds.db" ]; then
    BACKUP_FILE="/data/backups/feeds-$(date +%Y%m%d).db"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Creating daily backup..."
        cp /data/feeds.db "$BACKUP_FILE"
        # Keep only last 7 backups
        ls -t /data/backups/feeds-*.db 2>/dev/null | tail -n +8 | xargs -r rm
    fi
fi

# Start nginx in background
echo "Starting nginx..."
nginx

# Start backend
echo "Starting backend..."
cd /app/backend
exec node dist/index.js
