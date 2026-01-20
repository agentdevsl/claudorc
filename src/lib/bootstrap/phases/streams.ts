import { createError } from '../../errors/base.js';
import { getDurableStreamsServer } from '../../streams/server.js';
import { setStreamProvider } from '../../streams/provider.js';
import { err, ok } from '../../utils/result.js';

/**
 * Configuration for durable streams
 */
export interface StreamsConfig {
  /** Base URL for stream API endpoints */
  baseUrl?: string;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Initial delay between reconnection attempts (ms) */
  initialReconnectDelay?: number;
  /** Maximum delay between reconnection attempts (ms) */
  maxReconnectDelay?: number;
  /** Backoff multiplier for reconnection delays */
  backoffMultiplier?: number;
}

const DEFAULT_CONFIG: Required<StreamsConfig> = {
  baseUrl: '/api/streams',
  maxReconnectAttempts: 5,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Initialize and connect the durable streams server.
 *
 * This function:
 * 1. Gets or creates the singleton durable streams server
 * 2. Registers it as the global stream provider
 * 3. Returns the server instance for further use
 *
 * Compatible with bootstrap service phase function signature.
 */
export const connectStreams = async (_ctx?: unknown) => {
  const config = DEFAULT_CONFIG;

  try {
    // Get the singleton server instance
    const server = getDurableStreamsServer();

    // Register as the global stream provider
    setStreamProvider(server);

    // Log successful initialization
    console.log('[Streams] Durable streams server initialized', {
      baseUrl: config.baseUrl,
    });

    return ok(server);
  } catch (error) {
    console.error('[Streams] Failed to initialize durable streams:', error);
    return err(
      createError('BOOTSTRAP_STREAMS_FAILED', 'Failed to initialize streams', 500, {
        error: String(error),
      })
    );
  }
};

/**
 * Get the current streams configuration
 */
export function getStreamsConfig(): Required<StreamsConfig> {
  return { ...DEFAULT_CONFIG };
}
