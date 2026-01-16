// Test receiving events from stdin like Claude Code hooks
import { createInterface } from 'node:readline';

const rl = createInterface({ input: process.stdin, terminal: false });

console.error('[Test Hook] Started, waiting for input...');

rl.on('line', (line) => {
  console.error(`[Test Hook] Received line: ${line.substring(0, 100)}...`);
  try {
    const data = JSON.parse(line);
    console.error(`[Test Hook] Parsed event type: ${data.type || data.hook_event_name}`);
  } catch (e) {
    console.error(`[Test Hook] Parse error: ${e.message}`);
  }
});

rl.on('close', () => {
  console.error('[Test Hook] stdin closed');
});
