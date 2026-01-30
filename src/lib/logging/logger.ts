/**
 * Structured JSON Logger
 *
 * Provides structured logging with levels, context, and request IDs.
 * Outputs JSON in production, human-readable in development.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  requestId?: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProduction = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatEntry(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Human-readable for development
  const prefix = entry.context ? `[${entry.context}]` : '';
  const reqId = entry.requestId ? ` (req:${entry.requestId.slice(0, 8)})` : '';
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const errStr = entry.error ? ` err=${entry.error.message}` : '';
  return `${entry.level.toUpperCase()} ${prefix}${reqId} ${entry.message}${dataStr}${errStr}`;
}

function serializeError(err: unknown): LogEntry['error'] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      message: err.message,
      stack: err.stack,
      code: (err as { code?: string }).code,
    };
  }
  return { message: String(err) };
}

function log(
  level: LogLevel,
  message: string,
  opts?: { context?: string; requestId?: string; data?: Record<string, unknown>; error?: unknown }
) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: opts?.context,
    requestId: opts?.requestId,
    data: opts?.data,
    error: serializeError(opts?.error),
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Create a logger with a fixed context prefix.
 *
 * @example
 * const log = createLogger('TaskService');
 * log.info('Task created', { data: { taskId: '123' } });
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, opts?: { requestId?: string; data?: Record<string, unknown> }) =>
      log('debug', message, { ...opts, context }),
    info: (message: string, opts?: { requestId?: string; data?: Record<string, unknown> }) =>
      log('info', message, { ...opts, context }),
    warn: (
      message: string,
      opts?: { requestId?: string; data?: Record<string, unknown>; error?: unknown }
    ) => log('warn', message, { ...opts, context }),
    error: (
      message: string,
      opts?: { requestId?: string; data?: Record<string, unknown>; error?: unknown }
    ) => log('error', message, { ...opts, context }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
