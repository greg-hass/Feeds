#!/bin/sh
set -e

echo "Starting Feeds..."

# Fix permissions for data directory (Docker volumes mount with root ownership by default)
if [ -d "/data" ]; then
    chown -R feeds:feeds /data 2>/dev/null || true
fi

# Ensure data directory exists with correct permissions
mkdir -p /data /data/backups
chown -R feeds:feeds /data /data/backups

# Daily backup of database (keep last 7)
if [ -f "/data/feeds.db" ]; then
    BACKUP_FILE="/data/backups/feeds-$(date +%Y%m%d).db"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Creating daily backup..."
        # Run backup as feeds user to ensure ownership matches
        su -s /bin/sh feeds -c "cp /data/feeds.db '$BACKUP_FILE'"
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