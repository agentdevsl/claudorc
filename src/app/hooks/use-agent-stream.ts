import { useEffect, useMemo, useState } from 'react';
import type { SessionEvent } from '@/services/session.service';

export type AgentStreamChunk = {
  text: string;
  timestamp: number;
};

export function useAgentStream(sessionId: string): {
  chunks: AgentStreamChunk[];
  fullText: string;
  isStreaming: boolean;
} {
  const [chunks, setChunks] = useState<AgentStreamChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);
    setIsStreaming(true);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as SessionEvent;
      if (data.type === 'chunk') {
        setChunks((prev) => [
          ...prev,
          {
            text: (data.data as { text?: string }).text ?? '',
            timestamp: data.timestamp,
          },
        ]);
      }
    };

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      setIsStreaming(false);
      eventSource.close();
    };
  }, [sessionId]);

  const fullText = useMemo(() => chunks.map((chunk) => chunk.text).join(''), [chunks]);

  return { chunks, fullText, isStreaming };
}
