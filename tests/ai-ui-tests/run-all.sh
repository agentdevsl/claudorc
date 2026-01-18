#!/bin/bash
# AI UI Test Runner - Runs all agent-browser tests
# Usage: ./tests/ai-ui-tests/run-all.sh [base_url] [--headed]

set -e

BASE_URL="${1:-http://localhost:3000}"
HEADED=""

# Parse args
for arg in "$@"; do
  case $arg in
    --headed)
      HEADED="--headed"
      ;;
    http*)
      BASE_URL="$arg"
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_TESTS=""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           AI UI Test Runner (agent-browser)                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Base URL: $BASE_URL"
echo "Headed:   ${HEADED:-headless}"
echo ""

# Check if server is running
echo "🔍 Checking server availability..."
if ! curl -s --max-time 5 "$BASE_URL" > /dev/null 2>&1; then
  echo "❌ Server not responding at $BASE_URL"
  echo ""
  echo "Start the server first:"
  echo "  bun run dev"
  echo ""
  exit 1
fi
echo "✅ Server is running"
echo ""

# Create screenshots directory
mkdir -p "$SCRIPT_DIR/screenshots"

run_test() {
  local name="$1"
  local script="$2"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧪 Running: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if bash "$script" "$BASE_URL"; then
    echo ""
    echo "✅ $name: PASSED"
    TOTAL_PASSED=$((TOTAL_PASSED + 1))
  else
    echo ""
    echo "❌ $name: FAILED"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
    FAILED_TESTS="$FAILED_TESTS\n  - $name"
  fi
}

# Run all tests
run_test "Smoke Test" "$SCRIPT_DIR/smoke.sh"
run_test "Navigation Test" "$SCRIPT_DIR/navigation.sh"
run_test "Projects Test" "$SCRIPT_DIR/projects.sh"
run_test "Settings Test" "$SCRIPT_DIR/settings.sh"

# Summary
echo ""
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        TEST SUMMARY                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total Passed: $TOTAL_PASSED"
echo "  Total Failed: $TOTAL_FAILED"

if [ $TOTAL_FAILED -gt 0 ]; then
  echo ""
  echo "  Failed Tests:$FAILED_TESTS"
  echo ""
  exit 1
else
  echo ""
  echo "  🎉 All tests passed!"
  echo ""
fi

# List screenshots
echo "📸 Screenshots saved to:"
ls -la "$SCRIPT_DIR/screenshots/" 2>/dev/null || echo "  (none)"
echo ""
