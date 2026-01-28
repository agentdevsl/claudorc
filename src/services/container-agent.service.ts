/**
 * ContainerAgentService - Orchestrates Claude Agent SDK execution inside Docker containers.
 *
 * This service manages the lifecycle of agent processes running in sandbox containers:
 * - Starts agent-runner process via docker exec
 * - Bridges stdout events to DurableStreams
 * - Handles cancellation via sentinel files
 * - Tracks running agents per task
 */
import { eq } from 'drizzle-orm';

// Debug logging helper
const DEBUG = process.env.DEBUG_CONTAINER_AGENT === 'true' || process.env.DEBUG === 'true';

function debugLog(context: string, message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${timestamp}] [ContainerAgentService:${context}] ${message}${dataStr}`);
  }
}

function infoLog(context: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [ContainerAgentService:${context}] ${message}${dataStr}`);
}

import { projects } from '../db/schema/projects.js';
import { sessions } from '../db/schema/sessions.js';
import { tasks } from '../db/schema/tasks.js';
import { type ContainerBridge, createContainerBridge } from '../lib/agents/container-bridge.js';
import type { SandboxError } from '../lib/errors/sandbox-errors.js';
import { SandboxErrors } from '../lib/errors/sandbox-errors.js';
import type {
  ExecStreamResult,
  SandboxProvider,
} from '../lib/sandbox/providers/sandbox-provider.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';
import type { ApiKeyService } from './api-key.service.js';
import type { DurableStreamsService } from './durable-streams.service.js';

/**
 * Input for starting a container agent.
 */
export interface StartAgentInput {
  projectId: string;
  taskId: string;
  sessionId: string;
  prompt: string;
  model?: string;
  maxTurns?: number;
}

/**
 * Configuration for an agent run.
 */
export interface AgentConfig {
  model: string;
  maxTurns: number;
  allowedTools?: string[];
}

/**
 * Running agent instance.
 */
interface RunningAgent {
  taskId: string;
  sessionId: string;
  projectId: string;
  sandboxId: string;
  bridge: ContainerBridge;
  execResult: ExecStreamResult;
  stopFilePath: string;
  startedAt: Date;
  stopRequested: boolean;
}

/**
 * ContainerAgentService manages Claude Agent SDK execution inside Docker containers.
 */
export class ContainerAgentService {
  /** Map of taskId -> running agent */
  private runningAgents = new Map<string, RunningAgent>();

  constructor(
    private db: Database,
    private provider: SandboxProvider,
    private streams: DurableStreamsService,
    private apiKeyService: ApiKeyService
  ) {}

  /**
   * Start an agent for a task inside its project's sandbox container.
   */
  async startAgent(input: StartAgentInput): Promise<Result<void, SandboxError>> {
    const { projectId, taskId, sessionId, prompt, model, maxTurns } = input;

    infoLog('startAgent', 'Starting agent', { taskId, projectId, sessionId, model, maxTurns });
    debugLog('startAgent', 'Prompt preview', {
      promptLength: prompt.length,
      promptStart: prompt.slice(0, 100),
    });

    // Publish initializing status (before any checks, so UI gets immediate feedback)
    await this.streams
      .publish(sessionId, 'container-agent:status', {
        taskId,
        sessionId,
        stage: 'initializing',
        message: 'Initializing container agent...',
      })
      .catch((e) =>
        debugLog('startAgent', 'Failed to publish initializing status', { error: String(e) })
      );

    // Check if agent is already running for this task
    if (this.runningAgents.has(taskId)) {
      infoLog('startAgent', 'Agent already running for task', { taskId });
      return err(SandboxErrors.AGENT_ALREADY_RUNNING(taskId));
    }

    // Get project to find sandbox and config
    debugLog('startAgent', 'Fetching project', { projectId });
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      infoLog('startAgent', 'Project not found', { projectId });
      return err(SandboxErrors.PROJECT_NOT_FOUND);
    }
    debugLog('startAgent', 'Project found', {
      projectName: project.name,
      projectConfig: project.config,
    });

    // Publish validating status
    await this.streams
      .publish(sessionId, 'container-agent:status', {
        taskId,
        sessionId,
        stage: 'validating',
        message: 'Validating sandbox container...',
      })
      .catch((e) =>
        debugLog('startAgent', 'Failed to publish validating status', { error: String(e) })
      );

