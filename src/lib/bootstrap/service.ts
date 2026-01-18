import { err, ok } from '../utils/result.js';
import { initializeCollections } from './phases/collections.js';
import { validateGitHub } from './phases/github.js';
import { validateSchema } from './phases/schema.js';
import { seedDefaults } from './phases/seeding.js';
import { initializeSQLite } from './phases/sqlite.js';
import { connectStreams } from './phases/streams.js';
import type {
  BootstrapContext,
  BootstrapPhaseConfig,
  BootstrapResult,
  BootstrapState,
} from './types.js';

type Listener = (state: BootstrapState) => void;

type PhaseResult = {
  name: BootstrapPhaseConfig['name'];
  value: unknown;
};

export class BootstrapService {
  private state: BootstrapState = {
    phase: 'sqlite',
    progress: 0,
    isComplete: false,
  };

  private context: BootstrapContext = {};
  private listeners: Set<Listener> = new Set();
  private phases: BootstrapPhaseConfig[];

  constructor(phases?: BootstrapPhaseConfig[]) {
    this.phases = phases ?? this.createDefaultPhases();
  }

  async run(): Promise<BootstrapResult> {
    const phases = this.phases;

    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      if (!phase) {
        continue;
      }
      this.updateState({
        phase: phase.name,
        progress: (index / phases.length) * 100,
      });

      const result = await this.executeWithTimeout(() => phase.fn(this.context), phase.timeout);

      if (result.ok) {
        this.applyPhaseResult({ name: phase.name, value: result.value });
      } else if (!phase.recoverable) {
        this.updateState({ error: result.error as BootstrapState['error'] });
        return err(result.error as NonNullable<BootstrapState['error']>);
      }
    }

    this.updateState({ isComplete: true, progress: 100 });
    return ok(this.context);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private createDefaultPhases(): BootstrapPhaseConfig[] {
    return [
      { name: 'sqlite', fn: initializeSQLite, timeout: 30000, recoverable: false },
      { name: 'schema', fn: validateSchema, timeout: 30000, recoverable: false },
      { name: 'collections', fn: initializeCollections, timeout: 30000, recoverable: true },
      { name: 'streams', fn: connectStreams, timeout: 30000, recoverable: true },
      { name: 'github', fn: validateGitHub, timeout: 10000, recoverable: true },
      { name: 'seeding', fn: seedDefaults, timeout: 10000, recoverable: true },
    ];
  }

  private applyPhaseResult(result: PhaseResult) {
    switch (result.name) {
      case 'sqlite':
        this.context.db = result.value as BootstrapContext['db'];
        break;
      case 'collections':
        this.context.collections = result.value as BootstrapContext['collections'];
        break;
      case 'streams':
        this.context.streams = result.value as BootstrapContext['streams'];
        break;
      default:
        break;
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<ReturnType<typeof ok<T>> | ReturnType<typeof err>>,
    timeout: number
  ) {
    return Promise.race([
      fn(),
      new Promise<ReturnType<typeof err>>((resolve) => {
        setTimeout(
          () =>
            resolve(
              err({
                code: 'BOOTSTRAP_TIMEOUT',
                message: 'Timeout',
                status: 500,
              })
            ),
          timeout
        );
      }),
    ]);
  }

  private updateState(partial: Partial<BootstrapState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
