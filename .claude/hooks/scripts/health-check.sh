#!/bin/bash
# Health check for Langfuse Hook
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0
AUTO_FIX=${1:-""}

# Load .env file if it exists (for local testing)
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

check() { # $1=condition, $2=ok_msg, $3=error_msg, $4=fix_cmd (optional)
  if eval "$1"; then
    echo "[OK] $2"
  else
    echo "[ERROR] $3"
    if [ -n "$4" ] && [ "$AUTO_FIX" = "--fix" ]; then
      echo "  -> Auto-fixing: $4"
      (cd "$DIR" && eval "$4") && echo "  -> [FIXED]" && return 0
    fi
    ((FAIL++)) || true
  fi
}

echo "=== Langfuse Hook Health Check ==="
[ "$AUTO_FIX" = "--fix" ] && echo "(Auto-fix enabled)"
echo

check '[ -n "$LANGFUSE_PUBLIC_KEY" ]' "LANGFUSE_PUBLIC_KEY configured" "LANGFUSE_PUBLIC_KEY not set (export from .env)"
check '[ -n "$LANGFUSE_SECRET_KEY" ]' "LANGFUSE_SECRET_KEY configured" "LANGFUSE_SECRET_KEY not set (export from .env)"
check '[ -d "$DIR/node_modules/@langfuse" ]' "@langfuse packages installed" "@langfuse not installed" "npm install"
check '[ -f "$DIR/dist/langfuse-hook.js" ]' "Hook compiled" "Hook not compiled" "npm run build"

echo
[ $FAIL -eq 0 ] && echo "[SUCCESS] All checks passed" || { echo "[FAILED] $FAIL check(s) failed"; echo "Run with --fix to auto-install/build"; exit 1; }
