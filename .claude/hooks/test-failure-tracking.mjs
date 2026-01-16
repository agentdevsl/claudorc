#!/usr/bin/env node
/**
 * E2E Test Script for Langfuse Failure Tracking
 *
 * Simulates tool events and verifies scores are recorded correctly.
 *
 * Usage:
 *   node test-failure-tracking.mjs
 *
 * Prerequisites:
 *   - LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY set
 *   - Hook built: npm run build
 */

import { spawn } from "node:child_process";
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
config({ path: join(__dirname, ".env") });

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const host = process.env.LANGFUSE_HOST || "https://us.cloud.langfuse.com";

if (!publicKey || !secretKey) {
  console.error("ERROR: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY required");
  process.exit(1);
}

const auth = Buffer.from(publicKey + ":" + secretKey).toString("base64");
const hostUrl = new URL(host);

// Generate unique session ID for this test
const testSessionId = `e2e-test-${Date.now().toString(16)}`;
const testToolIds = {
  read: `read-${Date.now().toString(16)}`,
  bash: `bash-${Date.now().toString(16)}`,
  edit: `edit-${Date.now().toString(16)}`,
  write: `write-${Date.now().toString(16)}`,
};

console.log("=== Langfuse Failure Tracking E2E Test ===\n");
console.log("Session ID:", testSessionId);
console.log("Host:", host);
console.log("");

/**
 * Send an event to the hook via stdin
 */
function sendEvent(event) {
  return new Promise((resolve, reject) => {
    const hookPath = join(__dirname, "dist", "langfuse-hook.js");
    const proc = spawn("node", [hookPath], {
      cwd: __dirname,
      env: { ...process.env, LANGFUSE_HOOK_ENABLED: "true" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.log("  Hook stderr:", stderr.substring(0, 200));
      }
      resolve({ code, stdout, stderr });
    });

    proc.on("error", reject);

    proc.stdin.write(JSON.stringify(event) + "\n");
    proc.stdin.end();
  });
}

/**
 * Fetch scores for a trace from Langfuse API
 */
function fetchScores(traceId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostUrl.hostname,
      path: `/api/public/scores?traceId=${traceId}&limit=100`,
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body).data || []);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Fetch traces for a session
 */
