#!/bin/bash
# Entrypoint script for agent-sandbox container
# Fixes workspace permissions for bind-mounted volumes

set -e

# Fix workspace permissions if they're not writable by current user
if [ -d /workspace ] && [ ! -w /workspace ]; then
    # Try to fix permissions (will only work if running as root or with sudo)
    sudo chown -R node:node /workspace 2>/dev/null || \
    chown -R node:node /workspace 2>/dev/null || \
    echo "[entrypoint] Warning: Could not fix /workspace permissions" >&2
fi

# Ensure .claude directories exist for SDK (plans, credentials, etc.)
mkdir -p /home/node/.claude/plans 2>/dev/null || true

# Execute the command
exec "$@"
