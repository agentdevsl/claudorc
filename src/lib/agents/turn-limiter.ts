import type { SessionEvent } from '../../services/session.service.js';

export interface TurnLimiterOptions {
  maxTurns: number;
  warningThreshold: number; // Percentage (e.g., 0.8 for 80%)
  onWarning: (turn: number, maxTurns: number) => void;
  onLimitReached: (turn: number) => void;
}

export class TurnLimiter {
  private currentTurn = 0;

  constructor(
    _agentId: string,
    private options: TurnLimiterOptions
  ) {}

  incrementTurn(): { canContinue: boolean; warning: boolean } {
    this.currentTurn++;

    const warningTurn = Math.floor(this.options.maxTurns * this.options.warningThreshold);
    const isWarning = this.currentTurn === warningTurn;
    const isLimitReached = this.currentTurn >= this.options.maxTurns;

    if (isWarning) {
      this.options.onWarning(this.currentTurn, this.options.maxTurns);
    }

    if (isLimitReached) {
      this.options.onLimitReached(this.currentTurn);
    }

    return {
      canContinue: !isLimitReached,
      warning: isWarning,
    };
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getRemainingTurns(): number {
    return this.options.maxTurns - this.currentTurn;
  }
}

export function createTurnLimiter(
  agentId: string,
  sessionId: string,
  maxTurns: number,
  sessionService: {
    publish: (sessionId: string, event: SessionEvent) => Promise<unknown>;
  }
): TurnLimiter {
  return new TurnLimiter(agentId, {
    maxTurns,
    warningThreshold: 0.8,
    onWarning: (turn, max) => {
      sessionService.publish(sessionId, {
        id: crypto.randomUUID(),
        type: 'agent:warning',
        timestamp: Date.now(),
        data: {
          agentId,
          status: 'running',
          turn,
          warning: `Approaching turn limit: ${turn}/${max}`,
        },
      });
    },
    onLimitReached: (turn) => {
      sessionService.publish(sessionId, {
        id: crypto.randomUUID(),
        type: 'agent:turn_limit',
        timestamp: Date.now(),
        data: {
          agentId,
          status: 'paused',
          turn,
          message: `Turn limit reached (${turn}). Awaiting approval.`,
        },
      });
    },
  });
}
