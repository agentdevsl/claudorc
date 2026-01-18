import type { AppError } from '../errors/base.js';
import type { Result } from '../utils/result.js';

// Client-side bootstrap phases (database runs on server, accessed via API)
export type BootstrapPhase = 'client' | 'collections' | 'streams' | 'github';

export type BootstrapState = {
  phase: BootstrapPhase;
  progress: number;
  error?: AppError;
  isComplete: boolean;
};

export type BootstrapContext = {
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
