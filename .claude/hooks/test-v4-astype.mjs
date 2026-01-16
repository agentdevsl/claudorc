import { spawn } from "child_process";
import { setTimeout } from "timers/promises";

const hook = spawn("node", ["dist/langfuse-hook.js"], {
  env: { ...process.env },
  stdio: ["pipe", "inherit", "inherit"],
});

const sessionId = `test-v4-astype-${Date.now()}`;

// Test events simulating Claude Code behavior with subagents and tools
const events = [
  // Session start - UserPromptSubmit
  {
    hook_event_name: "UserPromptSubmit",
    session_id: sessionId,
    user_id: "test-user",
    cwd: "/workspace",
    permission_mode: "default",
    timestamp: new Date().toISOString(),
  },

  // Regular tool - should use asType: "tool"
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Read",
    tool_use_id: "tool_read_001",
    tool_input: { file_path: "/workspace/README.md" },
    model: "claude-sonnet-4-20250514",
  },
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Read",
    tool_use_id: "tool_read_001",
    tool_response: "# Project README\n\nThis is a test project.",
    tokens: { input: 100, output: 50 },
    model: "claude-sonnet-4-20250514",
  },

  // Subagent (Task tool) - should use asType: "agent"
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Task",
    tool_use_id: "tool_task_001",
    tool_input: {
      prompt: "Explore the codebase structure",
      subagent_type: "Explore",
      description: "Exploring codebase",
      model: "haiku",
    },
    model: "claude-sonnet-4-20250514",
  },

  // Nested tool inside subagent - should use asType: "tool" with Task as parent
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Glob",
    tool_use_id: "tool_glob_001",
    tool_input: { pattern: "**/*.ts" },
    parent_tool_use_id: "tool_task_001",
    model: "claude-sonnet-4-20250514",
  },
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Glob",
    tool_use_id: "tool_glob_001",
    tool_response: ["src/index.ts", "src/utils.ts"],
    parent_tool_use_id: "tool_task_001",
    tokens: { input: 20, output: 30 },
    model: "claude-sonnet-4-20250514",
  },

  // Complete the subagent
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Task",
    tool_use_id: "tool_task_001",
    tool_response: "Found 2 TypeScript files in the project.",
    tokens: { input: 500, output: 200 },
    model: "claude-sonnet-4-20250514",
  },

  // Another regular tool - Bash
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Bash",
    tool_use_id: "tool_bash_001",
    tool_input: { command: "echo 'Hello World'" },
    model: "claude-sonnet-4-20250514",
  },
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Bash",
    tool_use_id: "tool_bash_001",
    tool_response: "Hello World",
    tokens: { input: 30, output: 10 },
    model: "claude-sonnet-4-20250514",
  },

  // Session end
  {
    hook_event_name: "Stop",
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  },
];

console.log(`\nTesting Langfuse v4 SDK with asType support`);
console.log(`Session ID: ${sessionId}`);
console.log(`Sending ${events.length} events...\n`);

for (const event of events) {
  console.log(`→ ${event.hook_event_name}: ${event.tool_name || "session"}`);
  hook.stdin.write(JSON.stringify(event) + "\n");
  await setTimeout(100);
}

// Wait for flush
await setTimeout(2000);

hook.stdin.end();

console.log("\n✓ Events sent. Check Langfuse UI for:");
console.log("  - Session trace: claude-code-session");
console.log("  - Agent observation: Agent:Explore (Task tool)");
console.log("  - Tool observations: Read, Glob, Bash");
console.log("  - Hierarchy: Glob should be nested under Agent:Explore");
console.log(`\nSession ID to search: ${sessionId}`);