    // Get the sandbox for this project
    infoLog('startAgent', 'Getting sandbox for project', { projectId });
    const sandbox = await this.provider.get(projectId);
    infoLog('startAgent', 'Sandbox lookup result', {
      projectId,
      foundSandbox: !!sandbox,
      sandboxId: sandbox?.id,
      sandboxProjectId: sandbox?.projectId,
      sandboxStatus: sandbox?.status,
    });
    if (!sandbox) {
      infoLog('startAgent', 'Sandbox not found for project', { projectId });
      return err(SandboxErrors.CONTAINER_NOT_FOUND);
    }
    if (sandbox.projectId !== projectId) {
      // Allow fallback to default sandbox for any project
      infoLog('startAgent', 'Using default sandbox for project (fallback allowed)', {
        projectId,
        sandboxProjectId: sandbox.projectId,
      });
    }
    infoLog('startAgent', 'Sandbox found', { sandboxId: sandbox.id, status: sandbox.status });

    if (sandbox.status !== 'running') {
      infoLog('startAgent', 'Sandbox not running', {
        sandboxId: sandbox.id,
        status: sandbox.status,
      });
      return err(SandboxErrors.CONTAINER_NOT_RUNNING);
    }

    // Check if sandbox supports streaming exec
    if (!sandbox.execStream) {
      infoLog('startAgent', 'Sandbox does not support streaming exec', { sandboxId: sandbox.id });
      return err(SandboxErrors.STREAMING_EXEC_NOT_SUPPORTED);
    }

    // Fetch task to get title for session
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    // Validate task exists before proceeding
    if (!task) {
      infoLog('startAgent', 'Task not found', { taskId });
      return err(SandboxErrors.TASK_NOT_FOUND(taskId));
    }

