import type { AppError } from '../errors/base.js';

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: Omit<AppError, 'status'>;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const success = <T>(data: T): ApiSuccess<T> => ({
  ok: true,
  data,
});

export const failure = (error: AppError): ApiFailure => ({
  ok: false,
  error: {
    code: error.code,
    message: error.message,
    details: error.details,
  },
});
