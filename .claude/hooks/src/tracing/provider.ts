/**
 * Langfuse tracing provider using the v4 SDK with asType support.
 * Initializes OpenTelemetry with LangfuseSpanProcessor for proper observation types.
 */

import { LangfuseClient } from '@langfuse/client';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { setLangfuseTracerProvider } from '@langfuse/tracing';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type { TracingConfig } from './types.js';

// Module-level state
let isInitialized = false;
let provider: NodeTracerProvider | null = null;
let langfuseClient: LangfuseClient | null = null;
let currentConfig: TracingConfig | null = null;

/**
 * Default configuration values.
 */
const DEFAULTS = {
  baseUrl: 'https://cloud.langfuse.com',
  environment: 'development',
  release: 'claude-code',
  serviceName: 'claude-code-langfuse-hook',
  serviceVersion: '2.0.0',
} as const;

/**
 * Create service resource attributes for OpenTelemetry.
 * These are set as environment variables for the Langfuse SDK to pick up.
 *
 * @param environment - The deployment environment (e.g., "development", "production")
 */
function setServiceResourceEnv(environment: string): void {
  // Set OTEL_SERVICE_NAME for OpenTelemetry SDK to use
  // This is the standard way to configure service name in OTEL
  process.env.OTEL_SERVICE_NAME = DEFAULTS.serviceName;
  process.env.OTEL_SERVICE_VERSION = DEFAULTS.serviceVersion;
  process.env.OTEL_DEPLOYMENT_ENVIRONMENT = environment;
}

/**
 * Initialize the Langfuse tracing provider with OpenTelemetry.
 * Must be called before any tracing operations.
 *
 * @param config - Tracing configuration with API keys
 * @returns true if initialization succeeded, false otherwise
 */
export function initTracing(config: TracingConfig): boolean {
  if (isInitialized && provider) {
    return true;
  }

  const {
    publicKey,
    secretKey,
    baseUrl = DEFAULTS.baseUrl,
    environment = DEFAULTS.environment,
    release = DEFAULTS.release,
  } = config;

  if (!publicKey || !secretKey) {
    console.error('[Langfuse] ERROR: Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
    return false;
  }

  try {
    // Set environment variables for Langfuse SDK
    process.env.LANGFUSE_PUBLIC_KEY = publicKey;
    process.env.LANGFUSE_SECRET_KEY = secretKey;
    process.env.LANGFUSE_BASE_URL = baseUrl;
    process.env.LANGFUSE_RELEASE = release;
    process.env.LANGFUSE_ENVIRONMENT = environment;

    // Set service resource attributes via environment variables
    // OTEL_SERVICE_NAME is the standard way to configure service name
    setServiceResourceEnv(environment);

    // Create NodeTracerProvider with LangfuseSpanProcessor
    provider = new NodeTracerProvider({
      spanProcessors: [new LangfuseSpanProcessor()],
    });

    // Set as the Langfuse tracer provider for @langfuse/tracing
    setLangfuseTracerProvider(provider);

    // Create Langfuse client for score recording
    langfuseClient = new LangfuseClient({
      publicKey,
      secretKey,
      baseUrl,
    });

    currentConfig = { ...config, environment, release };
    isInitialized = true;

    console.error(`[Langfuse] Initialized (${release}/${environment})`);

    return true;
  } catch (error) {
    console.error(`[Langfuse] ERROR: Failed to initialize: ${error}`);
    return false;
  }
}

/**
 * Get the current tracing configuration.
 */
export function getTracingConfig(): TracingConfig | null {
  return currentConfig;
}

/**
 * Force flush all pending spans to Langfuse.
 * Call this before process exit to ensure data is exported.
 */
export async function forceFlush(): Promise<void> {
  if (provider) {
    try {
      await provider.forceFlush();
    } catch {
      // Ignore flush errors during shutdown
    }
  }
}

/**
 * Shutdown the tracing provider gracefully.
 * Flushes pending spans and scores, then cleans up resources.
 */
export async function shutdownTracing(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  try {
    // Flush pending spans first
    await forceFlush();
    if (provider) {
      await provider.shutdown();
    }
    // Flush pending scores - important for short-lived processes
    if (langfuseClient) {
      await langfuseClient.score.flush();
    }
  } catch {
    // Ignore shutdown errors
  } finally {
    provider = null;
    langfuseClient = null;
    currentConfig = null;
    isInitialized = false;
  }
}

/**
 * Get the Langfuse client instance for score recording.
 * Returns null if tracing is not initialized.
 */
export function getLangfuseClient(): LangfuseClient | null {
  return langfuseClient;
}

/**
 * Flush pending scores to Langfuse.
 * Call this after recording scores in short-lived processes.
 */
export async function flushScores(): Promise<void> {
  if (langfuseClient) {
    try {
      await langfuseClient.score.flush();
    } catch {
      // Ignore flush errors
    }
  }
}

/**
 * Check if tracing has been initialized.
 */
export function isTracingInitialized(): boolean {
  return isInitialized;
}

/**
 * Create tracing config from environment variables.
 */
export function createConfigFromEnv(): TracingConfig {
  return {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey: process.env.LANGFUSE_SECRET_KEY || '',
    baseUrl: process.env.LANGFUSE_HOST || process.env.LANGFUSE_BASE_URL,
    environment: process.env.LANGFUSE_ENVIRONMENT,
    release: process.env.LANGFUSE_RELEASE,
    debug: process.env.LANGFUSE_LOG_LEVEL === 'DEBUG',
  };
}
