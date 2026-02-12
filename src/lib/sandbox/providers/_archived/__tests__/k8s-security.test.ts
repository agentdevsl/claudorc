import type * as k8s from '@kubernetes/client-node';
import { beforeEach, describe, expect, it } from 'vitest';
import { createK8sAuditLogger, type K8sAuditEvent } from '../k8s-audit.js';
import { NETWORK_POLICY_DEFAULTS, PRIVATE_IP_RANGES } from '../k8s-network-policy.js';
import { RBAC_NAMES } from '../k8s-rbac.js';
// Import security modules
import { createPodSecurityValidator, ensureRestrictedPodSecurity } from '../k8s-security.js';

describe('PodSecurityValidator', () => {
  const validator = createPodSecurityValidator();

  const createBasePod = (): k8s.V1Pod => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: 'test-pod',
      namespace: 'agentpane-sandboxes',
    },
    spec: {
      restartPolicy: 'Never',
      securityContext: {
        runAsNonRoot: true,
        runAsUser: 1000,
        fsGroup: 1000,
        seccompProfile: {
          type: 'RuntimeDefault',
        },
      },
      containers: [
        {
          name: 'sandbox',
          image: 'node:22-slim',
          securityContext: {
            allowPrivilegeEscalation: false,
            privileged: false,
            capabilities: {
              drop: ['ALL'],
            },
          },
        },
      ],
    },
  });

  describe('validateRestricted', () => {
    it('should pass for a properly configured pod', () => {
      const pod = createBasePod();
      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(true);
      expect(result.profile).toBe('restricted');
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when hostNetwork is true', () => {
      const pod = createBasePod();
      if (pod.spec) pod.spec.hostNetwork = true;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('hostNetwork must be false');
    });

    it('should fail when hostPID is true', () => {
      const pod = createBasePod();
      if (pod.spec) pod.spec.hostPID = true;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('hostPID must be false');
    });

    it('should fail when hostIPC is true', () => {
      const pod = createBasePod();
      if (pod.spec) pod.spec.hostIPC = true;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('hostIPC must be false');
    });

    it('should fail when runAsNonRoot is not set', () => {
      const pod = createBasePod();
      if (pod.spec?.securityContext) pod.spec.securityContext.runAsNonRoot = undefined;
      if (pod.spec?.containers?.[0]?.securityContext)
        pod.spec.containers[0].securityContext.runAsNonRoot = undefined;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('runAsNonRoot'))).toBe(true);
    });

    it('should fail when seccompProfile is not set', () => {
      const pod = createBasePod();
      if (pod.spec?.securityContext) pod.spec.securityContext.seccompProfile = undefined;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('seccompProfile'))).toBe(true);
    });

    it('should fail when container is privileged', () => {
      const pod = createBasePod();
      if (pod.spec?.containers?.[0]?.securityContext)
        pod.spec.containers[0].securityContext.privileged = true;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('privileged'))).toBe(true);
    });

    it('should fail when allowPrivilegeEscalation is not explicitly false', () => {
      const pod = createBasePod();
      if (pod.spec?.containers?.[0]?.securityContext)
        pod.spec.containers[0].securityContext.allowPrivilegeEscalation = undefined;

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('allowPrivilegeEscalation'))).toBe(true);
    });

    it('should fail when dangerous capabilities are added', () => {
      const pod = createBasePod();
      if (pod.spec?.containers?.[0]?.securityContext) {
        pod.spec.containers[0].securityContext.capabilities = {
          add: ['SYS_ADMIN'],
          drop: ['ALL'],
        };
      }

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('SYS_ADMIN'))).toBe(true);
    });

    it('should fail when capabilities.drop does not include ALL', () => {
      const pod = createBasePod();
      if (pod.spec?.containers?.[0]?.securityContext) {
        pod.spec.containers[0].securityContext.capabilities = {
          drop: ['NET_RAW'],
        };
      }

      const result = validator.validateRestricted(pod);

      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.includes('drop must include ALL'))).toBe(true);
    });
  });

  describe('validateBaseline', () => {
    it('should pass for a baseline-compliant pod', () => {
      const pod = createBasePod();
      // Baseline allows some things that restricted doesn't
      if (pod.spec?.containers?.[0]?.securityContext) {
        pod.spec.containers[0].securityContext.allowPrivilegeEscalation = undefined;
        pod.spec.containers[0].securityContext.capabilities = {};
      }

      const result = validator.validateBaseline(pod);

      expect(result.valid).toBe(true);
      expect(result.profile).toBe('baseline');
    });

    it('should fail when hostNetwork is true', () => {
      const pod = createBasePod();
      if (pod.spec) pod.spec.hostNetwork = true;

      const result = validator.validateBaseline(pod);

      expect(result.valid).toBe(false);
    });
  });

  describe('validate with privileged profile', () => {
    it('should always pass for privileged profile', () => {
      const pod = createBasePod();
      if (pod.spec) {
        pod.spec.hostNetwork = true;
        pod.spec.hostPID = true;
        if (pod.spec.containers?.[0]?.securityContext) {
          pod.spec.containers[0].securityContext.privileged = true;
        }
      }

      const result = validator.validate(pod, 'privileged');

      expect(result.valid).toBe(true);
      expect(result.profile).toBe('privileged');
    });
  });

  describe('validateOrThrow', () => {
    it('should not throw for valid pod', () => {
      const pod = createBasePod();
      expect(() => validator.validateOrThrow(pod)).not.toThrow();
    });

    it('should throw for invalid pod', () => {
      const pod = createBasePod();
      if (pod.spec) pod.spec.hostNetwork = true;
      expect(() => validator.validateOrThrow(pod)).toThrow();
    });
  });
});

