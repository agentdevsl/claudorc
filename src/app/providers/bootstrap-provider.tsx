import { createContext, useContext } from 'react';
import type { AppError } from '../../lib/errors/base.js';
import { useBootstrap } from '../../lib/bootstrap/hooks.js';
import type { BootstrapContext } from '../../lib/bootstrap/types.js';

const BootstrapContext = createContext<BootstrapContext | null>(null);

export const BootstrapProvider = ({ children }: { children: React.ReactNode }) => {
  const { state, context, retry } = useBootstrap();

  if (state.error) {
    return <BootstrapErrorUI error={state.error} onRetry={retry} />;
  }

  if (!state.isComplete) {
    return <BootstrapLoadingUI phase={state.phase} progress={state.progress} />;
  }

  return <BootstrapContext.Provider value={context}>{children}</BootstrapContext.Provider>;
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
