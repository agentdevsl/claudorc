#!/bin/bash
# Smoke Test - Basic UI Verification
# Usage: ./tests/ai-ui-tests/smoke.sh [base_url]

set -e

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "══════════════════════════════════════════════════════════════"
echo "  Smoke Test - Basic UI Verification"
echo "  Base URL: $BASE_URL"
echo "══════════════════════════════════════════════════════════════"
echo ""

pass() {
  echo "✅ PASS: $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "❌ FAIL: $1"
  FAILED=$((FAILED + 1))
}

# Test 1: Open homepage
echo "🧪 Test: Open homepage..."
if bunx agent-browser open "$BASE_URL" 2>/dev/null; then
  pass "Homepage loaded"
else
  fail "Homepage failed to load"
  exit 1
fi

# Wait for app to fully render
bunx agent-browser wait 3000

# Test 2: Get page title
echo "🧪 Test: Check page title..."
TITLE=$(bunx agent-browser get title 2>/dev/null || echo "")
if [ -n "$TITLE" ]; then
  pass "Page title exists: $TITLE"
else
  fail "No page title found"
fi

# Test 3: Get interactive elements snapshot
echo "🧪 Test: Get interactive elements..."
SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if [ -n "$SNAPSHOT" ] && ! echo "$SNAPSHOT" | grep -q "no interactive elements"; then
  pass "Interactive elements found"
  echo "    Elements:"
  echo "$SNAPSHOT" | head -15
else
  fail "No interactive elements found"
fi

# Test 4: Check for navigation links
echo "🧪 Test: Check for navigation links..."
if echo "$SNAPSHOT" | grep -qi "projects\|settings\|agents"; then
  pass "Navigation links present"
else
  fail "Navigation links not found"
fi

# Test 5: Check URL
echo "🧪 Test: Check current URL..."
URL=$(bunx agent-browser get url 2>/dev/null || echo "")
if echo "$URL" | grep -q "localhost:3000"; then
  pass "URL is correct: $URL"
else
  fail "URL mismatch: $URL"
fi

# Test 6: Take screenshot
echo "🧪 Test: Take screenshot..."
mkdir -p tests/ai-ui-tests/screenshots
if bunx agent-browser screenshot tests/ai-ui-tests/screenshots/smoke-homepage.png 2>/dev/null; then
  pass "Screenshot saved"
else
  fail "Screenshot failed"
fi

# Close browser
bunx agent-browser close 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Results: $PASSED passed, $FAILED failed"
echo "══════════════════════════════════════════════════════════════"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
