type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const currentLevelNum = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return (LOG_LEVELS[level] ?? 0) >= currentLevelNum;
}

function formatLog(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  if (data) {
    Object.assign(entry, data);
  }
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', message, data));
    }
  },
  info(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, data));
    }
  },
  warn(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, data));
    }
  },
  error(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, data));
    }
  },
};
