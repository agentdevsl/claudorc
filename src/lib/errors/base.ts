export interface AppError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

export const createError = (
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): AppError => ({
  code,
  message,
  status,
  details,
});

export class AppErrorClass extends Error implements AppError {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
