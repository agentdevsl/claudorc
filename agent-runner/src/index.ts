#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
/**
 * Agent Runner - Entry point for running Claude Agent SDK inside Docker containers.
 *
 * Environment variables:
 * - ANTHROPIC_API_KEY: Required. API key for Claude.
 * - AGENT_TASK_ID: Required. Task ID being worked on.
 * - AGENT_SESSION_ID: Required. Session ID for event streaming.
 * - AGENT_PROMPT: Required. The task prompt.
 * - AGENT_MAX_TURNS: Optional. Maximum turns (default: 50).
 * - AGENT_MODEL: Optional. Model to use (default: claude-sonnet-4-20250514).
 * - AGENT_CWD: Optional. Working directory (default: /workspace).
 * - AGENT_STOP_FILE: Optional. Sentinel file path for cancellation.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createEventEmitter } from './event-emitter.js';
import { executeTool, getToolSchemas } from './tools/index.js';
import type { ToolContext } from './tools/types.js';

// Configuration from environment
const config = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  taskId: process.env.AGENT_TASK_ID,
  sessionId: process.env.AGENT_SESSION_ID,
  prompt: process.env.AGENT_PROMPT,
  maxTurns: parseInt(process.env.AGENT_MAX_TURNS ?? '50', 10),
  model: process.env.AGENT_MODEL ?? 'claude-sonnet-4-20250514',
  cwd: process.env.AGENT_CWD ?? '/workspace',
  stopFile: process.env.AGENT_STOP_FILE,
};

const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT ?? '/workspace';
const ALLOWED_STOP_ROOTS = [WORKSPACE_ROOT, '/tmp'];

// Validate required configuration
function validateConfig(): void {
  if (!config.apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  if (!config.taskId) {
    throw new Error('AGENT_TASK_ID is required');
  }
  if (!config.sessionId) {
    throw new Error('AGENT_SESSION_ID is required');
  }
  if (!config.prompt) {
    throw new Error('AGENT_PROMPT is required');
  }

  config.cwd = resolveWorkspacePath(config.cwd, WORKSPACE_ROOT);

  if (config.stopFile) {
    config.stopFile = resolveStopFilePath(config.stopFile);
  }
}

function resolveWorkspacePath(path: string, fallbackCwd: string): string {
  const resolved = isAbsolute(path) ? path : resolve(fallbackCwd, path);
  const normalized = resolve(resolved);

  if (!normalized.startsWith(`${WORKSPACE_ROOT}/`) && normalized !== WORKSPACE_ROOT) {
    throw new Error(`AGENT_CWD must be within ${WORKSPACE_ROOT}`);
  }

  return normalized;
}

function resolveStopFilePath(path: string): string {
  const resolved = isAbsolute(path) ? path : resolve('/tmp', path);
  const normalized = resolve(resolved);

  const allowed = ALLOWED_STOP_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  );

  if (!allowed) {
    throw new Error(`AGENT_STOP_FILE must be within ${ALLOWED_STOP_ROOTS.join(' or ')}`);
  }

  return normalized;
}

/**
 * Check if the agent should stop (sentinel file exists).
 */
async function shouldStop(): Promise<boolean> {
  if (!config.stopFile) {
    return false;
  }
  try {
    await access(config.stopFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * System prompt for the agent.
 */
const SYSTEM_PROMPT = `You are an AI assistant helping with software development tasks.

You are running inside a Docker container with access to the project files at /workspace.

Available tools:
- read_file: Read file contents
- write_file: Create or overwrite files
- edit_file: Replace specific text in files (must match exactly)
- bash: Execute shell commands
- glob: Find files matching patterns
- grep: Search for text patterns in files

When working on tasks:
1. First explore the codebase to understand the context
2. Make focused, incremental changes
3. Test your changes when possible
4. Commit related changes together

Be concise and focused. Complete the task thoroughly but efficiently.`;

/**
 * Main agent loop using the Anthropic SDK.
 */
async function runAgent(): Promise<void> {
  validateConfig();

  const client = new Anthropic({ apiKey: config.apiKey });
  // Safe to assert after validateConfig() ensures these are set
  const events = createEventEmitter(config.taskId as string, config.sessionId as string);
  const toolContext: ToolContext = { cwd: config.cwd };

  // Emit started event
  events.started({
    model: config.model,
    maxTurns: config.maxTurns,
  });

  // Build tool schemas for the API
  const tools = getToolSchemas();

  // Initialize conversation with user prompt (safe after validateConfig())
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: config.prompt as string,
    },
  ];

  let turn = 0;
  let accumulatedText = '';

  try {
    while (turn < config.maxTurns) {
      // Check for cancellation
      if (await shouldStop()) {
        events.cancelled(turn);
        return;
      }

      turn++;
      events.turn({
        turn,
        maxTurns: config.maxTurns,
        remaining: config.maxTurns - turn,
      });

      // Make API request with streaming
      const stream = client.messages.stream({
        model: config.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: tools as Anthropic.Tool[],
        messages,
      });

      // Collect response
      let assistantContent: Anthropic.ContentBlock[] = [];

      // Process stream events
      for await (const event of stream) {
        // Check for cancellation during streaming
        if (await shouldStop()) {
          events.cancelled(turn);
          return;
        }

        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta && delta.text) {
            accumulatedText += delta.text;
            events.token({
              delta: delta.text,
              accumulated: accumulatedText,
            });
          }
        }
      }

      // Get final message
      const response = await stream.finalMessage();
      assistantContent = response.content;

      // Extract text content for events
      const textContent = assistantContent
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (textContent) {
        events.message({
          role: 'assistant',
          content: textContent,
        });
      }

      // Add assistant message to conversation
      messages.push({
        role: 'assistant',
        content: assistantContent,
      });

      // Check if we need to handle tool calls
      const toolUseBlocks = assistantContent.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No tool calls - agent is done
        events.complete({
          status: 'completed',
          turnCount: turn,
          result: textContent || 'Task completed',
        });
        return;
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        events.toolStart({
          toolName: toolUse.name,
          toolId: toolUse.id,
          input: toolUse.input as Record<string, unknown>,
        });

        const startTime = Date.now();
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          toolContext
        );
        const durationMs = Date.now() - startTime;

        const hasNonText = result.content.some((c) => c.type !== 'text');
        const resultText = result.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && !!c.text)
          .map((c) => c.text)
          .join('\n');

        const safeResultText = resultText || (hasNonText ? '[Non-text tool result omitted]' : '');

        events.toolResult({
          toolName: toolUse.name,
          toolId: toolUse.id,
          result: safeResultText,
          isError: result.is_error ?? false,
          durationMs,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: safeResultText,
          is_error: result.is_error,
        });
      }

      // Add tool results to conversation
      messages.push({
        role: 'user',
        content: toolResults,
      });
    }

    // Turn limit reached
    events.complete({
      status: 'turn_limit',
      turnCount: turn,
      result: `Turn limit reached (${config.maxTurns}). Task may need manual completion.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Anthropic.APIError ? error.status?.toString() : undefined;

    events.error({
      error: message,
      code,
      turnCount: turn,
    });

    // Exit with error code
    process.exit(1);
  }
}

// Run the agent
runAgent()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    // Fatal error before agent could start
    console.error(
      JSON.stringify({
        type: 'agent:error',
        timestamp: Date.now(),
        taskId: config.taskId ?? 'unknown',
        sessionId: config.sessionId ?? 'unknown',
        data: {
          error: error instanceof Error ? error.message : String(error),
          turnCount: 0,
        },
      })
    );
    process.exit(1);
  });
