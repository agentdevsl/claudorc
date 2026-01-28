#!/usr/bin/env node
import { access, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
/**
 * Agent Runner - Entry point for running Claude Agent SDK inside Docker containers.
 *
 * Environment variables:
 * - CLAUDE_OAUTH_TOKEN: Required. OAuth token for Claude authentication.
 * - AGENT_TASK_ID: Required. Task ID being worked on.
 * - AGENT_SESSION_ID: Required. Session ID for event streaming.
 * - AGENT_PROMPT: Required. The task prompt.
 * - AGENT_MAX_TURNS: Optional. Maximum turns (default: 50).
 * - AGENT_MODEL: Optional. Model to use (default: claude-sonnet-4-20250514).
 * - AGENT_CWD: Optional. Working directory (default: /workspace).
 * - AGENT_STOP_FILE: Optional. Sentinel file path for cancellation.
 *
 * The OAuth token is written to ~/.claude/.credentials.json before starting the SDK.
 * This is required because OAuth tokens passed via ANTHROPIC_API_KEY env var are blocked.
 */
import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';
import { createEventEmitter } from './event-emitter.js';

// Configuration from environment
const config = {
  oauthToken: process.env.CLAUDE_OAUTH_TOKEN,
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
  if (!config.oauthToken) {
    throw new Error('CLAUDE_OAUTH_TOKEN is required');
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

/**
 * Write OAuth credentials to ~/.claude/.credentials.json
 * The Claude Agent SDK reads this file for authentication.
 * OAuth tokens passed via ANTHROPIC_API_KEY env var are blocked by the API.
 */
async function writeCredentialsFile(): Promise<void> {
  const home = homedir();
  const claudeDir = join(home, '.claude');
  const credentialsFile = join(claudeDir, '.credentials.json');

  const credentials = {
    claudeAiOauth: {
      accessToken: config.oauthToken,
      refreshToken: '',
      expiresAt: Date.now() + 86400000, // 24h
      scopes: ['user:inference', 'user:profile', 'user:sessions:claude_code'],
      subscriptionType: 'max',
    },
  };

  // Create .claude directory
  await mkdir(claudeDir, { recursive: true, mode: 0o700 });

  // Write credentials file
  await writeFile(credentialsFile, JSON.stringify(credentials), { mode: 0o600 });

  console.error(`[agent-runner] Wrote credentials to ${credentialsFile}`);
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
 * Main agent loop using the Claude Agent SDK.
 */
async function runAgent(): Promise<void> {
  validateConfig();

  // Write OAuth credentials to ~/.claude/.credentials.json
  // This must be done before creating the SDK session
  await writeCredentialsFile();

  // Safe to assert after validateConfig() ensures these are set
  const events = createEventEmitter(config.taskId as string, config.sessionId as string);

  // Emit started event
  events.started({
    model: config.model,
    maxTurns: config.maxTurns,
  });

  // Create Claude Agent SDK session
  // The SDK reads auth from ~/.claude/.credentials.json
  const session = unstable_v2_createSession({
    model: config.model,
    env: { ...process.env },
  });

  let turn = 0;
  let accumulatedText = '';

  try {
    // Send the initial prompt
    await session.send(config.prompt as string);

    // Process the stream
    for await (const msg of session.stream()) {
      // Check for cancellation
      if (await shouldStop()) {
        events.cancelled(turn);
        session.close();
        return;
      }

      // Handle different message types
      if (msg.type === 'stream_event') {
        const event = msg.event as {
          type: string;
          delta?: { type: string; text?: string };
          message?: { model?: string };
        };

        // Track turns on message_start
        if (event.type === 'message_start') {
          turn++;
          events.turn({
            turn,
            maxTurns: config.maxTurns,
            remaining: config.maxTurns - turn,
          });

          // Check turn limit
          if (turn >= config.maxTurns) {
            events.complete({
              status: 'turn_limit',
              turnCount: turn,
              result: `Turn limit reached (${config.maxTurns}). Task may need manual completion.`,
            });
            session.close();
            return;
          }
        }

        // Capture text deltas
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          const delta = event.delta.text;
          accumulatedText += delta;
          events.token({
            delta,
            accumulated: accumulatedText,
          });
        }
      }

      // Handle assistant messages
      if (msg.type === 'assistant') {
        const text = getAssistantText(msg);
        if (text) {
          events.message({
            role: 'assistant',
            content: text,
          });
        }
      }

      // Handle result (completion)
      if (msg.type === 'result') {
        const result = msg as { text?: string };
        events.complete({
          status: 'completed',
          turnCount: turn,
          result: result.text ?? (accumulatedText || 'Task completed'),
        });
        session.close();
        return;
      }
    }

    // Stream ended without explicit result
    events.complete({
      status: 'completed',
      turnCount: turn,
      result: accumulatedText || 'Task completed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    events.error({
      error: message,
      code: undefined,
      turnCount: turn,
    });

    // Exit with error code
    process.exit(1);
  } finally {
    session.close();
  }
}

/**
 * Extract text content from an assistant message.
 */
function getAssistantText(msg: unknown): string | null {
  const message = (msg as { message?: unknown }).message as {
    content?: Array<{ type: string; text?: string }>;
  };

  if (!message?.content) return null;

  const textBlocks = message.content.filter(
    (block): block is { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string'
  );

  return textBlocks.map((b) => b.text).join('') || null;
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
