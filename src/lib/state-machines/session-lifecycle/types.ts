import type { AppError } from '../../errors/base.js';

export type SessionLifecycleState =
  | 'idle'
  | 'initializing'
  | 'active'
  | 'paused'
  | 'closing'
  | 'closed'
  | 'error';

export type SessionLifecycleContext = {
  status: SessionLifecycleState;
  participants: string[];
  maxParticipants: number;
  lastActivity: number;
  error?: AppError;
};

export type SessionLifecycleEvent =
  | { type: 'INITIALIZE' }
  | { type: 'READY' }
  | { type: 'JOIN'; userId: string }
  | { type: 'LEAVE'; userId: string }
  | { type: 'HEARTBEAT' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CLOSE' }
  | { type: 'TIMEOUT' }
  | { type: 'ERROR'; error: AppError };