describe('ensureRestrictedPodSecurity', () => {
  it('should add missing security context to pod', () => {
    const pod: k8s.V1Pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'test' },
      spec: {
        containers: [{ name: 'main', image: 'nginx' }],
      },
    };

    const secured = ensureRestrictedPodSecurity(pod);

    expect(secured.spec?.securityContext?.runAsNonRoot).toBe(true);
    expect(secured.spec?.securityContext?.seccompProfile?.type).toBe('RuntimeDefault');
    const container = secured.spec?.containers?.[0];
    expect(container?.securityContext?.allowPrivilegeEscalation).toBe(false);
    expect(container?.securityContext?.privileged).toBe(false);
    expect(container?.securityContext?.capabilities?.drop).toContain('ALL');
  });

  it('should preserve existing security context settings', () => {
    const pod: k8s.V1Pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'test' },
      spec: {
        securityContext: {
          runAsUser: 1000,
        },
        containers: [
          {
            name: 'main',
            image: 'nginx',
            securityContext: {
              readOnlyRootFilesystem: true,
            },
          },
        ],
      },
    };

    const secured = ensureRestrictedPodSecurity(pod);

    expect(secured.spec?.securityContext?.runAsUser).toBe(1000);
    const container = secured.spec?.containers?.[0];
    expect(container?.securityContext?.readOnlyRootFilesystem).toBe(true);
  });

  it('should handle init containers', () => {
    const pod: k8s.V1Pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'test' },
      spec: {
        initContainers: [{ name: 'init', image: 'busybox' }],
        containers: [{ name: 'main', image: 'nginx' }],
      },
    };

    const secured = ensureRestrictedPodSecurity(pod);

    const initContainer = secured.spec?.initContainers?.[0];
    expect(initContainer?.securityContext?.allowPrivilegeEscalation).toBe(false);
    expect(initContainer?.securityContext?.capabilities?.drop).toContain('ALL');
  });
});

