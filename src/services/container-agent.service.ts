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
import { projects } from '../db/schema/projects.js';
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
    private streams: DurableStreamsService
  ) {}

  /**
   * Start an agent for a task inside its project's sandbox container.
   */
  async startAgent(input: StartAgentInput): Promise<Result<void, SandboxError>> {
    const { projectId, taskId, sessionId, prompt, model, maxTurns } = input;

    // Check if agent is already running for this task
    if (this.runningAgents.has(taskId)) {
      return err(SandboxErrors.AGENT_ALREADY_RUNNING(taskId));
    }

    // Get project to find sandbox and config
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return err(SandboxErrors.PROJECT_NOT_FOUND);
    }

    // Get the sandbox for this project
    const sandbox = await this.provider.get(projectId);
    if (!sandbox) {
      return err(SandboxErrors.CONTAINER_NOT_FOUND);
    }

    if (sandbox.status !== 'running') {
      return err(SandboxErrors.CONTAINER_NOT_RUNNING);
    }

    // Check if sandbox supports streaming exec
    if (!sandbox.execStream) {
      return err(SandboxErrors.STREAMING_EXEC_NOT_SUPPORTED);
    }

    // Create stream for this session if it doesn't exist
    try {
      await this.streams.createStream(sessionId, {
        type: 'container-agent',
        projectId,
        taskId,
      });
    } catch {
      // Stream might already exist, which is fine
    }

    // Resolve agent configuration
    const agentConfig: AgentConfig = {
      model: model ?? project.config?.model ?? 'claude-sonnet-4-20250514',
      maxTurns: maxTurns ?? project.config?.maxTurns ?? 50,
    };

    // Create sentinel file path for cancellation
    const stopFilePath = `/tmp/.agent-stop-${taskId}`;

    // Build environment variables for agent-runner
    const env: Record<string, string> = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
      AGENT_TASK_ID: taskId,
      AGENT_SESSION_ID: sessionId,
      AGENT_PROMPT: prompt,
      AGENT_MAX_TURNS: String(agentConfig.maxTurns),
      AGENT_MODEL: agentConfig.model,
      AGENT_CWD: '/workspace',
      AGENT_STOP_FILE: stopFilePath,
    };

    // Create the container bridge to process stdout events
    const bridge = createContainerBridge({
      taskId,
      sessionId,
      projectId,
      streams: this.streams,
      onComplete: (status, turnCount) => {
        this.handleAgentComplete(taskId, status, turnCount);
      },
      onError: (error, turnCount) => {
        this.handleAgentError(taskId, error, turnCount);
      },
    });

    try {
      // Start the agent-runner process inside the container
      const execResult = await sandbox.execStream({
        cmd: 'node',
        args: ['/opt/agent-runner/dist/index.js'],
        env,
        cwd: '/workspace',
      });

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
      };

      this.runningAgents.set(taskId, runningAgent);

      // Start processing the stdout stream (async, don't await)
      this.processAgentOutput(runningAgent);

      // Publish started event
      await this.streams.publish(sessionId, 'container-agent:started', {
        taskId,
        sessionId,
        model: agentConfig.model,
        maxTurns: agentConfig.maxTurns,
      });

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(SandboxErrors.AGENT_START_FAILED(message));
    }
  }

  /**
   * Stop a running agent by writing a sentinel file.
   */
  async stopAgent(taskId: string): Promise<Result<void, SandboxError>> {
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return err(SandboxErrors.AGENT_NOT_RUNNING(taskId));
    }

    try {
      // Get the sandbox to write the sentinel file
      const sandbox = await this.provider.getById(agent.sandboxId);
      if (sandbox && sandbox.status === 'running') {
        // Write sentinel file to signal agent to stop
        await sandbox.exec('touch', [agent.stopFilePath]);
      }

      // Kill the exec process
      agent.execResult.kill();

      // Stop the bridge
      agent.bridge.stop();

      // Clean up
      this.runningAgents.delete(taskId);

      // Publish cancelled event
      await this.streams.publish(agent.sessionId, 'container-agent:cancelled', {
        taskId,
        sessionId: agent.sessionId,
        turnCount: 0, // Unknown at this point
      });

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
    try {
      // Process the stdout stream through the bridge
      await agent.bridge.processStream(agent.execResult.stdout);

      // Wait for process to exit
      const { exitCode } = await agent.execResult.wait();

      if (exitCode !== 0 && this.runningAgents.has(agent.taskId)) {
        // Non-zero exit without completion event - emit error
        await this.streams.publish(agent.sessionId, 'container-agent:error', {
          taskId: agent.taskId,
          sessionId: agent.sessionId,
          error: `Agent process exited with code ${exitCode}`,
          turnCount: 0,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[ContainerAgentService] Error processing agent output for task ${agent.taskId}:`,
        message
      );

      if (this.runningAgents.has(agent.taskId)) {
        await this.streams.publish(agent.sessionId, 'container-agent:error', {
          taskId: agent.taskId,
          sessionId: agent.sessionId,
          error: message,
          turnCount: 0,
        });
      }
    } finally {
      // Clean up running agent entry
      this.runningAgents.delete(agent.taskId);
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
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return;
    }

    console.log(
      `[ContainerAgentService] Agent completed for task ${taskId}: ${status} after ${turnCount} turns`
    );

    // Update task status based on completion
    try {
      if (status === 'completed') {
        // Move task to waiting_approval
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
      } else if (status === 'turn_limit') {
        // Move task to waiting_approval for review
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
      }
      // cancelled - leave task in current state
    } catch (error) {
      console.error(`[ContainerAgentService] Failed to update task ${taskId}:`, error);
    }

    // Clean up sentinel file
    try {
      const sandbox = await this.provider.getById(agent.sandboxId);
      if (sandbox && sandbox.status === 'running') {
        await sandbox.exec('rm', ['-f', agent.stopFilePath]);
      }
    } catch {
      // Ignore cleanup errors
    }

    // Remove from running agents
    this.runningAgents.delete(taskId);
  }

  /**
   * Handle agent error.
   */
  private async handleAgentError(taskId: string, error: string, _turnCount: number): Promise<void> {
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return;
    }

    console.error(`[ContainerAgentService] Agent error for task ${taskId}: ${error}`);

    // Update task with error
    try {
      await this.db
        .update(tasks)
        .set({
          // Keep in in_progress but could add error state
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, taskId));
    } catch (err) {
      console.error(`[ContainerAgentService] Failed to update task ${taskId}:`, err);
    }

    // Remove from running agents
    this.runningAgents.delete(taskId);
  }
}

/**
 * Create a ContainerAgentService instance.
 */
export function createContainerAgentService(
  db: Database,
  provider: SandboxProvider,
  streams: DurableStreamsService
): ContainerAgentService {
  return new ContainerAgentService(db, provider, streams);
}
