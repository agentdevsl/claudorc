import { err, ok } from '../utils/result.js';
import type { Result } from '../utils/result.js';
import { ValidationErrors } from '../errors/validation-errors.js';
import type { z } from 'zod';

export const parseBody = async <T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<Result<T, ReturnType<typeof ValidationErrors.VALIDATION_ERROR>>> => {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return err(ValidationErrors.VALIDATION_ERROR(parsed.error.issues));
    }
    return ok(parsed.data);
  } catch (error) {
    return err(ValidationErrors.VALIDATION_ERROR([{ path: ['body'], message: String(error) }]));
  }
};

export const parseQuery = <T>(
  params: URLSearchParams,
  schema: z.ZodType<T>
): Result<T, ReturnType<typeof ValidationErrors.VALIDATION_ERROR>> => {
  const raw = Object.fromEntries(params.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return err(ValidationErrors.VALIDATION_ERROR(parsed.error.issues));
  }
  return ok(parsed.data);
};
