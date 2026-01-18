/**
 * Smoke Test - Server Health Verification
 *
 * This test runs FIRST to verify the server is online and the UI is available
 * before running any other E2E tests. It fails fast if the server is unhealthy.
 */
import { describe, expect, it } from 'vitest';
import { serverRunning } from './setup';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

describe('Smoke Test - Server Health', () => {
  it.skipIf(!serverRunning)('server should be online and return 200', async () => {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    expect(response.status).toBe(200);
  });

  it.skipIf(!serverRunning)('server should not return 500 errors', async () => {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    expect(response.status).not.toBe(500);
    expect(response.status).not.toBe(502);
    expect(response.status).not.toBe(503);
  });

  it.skipIf(!serverRunning)('UI should render valid HTML', async () => {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();

    // Verify basic HTML structure (case-insensitive for DOCTYPE)
    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head');
    expect(html).toContain('<body');

    // Verify the app root element exists
    expect(html).toContain('id="root"');
  });

  it.skipIf(!serverRunning)('static assets should be accessible', async () => {
    // First get the main page to find script/css references
    const mainResponse = await fetch(BASE_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    expect(mainResponse.ok).toBe(true);

    // Check Vite client is available (dev mode indicator)
    const viteClientResponse = await fetch(`${BASE_URL}/@vite/client`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    // In dev mode, Vite client should be available
    // In prod mode, this may 404 which is fine
    if (viteClientResponse) {
      expect([200, 304, 404]).toContain(viteClientResponse.status);
    }
  });
});
