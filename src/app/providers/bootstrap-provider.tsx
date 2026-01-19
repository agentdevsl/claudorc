import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createContext, useContext, useMemo } from 'react';
import { ServiceProvider } from '@/app/services/service-context';
import { createServices } from '@/app/services/services';
import { sqlite } from '@/db/client.js';
import * as schema from '@/db/schema/index.js';
import type { DurableStreamsServer } from '@/services/session.service';
import { useBootstrap } from '../../lib/bootstrap/hooks.js';
import type { BootstrapContext as BootstrapContextType } from '../../lib/bootstrap/types.js';
import type { AppError } from '../../lib/errors/base.js';

const BootstrapContext = createContext<BootstrapContextType | null>(null);

export const BootstrapProvider = ({ children }: { children: React.ReactNode }) => {
  const { state, context, retry } = useBootstrap();

  if (state.error) {
    return <BootstrapErrorUI error={state.error} onRetry={retry} />;
  }

  if (!state.isComplete || !context) {
    return <BootstrapLoadingUI phase={state.phase} progress={state.progress} />;
  }

  return (
    <BootstrapProviderInner context={context} retry={retry}>
      {children}
    </BootstrapProviderInner>
  );
};

// Check if running in browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const BootstrapProviderInner = ({
  context,
  retry,
  children,
}: {
  context: BootstrapContextType;
  retry: () => Promise<void>;
  children: React.ReactNode;
}) => {
  const servicesResult = useMemo(() => {
    // Client mode - no database needed, data access goes through API endpoints
    if (isBrowser || !sqlite) {
      return { ok: true as const, value: null };
    }
    // Server mode - create services with database
    const db = drizzle(sqlite, { schema });
    const streams = (context.streams as DurableStreamsServer) ?? {
      createStream: async () => undefined,
      publish: async () => undefined,
      subscribe: async function* () {
        yield { type: 'chunk', data: {} };
      },
    };
    return createServices({ db, streams });
  }, [context]);

  if (!servicesResult.ok) {
    return <BootstrapErrorUI error={servicesResult.error} onRetry={retry} />;
  }

  // Render with ServiceProvider (null on client, services on server)
  return (
    <BootstrapContext.Provider value={context}>
      <ServiceProvider services={servicesResult.value}>{children}</ServiceProvider>
    </BootstrapContext.Provider>
  );
};

export const useBootstrapContext = () => {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error('useBootstrapContext must be used within BootstrapProvider');
  }
  return context;
};

type LoadingProps = {
  phase: string;
  progress: number;
};

type ErrorProps = {
  error: AppError;
  onRetry: () => Promise<void>;
};

const BootstrapLoadingUI = ({ phase, progress }: LoadingProps) => (
  <div>
    <p>Bootstrapping: {phase}</p>
    <p>{Math.round(progress)}%</p>
  </div>
);

const BootstrapErrorUI = ({ error, onRetry }: ErrorProps) => (
  <div>
    <p>Bootstrap error: {error.message}</p>
    <button type="button" onClick={onRetry}>
      Retry
    </button>
  </div>
);
