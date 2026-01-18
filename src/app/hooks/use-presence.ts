import { useEffect, useState } from 'react';

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
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/presence`);
        const data = await response.json();
        if (mounted && data.ok) {
          setUsers(data.data as PresenceUser[]);
        }
      } catch {
        // API may not be ready
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 8000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    const updatePresence = async () => {
      try {
        await fetch(`/api/sessions/${sessionId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // Ignore presence update errors
      }
    };

    const interval = window.setInterval(updatePresence, 15000);

    return () => window.clearInterval(interval);
  }, [sessionId, userId]);

  return { users };
}
