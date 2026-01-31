import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { apiClient } from '@/lib/api/client';
import type { AggregateStatus, AlertToast, CliSession, PageState } from './cli-monitor-types';
import { deriveAggregateStatus } from './cli-monitor-utils';

interface CliMonitorContextValue {
  pageState: PageState;
  sessions: CliSession[];
  daemonConnected: boolean;
  aggregateStatus: AggregateStatus;
  alerts: AlertToast[];
  dismissAlert: (id: string) => void;
  connectionError: boolean;
  isOffline: boolean;
}

const CliMonitorContext = createContext<CliMonitorContextValue | null>(null);

export function useCliMonitor(): CliMonitorContextValue {
  const ctx = useContext(CliMonitorContext);
  if (!ctx) throw new Error('useCliMonitor must be used within CliMonitorProvider');
  return ctx;
}

export function CliMonitorProvider({ children }: { children: ReactNode }) {
  const [pageState, setPageState] = useState<PageState>('install');
  const [sessions, setSessions] = useState<CliSession[]>([]);
  const [daemonConnected, setDaemonConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertToast[]>([]);
  const [connectionError, setConnectionError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const eventSourceRef = useRef<EventSource | null>(null);
  const alertTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reconnectCountRef = useRef(0);

  const dismissAlert = useCallback((id: string) => {
    const timer = alertTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      alertTimersRef.current.delete(id);
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAlert = useCallback((alert: Omit<AlertToast, 'id' | 'createdAt'>) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAlert: AlertToast = { ...alert, id, createdAt: Date.now() };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 5));

    if (alert.autoDismiss) {
      const timeout = alert.type === 'new-session' ? 3000 : 5000;
      const timer = setTimeout(() => {
        alertTimersRef.current.delete(id);
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, timeout);
      alertTimersRef.current.set(id, timer);
    }
  }, []);

  // Cleanup alert timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of alertTimersRef.current.values()) {
        clearTimeout(timer);
      }
      alertTimersRef.current.clear();
    };
  }, []);

  // Browser offline/online detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // SSE stream for live updates
  useEffect(() => {
    const streamUrl = apiClient.cliMonitor.getStreamUrl();
    const source = new EventSource(streamUrl);
    eventSourceRef.current = source;

    source.onopen = () => {
      reconnectCountRef.current = 0;
      setConnectionError(false);
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'cli-monitor:snapshot':
            setSessions(data.sessions || []);
            setDaemonConnected(data.connected);
            if (!data.connected) {
              setPageState('install');
            } else if ((data.sessions || []).length === 0) {
              setPageState('waiting');
            } else {
              setPageState('active');
            }
            break;

          case 'cli-monitor:daemon-connected':
            setDaemonConnected(true);
            break;

          case 'cli-monitor:daemon-disconnected':
            setDaemonConnected(false);
            setPageState('install');
            setSessions([]);
            break;

          case 'cli-monitor:session-update': {
            const session = data.session as CliSession;
            setSessions((prev) => {
              const exists = prev.some((s) => s.sessionId === session.sessionId);
              if (exists) {
                return prev.map((s) => (s.sessionId === session.sessionId ? session : s));
              }
              return [...prev, session];
            });
            setPageState('active');

            if (data.previousStatus && data.previousStatus !== session.status) {
              if (session.status === 'waiting_for_approval') {
                addAlert({
                  type: 'approval',
                  title: 'Approval needed',
                  detail: `${session.sessionId.slice(0, 7)} \u2014 ${session.goal || 'Unknown task'}`,
                  sessionId: session.sessionId,
                  autoDismiss: false,
                });
              } else if (session.status === 'waiting_for_input') {
                addAlert({
                  type: 'input',
                  title: 'Input required',
                  detail: `${session.sessionId.slice(0, 7)} \u2014 ${session.goal || 'Unknown task'}`,
                  sessionId: session.sessionId,
                  autoDismiss: false,
                });
              } else if (session.status === 'idle' && data.previousStatus === 'working') {
                addAlert({
                  type: 'complete',
                  title: 'Session completed',
                  detail: `${session.sessionId.slice(0, 7)} \u2014 ${session.goal || 'Unknown task'}`,
                  sessionId: session.sessionId,
                  autoDismiss: true,
                });
              }
            }

            if (!data.previousStatus) {
              addAlert({
                type: 'new-session',
                title: 'New session detected',
                detail: `${session.projectName} \u2014 ${session.goal || session.sessionId.slice(0, 7)}`,
                sessionId: session.sessionId,
                autoDismiss: true,
              });
            }
            break;
          }

          case 'cli-monitor:session-removed':
            setSessions((prev) => {
              const remaining = prev.filter((s) => s.sessionId !== data.sessionId);
              if (remaining.length === 0) setPageState('waiting');
              return remaining;
            });
            break;
        }
      } catch {
        // Invalid JSON
      }
    };

    source.onerror = () => {
      reconnectCountRef.current++;
      if (reconnectCountRef.current >= 5) {
        setConnectionError(true);
      }
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [addAlert]);

  const aggregateStatus = deriveAggregateStatus(sessions);

  return (
    <CliMonitorContext.Provider
      value={{
        pageState,
        sessions,
        daemonConnected,
        aggregateStatus,
        alerts,
        dismissAlert,
        connectionError,
        isOffline,
      }}
    >
      {children}
    </CliMonitorContext.Provider>
  );
}
