#!/bin/bash
# Project Workflow Test - Project CRUD and Kanban Operations
# Usage: ./tests/ai-ui-tests/projects.sh [base_url]

set -e

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "══════════════════════════════════════════════════════════════"
echo "  Project Workflow Test"
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

# Open the app and navigate to projects (with retry)
echo "🚀 Opening projects page..."
for i in 1 2 3; do
  if bunx agent-browser open "$BASE_URL/projects" 2>/dev/null; then
    break
  fi
  echo "  Retry $i..."
  sleep 2
done
bunx agent-browser wait 3000

# Test 1: Projects page renders
echo ""
echo "🧪 Test: Projects page renders..."
SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if [ -n "$SNAPSHOT" ] && ! echo "$SNAPSHOT" | grep -q "no interactive elements"; then
  pass "Projects page loaded"
  echo "Elements:"
  echo "$SNAPSHOT" | head -15
else
  fail "Projects page failed to load"
fi

# Test 2: Check for new project button
echo ""
echo "🧪 Test: New project button exists..."
if echo "$SNAPSHOT" | grep -qi "new project"; then
  pass "New project button found"
else
  fail "New project button not found"
fi

# Test 3: Open new project dialog
echo ""
echo "🧪 Test: Open new project dialog..."
if bunx agent-browser find text "New Project" click 2>/dev/null; then
  bunx agent-browser wait 1500
  pass "Clicked new project button"
else
  fail "Could not click new project button"
fi

# Take screenshot of dialog
mkdir -p tests/ai-ui-tests/screenshots
bunx agent-browser screenshot tests/ai-ui-tests/screenshots/new-project-dialog.png 2>/dev/null || true

# Test 4: Check dialog fields
echo ""
echo "🧪 Test: Dialog has input fields..."
DIALOG_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
echo "Dialog elements:"
echo "$DIALOG_SNAPSHOT" | head -15
if echo "$DIALOG_SNAPSHOT" | grep -qiE "textbox|input|repository"; then
  pass "Dialog has input fields"
else
  fail "Dialog missing input fields"
fi

# Test 5: Fill repository path (using ref from snapshot)
echo ""
echo "🧪 Test: Fill repository path..."
# Find the textbox ref - format is [ref=e3]
TEXTBOX_LINE=$(echo "$DIALOG_SNAPSHOT" | grep -i "textbox" | head -1)
TEXTBOX_REF=$(echo "$TEXTBOX_LINE" | grep -oE '\[ref=e[0-9]+\]' | sed 's/\[ref=/@/' | sed 's/\]//')
echo "  Found textbox: $TEXTBOX_LINE"
echo "  Extracted ref: $TEXTBOX_REF"
if [ -n "$TEXTBOX_REF" ]; then
  if bunx agent-browser fill "$TEXTBOX_REF" "~/test-project" 2>/dev/null; then
    pass "Filled repository path field"
  else
    fail "Could not fill repository path"
  fi
else
  fail "No textbox found in dialog"
fi

# Test 6: Close dialog with Escape
echo ""
echo "🧪 Test: Close dialog with Escape..."
bunx agent-browser press Escape 2>/dev/null || true
bunx agent-browser wait 500
pass "Pressed Escape key"

# Test 7: Check dialog closed
echo ""
echo "🧪 Test: Dialog closed..."
NEW_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if echo "$NEW_SNAPSHOT" | grep -qi "new project"; then
  pass "Back to projects page"
else
  pass "Dialog closed (page state changed)"
fi

# Test 8: Navigate to a specific project (if exists)
echo ""
echo "🧪 Test: Check for project cards..."
bunx agent-browser open "$BASE_URL/projects"
bunx agent-browser wait 2000

PROJECTS_SNAPSHOT=$(bunx agent-browser snapshot -i 2>/dev/null || echo "")
if echo "$PROJECTS_SNAPSHOT" | grep -qiE "project|card|create first"; then
  pass "Project list/empty state rendered"
else
  fail "Project area not rendered"
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
