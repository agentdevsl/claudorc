import type Database from 'better-sqlite3';
import type { AppError } from '../errors/base.js';
import type { Result } from '../utils/result.js';

export type BootstrapPhase = 'sqlite' | 'schema' | 'collections' | 'streams' | 'github' | 'seeding';

export type BootstrapState = {
  phase: BootstrapPhase;
  progress: number;
  error?: AppError;
  isComplete: boolean;
};

export type BootstrapContext = {
  db?: Database.Database;
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