    // Create database session record for this container agent run
    debugLog('startAgent', 'Creating session record', { sessionId, taskId });
    try {
      await this.db.insert(sessions).values({
        id: sessionId,
        projectId,
        taskId,
        agentId: null, // Container agents don't have a separate agent record
        title: task.title ?? `Container Agent - ${taskId}`,
        url: `/projects/${projectId}/sessions/${sessionId}`,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      debugLog('startAgent', 'Session record created', { sessionId });
    } catch (dbErr) {
      const errorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
      // Only ignore UNIQUE constraint violations (session already exists from retry)
      if (
        !errorMessage.includes('UNIQUE constraint failed') &&
        !errorMessage.includes('already exists')
      ) {
        infoLog('startAgent', 'Failed to create session record', {
          sessionId,
          taskId,
          error: errorMessage,
        });
        return err(SandboxErrors.SESSION_CREATE_FAILED(errorMessage));
      }
      debugLog('startAgent', 'Session already exists, continuing', { sessionId });
    }

    // Create durable stream for real-time events
    debugLog('startAgent', 'Creating durable stream', { sessionId });
    try {
      await this.streams.createStream(sessionId, {
        type: 'container-agent',
        projectId,
        taskId,
      });
      debugLog('startAgent', 'Stream created successfully', { sessionId });
    } catch (streamErr) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
      // Only ignore "already exists" errors
      if (!errorMessage.includes('already exists') && !errorMessage.includes('duplicate')) {
        infoLog('startAgent', 'Failed to create durable stream', {
          sessionId,
          error: errorMessage,
        });
        return err(SandboxErrors.STREAM_CREATE_FAILED(errorMessage));
      }
      debugLog('startAgent', 'Stream already exists, continuing', { sessionId });
    }

    // Resolve agent configuration
    const agentConfig: AgentConfig = {
      model: model ?? project.config?.model ?? 'claude-sonnet-4-20250514',
      maxTurns: maxTurns ?? project.config?.maxTurns ?? 50,
    };
    infoLog('startAgent', 'Resolved agent config', {
      model: agentConfig.model,
      maxTurns: agentConfig.maxTurns,
    });

    // Create sentinel file path for cancellation
    const stopFilePath = `/tmp/.agent-stop-${taskId}`;

    // Publish credentials status
    await this.streams
      .publish(sessionId, 'container-agent:status', {
        taskId,
        sessionId,
        stage: 'credentials',
        message: 'Retrieving authentication credentials...',
      })
      .catch((e) =>
        debugLog('startAgent', 'Failed to publish credentials status', { error: String(e) })
      );

    // Get OAuth token from database (via ApiKeyService)
    // The Claude Agent SDK requires OAuth tokens to be written to ~/.claude/.credentials.json
    // We pass it via CLAUDE_OAUTH_TOKEN env var, and agent-runner writes the credentials file
    let oauthToken: string | null = null;
    try {
      oauthToken = await this.apiKeyService.getDecryptedKey('anthropic');
      infoLog('startAgent', 'Retrieved OAuth token from database', {
        hasToken: !!oauthToken,
        isOAuth: oauthToken?.startsWith('sk-ant-oat') ?? false,
      });
    } catch (keyErr) {
      infoLog('startAgent', 'Failed to get OAuth token from database', {
        error: keyErr instanceof Error ? keyErr.message : String(keyErr),
      });
    }

    // Fall back to environment variable if not in database
    if (!oauthToken) {
      oauthToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? null;
      if (oauthToken) {
        infoLog('startAgent', 'Using OAuth token from environment variable');
      }
    }

    if (!oauthToken) {
      infoLog('startAgent', 'No OAuth token available');
      return err(SandboxErrors.API_KEY_NOT_CONFIGURED);
    }

    // Build environment variables for agent-runner
    // CLAUDE_OAUTH_TOKEN is used by agent-runner to write credentials file
    // (OAuth tokens can't be passed via ANTHROPIC_API_KEY - they're blocked by API)
    const env: Record<string, string> = {
      CLAUDE_OAUTH_TOKEN: '[REDACTED]',
      AGENT_TASK_ID: taskId,
      AGENT_SESSION_ID: sessionId,
      AGENT_PROMPT: prompt,
      AGENT_MAX_TURNS: String(agentConfig.maxTurns),
      AGENT_MODEL: agentConfig.model,
      AGENT_CWD: '/workspace',
      AGENT_STOP_FILE: stopFilePath,
    };
    debugLog('startAgent', 'Environment variables prepared', {
      ...env,
      AGENT_PROMPT: `[${prompt.length} chars]`,
    });

    // Create the container bridge to process stdout events
    debugLog('startAgent', 'Creating container bridge', { taskId, sessionId, projectId });
    const bridge = createContainerBridge({
      taskId,
      sessionId,
      projectId,
      streams: this.streams,
      onComplete: (status, turnCount) => {
        infoLog('bridge:onComplete', 'Agent completed via bridge callback', {
          taskId,
          status,
          turnCount,
        });
        this.handleAgentComplete(taskId, status, turnCount);
      },
      onError: (error, turnCount) => {
        infoLog('bridge:onError', 'Agent error via bridge callback', { taskId, error, turnCount });
        this.handleAgentError(taskId, error, turnCount);
      },
    });

    // Publish executing status
    await this.streams
      .publish(sessionId, 'container-agent:status', {
        taskId,
        sessionId,
        stage: 'executing',
        message: 'Starting agent process in container...',
      })
      .catch((e) =>
        debugLog('startAgent', 'Failed to publish executing status', { error: String(e) })
      );

    try {
      // Start the agent-runner process inside the container
      infoLog('startAgent', 'Executing agent-runner in container', {
        sandboxId: sandbox.id,
        cmd: 'node /opt/agent-runner/dist/index.js',
      });

      const execResult = await sandbox.execStream({
        cmd: 'node',
        args: ['/opt/agent-runner/dist/index.js'],
        env: {
          ...env,
          CLAUDE_OAUTH_TOKEN: oauthToken, // Passed to agent-runner to write credentials file
          AGENT_PROMPT: prompt, // Use actual prompt
        },
        cwd: '/workspace',
      });
      debugLog('startAgent', 'Agent-runner process started', { sandboxId: sandbox.id });

      // Track the running agent
      const runningAgent: RunningAgent = {
        taskId,
        sessionId,
        projectId,
        sandboxId: sandbox.id,
        bridge,
        execResult,
        stopFilePath,
        startedAt: new Date(),
        stopRequested: false,
      };

      this.runningAgents.set(taskId, runningAgent);
      infoLog('startAgent', 'Agent registered as running', {
        taskId,
        totalRunning: this.runningAgents.size,
      });

      // Start processing the stdout stream (async, don't await)
      debugLog('startAgent', 'Starting stdout stream processing', { taskId });
      this.processAgentOutput(runningAgent);

      // Publish running status
      await this.streams.publish(sessionId, 'container-agent:status', {
        taskId,
        sessionId,
        stage: 'running',
        message: 'Agent is now running',
      });

      // Publish started event (legacy, for backward compatibility)
      await this.streams.publish(sessionId, 'container-agent:started', {
        taskId,
        sessionId,
        model: agentConfig.model,
        maxTurns: agentConfig.maxTurns,
      });
      infoLog('startAgent', 'Agent started successfully', {
        taskId,
        sessionId,
        model: agentConfig.model,
      });

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      infoLog('startAgent', 'Failed to start agent', { taskId, error: message });
      return err(SandboxErrors.AGENT_START_FAILED(message));
    }
  }

