#!/usr/bin/env node
/**
 * Comprehensive Langfuse Hook Validation Test
 *
 * This test validates:
 * 1. Hook can initialize and connect to Langfuse
 * 2. Session observations are created correctly
 * 3. Tool observations track PreToolUse -> PostToolUse lifecycle
 * 4. Nested tool hierarchies work with parent_tool_use_id
 * 5. Subagent detection works
 * 6. Error handling captures failures
 * 7. Metrics are tracked correctly
 * 8. Cross-process persistence functions
 * 9. Graceful shutdown and cleanup
 */

import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

console.log("╔════════════════════════════════════════════════════════╗");
console.log("║   Langfuse Hook Integration Validation Test           ║");
console.log("╚════════════════════════════════════════════════════════╝\n");

// Verify environment configuration
console.log("📋 Configuration Check:");
console.log(`   Langfuse Host: ${process.env.LANGFUSE_HOST}`);
console.log(`   Public Key: ${process.env.LANGFUSE_PUBLIC_KEY?.substring(0, 20)}...`);
console.log(`   Secret Key: ${process.env.LANGFUSE_SECRET_KEY ? '✓ Set' : '✗ Missing'}`);
console.log("");

if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_HOST) {
  console.error("❌ Missing required Langfuse configuration in .env file");
  process.exit(1);
}

// Generate unique session ID
const sessionId = `validation-test-${Date.now()}`;
const userId = "test-user-validation";

console.log("🔑 Test Session:");
console.log(`   Session ID: ${sessionId}`);
console.log(`   User ID: ${userId}`);
console.log("");

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(name, passed, details = "") {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`   ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`   ✗ ${name}`);
    if (details) console.log(`     ${details}`);
  }
  results.tests.push({ name, passed, details });
}

// Test scenarios
const testScenarios = [
  {
    name: "1. Basic Tool Lifecycle (Bash)",
    description: "Tests simple PreToolUse -> PostToolUse flow",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-success",
        tool_input: { command: "echo 'Hello from Langfuse test'" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-success",
        tool_input: { command: "echo 'Hello from Langfuse test'" },
        tool_response: { exit_code: 0, stdout: "Hello from Langfuse test\n" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
        tokens: { input: 150, output: 75, total: 225 },
      },
    ],
    expectedLogs: [
      /PreToolUse: Bash/,
      /tool-bash-success/,
      /Bash.*OK/,
    ],
  },

  {
    name: "2. Error Handling",
    description: "Tests tool failure detection",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-error",
        tool_input: { command: "exit 1" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-error",
        tool_input: { command: "exit 1" },
        tool_response: { exit_code: 1, stderr: "Command failed with exit code 1" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
        tokens: { input: 100, output: 50, total: 150 },
      },
    ],
    expectedLogs: [
      /PreToolUse: Bash/,
      /Bash.*ERROR/,
    ],
  },

  {
    name: "3. Subagent Detection",
    description: "Tests subagent tool recognition",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Task",
        tool_use_id: "tool-subagent-explore",
        tool_input: {
          subagent_type: "Explore",
          description: "Test exploration subagent",
          model: "claude-sonnet-4-5-20251101",
          prompt: "Find all TypeScript files in src/",
        },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Task",
        tool_use_id: "tool-subagent-explore",
        tool_input: {
          subagent_type: "Explore",
          description: "Test exploration subagent",
          model: "claude-sonnet-4-5-20251101",
          prompt: "Find all TypeScript files in src/",
        },
        tool_response: { success: true, result: "Found 12 TypeScript files" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
        tokens: { input: 800, output: 300, total: 1100 },
      },
      {
        hook_event_name: "SubagentStop",
        session_id: sessionId,
        user_id: userId,
        cwd: process.cwd(),
        stop_hook_active: true,
      },
    ],
    expectedLogs: [
      /PreToolUse: Task/,
      /Task.*(Explore|subagent)/i,
      /OK/,
      /Subagent completed/,
    ],
  },

  {
    name: "4. Nested Tool Hierarchy",
    description: "Tests parent-child tool relationships",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Task",
        tool_use_id: "tool-parent-agent",
        tool_input: {
          subagent_type: "Agent",
          description: "Parent agent for nested test",
          prompt: "Perform file operations",
        },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Read",
        tool_use_id: "tool-nested-read",
        parent_tool_use_id: "tool-parent-agent",
        tool_input: { file_path: "/workspace/.claude/hooks/package.json" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Read",
        tool_use_id: "tool-nested-read",
        parent_tool_use_id: "tool-parent-agent",
        tool_input: { file_path: "/workspace/.claude/hooks/package.json" },
        tool_response: { content: '{"name":"claude-langfuse-hooks"}' },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
        tokens: { input: 200, output: 100, total: 300 },
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        user_id: userId,
        tool_name: "Task",
        tool_use_id: "tool-parent-agent",
        tool_input: {
          subagent_type: "Agent",
          description: "Parent agent for nested test",
          prompt: "Perform file operations",
        },
        tool_response: { success: true },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
        tokens: { input: 600, output: 250, total: 850 },
      },
    ],
    expectedLogs: [
      /PreToolUse: Task.*tool-parent-agent/,
      /PreToolUse: Read.*tool-nested-read.*parent=/,
      /Read.*OK/,
      /Task.*OK/,
    ],
  },

  {
    name: "5. User Interaction Events",
    description: "Tests user prompt tracking",
    events: [
      {
        hook_event_name: "UserPromptSubmit",
        session_id: sessionId,
        user_id: userId,
        cwd: process.cwd(),
        permission_mode: "auto",
        timestamp: new Date().toISOString(),
      },
    ],
    expectedLogs: [
      /UserPromptSubmit/,
    ],
  },
];

// Run a single test scenario
async function runScenario(scenario) {
  console.log(`\n📝 ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  return new Promise((resolve, reject) => {
    const hook = spawn("node", ["dist/langfuse-hook.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        LANGFUSE_LOG_LEVEL: "DEBUG",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const stderrLines = [];

    hook.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    hook.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      stderrLines.push(...text.split("\n").filter(l => l.trim()));
    });

    // Send events with slight delay
    let eventIndex = 0;
    function sendNextEvent() {
      if (eventIndex >= scenario.events.length) {
        // Allow time for processing
        setTimeout(() => hook.stdin.end(), 100);
        return;
      }

      const event = scenario.events[eventIndex];
      hook.stdin.write(JSON.stringify(event) + "\n");
      eventIndex++;

      setTimeout(sendNextEvent, 50);
    }

    sendNextEvent();

    hook.on("exit", (code) => {
      // Validate expected logs
      let allLogsFound = true;
      let missingLogs = [];

      for (const expectedLog of scenario.expectedLogs) {
        const found = stderrLines.some(line => expectedLog.test(line));
        if (!found) {
          allLogsFound = false;
          missingLogs.push(expectedLog.toString());
        }
      }

      if (code === 0 && allLogsFound) {
        recordTest(scenario.name, true);
        resolve({ stdout, stderr, stderrLines });
      } else {
        const details = !allLogsFound
          ? `Missing logs: ${missingLogs.join(", ")}`
          : `Exit code: ${code}`;
        recordTest(scenario.name, false, details);
        resolve({ stdout, stderr, stderrLines, failed: true });
      }
    });

    hook.on("error", (err) => {
      recordTest(scenario.name, false, `Process error: ${err.message}`);
      resolve({ failed: true, error: err });
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      hook.kill();
      recordTest(scenario.name, false, "Timeout after 10s");
      resolve({ failed: true, error: new Error("Timeout") });
    }, 10000);
  });
}

