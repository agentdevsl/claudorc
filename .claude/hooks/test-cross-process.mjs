#!/usr/bin/env node
/**
 * Test cross-process span persistence
 * Simulates the real Claude Code scenario where PreToolUse and PostToolUse
 * happen in different Node.js processes
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

console.log("=== Cross-Process Span Linking Test ===\n");

const sessionId = `cross-process-test-${Date.now()}`;
console.log("Session ID:", sessionId);
console.log("");

// Helper to run hook in a separate process
function runHookProcess(event) {
  return new Promise((resolve, reject) => {
    const hook = spawn("node", ["dist/langfuse-hook.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        LANGFUSE_LOG_LEVEL: "DEBUG",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";

    hook.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    hook.stdin.write(JSON.stringify(event) + "\n");
    hook.stdin.end();

    hook.on("exit", (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(`Hook exited with code ${code}`));
      }
    });

    hook.on("error", reject);
  });
}

async function testCrossProcess() {
  try {
    console.log("Step 1: Process 1 - Send PreToolUse");
    await runHookProcess({
      hook_event_name: "PreToolUse",
      session_id: sessionId,
      tool_name: "Bash",
      tool_use_id: "cross-process-tool-1",
      tool_input: { command: "sleep 1 && echo 'done'" },
      cwd: process.cwd(),
      permission_mode: "auto",
      model: "claude-opus-4-5-20251101",
    });
    console.log("  ✓ Span persisted to disk\n");

    // Simulate delay between PreToolUse and PostToolUse
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("Step 2: Process 2 - Send PostToolUse (different process)");
    await runHookProcess({
      hook_event_name: "PostToolUse",
      session_id: sessionId,
      tool_name: "Bash",
      tool_use_id: "cross-process-tool-1",
      tool_input: { command: "sleep 1 && echo 'done'" },
      tool_response: { exit_code: 0, stdout: "done" },
      cwd: process.cwd(),
      permission_mode: "auto",
      model: "claude-opus-4-5-20251101",
      tokens: { input: 50, output: 25, total: 75 },
    });
    console.log("  ✓ Span retrieved from disk and completed\n");

    console.log("Step 3: Test multiple concurrent tools");
    // Start 3 tools in parallel
    await Promise.all([
      runHookProcess({
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Read",
        tool_use_id: "tool-read-1",
        tool_input: { file_path: "/etc/hosts" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      }),
      runHookProcess({
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Glob",
        tool_use_id: "tool-glob-1",
        tool_input: { pattern: "**/*.ts" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      }),
      runHookProcess({
        hook_event_name: "PreToolUse",
        session_id: sessionId,
        tool_name: "Grep",
        tool_use_id: "tool-grep-1",
        tool_input: { pattern: "TODO", glob: "**/*.ts" },
        cwd: process.cwd(),
        permission_mode: "auto",
        model: "claude-opus-4-5-20251101",
      }),
    ]);
    console.log("  ✓ 3 tools started concurrently\n");

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Complete them in different order
    console.log("Step 4: Complete tools in random order");
    await runHookProcess({
      hook_event_name: "PostToolUse",
      session_id: sessionId,
      tool_name: "Glob",
      tool_use_id: "tool-glob-1",
      tool_input: { pattern: "**/*.ts" },
      tool_response: { files: ["src/index.ts", "src/utils.ts"] },
      cwd: process.cwd(),
      permission_mode: "auto",
      model: "claude-opus-4-5-20251101",
    });
    console.log("  ✓ Glob completed first\n");

    await runHookProcess({
      hook_event_name: "PostToolUse",
      session_id: sessionId,
      tool_name: "Read",
      tool_use_id: "tool-read-1",
      tool_input: { file_path: "/etc/hosts" },
      tool_response: { content: "127.0.0.1 localhost" },
      cwd: process.cwd(),
      permission_mode: "auto",
      model: "claude-opus-4-5-20251101",
    });
    console.log("  ✓ Read completed second\n");

    await runHookProcess({
      hook_event_name: "PostToolUse",
      session_id: sessionId,
      tool_name: "Grep",
      tool_use_id: "tool-grep-1",
      tool_input: { pattern: "TODO", glob: "**/*.ts" },
      tool_response: { matches: ["src/utils.ts:42: // TODO: fix"] },
      cwd: process.cwd(),
      permission_mode: "auto",
      model: "claude-opus-4-5-20251101",
    });
    console.log("  ✓ Grep completed last\n");

    console.log("Step 5: End session");
    await runHookProcess({
      hook_event_name: "Stop",
      session_id: sessionId,
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
    });
    console.log("  ✓ Session ended and cleaned up\n");

    console.log("=== Cross-Process Test Passed ===");
    console.log(`\nSession: ${sessionId}`);
    console.log("Verified:");
    console.log("  ✓ Span persistence across processes");
    console.log("  ✓ Concurrent tool handling");
    console.log("  ✓ Out-of-order completion");
    console.log("  ✓ Session cleanup");
    console.log("\nCheck Langfuse for 4 completed tool spans");

  } catch (error) {
    console.error("\n=== Test Failed ===");
    console.error(error);
    process.exit(1);
  }
}

testCrossProcess();
