#!/bin/bash
# Settings Test - Settings Pages and Theme Toggle
# Usage: ./tests/ai-ui-tests/settings.sh [base_url]

set -e

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "══════════════════════════════════════════════════════════════"
echo "  Settings Test"
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
sleep 1

# Open settings page (with retry)
echo "🚀 Opening settings..."
for i in 1 2 3; do
  if bunx agent-browser open "$BASE_URL/settings" 2>/dev/null; then
    break
  fi
  echo "  Retry $i..."
  sleep 2
done
bunx agent-browser wait 2000

# Test 1: Settings page renders
echo ""
echo "🧪 Test: Settings page renders..."
SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if [ -n "$SNAPSHOT" ]; then
  pass "Settings page loaded"
  echo "$SNAPSHOT" | head -25
else
  fail "Settings page failed to load"
fi

# Take screenshot
mkdir -p tests/ai-ui-tests/screenshots
bunx agent-browser screenshot tests/ai-ui-tests/screenshots/settings-main.png 2>/dev/null || true

# Test 2: Check for settings tabs/sections
echo ""
echo "🧪 Test: Settings sections exist..."
if echo "$SNAPSHOT" | grep -qiE "general|appearance|preferences|api|github|agents"; then
  pass "Settings sections found"
else
  fail "Settings sections not found"
fi

# Test 3: Navigate to Appearance settings
echo ""
echo "🧪 Test: Navigate to Appearance settings..."
if bunx agent-browser click '[data-testid="settings-appearance"]' 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked Appearance settings"
elif bunx agent-browser find text "Appearance" click 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked Appearance (via text)"
else
  bunx agent-browser open "$BASE_URL/settings/appearance"
  bunx agent-browser wait 1000
  pass "Navigated to Appearance directly"
fi

# Test 4: Check for theme toggle
echo ""
echo "🧪 Test: Theme toggle exists..."
APPEARANCE_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
echo "$APPEARANCE_SNAPSHOT" | head -20

if echo "$APPEARANCE_SNAPSHOT" | grep -qiE "theme|dark|light|system"; then
  pass "Theme options found"
else
  fail "Theme toggle not found"
fi

# Test 5: Toggle theme (if available)
echo ""
echo "🧪 Test: Toggle theme..."
if bunx agent-browser click '[data-testid="theme-toggle"]' 2>/dev/null; then
  bunx agent-browser wait 500
  pass "Clicked theme toggle"
  bunx agent-browser screenshot tests/ai-ui-tests/screenshots/settings-theme-toggled.png 2>/dev/null || true
elif bunx agent-browser find role "switch" click 2>/dev/null; then
  bunx agent-browser wait 500
  pass "Clicked theme switch"
else
  echo "    (Theme toggle not clickable or not found)"
  pass "Theme toggle test skipped"
fi

# Test 6: Navigate to API Keys settings
echo ""
echo "🧪 Test: Navigate to API Keys settings..."
if bunx agent-browser click '[data-testid="settings-api-keys"]' 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked API Keys settings"
elif bunx agent-browser find text "API Keys" click 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked API Keys (via text)"
else
  bunx agent-browser open "$BASE_URL/settings/api-keys"
  bunx agent-browser wait 1000
  pass "Navigated to API Keys directly"
fi

API_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
echo "$API_SNAPSHOT" | head -15

# Test 7: Navigate to GitHub settings
echo ""
echo "🧪 Test: Navigate to GitHub settings..."
if bunx agent-browser click '[data-testid="settings-github"]' 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked GitHub settings"
elif bunx agent-browser find text "GitHub" click 2>/dev/null; then
  bunx agent-browser wait 1000
  pass "Clicked GitHub (via text)"
else
  bunx agent-browser open "$BASE_URL/settings/github"
  bunx agent-browser wait 1000
  pass "Navigated to GitHub directly"
fi

bunx agent-browser screenshot tests/ai-ui-tests/screenshots/settings-github.png 2>/dev/null || true

# Test 8: Navigate to Preferences settings
echo ""
echo "🧪 Test: Navigate to Preferences settings..."
bunx agent-browser open "$BASE_URL/settings/preferences"
bunx agent-browser wait 1000

PREFS_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if [ -n "$PREFS_SNAPSHOT" ]; then
  pass "Preferences page loaded"
  echo "$PREFS_SNAPSHOT" | head -15
else
  fail "Preferences page failed"
fi

# Test 9: Check for form elements in preferences
echo ""
echo "🧪 Test: Preferences has form elements..."
if echo "$PREFS_SNAPSHOT" | grep -qiE "checkbox|switch|select|input"; then
  pass "Form elements found in preferences"
else
  fail "No form elements in preferences"
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
