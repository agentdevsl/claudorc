import type { PGlite } from '@electric-sql/pglite';
import type { AppError } from '../errors/base.js';
import type { Result } from '../utils/result.js';

export type BootstrapPhase = 'pglite' | 'schema' | 'collections' | 'streams' | 'github' | 'seeding';

export type BootstrapState = {
  phase: BootstrapPhase;
  progress: number;
  error?: AppError;
  isComplete: boolean;
};

export type BootstrapContext = {
  db?: PGlite;
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
