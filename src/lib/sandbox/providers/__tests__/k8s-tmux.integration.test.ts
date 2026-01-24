/**
 * Integration tests for K8s tmux operations
 *
 * These tests require a real Kubernetes cluster (kind/minikube/Docker Desktop).
 * They are skipped automatically if no cluster is available.
 *
 * To run these tests:
 *   1. Start a local K8s cluster: `minikube start` or `kind create cluster`
 *   2. Run: `bun test src/lib/sandbox/providers/__tests__/k8s-tmux.integration.test.ts`
 *
 * Note: These tests create real pods and may take 30-60 seconds to run.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SandboxConfig } from '../../types.js';
import type { Sandbox } from '../sandbox-provider.js';

// Dynamically import to avoid bundling K8s client in non-integration contexts
let K8sProvider: typeof import('../k8s-provider.js').K8sProvider;
let createK8sProvider: typeof import('../k8s-provider.js').createK8sProvider;

// Check if K8s cluster is available
async function isClusterAvailable(): Promise<boolean> {
  try {
    const k8s = await import('@kubernetes/client-node');
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const api = kc.makeApiClient(k8s.CoreV1Api);
    await api.listNamespace();
    return true;
  } catch {
    return false;
  }
}

// Use a unique namespace per test run to avoid conflicts
const testNamespace = `agentpane-integration-${Date.now()}`;
const testImage = 'alpine:latest'; // Small image with basic tools

describe.skipIf(!process.env.K8S_INTEGRATION_TESTS)('K8s tmux integration tests', () => {
  let provider: InstanceType<typeof K8sProvider>;
  let sandbox: Sandbox;
  let clusterAvailable = false;

  const testConfig: SandboxConfig = {
    projectId: `integration-test-${Date.now()}`,
    projectPath: '/tmp/test-workspace',
    image: testImage,
    memoryMb: 256,
    cpuCores: 0.5,
    idleTimeoutMinutes: 5,
    volumeMounts: [],
    env: {},
  };

  beforeAll(async () => {
    // Check cluster availability
    clusterAvailable = await isClusterAvailable();
    if (!clusterAvailable) {
      console.log('⚠️  Skipping K8s integration tests: No cluster available');
      return;
    }

    // Dynamic imports
    const k8sProviderModule = await import('../k8s-provider.js');
    K8sProvider = k8sProviderModule.K8sProvider;
    createK8sProvider = k8sProviderModule.createK8sProvider;

    // Create provider with test namespace
    provider = createK8sProvider({
      namespace: testNamespace,
      createNamespace: true,
    });

    console.log(`🚀 Creating test sandbox in namespace: ${testNamespace}`);

    // Create sandbox - this may take a while for image pull
    sandbox = await provider.create({
      ...testConfig,
      // Use a custom image with tmux installed if available
      // Default alpine doesn't have tmux, so install it
    });

    // Wait for container to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Install tmux in the pod (alpine doesn't have it by default)
    console.log('📦 Installing tmux in test pod...');
    const installResult = await sandbox.exec('apk', ['add', '--no-cache', 'tmux']);
    if (installResult.exitCode !== 0) {
      console.warn('Failed to install tmux:', installResult.stderr);
    }
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    if (!clusterAvailable || !provider) return;

    try {
      // Clean up: stop sandbox and delete namespace
      if (sandbox) {
        console.log('🧹 Cleaning up test sandbox...');
        await sandbox.stop();
      }

      // Delete the test namespace
      const k8s = await import('@kubernetes/client-node');
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      const api = kc.makeApiClient(k8s.CoreV1Api);
      await api.deleteNamespace({ name: testNamespace });
      console.log(`🗑️  Deleted namespace: ${testNamespace}`);
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }, 60000);

  describe('tmux session lifecycle', () => {
    it('creates a new tmux session', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'test-session-1';
      const session = await sandbox.createTmuxSession(sessionName);

      expect(session.name).toBe(sessionName);
      expect(session.sandboxId).toBe(sandbox.id);
      expect(session.windowCount).toBe(1);
      expect(session.attached).toBe(false);
    });

    it('throws error when creating duplicate session', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'duplicate-session';
      await sandbox.createTmuxSession(sessionName);

      await expect(sandbox.createTmuxSession(sessionName)).rejects.toMatchObject({
        code: 'K8S_TMUX_SESSION_ALREADY_EXISTS',
      });
    });

    it('lists all tmux sessions', async () => {
      if (!clusterAvailable) return;

      // Create additional sessions
      await sandbox.createTmuxSession('list-test-1');
      await sandbox.createTmuxSession('list-test-2');

      const sessions = await sandbox.listTmuxSessions();

      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some((s) => s.name === 'list-test-1')).toBe(true);
      expect(sessions.some((s) => s.name === 'list-test-2')).toBe(true);
    });

    it('kills a tmux session', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'kill-test';
      await sandbox.createTmuxSession(sessionName);

      // Verify it exists
      let sessions = await sandbox.listTmuxSessions();
      expect(sessions.some((s) => s.name === sessionName)).toBe(true);

      // Kill it
      await sandbox.killTmuxSession(sessionName);

      // Verify it's gone
      sessions = await sandbox.listTmuxSessions();
      expect(sessions.some((s) => s.name === sessionName)).toBe(false);
    });

    it('handles killing non-existent session gracefully', async () => {
      if (!clusterAvailable) return;

      // Should not throw for non-existent session
      await expect(sandbox.killTmuxSession('non-existent-session')).resolves.toBeUndefined();
    });
  });

  describe('tmux interaction', () => {
    it('sends keys to a tmux session', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'keys-test';
      await sandbox.createTmuxSession(sessionName);

      // Send a simple command
      await sandbox.sendKeysToTmux(sessionName, 'echo "hello world"');

      // Give tmux time to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture the output
      const output = await sandbox.captureTmuxPane(sessionName);
      expect(output).toContain('hello world');
    });

    it('captures pane content with line limit', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'capture-test';
      await sandbox.createTmuxSession(sessionName);

      // Send multiple commands to generate output
      for (let i = 0; i < 5; i++) {
        await sandbox.sendKeysToTmux(sessionName, `echo "line ${i}"`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Capture with line limit
      const output = await sandbox.captureTmuxPane(sessionName, 10);
      expect(output).toBeTruthy();
    });

    it('runs commands in sequence via tmux', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'sequence-test';
      await sandbox.createTmuxSession(sessionName);

      // Create a file
      await sandbox.sendKeysToTmux(sessionName, 'echo "test content" > /tmp/testfile.txt');
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Read the file
      await sandbox.sendKeysToTmux(sessionName, 'cat /tmp/testfile.txt');
      await new Promise((resolve) => setTimeout(resolve, 300));

      const output = await sandbox.captureTmuxPane(sessionName);
      expect(output).toContain('test content');
    });
  });

  describe('session persistence', () => {
    it('sessions persist across listTmuxSessions calls', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'persist-test';
      await sandbox.createTmuxSession(sessionName);

      // List multiple times
      const sessions1 = await sandbox.listTmuxSessions();
      const sessions2 = await sandbox.listTmuxSessions();
      const sessions3 = await sandbox.listTmuxSessions();

      expect(sessions1.some((s) => s.name === sessionName)).toBe(true);
      expect(sessions2.some((s) => s.name === sessionName)).toBe(true);
      expect(sessions3.some((s) => s.name === sessionName)).toBe(true);
    });

    it('session window count updates after creating new windows', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'window-count-test';
      await sandbox.createTmuxSession(sessionName);

      // Get initial window count
      let sessions = await sandbox.listTmuxSessions();
      let session = sessions.find((s) => s.name === sessionName);
      expect(session?.windowCount).toBe(1);

      // Create a new window
      await sandbox.sendKeysToTmux(sessionName, '');
      const result = await sandbox.exec('tmux', ['new-window', '-t', sessionName]);
      expect(result.exitCode).toBe(0);

      // Check updated window count
      sessions = await sandbox.listTmuxSessions();
      session = sessions.find((s) => s.name === sessionName);
      expect(session?.windowCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('returns empty list when no tmux server is running', async () => {
      if (!clusterAvailable) return;

      // Create a fresh provider/sandbox for this test
      const isolatedProvider = createK8sProvider({
        namespace: testNamespace,
        createNamespace: false, // Namespace already exists
      });

      const isolatedConfig: SandboxConfig = {
        ...testConfig,
        projectId: `isolated-test-${Date.now()}`,
      };

      const isolatedSandbox = await isolatedProvider.create(isolatedConfig);

      try {
        // Install tmux
        await isolatedSandbox.exec('apk', ['add', '--no-cache', 'tmux']);

        // No tmux sessions have been created, so no server
        const sessions = await isolatedSandbox.listTmuxSessions();
        expect(sessions).toEqual([]);
      } finally {
        await isolatedSandbox.stop();
      }
    });

    it('handles exec failure in tmux operations', async () => {
      if (!clusterAvailable) return;

      const sessionName = 'error-test';
      await sandbox.createTmuxSession(sessionName);

      // Try to capture a pane from a non-existent session
      await expect(sandbox.captureTmuxPane('non-existent')).rejects.toMatchObject({
        code: 'K8S_EXEC_FAILED',
      });
    });
  });
});

// Additional describe block for running without the skip condition in CI
describe('K8s tmux integration (auto-detect cluster)', () => {
  it.skipIf(!process.env.CI)('should be runnable in CI with kind cluster', async () => {
    const available = await isClusterAvailable();
    if (!available) {
      console.log('No K8s cluster available in CI - skipping integration tests');
      return;
    }
    // The main test suite above will run
    expect(available).toBe(true);
  });
});
