import { type SDKMessage, unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { projects } from '@/db/schema/projects';
import { type NewTask, tasks } from '@/db/schema/tasks';
import type { Result } from '@/lib/utils/result';
import { err, ok } from '@/lib/utils/result';
import type { Database } from '@/types/database';
import type { DurableStreamsService } from './durable-streams.service';
import type { SessionService } from './session.service';

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskSuggestion {
  title: string;
  description: string;
  labels: string[];
  priority: TaskPriority;
}

export interface TaskCreationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type TaskCreationSessionStatus = 'active' | 'waiting_user' | 'completed' | 'cancelled';

/** V2 Session interface */
interface V2Session {
  send(message: string): Promise<void>;
  stream(): AsyncGenerator<SDKMessage>;
  close(): void;
}

export interface TaskCreationSession {
  id: string;
  projectId: string;
  status: TaskCreationSessionStatus;
  messages: TaskCreationMessage[];
  suggestion: TaskSuggestion | null;
  createdTaskId: string | null;
  createdAt: string;
  completedAt: string | null;
  /** SDK session ID for resuming */
  sdkSessionId: string | null;
  /** V2 session object */
  v2Session: V2Session | null;
  /** Whether system prompt has been sent */
  systemPromptSent: boolean;
  /** Database session ID for history tracking */
  dbSessionId: string | null;
}

export interface TaskCreationError {
  code: string;
  message: string;
}

// ============================================================================
// Error Definitions
// ============================================================================

export const TaskCreationErrors = {
  PROJECT_NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    message: 'Project not found.',
  },
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    message: 'Task creation session not found.',
  },
  NO_SUGGESTION: {
    code: 'NO_SUGGESTION',
    message: 'No task suggestion available to accept.',
  },
  SESSION_COMPLETED: (sessionId: string) => ({
    code: 'SESSION_COMPLETED',
    message: `Session ${sessionId} is already completed.`,
  }),
  API_ERROR: (message: string) => ({
    code: 'API_ERROR',
    message: `Claude API error: ${message}`,
  }),
  DATABASE_ERROR: (operation: string, message: string) => ({
    code: 'DATABASE_ERROR',
    message: `Database ${operation} failed: ${message}`,
  }),
} as const;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an AI assistant helping users create well-structured tasks for a software project management system.

IMPORTANT: You must ALWAYS include a task suggestion JSON block in your VERY FIRST response and every response. Users expect immediate actionable output.

Your role is to:
1. Understand what the user wants (from their message)
2. Generate a task suggestion immediately based on available information
3. Explain any assumptions you made

Response format - ALWAYS include both:
1. A brief explanation (1-2 sentences max)
2. The task suggestion JSON block

ALWAYS respond with a JSON block in this exact format:

\`\`\`json
{
  "type": "task_suggestion",
  "title": "Short descriptive title (5-10 words)",
  "description": "Detailed task description in markdown format. Include:\\n- What needs to be done\\n- Acceptance criteria\\n- Any relevant context",
  "labels": ["feature"],
  "priority": "medium"
}
\`\`\`

Field guidelines:
- labels: Choose from ["bug", "feature", "enhancement", "docs", "refactor", "test", "research"]
- priority: "high" for urgent/blocking, "medium" for standard, "low" for nice-to-have

CRITICAL: Generate the suggestion immediately even with limited information. The user can refine it later. Don't ask clarifying questions - make reasonable assumptions and document them in the description.`;

// ============================================================================
// Service Implementation
// ============================================================================

export type TokenCallback = (delta: string, accumulated: string) => void;

export class TaskCreationService {
  private sessions = new Map<string, TaskCreationSession>();

  constructor(
    private db: Database,
    private streams: DurableStreamsService,
    private sessionService?: SessionService
  ) {}

  /**
   * Parse a task suggestion from assistant response text
   */
  private parseSuggestion(text: string): TaskSuggestion | null {
    // Look for JSON block in the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) return null;

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type !== 'task_suggestion') return null;

