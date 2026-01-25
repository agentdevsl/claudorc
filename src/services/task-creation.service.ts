import { type SDKMessage, unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { projects } from '@/db/schema/projects';
import { type NewTask, tasks } from '@/db/schema/tasks';
import { getTaskCreationModel } from '@/lib/constants/models';
import { DEFAULT_TASK_CREATION_TOOLS } from '@/lib/constants/tools';
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

export interface ClarifyingQuestionOption {
  label: string;
  description?: string;
}

export interface ClarifyingQuestion {
  header: string;
  question: string;
  options: ClarifyingQuestionOption[];
}

export interface PendingQuestions {
  id: string;
  questions: ClarifyingQuestion[];
  round: number;
  totalAsked: number;
  maxQuestions: number;
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
  pendingQuestions: PendingQuestions | null;
  questionRound: number;
  totalQuestionsAsked: number;
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

const SYSTEM_PROMPT = `You are an AI assistant helping users create well-structured tasks for a software project management system.

Your role is to:
1. Understand what the user wants (from their initial message)
2. Use the AskUserQuestion tool to gather 2-5 clarifying questions
3. Generate a high-quality task suggestion based on the user's answers

## Phase 1: Clarifying Questions

When you receive the user's initial request, use the AskUserQuestion tool to ask clarifying questions.
Ask questions that will help you create a better, more specific task. Focus on:
- Scope and boundaries (what's included/excluded)
- Technical approach or implementation preference
- Priority and urgency
- Dependencies or blockers
- Acceptance criteria

Guidelines for questions:
- Keep headers short (1-2 words): "Scope", "Priority", "Approach", "Testing", etc.
- Each question should have 2-4 options
- Options should be mutually exclusive and cover common choices
- Ask 2-5 questions maximum

## Phase 2: Task Suggestion

After receiving answers from AskUserQuestion, generate the task suggestion as a JSON block:

\`\`\`json
{
  "type": "task_suggestion",
  "title": "Short descriptive title (5-10 words)",
  "description": "Detailed task description in markdown format. Include:\\n## Objective\\n- What needs to be done\\n\\n## Requirements\\n- Specific requirements based on answers\\n\\n## Acceptance Criteria\\n- [ ] Criteria 1\\n- [ ] Criteria 2",
  "labels": ["feature"],
  "priority": "medium"
}
\`\`\`

Field guidelines:
- labels: Choose from ["bug", "feature", "enhancement", "docs", "refactor", "test", "research"]
- priority: "high" for urgent/blocking, "medium" for standard, "low" for nice-to-have

CRITICAL: Always use the AskUserQuestion tool first before generating a task suggestion. This ensures high-quality, well-scoped tasks.`;

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

  /** Maximum total questions to ask across all rounds */
  private static readonly MAX_QUESTIONS = 10;

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
    } catch (error) {
      console.error('[TaskCreationService] Failed to parse task suggestion JSON:', error);
      return null;
    }
  }

  /**
   * Parse clarifying questions from assistant response text
   */
  private parseClarifyingQuestions(
    text: string,
    session: TaskCreationSession
  ): PendingQuestions | null {
    // Look for JSON block in the response
    console.log(
      '[TaskCreationService] Attempting to parse clarifying questions from text length:',
      text.length
    );
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      console.log('[TaskCreationService] No JSON block found in response');
      return null;
    }
    console.log('[TaskCreationService] Found JSON block, attempting to parse');

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      console.log('[TaskCreationService] Parsed JSON type:', parsed.type);
      if (parsed.type !== 'clarifying_questions') {
        console.log('[TaskCreationService] Not clarifying_questions type, skipping');
        return null;
      }

      // Validate questions array
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;

      // Validate each question
      const questions: ClarifyingQuestion[] = [];
      for (const q of parsed.questions) {
        if (!q.header || !q.question || !Array.isArray(q.options) || q.options.length === 0) {
          continue;
        }
        questions.push({
          header: q.header,
          question: q.question,
          options: q.options.map((opt: { label?: string; description?: string }) => ({
            label: opt.label || '',
            description: opt.description,
          })),
        });
      }

      if (questions.length === 0) return null;

      return {
        id: createId(),
        questions,
        round: session.questionRound + 1,
        totalAsked: session.totalQuestionsAsked + questions.length,
        maxQuestions: TaskCreationService.MAX_QUESTIONS,
      };
    } catch (error) {
      console.error('[TaskCreationService] Failed to parse clarifying questions JSON:', error);
      return null;
    }
  }

  /**
   * Start a new task creation conversation
   * @param projectId - The project to create a task for
   * @param configuredTools - Optional tools configured in settings (from frontend localStorage)
   */
  async startConversation(
    projectId: string,
    configuredTools?: string[]
  ): Promise<Result<TaskCreationSession, TaskCreationError>> {
    // Verify project exists
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return err(TaskCreationErrors.PROJECT_NOT_FOUND);
    }

    // Create V2 session with task system enabled
    // Use configured tools from settings, ensuring AskUserQuestion is always included
    const taskCreationModel = getTaskCreationModel();
    const baseTools = configuredTools ?? DEFAULT_TASK_CREATION_TOOLS;
    const allowedTools = baseTools.includes('AskUserQuestion')
      ? baseTools
      : [...baseTools, 'AskUserQuestion'];

    const v2Session = unstable_v2_createSession({
      model: taskCreationModel,
      env: { ...process.env, CLAUDE_CODE_ENABLE_TASKS: 'true' },
      allowedTools,
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
      pendingQuestions: null,
      questionRound: 0,
      totalQuestionsAsked: 0,
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

      // Track in-flight tool calls for emitting tool:start/tool:result events
      const inFlightTools = new Map<
        number,
        { id: string; name: string; input: string; startTime: number }
      >();

      // Stream response using V2 API
      for await (const msg of session.v2Session.stream()) {
        // Debug: Log all message types
        console.log(`[TaskCreationService] SDK message type: ${msg.type}`);

        // Capture session ID for resume capability
        if (msg.session_id && !session.sdkSessionId) {
          session.sdkSessionId = msg.session_id;
        }

        // Handle partial streaming messages
        if (msg.type === 'stream_event') {
          const event = msg.event as {
            type: string;
            index?: number;
            content_block?: { type: string; id?: string; name?: string };
            delta?: { type: string; text?: string; partial_json?: string };
            message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
            usage?: { input_tokens?: number; output_tokens?: number };
          };

          // Debug logging for all event types (except text_delta which is too verbose)
          if (event.type !== 'content_block_delta' || event.delta?.type !== 'text_delta') {
            console.log(
              `[TaskCreationService] stream_event: ${event.type}`,
              event.content_block ? `(block: ${event.content_block.type})` : ''
            );
          }

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

          // Handle tool_use content_block_start - emit tool:start event
          if (
            event.type === 'content_block_start' &&
            event.content_block?.type === 'tool_use' &&
            event.index !== undefined
          ) {
            const toolId = event.content_block.id ?? createId();
            const toolName = event.content_block.name ?? 'unknown';

            console.log(
              `[TaskCreationService] Detected tool_use block: ${toolName} (${toolId}), dbSessionId: ${session.dbSessionId}`
            );

            inFlightTools.set(event.index, {
              id: toolId,
              name: toolName,
              input: '',
              startTime: Date.now(),
            });

            // Publish tool:start event to session
            if (session.dbSessionId && this.sessionService) {
              try {
                const publishResult = await this.sessionService.publish(session.dbSessionId, {
                  id: createId(),
                  type: 'tool:start',
                  timestamp: Date.now(),
                  data: {
                    id: toolId,
                    tool: toolName,
                    input: {},
                  },
                });
                if (publishResult.ok) {
                  console.log(
                    `[TaskCreationService] Published tool:start for ${toolName}, offset: ${publishResult.value.offset}`
                  );
                } else {
                  console.error(
                    `[TaskCreationService] Failed to publish tool:start: ${publishResult.error.message}`
                  );
                }
              } catch (error) {
                console.error('[TaskCreationService] Failed to publish tool:start:', error);
              }
            } else {
              console.warn(
                `[TaskCreationService] Cannot publish tool:start - dbSessionId: ${session.dbSessionId}, hasSessionService: ${!!this.sessionService}`
              );
            }
          }

          // Handle input_json_delta - accumulate tool input
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'input_json_delta' &&
            event.delta.partial_json &&
            event.index !== undefined
          ) {
            const toolInfo = inFlightTools.get(event.index);
            if (toolInfo) {
              toolInfo.input += event.delta.partial_json;
            }
          }

          // Handle content_block_stop - emit tool:result event for completed tools
          if (event.type === 'content_block_stop' && event.index !== undefined) {
            const toolInfo = inFlightTools.get(event.index);
            if (toolInfo) {
              const duration = Date.now() - toolInfo.startTime;

              // Parse the accumulated input JSON
              let parsedInput: Record<string, unknown> = {};
              try {
                if (toolInfo.input) {
                  parsedInput = JSON.parse(toolInfo.input);
                }
              } catch {
                console.warn('[TaskCreationService] Failed to parse tool input JSON');
              }

              // Update the tool:start event with parsed input (re-publish with correct input)
              if (session.dbSessionId && this.sessionService) {
                try {
                  // Publish tool:result event
                  await this.sessionService.publish(session.dbSessionId, {
                    id: createId(),
                    type: 'tool:result',
                    timestamp: Date.now(),
                    data: {
                      id: toolInfo.id,
                      tool: toolInfo.name,
                      input: parsedInput,
                      output: null, // Output comes from the actual tool execution, not available here
                      duration,
                      isError: false,
                    },
                  });
                } catch (error) {
                  console.error('[TaskCreationService] Failed to publish tool:result:', error);
                }
              }

              inFlightTools.delete(event.index);
            }
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
            content?: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
          };
          if (message?.model) {
            modelUsed = message.model;
          }
          if (message?.usage) {
            inputTokens = message.usage.input_tokens ?? 0;
            outputTokens = message.usage.output_tokens ?? 0;
          }

          // Extract tool_use blocks from assistant message content
          if (message?.content && session.dbSessionId && this.sessionService) {
            for (const block of message.content) {
              if (block.type === 'tool_use' && block.id && block.name) {
                // Emit tool:start and tool:result for tool_use blocks not seen via streaming
                const toolId = block.id;
                const existingTool = Array.from(inFlightTools.values()).find(
                  (t) => t.id === toolId
                );

                if (!existingTool) {
                  try {
                    const timestamp = Date.now();
                    // Emit tool:start
                    await this.sessionService.publish(session.dbSessionId, {
                      id: createId(),
                      type: 'tool:start',
                      timestamp,
                      data: {
                        id: toolId,
                        tool: block.name,
                        input: (block.input as Record<string, unknown>) ?? {},
                      },
                    });
                    // Emit tool:result immediately (we don't have the actual result)
                    await this.sessionService.publish(session.dbSessionId, {
                      id: createId(),
                      type: 'tool:result',
                      timestamp: timestamp + 1,
                      data: {
                        id: toolId,
                        tool: block.name,
                        input: (block.input as Record<string, unknown>) ?? {},
                        output: null,
                        duration: 0,
                        isError: false,
                      },
                    });
                  } catch (error) {
                    console.error(
                      '[TaskCreationService] Failed to publish tool events from assistant:',
                      error
                    );
                  }
                }
              }
            }
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

        // Handle tool_progress messages - these indicate tool execution in progress
        if (msg.type === 'tool_progress') {
          const progress = msg as {
            tool_use_id: string;
            tool_name: string;
            elapsed_time_seconds: number;
          };

          console.log(
            `[TaskCreationService] Tool progress - ${progress.tool_name} (${progress.tool_use_id}): ${progress.elapsed_time_seconds}s`
          );

          // If we haven't seen this tool yet, emit a tool:start event
          // This handles cases where the tool_use block wasn't captured via stream_event
          const existingTool = Array.from(inFlightTools.values()).find(
            (t) => t.id === progress.tool_use_id
          );
          if (!existingTool && session.dbSessionId && this.sessionService) {
            try {
              await this.sessionService.publish(session.dbSessionId, {
                id: createId(),
                type: 'tool:start',
                timestamp: Date.now(),
                data: {
                  id: progress.tool_use_id,
                  tool: progress.tool_name,
                  input: {},
                },
              });
            } catch (error) {
              console.error(
                '[TaskCreationService] Failed to publish tool:start from progress:',
                error
              );
            }
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

        // Parse clarifying questions from response (takes precedence)
        const questions = this.parseClarifyingQuestions(accumulated, session);
        if (questions) {
          console.log(
            '[TaskCreationService] Parsed clarifying questions:',
            questions.questions.length
          );
          session.pendingQuestions = questions;
          session.questionRound = questions.round;
          session.totalQuestionsAsked = questions.totalAsked;
          session.status = 'waiting_user';

          // Publish questions event
          try {
            await this.streams.publishTaskCreationQuestions(sessionId, {
              sessionId,
              questions,
            });
          } catch (error) {
            console.error('[TaskCreationService] Failed to publish questions:', error);
          }
        } else {
          // Parse suggestion from response (only if no questions)
          const suggestion = this.parseSuggestion(accumulated);
          if (suggestion) {
            session.suggestion = suggestion;
            session.pendingQuestions = null;

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

    // Check if we have a complete suggestion from either session or overrides
    const hasCompleteOverrides = overrides?.title && overrides?.description;
    if (!session.suggestion && !hasCompleteOverrides) {
      console.error('[TaskCreationService] No suggestion available:', {
        sessionId,
        hasSessionSuggestion: !!session.suggestion,
        hasCompleteOverrides,
        overrides,
      });
      return err(TaskCreationErrors.NO_SUGGESTION);
    }

    // Use session suggestion as base, with overrides taking precedence
    // If session.suggestion is null but overrides has complete data, use overrides directly
    const baseSuggestion = session.suggestion ?? {
      title: '',
      description: '',
      labels: [],
      priority: 'medium' as const,
    };
    const finalSuggestion = { ...baseSuggestion, ...overrides };

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
   * Answer clarifying questions and continue the conversation
   */
  async answerQuestions(
    sessionId: string,
    questionsId: string,
    answers: Record<string, string>
  ): Promise<Result<TaskCreationSession, TaskCreationError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(TaskCreationErrors.SESSION_NOT_FOUND);
    }

    if (!session.pendingQuestions || session.pendingQuestions.id !== questionsId) {
      return err({
        code: 'INVALID_QUESTIONS_ID',
        message: 'Questions ID does not match pending questions',
      });
    }

    // Format answers as a message to send to the AI
    const answerLines: string[] = ['Here are my answers to your questions:'];
    for (const [index, answer] of Object.entries(answers)) {
      const question = session.pendingQuestions.questions[Number(index)];
      if (question) {
        answerLines.push(`- ${question.header}: ${answer}`);
      }
    }
    const answerMessage = answerLines.join('\n');

    // Clear pending questions and resume active status
    session.pendingQuestions = null;
    session.status = 'active';

    // Send the answers as a new message
    return this.sendMessage(sessionId, answerMessage);
  }

  /**
   * Skip clarifying questions and generate task with available information
   */
  async skipQuestions(sessionId: string): Promise<Result<TaskCreationSession, TaskCreationError>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return err(TaskCreationErrors.SESSION_NOT_FOUND);
    }

    // Clear pending questions and resume active status
    session.pendingQuestions = null;
    session.status = 'active';

    // Send a message telling the AI to proceed without further questions
    const skipMessage =
      'Please proceed with generating the task based on the information provided so far. No more clarifying questions needed.';

    return this.sendMessage(sessionId, skipMessage);
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
