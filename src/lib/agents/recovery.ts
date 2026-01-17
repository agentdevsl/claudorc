export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /rate limit/i,
    /timeout/i,
    /connection reset/i,
    /ECONNREFUSED/,
    /ETIMEDOUT/,
    /503/,
    /529/,
    /overloaded/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(error.message));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return { ok: true, value: result };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        return { ok: false, error: lastError };
      }

      if (attempt < opts.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
      }
    }
  }

  return { ok: false, error: lastError };
}

export interface AgentExecutionContext {
  agentId: string;
  taskId: string;
  maxTurns: number;
  currentTurn: number;
}

export type RecoveryAction = 'retry' | 'pause' | 'fail';

export interface RecoveryResult {
  shouldRetry: boolean;
  action: RecoveryAction;
  message: string;
}

export function handleAgentError(error: Error, context: AgentExecutionContext): RecoveryResult {
  const errorMessage = error.message.toLowerCase();

  // Rate limit - pause and retry later
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return {
      shouldRetry: true,
      action: 'pause',
      message: 'Rate limited. Agent will resume after cooldown.',
    };
  }

  // Turn limit reached - expected completion
  if (context.currentTurn >= context.maxTurns) {
    return {
      shouldRetry: false,
      action: 'pause',
      message: `Turn limit reached (${context.maxTurns}). Task moved to waiting approval.`,
    };
  }

  // Context length exceeded - summarize and continue
  if (errorMessage.includes('context length') || errorMessage.includes('token limit')) {
    return {
      shouldRetry: true,
      action: 'retry',
      message: 'Context limit reached. Conversation will be summarized.',
    };
  }

  // Network errors - retry
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout')
  ) {
    return {
      shouldRetry: true,
      action: 'retry',
      message: 'Network error. Retrying...',
    };
  }

  // Unknown error - fail
  return {
    shouldRetry: false,
    action: 'fail',
    message: `Agent execution failed: ${error.message}`,
  };
}
