import { useEffect, useState } from 'react';
import { useServices } from '@/app/services/service-context';

export type PresenceUser = {
  userId: string;
  lastSeen: number;
  cursor?: { x: number; y: number };
  activeFile?: string;
};

export function usePresence(
  sessionId: string,
  userId: string
): {
  users: PresenceUser[];
} {
  const { sessionService } = useServices();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const result = await sessionService.getActiveUsers(sessionId);
      if (mounted && result.ok) {
        setUsers(result.value as PresenceUser[]);
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 8000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId, sessionService]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void sessionService.updatePresence(sessionId, userId, {});
    }, 15000);

    return () => window.clearInterval(interval);
  }, [sessionId, sessionService, userId]);

  return { users };
}