      // Validate and extract suggestion
      if (!parsed.title || !parsed.description) return null;

      return {
        title: parsed.title,
        description: parsed.description,
        labels: Array.isArray(parsed.labels) ? parsed.labels : [],
        priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
      };
    } catch {
      return null;
    }
  }

  /**
   * Start a new task creation conversation
   */
  async startConversation(
    projectId: string
  ): Promise<Result<TaskCreationSession, TaskCreationError>> {
    // Verify project exists
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return err(TaskCreationErrors.PROJECT_NOT_FOUND);
    }

    // Create V2 session
    const v2Session = unstable_v2_createSession({
      model: DEFAULT_MODEL,
    });

    // Create our session wrapper
    const sessionId = createId();

    // Create database session for history tracking (if session service is available)
    let dbSessionId: string | null = null;
    if (this.sessionService) {
      try {
        const dbSessionResult = await this.sessionService.create({
          projectId,
          title: 'Task Creation',
        });
        if (dbSessionResult.ok) {
          dbSessionId = dbSessionResult.value.id;
          console.log('[TaskCreationService] Created database session:', dbSessionId);
        } else {
          console.warn(
            '[TaskCreationService] Failed to create database session:',
            dbSessionResult.error
          );
        }
      } catch (error) {
        console.error('[TaskCreationService] Error creating database session:', error);
      }
    }

    const session: TaskCreationSession = {
      id: sessionId,
      projectId,
      status: 'active',
      messages: [],
      suggestion: null,
      createdTaskId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      sdkSessionId: null,
      v2Session: v2Session as V2Session,
      systemPromptSent: false,
      dbSessionId,
    };

    this.sessions.set(sessionId, session);

    // Create stream for real-time events
    try {
      await this.streams.createStream(sessionId, {
        type: 'task-creation',
        projectId,
      });
    } catch (error) {
      console.error('[TaskCreationService] Failed to create stream:', error);
    }

    // Publish session started event
    try {
      await this.streams.publishTaskCreationStarted(sessionId, {
        sessionId,
        projectId,
      });
    } catch (error) {
      console.error('[TaskCreationService] Failed to publish start event:', error);
    }

    return ok(session);
  }

  /**
   * Send a message in the conversation using V2 API
   */
  async sendMessage(
    sessionId: string,
    content: string,
    onToken?: TokenCallback
  ): Promise<Result<TaskCreationSession, TaskCreationError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(TaskCreationErrors.SESSION_NOT_FOUND);
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      return err(TaskCreationErrors.SESSION_COMPLETED(sessionId));
    }

    if (!session.v2Session) {
      return err(TaskCreationErrors.API_ERROR('No active V2 session'));
    }

    // Add user message
    const userMessage: TaskCreationMessage = {
      id: createId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMessage);

    // Publish user message event
    try {
      await this.streams.publishTaskCreationMessage(sessionId, {
        sessionId,
        messageId: userMessage.id,
        role: 'user',
        content,
      });
    } catch (error) {
      console.error('[TaskCreationService] Failed to publish user message:', error);
    }

    // Persist user message to database for session history
    if (session.dbSessionId && this.sessionService) {
      try {
        await this.sessionService.publish(session.dbSessionId, {
          id: userMessage.id,
          type: 'chunk',
          timestamp: Date.now(),
          data: { role: 'user', content },
        });
      } catch (error) {
        console.error('[TaskCreationService] Failed to persist user message:', error);
      }
    }

    try {
      // Build message with system prompt for first message
      let messageToSend = content;
      if (!session.systemPromptSent) {
        messageToSend = `${SYSTEM_PROMPT}\n\n---\n\nUser message: ${content}`;
        session.systemPromptSent = true;
      }

      // Send message using V2 API
      await session.v2Session.send(messageToSend);

      let accumulated = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let modelUsed = '';

      // Stream response using V2 API
      for await (const msg of session.v2Session.stream()) {
        // Capture session ID for resume capability
        if (msg.session_id && !session.sdkSessionId) {
          session.sdkSessionId = msg.session_id;
        }

        // Handle partial streaming messages
        if (msg.type === 'stream_event') {
          const event = msg.event as {
            type: string;
            delta?: { type: string; text?: string };
            message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
            usage?: { input_tokens?: number; output_tokens?: number };
          };

          // Capture message_start for model info (legacy SDK V1 path)
          if (event.type === 'message_start' && event.message) {
            if (event.message.model) {
              modelUsed = event.message.model;
            }
            if (event.message.usage) {
              inputTokens = event.message.usage.input_tokens ?? 0;
            }
          }

          // Capture message_delta for output token usage
          if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens ?? 0;
          }

          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text
          ) {
            const delta = event.delta.text;
            accumulated += delta;

            if (onToken) {
              onToken(delta, accumulated);
            }

            // Publish token event
            try {
              await this.streams.publishTaskCreationToken(sessionId, {
                sessionId,
                delta,
                accumulated,
              });
            } catch (error) {
              console.error('[TaskCreationService] Failed to publish token:', error);
            }
          }
        }

        // Handle complete assistant messages
        if (msg.type === 'assistant') {
          const text = this.getAssistantText(msg);
          if (text) {
            accumulated = text;
          }

          // Extract model and usage from assistant message
          const message = msg.message as {
            model?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          if (message?.model) {
            modelUsed = message.model;
          }
          if (message?.usage) {
            inputTokens = message.usage.input_tokens ?? 0;
            outputTokens = message.usage.output_tokens ?? 0;
          }
        }

        // Handle result messages which may contain usage info
        if (msg.type === 'result') {
          const result = msg as {
            usage?: { input_tokens?: number; output_tokens?: number };
            num_turns?: number;
          };
          if (result.usage) {
            inputTokens = result.usage.input_tokens ?? inputTokens;
            outputTokens = result.usage.output_tokens ?? outputTokens;
          }
        }
      }

      // Log token usage for debugging
      const totalTokens = inputTokens + outputTokens;
      if (totalTokens > 0) {
        console.log(
          `[TaskCreationService] Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Model: ${modelUsed}`
        );
      }

      // Add assistant response if we have content
      if (accumulated) {
        const assistantMessage: TaskCreationMessage = {
          id: createId(),
          role: 'assistant',
          content: accumulated,
          timestamp: new Date().toISOString(),
        };
        session.messages.push(assistantMessage);

        // Publish assistant message
        try {
          await this.streams.publishTaskCreationMessage(sessionId, {
            sessionId,
            messageId: assistantMessage.id,
            role: 'assistant',
            content: assistantMessage.content,
          });
        } catch (error) {
          console.error('[TaskCreationService] Failed to publish assistant message:', error);
        }

        // Persist assistant message to database for session history
        if (session.dbSessionId && this.sessionService) {
          try {
            await this.sessionService.publish(session.dbSessionId, {
              id: assistantMessage.id,
              type: 'chunk',
              timestamp: Date.now(),
              data: {
                role: 'assistant',
                content: accumulated,
                model: modelUsed || undefined,
                usage: totalTokens > 0 ? { inputTokens, outputTokens, totalTokens } : undefined,
              },
            });
          } catch (error) {
            console.error('[TaskCreationService] Failed to persist assistant message:', error);
          }
        }

        // Parse suggestion from response
        const suggestion = this.parseSuggestion(accumulated);
        if (suggestion) {
          session.suggestion = suggestion;

          // Publish suggestion event
          try {
            await this.streams.publishTaskCreationSuggestion(sessionId, {
              sessionId,
              suggestion,
            });
          } catch (error) {
            console.error('[TaskCreationService] Failed to publish suggestion:', error);
          }
        }
      }

      return ok(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        await this.streams.publishTaskCreationError(sessionId, {
          sessionId,
          error: message,
        });
      } catch (streamError) {
        console.error('[TaskCreationService] Failed to publish error:', streamError);
      }

      return err(TaskCreationErrors.API_ERROR(message));
    }
  }

  /**
   * Extract text content from an SDK assistant message
   */
  private getAssistantText(msg: SDKMessage): string | null {
    if (msg.type !== 'assistant') return null;
    return msg.message.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { type: string; text?: string }) => block.text ?? '')
      .join('');
  }

  /**
   * Accept the current suggestion and create a task
   */
  async acceptSuggestion(
    sessionId: string,
    overrides?: Partial<TaskSuggestion>
  ): Promise<Result<{ session: TaskCreationSession; taskId: string }, TaskCreationError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(TaskCreationErrors.SESSION_NOT_FOUND);
    }

    if (!session.suggestion) {
      return err(TaskCreationErrors.NO_SUGGESTION);
    }

    // Merge overrides with suggestion
    const finalSuggestion = { ...session.suggestion, ...overrides };

    // Create the task
    try {
      const taskId = createId();
      const newTask: NewTask = {
        id: taskId,
        projectId: session.projectId,
        title: finalSuggestion.title,
        description: finalSuggestion.description,
        labels: finalSuggestion.labels,
        priority: finalSuggestion.priority,
        column: 'backlog',
        position: 0, // Will be reordered by the task service
      };

      await this.db.insert(tasks).values(newTask);

      // Close V2 session
      if (session.v2Session) {
        try {
          session.v2Session.close();
        } catch (error) {
          console.error('[TaskCreationService] Failed to close V2 session:', error);
        }
        session.v2Session = null;
      }

      // Close database session
      if (session.dbSessionId && this.sessionService) {
        try {
          await this.sessionService.close(session.dbSessionId);
          console.log('[TaskCreationService] Closed database session:', session.dbSessionId);
        } catch (error) {
          console.error('[TaskCreationService] Failed to close database session:', error);
        }
      }

      // Update session
      session.status = 'completed';
      session.createdTaskId = taskId;
      session.completedAt = new Date().toISOString();

      // Publish completion event
      try {
        await this.streams.publishTaskCreationCompleted(sessionId, {
          sessionId,
          taskId,
          suggestion: finalSuggestion,
        });
      } catch (error) {
        console.error('[TaskCreationService] Failed to publish completion event:', error);
      }

      return ok({ session, taskId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(TaskCreationErrors.DATABASE_ERROR('insert', message));
    }
  }

  /**
   * Cancel a task creation session
   */
  async cancel(sessionId: string): Promise<Result<TaskCreationSession, TaskCreationError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(TaskCreationErrors.SESSION_NOT_FOUND);
    }

    // Close V2 session
    if (session.v2Session) {
      try {
        session.v2Session.close();
      } catch (error) {
        console.error('[TaskCreationService] Failed to close V2 session:', error);
      }
      session.v2Session = null;
    }

    // Close database session
    if (session.dbSessionId && this.sessionService) {
      try {
        await this.sessionService.close(session.dbSessionId);
        console.log('[TaskCreationService] Closed database session:', session.dbSessionId);
      } catch (error) {
        console.error('[TaskCreationService] Failed to close database session:', error);
      }
    }

    session.status = 'cancelled';
    session.completedAt = new Date().toISOString();

    try {
      await this.streams.publishTaskCreationCancelled(sessionId, {
        sessionId,
      });
    } catch (error) {
      console.error('[TaskCreationService] Failed to publish cancel event:', error);
    }

    return ok(session);
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): TaskCreationSession | null {
    return this.sessions.get(sessionId) ?? null;
  }
}

/**
 * Create TaskCreationService
 */
export function createTaskCreationService(
  db: Database,
  streams: DurableStreamsService,
  sessionService?: SessionService
): TaskCreationService {
  return new TaskCreationService(db, streams, sessionService);
}
