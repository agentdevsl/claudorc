#!/usr/bin/env node
/**
 * Debug test for Langfuse hook - simulates real Claude Code events
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

console.log("=== Langfuse Hook Debug Test ===\n");
console.log("Environment:");
console.log("  LANGFUSE_HOST:", process.env.LANGFUSE_HOST);
console.log("  LANGFUSE_PUBLIC_KEY:", process.env.LANGFUSE_PUBLIC_KEY?.substring(0, 15) + "...");
console.log("  LANGFUSE_SECRET_KEY set:", !!process.env.LANGFUSE_SECRET_KEY);
console.log("");

// Generate a unique session ID
const sessionId = `debug-test-${Date.now()}`;
console.log("Session ID:", sessionId);
console.log("");

// Simulate events that Claude Code would send
const events = [
  // PreToolUse - starting a Bash command
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Bash",
    tool_use_id: "tool-1",
    tool_input: { command: "echo 'hello world'" },
    cwd: process.cwd(),
    permission_mode: "auto",
    model: "claude-opus-4-5-20251101",
  },
  // PostToolUse - Bash completed successfully
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Bash",
    tool_use_id: "tool-1",
    tool_input: { command: "echo 'hello world'" },
    tool_response: "hello world",
    cwd: process.cwd(),
    permission_mode: "auto",
    model: "claude-opus-4-5-20251101",
  },
  // PreToolUse - starting a Read
  {
    hook_event_name: "PreToolUse",
    session_id: sessionId,
    tool_name: "Read",
    tool_use_id: "tool-2",
    tool_input: { file_path: "/etc/hostname" },
    cwd: process.cwd(),
    permission_mode: "auto",
    model: "claude-opus-4-5-20251101",
  },
  // PostToolUse - Read completed
  {
    hook_event_name: "PostToolUse",
    session_id: sessionId,
    tool_name: "Read",
    tool_use_id: "tool-2",
    tool_input: { file_path: "/etc/hostname" },
    tool_response: "test-hostname",
    cwd: process.cwd(),
    permission_mode: "auto",
    model: "claude-opus-4-5-20251101",
  },
  // Stop - end the session
  {
    hook_event_name: "Stop",
    session_id: sessionId,
    cwd: process.cwd(),
    timestamp: new Date().toISOString(),
  },
];

// Run the hook as a child process
console.log("Starting hook process...\n");

const hook = spawn("node", ["dist/langfuse-hook.js"], {
  cwd: __dirname,
  env: {
    ...process.env,
    LANGFUSE_LOG_LEVEL: "DEBUG",
  },
  stdio: ["pipe", "inherit", "inherit"],
});

// Send events with delays
let eventIndex = 0;
function sendNextEvent() {
  if (eventIndex >= events.length) {
    console.log("\n--- All events sent, waiting for flush... ---\n");
    // Close stdin to trigger shutdown
    hook.stdin.end();
    return;
  }

  const event = events[eventIndex];
  console.log(`>>> Sending event ${eventIndex + 1}/${events.length}: ${event.hook_event_name} ${event.tool_name || ""}`);
  hook.stdin.write(JSON.stringify(event) + "\n");
  eventIndex++;

  // Small delay between events
  setTimeout(sendNextEvent, 100);
}

// Start sending events
sendNextEvent();

// Wait for hook to exit
hook.on("exit", (code) => {
  console.log(`\nHook exited with code ${code}`);
  console.log("\n=== Check Langfuse dashboard for session:", sessionId, "===");
});

// Handle errors
hook.on("error", (err) => {
  console.error("Hook process error:", err);
});
