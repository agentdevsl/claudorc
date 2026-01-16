#!/usr/bin/env node
/**
 * Comprehensive integration test for Langfuse hook
 * Tests the complete flow including:
 * - Session creation and tracking
 * - Tool observation lifecycle (PreToolUse -> PostToolUse)
 * - Cross-process span persistence
 * - Subagent detection
 * - Error handling
 * - Metrics aggregation
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

console.log("=== Langfuse Integration Test ===\n");

// Generate a unique session ID
const sessionId = `integration-test-${Date.now()}`;
console.log("Session ID:", sessionId);

// Test scenarios
const scenarios = {
  basicTools: {
    name: "Basic Tool Flow",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-1",
        tool_input: { command: "echo 'hello world'" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-1",
        tool_input: { command: "echo 'hello world'" },
        tool_response: { exit_code: 0, stdout: "hello world" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
        tokens: { input: 100, output: 50, total: 150 },
      },
    ],
  },

  errorHandling: {
    name: "Error Handling",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-error",
        tool_input: { command: "exit 1" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        tool_name: "Bash",
        tool_use_id: "tool-bash-error",
        tool_input: { command: "exit 1" },
        tool_response: { exit_code: 1, stderr: "Command failed" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
    ],
  },

  subagentFlow: {
    name: "Subagent Detection",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Task",
        tool_use_id: "tool-subagent-1",
        tool_input: {
          subagent_type: "Explore",
          description: "Search for authentication code",
          model: "claude-sonnet-4-5-20251101",
          prompt: "Find all authentication handlers in the codebase",
        },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        tool_name: "Task",
        tool_use_id: "tool-subagent-1",
        tool_input: {
          subagent_type: "Explore",
          description: "Search for authentication code",
          model: "claude-sonnet-4-5-20251101",
          prompt: "Find all authentication handlers in the codebase",
        },
        tool_response: { success: true, result: "Found 3 auth handlers" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
        tokens: { input: 500, output: 200, total: 700 },
      },
      {
        hook_event_name: "SubagentStop",
        session_id: sessionId,
        cwd: process.cwd(),
        stop_hook_active: true,
      },
    ],
  },

  nestedTools: {
    name: "Nested Tool Hierarchy",
    events: [
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Task",
        tool_use_id: "tool-parent",
        tool_input: {
          subagent_type: "Agent",
          description: "Parent subagent",
          prompt: "Perform nested task",
        },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
      {
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Read",
        tool_use_id: "tool-nested-child",
        parent_tool_use_id: "tool-parent",
        tool_input: { file_path: "/etc/hostname" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        tool_name: "Read",
        tool_use_id: "tool-nested-child",
        parent_tool_use_id: "tool-parent",
        tool_input: { file_path: "/etc/hostname" },
        tool_response: { content: "test-hostname" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-sonnet-4-5-20251101",
      },
      {
        hook_event_name: "PostToolUse",
        session_id: sessionId,
        tool_name: "Task",
        tool_use_id: "tool-parent",
        tool_input: {
          subagent_type: "Agent",
          description: "Parent subagent",
          prompt: "Perform nested task",
        },
        tool_response: { success: true },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      },
    ],
  },
};

// Run each scenario
async function runScenario(scenario) {
  console.log(`\n--- ${scenario.name} ---`);

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

    hook.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    hook.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    // Send events
    let eventIndex = 0;
    function sendNextEvent() {
      if (eventIndex >= scenario.events.length) {
        hook.stdin.end();
        return;
      }

      const event = scenario.events[eventIndex];
      console.log(`  → ${event.hook_event_name} ${event.tool_name || ""}`);
      hook.stdin.write(JSON.stringify(event) + "\n");
      eventIndex++;

      setTimeout(sendNextEvent, 50);
    }

    sendNextEvent();

    hook.on("exit", (code) => {
      if (code === 0) {
        console.log(`  ✓ Completed successfully`);
        resolve({ stdout, stderr });
      } else {
        console.log(`  ✗ Failed with code ${code}`);
        reject(new Error(`Hook exited with code ${code}`));
      }
    });

    hook.on("error", (err) => {
      console.error(`  ✗ Process error:`, err);
      reject(err);
    });
  });
}

// Run all scenarios sequentially
async function runAllTests() {
  try {
    for (const [key, scenario] of Object.entries(scenarios)) {
      await runScenario(scenario);
    }

    // Final session stop
    console.log("\n--- Session Stop ---");
    await runScenario({
      name: "Stop Event",
      events: [
        {
          hook_event_name: "Stop",
          session_id: sessionId,
          cwd: process.cwd(),
          timestamp: new Date().toISOString(),
        },
      ],
    });

    console.log("\n=== All Tests Passed ===");
    console.log(`\nCheck Langfuse dashboard for session: ${sessionId}`);
    console.log("Expected observations:");
    console.log("  - 1 session trace");
    console.log("  - 6 tool spans (2 Bash, 1 Bash error, 2 Task, 1 Read)");
    console.log("  - Nested tool should show parent-child relationship");
    console.log("  - Metrics: 6 total tools, 2 subagents, 1 error");
    console.log("  - Token usage: ~850 total tokens");

  } catch (error) {
    console.error("\n=== Test Failed ===");
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
