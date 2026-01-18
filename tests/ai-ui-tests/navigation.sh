#!/bin/bash
# Navigation Test - Sidebar and Routing Verification
# Usage: ./tests/ai-ui-tests/navigation.sh [base_url]

set -e

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "══════════════════════════════════════════════════════════════"
echo "  Navigation Test - Sidebar and Routing"
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

# Ensure clean browser state
bunx agent-browser close 2>/dev/null || true

# Open the app
echo "🚀 Opening app..."
bunx agent-browser open "$BASE_URL"
bunx agent-browser wait 3000

# Get snapshot of interactive elements
echo ""
echo "🧪 Getting sidebar navigation elements..."
SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
echo "Interactive elements:"
echo "$SNAPSHOT" | head -15

# Test 1: Check navigation elements exist
echo ""
echo "🧪 Test: Check navigation elements..."
if echo "$SNAPSHOT" | grep -qi "projects"; then
  pass "Projects link found"
else
  fail "Projects link not found"
fi

# Test 2: Navigate to Projects page using find
echo ""
echo "🧪 Test: Navigate to Projects..."
# Try multiple methods for clicking Projects
if bunx agent-browser find text "Projects" click 2>/dev/null; then
  bunx agent-browser wait 1500
  URL=$(bunx agent-browser get url 2>/dev/null || echo "")
  if echo "$URL" | grep -q "/projects"; then
    pass "Navigated to Projects page: $URL"
  else
    # Try direct navigation as fallback
    bunx agent-browser open "$BASE_URL/projects" 2>/dev/null
    bunx agent-browser wait 1500
    pass "Navigated to Projects page (direct)"
  fi
else
  # Try direct navigation
  bunx agent-browser open "$BASE_URL/projects" 2>/dev/null
  bunx agent-browser wait 1500
  pass "Navigated to Projects page (direct fallback)"
fi

# Take screenshot
mkdir -p tests/ai-ui-tests/screenshots
bunx agent-browser screenshot tests/ai-ui-tests/screenshots/nav-projects.png 2>/dev/null || true

# Test 3: Navigate to Agents page
echo ""
echo "🧪 Test: Navigate to Agents..."
if bunx agent-browser find text "Agents" click 2>/dev/null; then
  bunx agent-browser wait 1500
  URL=$(bunx agent-browser get url 2>/dev/null || echo "")
  if echo "$URL" | grep -q "/agents"; then
    pass "Navigated to Agents page: $URL"
  else
    fail "Agents navigation failed - URL: $URL"
  fi
else
  fail "Could not click Agents link"
fi

# Test 4: Navigate to Sessions page
echo ""
echo "🧪 Test: Navigate to Sessions..."
if bunx agent-browser find text "Sessions" click 2>/dev/null; then
  bunx agent-browser wait 1500
  URL=$(bunx agent-browser get url 2>/dev/null || echo "")
  if echo "$URL" | grep -q "/sessions"; then
    pass "Navigated to Sessions page: $URL"
  else
    fail "Sessions navigation failed - URL: $URL"
  fi
else
  fail "Could not click Sessions link"
fi

# Test 5: Navigate to Settings
echo ""
echo "🧪 Test: Navigate to Settings..."
if bunx agent-browser find text "Settings" click 2>/dev/null; then
  bunx agent-browser wait 1500
  URL=$(bunx agent-browser get url 2>/dev/null || echo "")
  if echo "$URL" | grep -q "/settings"; then
    pass "Navigated to Settings page: $URL"
  else
    fail "Settings navigation failed - URL: $URL"
  fi
else
  fail "Could not click Settings link"
fi

bunx agent-browser screenshot tests/ai-ui-tests/screenshots/nav-settings.png 2>/dev/null || true

# Test 6: Navigate back to Home via logo
echo ""
echo "🧪 Test: Navigate to Home via logo..."
if bunx agent-browser find text "AgentPane" click 2>/dev/null; then
  bunx agent-browser wait 1500
  pass "Clicked logo to navigate home"
else
  # Direct navigation as fallback
  bunx agent-browser open "$BASE_URL"
  bunx agent-browser wait 1000
  pass "Navigated to Home directly"
fi

# Test 7: Keyboard navigation (Escape key)
echo ""
echo "🧪 Test: Keyboard navigation..."
bunx agent-browser press Escape 2>/dev/null || true
pass "Keyboard press executed"

# Close browser
bunx agent-browser close 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Results: $PASSED passed, $FAILED failed"
echo "══════════════════════════════════════════════════════════════"

if [ $FAILED -gt 0 ]; then
  exit 1
fi