  /**
   * Stop a running agent by writing a sentinel file.
   */
  async stopAgent(taskId: string): Promise<Result<void, SandboxError>> {
    infoLog('stopAgent', 'Stopping agent', { taskId });

    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      infoLog('stopAgent', 'Agent not found in running agents', {
        taskId,
        runningAgents: Array.from(this.runningAgents.keys()),
      });
      return err(SandboxErrors.AGENT_NOT_RUNNING(taskId));
    }

    debugLog('stopAgent', 'Found running agent', {
      taskId,
      sessionId: agent.sessionId,
      sandboxId: agent.sandboxId,
      runningFor: `${Date.now() - agent.startedAt.getTime()}ms`,
    });

    try {
      // Get the sandbox to write the sentinel file
      debugLog('stopAgent', 'Getting sandbox to write sentinel file', {
        sandboxId: agent.sandboxId,
      });
      const sandbox = await this.provider.getById(agent.sandboxId);
      if (sandbox && sandbox.status === 'running') {
        // Write sentinel file to signal agent to stop
        debugLog('stopAgent', 'Writing sentinel file', { stopFilePath: agent.stopFilePath });
        await sandbox.exec('touch', [agent.stopFilePath]);
      } else {
        debugLog('stopAgent', 'Sandbox not available for sentinel file', {
          sandboxExists: !!sandbox,
          status: sandbox?.status,
        });
      }

      // Kill the exec process
      debugLog('stopAgent', 'Killing exec process', { taskId });
      agent.execResult.kill();

      agent.stopRequested = true;

      // Publish cancelled event
      await this.streams.publish(agent.sessionId, 'container-agent:cancelled', {
        taskId,
        sessionId: agent.sessionId,
        turnCount: 0, // Unknown at this point
      });

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      infoLog('stopAgent', 'Failed to stop agent', { taskId, error: message });
      return err(SandboxErrors.AGENT_STOP_FAILED(message));
    }
  }

  /**
   * Check if an agent is running for a task.
   */
  isAgentRunning(taskId: string): boolean {
    return this.runningAgents.has(taskId);
  }

  /**
   * Get running agent info for a task.
   */
  getRunningAgent(
    taskId: string
  ): { projectId: string; sessionId: string; startedAt: Date } | null {
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return null;
    }

    return {
      projectId: agent.projectId,
      sessionId: agent.sessionId,
      startedAt: agent.startedAt,
    };
  }

  /**
   * Get all running agents.
   */
  getRunningAgents(): Array<{
    taskId: string;
    projectId: string;
    sessionId: string;
    startedAt: Date;
  }> {
    return Array.from(this.runningAgents.values()).map((agent) => ({
      taskId: agent.taskId,
      projectId: agent.projectId,
      sessionId: agent.sessionId,
      startedAt: agent.startedAt,
    }));
  }

  /**
   * Process stdout from the agent-runner process.
   */
  private async processAgentOutput(agent: RunningAgent): Promise<void> {
    debugLog('processAgentOutput', 'Starting to process agent output', {
      taskId: agent.taskId,
      sessionId: agent.sessionId,
      sandboxId: agent.sandboxId,
    });

    try {
      // Process the stdout stream through the bridge
      debugLog('processAgentOutput', 'Processing stdout stream through bridge', {
        taskId: agent.taskId,
      });
      await agent.bridge.processStream(agent.execResult.stdout);
      debugLog('processAgentOutput', 'Bridge finished processing stream', { taskId: agent.taskId });

      // Wait for process to exit
      debugLog('processAgentOutput', 'Waiting for process to exit', { taskId: agent.taskId });
      const { exitCode } = await agent.execResult.wait();
      infoLog('processAgentOutput', 'Process exited', { taskId: agent.taskId, exitCode });

      if (this.runningAgents.has(agent.taskId)) {
        if (agent.stopRequested) {
          infoLog('processAgentOutput', 'Agent stopped via cancellation request', {
            taskId: agent.taskId,
            exitCode,
          });
          await this.handleAgentComplete(agent.taskId, 'cancelled', 0);
          return;
        }

        const errorMessage =
          exitCode === 0
            ? 'Agent exited without emitting a completion event'
            : `Agent process exited with code ${exitCode}`;

        infoLog('processAgentOutput', 'Process exit without completion, publishing error', {
          taskId: agent.taskId,
          exitCode,
        });

        await this.streams.publish(agent.sessionId, 'container-agent:error', {
          taskId: agent.taskId,
          sessionId: agent.sessionId,
          error: errorMessage,
          turnCount: 0,
        });

        await this.handleAgentError(agent.taskId, errorMessage, 0);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      infoLog('processAgentOutput', 'Error processing agent output', {
        taskId: agent.taskId,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (this.runningAgents.has(agent.taskId)) {
        if (agent.stopRequested) {
          await this.handleAgentComplete(agent.taskId, 'cancelled', 0);
          return;
        }

        await this.streams.publish(agent.sessionId, 'container-agent:error', {
          taskId: agent.taskId,
          sessionId: agent.sessionId,
          error: message,
          turnCount: 0,
        });

        await this.handleAgentError(agent.taskId, message, 0);
      }
    } finally {
      // Note: Cleanup is handled by handleAgentComplete/handleAgentError callbacks.
      // We intentionally do NOT delete from runningAgents here to avoid race conditions
      // where the callbacks run after this finally block.
      debugLog('processAgentOutput', 'Stream processing finished', {
        taskId: agent.taskId,
        stillRunning: this.runningAgents.has(agent.taskId),
      });
    }
  }

  /**
   * Handle agent completion.
   */
  private async handleAgentComplete(
    taskId: string,
    status: 'completed' | 'turn_limit' | 'cancelled',
    turnCount: number
  ): Promise<void> {
    infoLog('handleAgentComplete', 'Agent completion callback triggered', {
      taskId,
      status,
      turnCount,
    });

    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      debugLog('handleAgentComplete', 'Agent not found in running agents map', {
        taskId,
        runningAgents: Array.from(this.runningAgents.keys()),
      });
      return;
    }

    debugLog('handleAgentComplete', 'Found running agent', {
      taskId,
      sessionId: agent.sessionId,
      sandboxId: agent.sandboxId,
      runDuration: `${Date.now() - agent.startedAt.getTime()}ms`,
    });

    // Update task status based on completion - always clear agentId/sessionId and set lastAgentStatus
    try {
      if (status === 'completed') {
        // Move task to waiting_approval
        debugLog('handleAgentComplete', 'Updating task to waiting_approval (completed)', {
          taskId,
        });
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            agentId: null,
            sessionId: null,
            lastAgentStatus: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
        infoLog('handleAgentComplete', 'Task moved to waiting_approval', { taskId, status });
      } else if (status === 'turn_limit') {
        // Move task to waiting_approval for review
        debugLog('handleAgentComplete', 'Updating task to waiting_approval (turn_limit)', {
          taskId,
        });
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            agentId: null,
            sessionId: null,
            lastAgentStatus: 'turn_limit',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
        infoLog('handleAgentComplete', 'Task moved to waiting_approval (turn limit)', {
          taskId,
          status,
        });
      } else {
        // cancelled - clear agent refs but leave task in current column
        debugLog('handleAgentComplete', 'Task cancelled, clearing agent refs', { taskId });
        await this.db
          .update(tasks)
          .set({
            agentId: null,
            sessionId: null,
            lastAgentStatus: 'cancelled',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ContainerAgentService] Failed to update task status:', {
        taskId,
        status,
        error: errorMessage,
      });
      // Publish error event so UI knows task update failed
      try {
        await this.streams.publish(agent.sessionId, 'container-agent:task-update-failed', {
          taskId,
          sessionId: agent.sessionId,
          error: errorMessage,
          attemptedStatus: status,
        });
      } catch (publishErr) {
        // If we can't even publish the error, just log it
        console.error(
          '[ContainerAgentService] Failed to publish task update error event:',
          publishErr
        );
      }
    }

    // Clean up sentinel file
    try {
      debugLog('handleAgentComplete', 'Cleaning up sentinel file', {
        taskId,
        stopFilePath: agent.stopFilePath,
      });
      const sandbox = await this.provider.getById(agent.sandboxId);
      if (sandbox && sandbox.status === 'running') {
        await sandbox.exec('rm', ['-f', agent.stopFilePath]);
        debugLog('handleAgentComplete', 'Sentinel file removed', { taskId });
      } else {
        debugLog('handleAgentComplete', 'Sandbox not available for cleanup', {
          taskId,
          sandboxExists: !!sandbox,
          status: sandbox?.status,
        });
      }
    } catch (cleanupError) {
      debugLog('handleAgentComplete', 'Failed to cleanup sentinel file (ignoring)', {
        taskId,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    // Remove from running agents
    this.runningAgents.delete(taskId);
    infoLog('handleAgentComplete', 'Agent completion handling finished', {
      taskId,
      remainingAgents: this.runningAgents.size,
    });
  }

  /**
   * Handle agent error.
   */
  private async handleAgentError(taskId: string, error: string, turnCount: number): Promise<void> {
    infoLog('handleAgentError', 'Agent error callback triggered', {
      taskId,
      error,
      turnCount,
    });

    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      // Use infoLog (not debugLog) because missing agent during error handling
      // indicates a potential race condition or cleanup issue worth investigating
      infoLog(
        'handleAgentError',
        'Agent not found in running agents map - possible race condition',
        {
          taskId,
          runningAgents: Array.from(this.runningAgents.keys()),
        }
      );
      return;
    }

    debugLog('handleAgentError', 'Found running agent', {
      taskId,
      sessionId: agent.sessionId,
      sandboxId: agent.sandboxId,
      runDuration: `${Date.now() - agent.startedAt.getTime()}ms`,
    });

    // Update task - clear agent refs on error and set lastAgentStatus
    try {
      debugLog('handleAgentError', 'Clearing agent refs and setting error status', { taskId });
      await this.db
        .update(tasks)
        .set({
          agentId: null,
          sessionId: null,
          lastAgentStatus: 'error',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, taskId));
      debugLog('handleAgentError', 'Task agent refs cleared, status set to error', { taskId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[ContainerAgentService] Failed to update task status:', {
        taskId,
        status: 'error',
        error: errorMessage,
      });
      // Publish error event so UI knows task update failed
      try {
        await this.streams.publish(agent.sessionId, 'container-agent:task-update-failed', {
          taskId,
          sessionId: agent.sessionId,
          error: errorMessage,
          attemptedStatus: 'error',
        });
      } catch (publishErr) {
        // If we can't even publish the error, just log it
        console.error(
          '[ContainerAgentService] Failed to publish task update error event:',
          publishErr
        );
      }
    }

    // Remove from running agents
    this.runningAgents.delete(taskId);
    infoLog('handleAgentError', 'Agent error handling finished', {
      taskId,
      remainingAgents: this.runningAgents.size,
    });
  }
}

/**
 * Create a ContainerAgentService instance.
 */
export function createContainerAgentService(
  db: Database,
  provider: SandboxProvider,
  streams: DurableStreamsService,
  apiKeyService: ApiKeyService
): ContainerAgentService {
  return new ContainerAgentService(db, provider, streams, apiKeyService);
}
