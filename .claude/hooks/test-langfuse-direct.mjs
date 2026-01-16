#!/usr/bin/env node
/**
 * Direct Langfuse API test - verify the SDK is actually sending data
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

import Langfuse from "langfuse";

console.log("=== Direct Langfuse SDK Test ===\n");
console.log("Host:", process.env.LANGFUSE_HOST);
console.log("Public Key:", process.env.LANGFUSE_PUBLIC_KEY?.substring(0, 15) + "...");
console.log("");

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
  flushAt: 1,
  flushInterval: 0,
});

// Enable debug logging
langfuse.on("error", (error) => {
  console.error("Langfuse error:", error);
});

const sessionId = `direct-test-${Date.now()}`;
console.log("Creating trace with session:", sessionId);

// Create a trace (this is what sessions become)
const trace = langfuse.trace({
  id: `trace-${sessionId}`,
  name: "direct-test-trace",
  sessionId: sessionId,
  userId: "test-user",
  input: { test: true },
  metadata: { source: "direct-test" },
  tags: ["test", "debug"],
});

console.log("Trace created with ID:", trace.id);

// Create a span (child of trace)
const span = trace.span({
  name: "Tool:Bash",
  input: { command: "echo hello" },
  metadata: { tool_name: "Bash" },
});

console.log("Span created with ID:", span.id);

// Update and end span
span.update({
  output: "hello",
  level: "DEFAULT",
  metadata: { success: true, duration_ms: 100 },
});
span.end();

console.log("Span ended");

// Update trace with output
trace.update({
  output: { ended: true, tool_count: 1 },
});

console.log("Trace updated");

// Flush and verify
console.log("\nFlushing to Langfuse...");

try {
  await langfuse.flushAsync();
  console.log("Flush completed successfully!");

  // Wait a bit more to ensure network completes
  await new Promise(r => setTimeout(r, 2000));

  console.log("\n=== Check Langfuse dashboard ===");
  console.log("Session ID:", sessionId);
  console.log("Trace ID:", trace.id);
  console.log("URL:", `${process.env.LANGFUSE_HOST}/project/*/traces/${trace.id}`);
} catch (error) {
  console.error("Flush error:", error);
}

// Shutdown
await langfuse.shutdownAsync();
console.log("\nDone!");