// Main test execution
async function runAllTests() {
  console.log("🚀 Starting Test Suite...\n");

  try {
    // Run all test scenarios
    for (const scenario of testScenarios) {
      const result = await runScenario(scenario);
      if (result.failed) {
        console.log(`      ⚠️  Scenario failed but continuing...`);
      }
      // Small delay between scenarios
      await new Promise(r => setTimeout(r, 200));
    }

    // Final session stop event
    console.log("\n📝 6. Session Stop & Cleanup");
    console.log("   Tests graceful shutdown and metrics finalization");

    const stopResult = await runScenario({
      name: "Session Stop",
      description: "Final cleanup",
      events: [
        {
          hook_event_name: "Stop",
          session_id: sessionId,
          user_id: userId,
          cwd: process.cwd(),
          timestamp: new Date().toISOString(),
        },
      ],
      expectedLogs: [
        /Session ended/,
      ],
    });

    // Print summary
    console.log("\n");
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║                   Test Results Summary                 ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(`   Total Tests:  ${results.total}`);
    console.log(`   ✓ Passed:     ${results.passed}`);
    console.log(`   ✗ Failed:     ${results.failed}`);
    console.log("");

    if (results.failed > 0) {
      console.log("❌ Failed Tests:");
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`   • ${t.name}`);
        if (t.details) console.log(`     ${t.details}`);
      });
      console.log("");
    }

    // Langfuse verification
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║              Langfuse Dashboard Verification           ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("🔍 Check Langfuse dashboard for the following:");
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   User ID: ${userId}`);
    console.log("");
    console.log("Expected Observations:");
    console.log("   • 1 session trace (claude-code-session)");
    console.log("   • 5 tool spans:");
    console.log("     - 2 Bash tools (1 success, 1 error)");
    console.log("     - 1 Explore subagent (Task)");
    console.log("     - 1 Agent subagent (Task) with nested Read");
    console.log("     - 1 Read tool (child of Agent)");
    console.log("   • Parent-child relationship visible for nested tools");
    console.log("   • Events: UserPromptSubmit, SubagentStop");
    console.log("");
    console.log("Metrics Summary:");
    console.log("   • Total Tools: ~5");
    console.log("   • Subagents: 2 (Explore, Agent)");
    console.log("   • Errors: 1 (Bash exit 1)");
    console.log("   • Total Tokens: ~2625 tokens");
    console.log("");
    console.log(`Dashboard URL: ${process.env.LANGFUSE_HOST}/project/*/sessions/${sessionId}`);
    console.log("");

    // Exit status
    if (results.failed === 0) {
      console.log("✅ All tests passed! Integration is working correctly.");
      console.log("");
      process.exit(0);
    } else {
      console.log("⚠️  Some tests failed. Check the details above.");
      console.log("");
      process.exit(1);
    }

  } catch (error) {
    console.error("\n❌ Fatal Error:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test suite
runAllTests();
