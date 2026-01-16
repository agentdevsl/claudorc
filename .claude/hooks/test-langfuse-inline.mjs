import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env"), override: true });

import { Langfuse } from "langfuse";

console.log("Testing Langfuse connection...");
console.log("Host:", process.env.LANGFUSE_HOST);
console.log("Public Key:", process.env.LANGFUSE_PUBLIC_KEY?.substring(0, 10) + "...");
console.log("Secret Key set:", !!process.env.LANGFUSE_SECRET_KEY);

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

const trace = langfuse.trace({
  name: "test-trace-manual",
  sessionId: "manual-test-" + Date.now(),
  metadata: { test: true }
});

const span = trace.span({
  name: "test-span",
  input: { message: "hello" }
});

span.end({ output: { result: "success" } });

console.log("Trace ID:", trace.id);
console.log("Flushing...");
await langfuse.flushAsync();
console.log("Done! Check Langfuse dashboard.");