describe('K8sAuditLogger', () => {
  let capturedEvents: K8sAuditEvent[];

  beforeEach(() => {
    capturedEvents = [];
  });

  const createLogger = () =>
    createK8sAuditLogger({
      enabled: true,
      logFn: (event) => capturedEvents.push(event),
    });

  it('should log pod created events', () => {
    const logger = createLogger();

    logger.logPodCreated({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
      projectId: 'project-456',
      image: 'node:22-slim',
      durationMs: 5000,
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('pod.created');
    expect(event.severity).toBe('info');
    expect(event.resourceName).toBe('test-pod');
    expect(event.sandboxId).toBe('sandbox-123');
  });

  it('should log pod failed events with error severity', () => {
    const logger = createLogger();

    logger.logPodFailed({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
      error: 'Image pull failed',
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('pod.failed');
    expect(event.severity).toBe('error');
    expect(event.error).toBe('Image pull failed');
  });

  it('should log network policy events', () => {
    const logger = createLogger();

    logger.logNetworkPolicyCreated({
      policyName: 'sandbox-default-policy',
      namespace: 'agentpane-sandboxes',
      egressRules: 4,
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('network_policy.created');
    expect(event.metadata?.egressRules).toBe(4);
  });

  it('should log exec commands', () => {
    const logger = createLogger();

    logger.logExecCommand({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
      command: 'npm install',
      exitCode: 0,
      durationMs: 10000,
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('security.exec_command');
    expect(event.severity).toBe('info');
    expect(event.metadata?.command).toBe('npm install');
  });

  it('should log exec as root attempts with warning severity', () => {
    const logger = createLogger();

    logger.logExecAsRootAttempted({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
      command: 'apt install curl',
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('security.exec_as_root_attempted');
    expect(event.severity).toBe('warn');
  });

  it('should log PSS validation results', () => {
    const logger = createLogger();

    logger.logPssValidation({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      passed: false,
      profile: 'restricted',
      violations: ['hostNetwork must be false', 'runAsNonRoot must be true'],
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.event).toBe('security.pss_validation_failed');
    expect(event.severity).toBe('error');
    expect(event.metadata?.violations).toHaveLength(2);
  });

  it('should respect enabled flag', () => {
    const logger = createK8sAuditLogger({
      enabled: false,
      logFn: (event) => capturedEvents.push(event),
    });

    logger.logPodCreated({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
      projectId: 'project-456',
      image: 'node:22-slim',
    });

    expect(capturedEvents).toHaveLength(0);
  });

  it('should include timestamp in ISO format', () => {
    const logger = createLogger();

    logger.logPodStarted({
      podName: 'test-pod',
      namespace: 'agentpane-sandboxes',
      sandboxId: 'sandbox-123',
    });

    expect(capturedEvents).toHaveLength(1);
    const event = capturedEvents[0]!;
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('NetworkPolicy Constants', () => {
  it('should have correct default values', () => {
    expect(NETWORK_POLICY_DEFAULTS.enabled).toBe(true);
    expect(NETWORK_POLICY_DEFAULTS.allowDns).toBe(true);
    expect(NETWORK_POLICY_DEFAULTS.allowHttps).toBe(true);
    expect(NETWORK_POLICY_DEFAULTS.allowHttp).toBe(false);
    expect(NETWORK_POLICY_DEFAULTS.allowSsh).toBe(true);
  });

  it('should have correct private IP ranges', () => {
    expect(PRIVATE_IP_RANGES).toContain('10.0.0.0/8');
    expect(PRIVATE_IP_RANGES).toContain('172.16.0.0/12');
    expect(PRIVATE_IP_RANGES).toContain('192.168.0.0/16');
    expect(PRIVATE_IP_RANGES).toContain('127.0.0.0/8');
    expect(PRIVATE_IP_RANGES).toContain('169.254.0.0/16');
  });
});

describe('RBAC Constants', () => {
  it('should have correct resource names', () => {
    expect(RBAC_NAMES.serviceAccount).toBe('agentpane-sandbox-controller');
    expect(RBAC_NAMES.role).toBe('sandbox-manager');
    expect(RBAC_NAMES.roleBinding).toBe('agentpane-sandbox-controller-binding');
    expect(RBAC_NAMES.clusterRole).toBe('agentpane-cluster-reader');
    expect(RBAC_NAMES.clusterRoleBinding).toBe('agentpane-cluster-reader-binding');
  });
});
