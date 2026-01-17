/**
 * E2E Test Setup using agent-browser CLI
 *
 * Uses the agent-browser CLI skill for browser automation.
 * Requires: bunx agent-browser (or npm install -g agent-browser)
 *
 * Set E2E_BASE_URL env var to enable E2E tests:
 *   E2E_BASE_URL=http://localhost:3000 bun run test:e2e
 */
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const exec = promisify(execCallback);

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Server is considered running if E2E_BASE_URL is explicitly set
// This allows tests to skip gracefully when not configured
export const serverRunning = process.env.E2E_BASE_URL !== undefined;
export let browserReady = false;

const showSkipWarning = () => {
  console.warn('\n');
  console.warn('⚠️  ══════════════════════════════════════════════════════════════');
  console.warn('⚠️  E2E TESTS SKIPPED - Server not configured');
  console.warn('⚠️  ══════════════════════════════════════════════════════════════');
  console.warn('⚠️  ');
  console.warn('⚠️  To run E2E tests, set the E2E_BASE_URL environment variable:');
  console.warn('⚠️  ');
  console.warn('⚠️    E2E_BASE_URL=http://localhost:3000 bun run test:e2e');
  console.warn('⚠️  ');
  console.warn('⚠️  Or use the E2E test runner (starts server automatically):');
  console.warn('⚠️  ');
  console.warn('⚠️    bun scripts/e2e-test.ts');
  console.warn('⚠️  ');
  console.warn('⚠️  ══════════════════════════════════════════════════════════════');
  console.warn('\n');
};

if (!serverRunning) {
  showSkipWarning();
}

/**
 * Run an agent-browser CLI command
 */
const run = async (args: string[]): Promise<string> => {
  if (!serverRunning) {
    throw new Error(`Server not configured. Set E2E_BASE_URL env var.`);
  }
  const { stdout } = await exec(`bunx agent-browser ${args.join(' ')}`);
  return stdout.trim();
};

/**
 * Open browser to a URL
 */
export async function open(url: string): Promise<void> {
  await run(['open', `"${url}"`]);
  browserReady = true;
}

/**
 * Close the browser
 */
export async function close(): Promise<void> {
  if (browserReady) {
    await run(['close']).catch(() => {});
    browserReady = false;
  }
}

/**
 * Navigate to a path (relative to BASE_URL or absolute)
 */
export async function goto(path: string): Promise<void> {
  const target = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  await run(['open', `"${target}"`]);
}

/**
 * Click an element by selector
 */
export async function click(selector: string): Promise<void> {
  await run(['click', `"${selector}"`]);
}

/**
 * Fill an input field
 */
export async function fill(selector: string, text: string): Promise<void> {
  await run(['fill', `"${selector}"`, `"${text}"`]);
}

/**
 * Get text content of an element
 */
export async function getText(selector: string): Promise<string> {
  return run(['get', 'text', `"${selector}"`]);
}

/**
 * Wait for a selector to appear
 */
export async function waitForSelector(
  selector: string,
  options?: { timeout?: number }
): Promise<void> {
  const args = ['wait', `"${selector}"`];
  if (options?.timeout) {
    args.push('--timeout', options.timeout.toString());
  }
  await run(args);
}

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(timeout = 5000): Promise<void> {
  await run(['wait', '--load', 'networkidle', '--timeout', timeout.toString()]);
}

/**
 * Take a screenshot
 */
export async function screenshot(name: string): Promise<Buffer> {
  await run(['screenshot', `tests/e2e/screenshots/${name}.png`]);
  return Buffer.from('');
}

/**
 * Drag and drop between elements
 */
export async function drag(sourceSelector: string, targetSelector: string): Promise<void> {
  await run(['drag', `"${sourceSelector}"`, `"${targetSelector}"`]);
}

/**
 * Check if an element exists and is visible
 */
export async function exists(selector: string): Promise<boolean> {
  try {
    await run(['is', 'visible', `"${selector}"`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get count of elements matching selector
 */
export async function getAll(selector: string): Promise<string[]> {
  const result = await run(['get', 'count', `"${selector}"`]);
  const count = Number.parseInt(result || '0', 10);
  return Array.from({ length: Number.isNaN(count) ? 0 : count }, (_, index) => `${index}`);
}

/**
 * Type text character by character
 */
export async function type(selector: string, text: string): Promise<void> {
  await run(['type', `"${selector}"`, `"${text}"`]);
}

/**
 * Press a keyboard key
 */
export async function press(key: string): Promise<void> {
  await run(['press', key]);
}

/**
 * Hover over an element
 */
export async function hover(selector: string): Promise<void> {
  await run(['hover', `"${selector}"`]);
}

/**
 * Get an attribute value from an element
 */
export async function getAttribute(selector: string, name: string): Promise<string> {
  return run(['get', 'attribute', `"${selector}"`, name]);
}

/**
 * Get the current page URL
 */
export async function getUrl(): Promise<string> {
  return run(['get', 'url']);
}

// Lifecycle hooks
beforeAll(async () => {
  if (!serverRunning) {
    return;
  }

  console.log(`✅ E2E tests enabled - server at ${BASE_URL}`);
  await open(BASE_URL);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  if (serverRunning && browserReady) {
    await goto(BASE_URL);
  }
});
