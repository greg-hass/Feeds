#!/bin/sh
set -e

echo "Starting Feeds..."

# Fix permissions for data directory (Docker volumes mount with root ownership by default)
if [ -d "/data" ]; then
    chown -R feeds:feeds /data 2>/dev/null || true
fi

# Ensure data directory exists with correct permissions
mkdir -p /data /data/backups
chown -R feeds:feeds /data /data/backups 2>/dev/null || true

# Daily backup of database (keep last 7) - non-fatal if permissions fail
if [ -f "/data/feeds.db" ]; then
    BACKUP_FILE="/data/backups/feeds-$(date +%Y%m%d).db"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Creating daily backup..."
        if cp /data/feeds.db "$BACKUP_FILE" 2>/dev/null; then
            # Keep only last 7 backups
            ls -t /data/backups/feeds-*.db 2>/dev/null | tail -n +8 | xargs -r rm 2>/dev/null || true
        else
            echo "Warning: Could not create backup (permission denied). Continuing anyway..."
        fi
    fi
fi

# Start nginx in background
echo "Starting nginx..."
nginx

# Start backend
echo "Starting backend..."
cd /app/backend
exec node dist/index.js