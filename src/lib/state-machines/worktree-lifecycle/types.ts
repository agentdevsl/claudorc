export type WorktreeLifecycleState =
  | 'creating'
  | 'initializing'
  | 'active'
  | 'dirty'
  | 'committing'
  | 'merging'
  | 'conflict'
  | 'removing'
  | 'removed'
  | 'error';

export type WorktreeLifecycleContext = {
  status: WorktreeLifecycleState;
  branch: string;
  path?: string;
  lastActivity: number;
  branchExists: boolean;
  pathAvailable: boolean;
  hasUncommittedChanges: boolean;
  conflictFiles: string[];
};

export type WorktreeLifecycleEvent =
  | { type: 'CREATE' }
  | { type: 'INIT_COMPLETE' }
  | { type: 'MODIFY' }
  | { type: 'COMMIT' }
  | { type: 'MERGE' }
  | { type: 'RESOLVE_CONFLICT' }
  | { type: 'REMOVE' }
  | { type: 'ERROR' };
