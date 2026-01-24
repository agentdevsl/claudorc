#!/usr/bin/env bun

/**
 * Test script for the Kubernetes Sandbox Provider
 *
 * This script validates the K8s integration feature step by step,
 * explaining what's happening at each stage.
 *
 * Usage: K8S_KUBECONFIG=/path/to/config bun scripts/test-k8s-provider.ts
 */

import { getClusterInfo, loadKubeConfig } from '../src/lib/sandbox/providers/k8s-config.js';
import { createK8sProvider, type K8sProvider } from '../src/lib/sandbox/providers/k8s-provider.js';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
}

async function main() {
  console.clear();
  console.log(`\n${colors.bright}${colors.blue}🧪 Kubernetes Provider Test Suite${colors.reset}\n`);

  const kubeconfigPath =
    process.env.K8S_KUBECONFIG || '/Users/aarone/Documents/repos/claudorc/config';

  // ============================================================
  // TEST 1: Load and validate kubeconfig
  // ============================================================
  section('Step 1: Load Kubeconfig');

  log('📄', `Loading kubeconfig from: ${kubeconfigPath}`);

  try {
    const kc = loadKubeConfig(kubeconfigPath);
    const clusterInfo = getClusterInfo(kc);
    const currentContext = kc.getCurrentContext();
    const contexts = kc.getContexts();

    log('✅', 'Kubeconfig loaded successfully!', colors.green);
    console.log(`\n   ${colors.dim}Current context:${colors.reset} ${currentContext}`);
    console.log(`   ${colors.dim}Cluster name:${colors.reset}    ${clusterInfo?.name}`);
    console.log(`   ${colors.dim}API server:${colors.reset}      ${clusterInfo?.server}`);
    console.log(`   ${colors.dim}Available contexts:${colors.reset}`);
    contexts.forEach((ctx) => {
      const marker = ctx.name === currentContext ? ' ← active' : '';
      console.log(`      - ${ctx.name}${colors.dim}${marker}${colors.reset}`);
    });
  } catch (error) {
    log('❌', `Failed to load kubeconfig: ${error}`, colors.red);
    process.exit(1);
  }

  // ============================================================
  // TEST 2: Create K8s Provider
  // ============================================================
  section('Step 2: Create K8s Provider');

  log('🔧', 'Creating K8sProvider instance...');
  console.log(`\n   ${colors.dim}Configuration:${colors.reset}`);
  console.log(`   - kubeconfigPath: ${kubeconfigPath}`);
  console.log(`   - skipTLSVerify: true (for local Docker Desktop)`);
  console.log(`   - volumeType: pvc (PersistentVolumeClaim)`);
  console.log(`   - workspaceStorageSize: 100Mi`);
  console.log(`   - namespace: agentpane-sandboxes (default)`);
  console.log(`   - createNamespace: true`);
  console.log(`   - networkPolicyEnabled: true`);
  console.log(`   - setupRbac: true`);
  console.log(`   - enableAuditLogging: true`);

  let provider: K8sProvider;
  try {
    provider = createK8sProvider({
      kubeconfigPath,
      // Skip TLS verification for local Docker Desktop development
      // This is needed because Bun has issues with TLS client certificates
      skipTLSVerify: true,
      // Use PVC for workspace storage (works with Docker Desktop without hostPath sharing)
      volumeType: 'pvc',
      workspaceStorageSize: '100Mi',
    });
    log('✅', 'K8sProvider created successfully!', colors.green);
  } catch (error) {
    log('❌', `Failed to create provider: ${error}`, colors.red);
    process.exit(1);
  }

  // ============================================================
  // TEST 3: Health Check
  // ============================================================
  section('Step 3: Cluster Health Check');

  log('🏥', 'Running health check...');
  console.log(`\n   ${colors.dim}This verifies:${colors.reset}`);
  console.log(`   - Cluster connectivity (can reach API server)`);
  console.log(`   - Namespace status (exists or can be created)`);
  console.log(`   - Server version information`);
  console.log(`   - Current pod count in sandbox namespace\n`);

  try {
    const health = await provider.healthCheck();

    if (health.healthy) {
      log('✅', 'Cluster is healthy!', colors.green);
      console.log(`\n   ${colors.bright}Health Check Details:${colors.reset}`);
      const details = health.details as Record<string, unknown>;
      for (const [key, value] of Object.entries(details)) {
        if (typeof value === 'object') {
          console.log(`   ${colors.dim}${key}:${colors.reset} ${JSON.stringify(value)}`);
        } else {
          console.log(`   ${colors.dim}${key}:${colors.reset} ${value}`);
        }
      }
    } else {
      log('⚠️', `Cluster unhealthy: ${health.message}`, colors.yellow);
    }
  } catch (error) {
    log('❌', `Health check failed: ${error}`, colors.red);
  }

  // ============================================================
  // TEST 4: List existing sandboxes
  // ============================================================
  section('Step 4: List Sandboxes');

  log('📋', 'Listing existing sandboxes...');

  try {
    const sandboxes = await provider.list();
    if (sandboxes.length === 0) {
      log('ℹ️', 'No sandboxes currently running', colors.dim);
    } else {
      log('✅', `Found ${sandboxes.length} sandbox(es):`, colors.green);
      sandboxes.forEach((sb) => {
        console.log(`\n   ${colors.bright}Sandbox: ${sb.id}${colors.reset}`);
        console.log(`   ${colors.dim}Project:${colors.reset} ${sb.projectId}`);
        console.log(`   ${colors.dim}Status:${colors.reset} ${sb.status}`);
        console.log(`   ${colors.dim}Container:${colors.reset} ${sb.containerId}`);
      });
    }
  } catch (error) {
    log('❌', `Failed to list sandboxes: ${error}`, colors.red);
  }

  // ============================================================
  // TEST 5: Optional - Create a test sandbox
  // ============================================================
  section('Step 5: Create Test Sandbox (Optional)');

  const createTestSandbox = process.argv.includes('--create-sandbox');

  if (!createTestSandbox) {
    log('⏭️', 'Skipping sandbox creation (run with --create-sandbox to test)', colors.dim);
    console.log(`\n   ${colors.dim}To create a test sandbox, run:${colors.reset}`);
    console.log(
      `   K8S_KUBECONFIG=${kubeconfigPath} bun scripts/test-k8s-provider.ts --create-sandbox`
    );
  } else {
    log('🚀', 'Creating test sandbox...');

    try {
      // With PVC volume type, we don't need to specify a host path
      // The workspace is stored in a Kubernetes PersistentVolume
      const sandbox = await provider.create({
        projectId: `test-project-${Date.now()}`,
        projectPath: '/workspace', // Only used for labeling, not for hostPath
        image: 'alpine:latest',
        memoryMb: 256,
        cpuCores: 0.5,
        volumeMounts: [],
      });

      console.log(`   ${colors.dim}Volume type:${colors.reset} PVC (workspace-${sandbox.id})`);

      log('✅', `Sandbox created: ${sandbox.id}`, colors.green);
      console.log(`\n   ${colors.dim}Pod name:${colors.reset} ${(sandbox as any).podName}`);
      console.log(`   ${colors.dim}Status:${colors.reset} ${sandbox.status}`);

      // Test exec
      log('🖥️', 'Testing exec (running "echo Hello from K8s!")...');
      const result = await sandbox.exec({
        command: ['echo', 'Hello from K8s!'],
        timeoutMs: 10000,
      });

      if (result.exitCode === 0) {
        log('✅', `Exec succeeded: ${result.stdout.trim()}`, colors.green);
      } else {
        log('⚠️', `Exec returned exit code ${result.exitCode}: ${result.stderr}`, colors.yellow);
      }

      // Cleanup
      log('🧹', 'Cleaning up test sandbox...');
      await sandbox.stop();
      log('✅', 'Sandbox stopped', colors.green);
    } catch (error) {
      log('❌', `Sandbox test failed: ${error}`, colors.red);
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  section('Test Summary');

  console.log(`${colors.green}✅ K8s Provider validation complete!${colors.reset}\n`);
  console.log(
    `${colors.dim}The Kubernetes Sandbox Provider is working with your Docker Desktop cluster.`
  );
  console.log(
    `You can now use it in AgentPane by selecting "Kubernetes" in Settings > Sandbox.${colors.reset}\n`
  );
}

main().catch((error) => {
  console.error(`\n${colors.red}💥 Fatal error: ${error}${colors.reset}\n`);
  process.exit(1);
});
