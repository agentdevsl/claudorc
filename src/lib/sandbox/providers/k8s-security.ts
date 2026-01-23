import type * as k8s from '@kubernetes/client-node';
import { K8sErrors } from '../../errors/k8s-errors.js';

/**
 * Pod Security Standards profile levels
 * @see https://kubernetes.io/docs/concepts/security/pod-security-standards/
 */
export type PssProfile = 'privileged' | 'baseline' | 'restricted';

/**
 * Validation result for Pod Security Standards
 */
export interface PssValidationResult {
  /** Whether the pod spec passes validation */
  valid: boolean;

  /** The profile used for validation */
  profile: PssProfile;

  /** List of violations if invalid */
  violations: string[];

  /** Warnings (not blocking, but recommended fixes) */
  warnings: string[];
}

/**
 * Validates pod specifications against Kubernetes Pod Security Standards (PSS)
 *
 * This validator checks pod specs against the 'restricted' profile by default,
 * which is the most secure and is enforced in the AgentPane sandbox namespace.
 *
 * @see https://kubernetes.io/docs/concepts/security/pod-security-standards/
 */
export class PodSecurityValidator {
  /**
   * Validate a pod spec against the restricted PSS profile
   */
  validateRestricted(pod: k8s.V1Pod): PssValidationResult {
    return this.validate(pod, 'restricted');
  }

  /**
   * Validate a pod spec against the baseline PSS profile
   */
  validateBaseline(pod: k8s.V1Pod): PssValidationResult {
    return this.validate(pod, 'baseline');
  }

  /**
   * Validate a pod spec against a specific PSS profile
   */
  validate(pod: k8s.V1Pod, profile: PssProfile): PssValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    if (profile === 'privileged') {
      // Privileged profile allows everything
      return { valid: true, profile, violations: [], warnings: [] };
    }

    const spec = pod.spec;
    if (!spec) {
      violations.push('Pod spec is missing');
      return { valid: false, profile, violations, warnings };
    }

    // Check pod-level security context
    const podSecurityContext = spec.securityContext;

    // Baseline + Restricted: HostNetwork must be false
    if (spec.hostNetwork === true) {
      violations.push('hostNetwork must be false');
    }

    // Baseline + Restricted: HostPID must be false
    if (spec.hostPID === true) {
      violations.push('hostPID must be false');
    }

    // Baseline + Restricted: HostIPC must be false
    if (spec.hostIPC === true) {
      violations.push('hostIPC must be false');
    }

    // Restricted: runAsNonRoot must be true at pod or container level
    if (profile === 'restricted') {
      if (podSecurityContext?.runAsNonRoot !== true) {
        // Check if all containers have runAsNonRoot
        const allContainersNonRoot = (spec.containers ?? []).every(
          (c) => c.securityContext?.runAsNonRoot === true
        );
        if (!allContainersNonRoot) {
          violations.push('runAsNonRoot must be true (pod or all containers)');
        }
      }
    }

    // Restricted: seccompProfile must be RuntimeDefault or Localhost
    if (profile === 'restricted') {
      const seccompType = podSecurityContext?.seccompProfile?.type;
      if (seccompType !== 'RuntimeDefault' && seccompType !== 'Localhost') {
        // Check if all containers have valid seccomp
        const allContainersHaveSeccomp = (spec.containers ?? []).every((c) => {
          const containerSeccomp = c.securityContext?.seccompProfile?.type;
          return containerSeccomp === 'RuntimeDefault' || containerSeccomp === 'Localhost';
        });
        if (!allContainersHaveSeccomp) {
          violations.push('seccompProfile must be RuntimeDefault or Localhost');
        }
      }
    }

