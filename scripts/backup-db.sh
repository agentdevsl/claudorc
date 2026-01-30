#!/usr/bin/env bash
# Database backup script for AgentPane SQLite database.
#
# Creates a consistent backup by issuing a WAL checkpoint before copying.
#
# Usage:
#   ./scripts/backup-db.sh                    # backs up to data/backups/
#   ./scripts/backup-db.sh /path/to/backup    # custom backup directory
#   DB_PATH=./data/agentpane.db ./scripts/backup-db.sh

set -euo pipefail

DB_PATH="${DB_PATH:-./data/agentpane.db}"
BACKUP_DIR="${1:-./data/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/agentpane_${TIMESTAMP}.db"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: Database not found at $DB_PATH"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Checkpoint WAL to ensure all data is flushed to the main database file
echo "Checkpointing WAL..."
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);"

# Copy the database file
echo "Backing up to $BACKUP_FILE..."
cp "$DB_PATH" "$BACKUP_FILE"

# Verify backup
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat --format=%s "$BACKUP_FILE" 2>/dev/null || echo "unknown")
echo "Backup complete: $BACKUP_FILE ($SIZE bytes)"

# Clean up old backups (keep last 7)
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "agentpane_*.db" -type f | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 7 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 7))
  echo "Cleaning up $REMOVE_COUNT old backup(s)..."
  find "$BACKUP_DIR" -name "agentpane_*.db" -type f | sort | head -n "$REMOVE_COUNT" | xargs rm -f
fi

echo "Done."
