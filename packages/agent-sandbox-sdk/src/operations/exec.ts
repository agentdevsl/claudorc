import { PassThrough, Writable } from 'node:stream';
import type { KubeConfig } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import { ExecError, TimeoutError } from '../errors.js';
import type {
  ExecOptions,
  ExecResult,
  ExecStreamOptions,
  ExecStreamResult,
} from '../types/exec.js';

/**
 * Execute a command inside a sandbox pod (buffered).
 * Collects all stdout/stderr and returns when the process exits.
 */
export async function execInSandbox(kc: KubeConfig, options: ExecOptions): Promise<ExecResult> {
  const { sandboxName, namespace, container, command, timeoutMs } = options;

  // Resolve the pod name from the sandbox
  const podName = await resolvePodName(kc, namespace, sandboxName);

  const execPromise = new Promise<ExecResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    const stdoutStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        stdout += chunk.toString();
        callback();
      },
    });

    const stderrStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        stderr += chunk.toString();
        callback();
      },
    });

    const exec = new k8s.Exec(kc);

    exec
      .exec(
        namespace,
        podName,
        container ?? 'sandbox',
        command,
        stdoutStream,
        stderrStream,
        null, // stdin
        false, // tty
        (status: k8s.V1Status) => {
          if (status.status === 'Success') {
            exitCode = 0;
          } else if (status.details?.causes) {
            const exitCause = status.details.causes.find((c) => c.reason === 'ExitCode');
            if (exitCause?.message) {
              exitCode = parseInt(exitCause.message, 10) || 1;
            } else {
              exitCode = 1;
            }
          } else {
            exitCode = 1;
          }

          resolve({
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      )
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        reject(new ExecError(command.join(' '), message));
      });
  });

  if (timeoutMs) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`exec ${command.join(' ')}`, timeoutMs));
      }, timeoutMs);
    });
    return Promise.race([execPromise, timeoutPromise]);
  }

  return execPromise;
}

/**
 * Execute a command inside a sandbox pod (streaming).
 * Returns Readable streams for real-time output processing.
 */
export async function execStreamInSandbox(
  kc: KubeConfig,
  options: ExecStreamOptions
): Promise<ExecStreamResult> {
  const { sandboxName, namespace, container, command, stdin, tty } = options;

  const podName = await resolvePodName(kc, namespace, sandboxName);

  const stdoutPassThrough = new PassThrough();
  const stderrPassThrough = new PassThrough();

  let resolveWait!: (value: { exitCode: number }) => void;
  let rejectWait!: (error: Error) => void;
  const waitPromise = new Promise<{ exitCode: number }>((resolve, reject) => {
    resolveWait = resolve;
    rejectWait = reject;
  });

  let wsConnection: Awaited<ReturnType<k8s.Exec['exec']>> | undefined;

  const exec = new k8s.Exec(kc);

  try {
    wsConnection = await exec.exec(
      namespace,
      podName,
      container ?? 'sandbox',
      command,
      stdoutPassThrough,
      stderrPassThrough,
      stdin ?? null,
      tty ?? false,
      (status: k8s.V1Status) => {
        let exitCode = 0;
        if (status.status === 'Success') {
          exitCode = 0;
        } else if (status.details?.causes) {
          const exitCause = status.details.causes.find((c) => c.reason === 'ExitCode');
          if (exitCause?.message) {
            exitCode = parseInt(exitCause.message, 10) || 1;
          } else {
            exitCode = 1;
          }
        } else {
          exitCode = 1;
        }

        stdoutPassThrough.end();
        stderrPassThrough.end();
        resolveWait({ exitCode });
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stdoutPassThrough.destroy();
    stderrPassThrough.destroy();
    rejectWait?.(new ExecError(command.join(' '), message));
  }

  return {
    stdout: stdoutPassThrough,
    stderr: stderrPassThrough,
    wait: () => waitPromise,
    kill: () => {
      if (wsConnection && typeof wsConnection.close === 'function') {
        wsConnection.close();
      }
      stdoutPassThrough.destroy();
      stderrPassThrough.destroy();
    },
  };
}

/**
 * Resolve the pod name from a sandbox resource.
 * Reads the sandbox status.podName, falling back to the sandbox name.
 */
async function resolvePodName(
  kc: KubeConfig,
  namespace: string,
  sandboxName: string
): Promise<string> {
  try {
    const api = kc.makeApiClient(k8s.CustomObjectsApi);
    const sandbox = (await api.getNamespacedCustomObject({
      group: 'agents.x-k8s.io',
      version: 'v1alpha1',
      namespace,
      plural: 'sandboxes',
      name: sandboxName,
    })) as { status?: { podName?: string } };
    return sandbox.status?.podName ?? sandboxName;
  } catch {
    // Fall back to using sandbox name as pod name
    return sandboxName;
  }
}