    // Check each container
    for (const container of spec.containers ?? []) {
      const containerName = container.name;
      const securityContext = container.securityContext;

      // Baseline + Restricted: privileged must be false
      if (securityContext?.privileged === true) {
        violations.push(`Container ${containerName}: privileged must be false`);
      }

      // Baseline + Restricted: allowPrivilegeEscalation must be false (restricted requires this)
      if (profile === 'restricted') {
        if (securityContext?.allowPrivilegeEscalation !== false) {
          violations.push(
            `Container ${containerName}: allowPrivilegeEscalation must be explicitly set to false`
          );
        }
      }

      // Baseline + Restricted: capabilities - check for dangerous capabilities
      const capabilities = securityContext?.capabilities;
      const addCaps = capabilities?.add ?? [];
      const dangerousCaps = ['ALL', 'SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'SYS_MODULE'];
      for (const cap of addCaps) {
        if (dangerousCaps.includes(cap)) {
          violations.push(
            `Container ${containerName}: dangerous capability ${cap} must not be added`
          );
        }
      }

      // Restricted: capabilities.drop must include ALL
      if (profile === 'restricted') {
        const dropCaps = capabilities?.drop ?? [];
        if (!dropCaps.includes('ALL')) {
          violations.push(`Container ${containerName}: capabilities.drop must include ALL`);
        }
      }

      // Restricted: runAsNonRoot at container level if not set at pod level
      if (profile === 'restricted') {
        if (podSecurityContext?.runAsNonRoot !== true && securityContext?.runAsNonRoot !== true) {
          violations.push(`Container ${containerName}: runAsNonRoot must be true`);
        }
      }

      // Check for hostPath volumes (warning in baseline, violation in restricted for certain paths)
      for (const volume of spec.volumes ?? []) {
        if (volume.hostPath) {
          const hostPath = volume.hostPath.path;
          const dangerousPaths = ['/etc', '/var/run', '/proc', '/sys', '/dev'];
          if (dangerousPaths.some((p) => hostPath?.startsWith(p))) {
            if (profile === 'restricted') {
              violations.push(`Volume ${volume.name}: hostPath to ${hostPath} is not allowed`);
            } else {
              warnings.push(`Volume ${volume.name}: hostPath to ${hostPath} may be dangerous`);
            }
          }
        }
      }
    }

    // Check init containers with same rules
    for (const container of spec.initContainers ?? []) {
      const containerName = `initContainer/${container.name}`;
      const securityContext = container.securityContext;

      if (securityContext?.privileged === true) {
        violations.push(`${containerName}: privileged must be false`);
      }

      if (profile === 'restricted' && securityContext?.allowPrivilegeEscalation !== false) {
        violations.push(
          `${containerName}: allowPrivilegeEscalation must be explicitly set to false`
        );
      }
    }

    return {
      valid: violations.length === 0,
      profile,
      violations,
      warnings,
    };
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(pod: k8s.V1Pod, profile: PssProfile = 'restricted'): void {
    const result = this.validate(pod, profile);
    if (!result.valid) {
      const podName = pod.metadata?.name ?? 'unknown';
      throw K8sErrors.POD_SECURITY_VIOLATION(podName, result.violations.join('; '));
    }
  }
}

/**
 * Ensure a pod spec meets restricted PSS requirements
 * Applies necessary security context settings
 */
export function ensureRestrictedPodSecurity(pod: k8s.V1Pod): k8s.V1Pod {
  const spec = pod.spec;
  if (!spec) {
    return pod;
  }

  // Ensure pod-level security context
  spec.securityContext = {
    ...spec.securityContext,
    runAsNonRoot: true,
    seccompProfile: {
      type: 'RuntimeDefault',
      ...spec.securityContext?.seccompProfile,
    },
  };

  // Ensure container-level security context
  for (const container of spec.containers ?? []) {
    container.securityContext = {
      ...container.securityContext,
      allowPrivilegeEscalation: false,
      privileged: false,
      capabilities: {
        drop: ['ALL'],
        ...container.securityContext?.capabilities,
      },
    };
  }

  // Ensure init container security context
  for (const container of spec.initContainers ?? []) {
    container.securityContext = {
      ...container.securityContext,
      allowPrivilegeEscalation: false,
      privileged: false,
      capabilities: {
        drop: ['ALL'],
        ...container.securityContext?.capabilities,
      },
    };
  }

  return pod;
}

/**
 * Create a singleton validator instance
 */
let validatorInstance: PodSecurityValidator | null = null;

export function getPodSecurityValidator(): PodSecurityValidator {
  if (!validatorInstance) {
    validatorInstance = new PodSecurityValidator();
  }
  return validatorInstance;
}

export function createPodSecurityValidator(): PodSecurityValidator {
  return new PodSecurityValidator();
}