function fetchTraces(sessionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostUrl.hostname,
      path: `/api/public/traces?sessionId=${encodeURIComponent(sessionId)}&limit=5`,
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body).data || []);
        } catch {
          resolve([]);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function runTest() {
  const baseEvent = {
    session_id: testSessionId,
    cwd: __dirname,
    permission_mode: "default",
  };

  console.log("1. Sending tool events...\n");

  // Tool 1: Read (success)
  console.log("  [1/4] Read - success");
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PreToolUse",
    tool_name: "Read",
    tool_use_id: testToolIds.read,
    tool_input: { file_path: "/test/file.txt" },
  });
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PostToolUse",
    tool_name: "Read",
    tool_use_id: testToolIds.read,
    tool_response: { content: "file content" },
  });

  // Tool 2: Bash (failure - exit code)
  console.log("  [2/4] Bash - failure (exit_code)");
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_use_id: testToolIds.bash,
    tool_input: { command: "false" },
  });
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PostToolUse",
    tool_name: "Bash",
    tool_use_id: testToolIds.bash,
    tool_response: { exit_code: 1, stderr: "command failed" },
  });

  // Tool 3: Edit (failure - error, cascade)
  console.log("  [3/4] Edit - failure (error, cascade)");
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PreToolUse",
    tool_name: "Edit",
    tool_use_id: testToolIds.edit,
    tool_input: { file_path: "/missing/file.txt" },
  });
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    tool_use_id: testToolIds.edit,
    tool_response: { error: "file not found" },
  });

  // Tool 4: Write (success)
  console.log("  [4/4] Write - success");
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_use_id: testToolIds.write,
    tool_input: { file_path: "/test/output.txt" },
  });
  await sendEvent({
    ...baseEvent,
    hook_event_name: "PostToolUse",
    tool_name: "Write",
    tool_use_id: testToolIds.write,
    tool_response: { success: true },
  });

  // Send Stop event for session scores
  console.log("  [Stop] Session end");
  await sendEvent({
    ...baseEvent,
    hook_event_name: "Stop",
  });

  console.log("\n2. Waiting for Langfuse to process (5s)...\n");
  await new Promise((r) => setTimeout(r, 5000));

  console.log("3. Fetching traces and scores...\n");

  const traces = await fetchTraces(testSessionId);
  if (traces.length === 0) {
    console.log("  ERROR: No traces found for session");
    console.log("  This may indicate the hook is not running or not enabled.");
    process.exit(1);
  }

  console.log(`  Found ${traces.length} trace(s)`);

  let allScores = [];
  for (const trace of traces) {
    const scores = await fetchScores(trace.id);
    console.log(`  Trace ${trace.id.substring(0, 16)}: ${scores.length} scores`);
    allScores = allScores.concat(scores);
  }

  console.log("\n4. Validating scores...\n");

  // Group scores by name
  const byName = {};
  allScores.forEach((s) => {
    if (!byName[s.name]) byName[s.name] = [];
    byName[s.name].push(s);
  });

  const results = {
    passed: 0,
    failed: 0,
    checks: [],
  };

  function check(name, condition, expected, actual) {
    const passed = condition;
    results.checks.push({ name, passed, expected, actual });
    if (passed) {
      results.passed++;
      console.log(`  ✅ ${name}`);
    } else {
      results.failed++;
      console.log(`  ❌ ${name}`);
      console.log(`     Expected: ${expected}`);
      console.log(`     Actual: ${actual}`);
    }
  }

  // Check tool_success scores
  const successScores = byName["tool_success"] || [];
  const failures = successScores.filter((s) => s.value === 0 || s.value === false);
  const successes = successScores.filter((s) => s.value === 1 || s.value === true);

  check(
    "tool_success scores recorded",
    successScores.length >= 4,
    "at least 4",
    successScores.length
  );
  check(
    "2 failures recorded",
    failures.length >= 2,
    "at least 2",
    failures.length
  );
  check(
    "2 successes recorded",
    successes.length >= 2,
    "at least 2",
    successes.length
  );

  // Check failure_category scores
  const categoryScores = byName["failure_category"] || [];
  const exitCodeCategory = categoryScores.filter((s) => s.stringValue === "exit_code");
  const errorCategory = categoryScores.filter((s) => s.stringValue === "error");

  check(
    "failure_category scores recorded",
    categoryScores.length >= 2,
    "at least 2",
    categoryScores.length
  );
  check(
    "exit_code category present",
    exitCodeCategory.length >= 1,
    "at least 1",
    exitCodeCategory.length
  );
  check(
    "error category present",
    errorCategory.length >= 1,
    "at least 1",
    errorCategory.length
  );

  // Check error_severity scores
  const severityScores = byName["error_severity"] || [];
  const highSeverity = severityScores.filter((s) => s.value >= 0.7);

  check(
    "error_severity scores recorded",
    severityScores.length >= 2,
    "at least 2",
    severityScores.length
  );
  check(
    "high severity (>=0.7) present",
    highSeverity.length >= 1,
    "at least 1",
    highSeverity.length
  );

  // Check cascade failure
  const cascadeScores = byName["is_cascade_failure"] || [];
  const cascadeTrue = cascadeScores.filter((s) => s.value === 1 || s.value === true);

  check(
    "is_cascade_failure scores recorded",
    cascadeScores.length >= 1,
    "at least 1",
    cascadeScores.length
  );
  check(
    "cascade=true for Edit after Bash failure",
    cascadeTrue.length >= 1,
    "at least 1",
    cascadeTrue.length
  );

  // Summary
  console.log("\n=== Test Summary ===\n");
  console.log(`Passed: ${results.passed}/${results.passed + results.failed}`);
  console.log(`Failed: ${results.failed}/${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log("\nFailed checks:");
    results.checks
      .filter((c) => !c.passed)
      .forEach((c) => console.log(`  - ${c.name}`));
    process.exit(1);
  }

  console.log("\n✅ All checks passed!\n");
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
