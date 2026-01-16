import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

// Import the tracing module
import { 
  initTracing, 
  createConfigFromEnv, 
  createSessionObservation,
  createToolObservation,
  finalizeToolObservation,
  forceFlush,
  shutdownTracing
} from "./dist/tracing/index.js";

console.log("Testing OTEL+Langfuse integration...");

const cfg = createConfigFromEnv();
console.log("Config:", JSON.stringify({ ...cfg, secretKey: "***" }, null, 2));

const initialized = initTracing(cfg);
console.log("Initialized:", initialized);

if (!initialized) {
  console.error("Failed to initialize tracing");
  process.exit(1);
}

// Create a session
const session = createSessionObservation({
  sessionId: "otel-test-" + Date.now(),
  cwd: "/workspace",
  permissionMode: "default"
});

console.log("Session created:", session.id);

// Create a tool observation
const ctx = {
  toolName: "Bash",
  toolUseId: "tool-" + Date.now(),
  toolInput: { command: "echo test" },
  isSubagent: false
};

const tool = createToolObservation(ctx);
console.log("Tool created:", tool.id);

// Finalize it
finalizeToolObservation(tool, { success: true, output: "test output", durationMs: 100 }, ctx);
console.log("Tool finalized");

// Flush and shutdown
console.log("Flushing...");
await forceFlush();
console.log("Shutting down...");
await shutdownTracing();
console.log("Done! Check Langfuse.");
