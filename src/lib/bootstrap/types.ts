import type { Database as SQLiteDatabase } from 'better-sqlite3';
import type { AppError } from '../errors/base.js';
import type { Result } from '../utils/result.js';

// Server-side bootstrap phases (includes database initialization)
export type BootstrapPhase =
  | 'sqlite'
  | 'schema'
  | 'seeding'
  | 'client'
  | 'collections'
  | 'streams'
  | 'github';

export type BootstrapState = {
  phase: BootstrapPhase;
  progress: number;
  error?: AppError;
  isComplete: boolean;
};

export type BootstrapContext = {
  db?: SQLiteDatabase;
  collections?: Record<string, unknown>;
  streams?: unknown;
  githubToken?: string;
};

export type BootstrapPhaseConfig = {
  name: BootstrapPhase;
  fn: (ctx: BootstrapContext) => Promise<Result<unknown, AppError>>;
  timeout: number;
  recoverable: boolean;
};

export type BootstrapResult = Result<BootstrapContext, AppError>;
