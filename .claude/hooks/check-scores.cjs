const https = require("https");
const fs = require("fs");
const path = require("path");

// Read .env manually from hooks directory
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
envContent.split("\n").forEach(line => {
  if (line && line.indexOf("#") !== 0) {
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  }
});

const auth = Buffer.from(envVars.LANGFUSE_PUBLIC_KEY + ":" + envVars.LANGFUSE_SECRET_KEY).toString("base64");
const sessionId = process.argv[2];
let traceId = process.argv[3];

console.log("Using host:", envVars.LANGFUSE_HOST);
console.log("Session ID or Trace ID:", sessionId);
console.log("");

function fetchTraceBySession() {
  return new Promise((resolve, reject) => {
    if (traceId) {
      resolve();
      return;
    }
    if (!sessionId) {
      console.log("Usage: node check-scores.cjs <sessionId|traceId>");
      process.exit(1);
    }

    // If sessionId looks like a trace ID (32 hex chars), use it directly
    if (/^[a-f0-9]{32}$/.test(sessionId)) {
      traceId = sessionId;
      console.log("Using as trace ID:", traceId);
      resolve();
      return;
    }

    const options = {
      hostname: "us.cloud.langfuse.com",
      path: `/api/public/traces?sessionId=${encodeURIComponent(sessionId)}&limit=1`,
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            traceId = json.data[0].id;
            console.log("Found trace ID:", traceId);
            console.log("");
          } else {
            console.log("No trace found for session:", sessionId);
            process.exit(1);
          }
          resolve();
        } catch (e) {
          console.log("Parse error:", e.message);
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

let observationIds = new Set();

function fetchObservations() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "us.cloud.langfuse.com",
      path: `/api/public/observations?traceId=${traceId}&limit=50`,
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          console.log("=== Observations for trace ===");
          if (json.data && json.data.length > 0) {
            json.data.forEach(o => {
              observationIds.add(o.id);
              const status = o.statusMessage || (o.level === "ERROR" ? "ERROR" : "OK");
              console.log(`  ${o.name}: ${status} (${o.type}, level=${o.level || "DEFAULT"}) id=${o.id.substring(0, 8)}`);
            });
            // Also add trace ID as it can be an observation ID for session-level scores
            observationIds.add(traceId);
            console.log("Total observations:", json.data.length);
          } else {
            console.log("No observations found");
          }
          resolve();
        } catch (e) {
          console.log("Parse error:", e.message);
          resolve();
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function fetchScores() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "us.cloud.langfuse.com",
      path: `/api/public/scores?traceId=${traceId}&limit=50`,
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          console.log("\n=== Scores for test trace ===");
          if (json.data && json.data.length > 0) {
            // Filter to only scores for observations in this trace
            const relevantScores = json.data.filter(s => observationIds.has(s.observationId));

            // Also show scores with matching traceId (session scores)
            const traceScores = json.data.filter(s => s.traceId === traceId);
            if (traceScores.length !== relevantScores.length) {
              console.log(`(Also found ${traceScores.length} scores matching traceId)`);
            }

            // Group by score name
            const byName = {};
            relevantScores.forEach(s => {
              if (!byName[s.name]) byName[s.name] = [];
              byName[s.name].push(s);
            });

            Object.entries(byName).forEach(([name, scores]) => {
              console.log(`\n${name} (${scores.length} score(s)):`);
              scores.forEach(s => {
                const displayValue = s.stringValue !== undefined ? s.stringValue : s.value;
                console.log(`  - ${displayValue} (${s.dataType}) obsId=${s.observationId?.substring(0, 8) || 'trace'}`);
              });
            });
            console.log("\n---");
            console.log(`Relevant scores: ${relevantScores.length} (filtered from ${json.data.length} total)`);

            // Show sample of other scores for debugging
            if (relevantScores.length === 0 && json.data.length > 0) {
              console.log("\nSample of other scores (first 5):");
              json.data.slice(0, 5).forEach(s => {
                console.log(`  ${s.name}=${s.stringValue || s.value} traceId=${s.traceId?.substring(0,8)} obsId=${s.observationId?.substring(0,8)}`);
              });
            }
          } else {
            console.log("No scores found");
            if (json.message) {
              console.log("Message:", json.message);
            }
          }
          resolve();
        } catch (e) {
          console.log("Parse error:", e.message);
          console.log("Raw response:", data);
          resolve();
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  await fetchTraceBySession();
  await fetchObservations();
  await fetchScores();
}

main().catch(console.error);
