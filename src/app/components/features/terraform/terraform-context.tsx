import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiClient } from '@/lib/api/client';
import type {
  ComposeEvent,
  ComposeMessage,
  ComposeStage,
  ModuleMatch,
  TerraformModuleView,
  TerraformRegistryView,
} from '@/lib/terraform/types';

interface TerraformContextValue {
  messages: ComposeMessage[];
  matchedModules: ModuleMatch[];
  generatedCode: string | null;
  registries: TerraformRegistryView[];
  modules: TerraformModuleView[];
  syncStatus: { lastSynced: string | null; moduleCount: number };
  isStreaming: boolean;
  composeStage: ComposeStage | null;
  composeComplete: boolean;
  error: string | null;
  selectedModuleId: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  setSelectedModuleId: (id: string | null) => void;
  refreshModules: () => Promise<void>;
  syncRegistry: (id: string) => Promise<void>;
  clearError: () => void;
}

const TerraformContext = createContext<TerraformContextValue | null>(null);

export function useTerraform(): TerraformContextValue {
  const ctx = useContext(TerraformContext);
  if (!ctx) {
    throw new Error('useTerraform must be used within a TerraformProvider');
  }
  return ctx;
}

export function TerraformProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [messages, setMessages] = useState<ComposeMessage[]>([]);
  const [matchedModules, setMatchedModules] = useState<ModuleMatch[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [registries, setRegistries] = useState<TerraformRegistryView[]>([]);
  const [modules, setModules] = useState<TerraformModuleView[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [composeStage, setComposeStage] = useState<ComposeStage | null>(null);
  const [composeComplete, setComposeComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ComposeMessage[]>([]);
  const isStreamingRef = useRef(false);
  messagesRef.current = messages;

  const loadRegistries = useCallback(async () => {
    try {
      const result = await apiClient.terraform.listRegistries();
      if (result.ok) {
        setRegistries(result.data.items as TerraformRegistryView[]);
      } else {
        console.error('[Terraform] Failed to load registries:', result.error);
        setError('Failed to load registries. The backend may be offline.');
      }
    } catch (err) {
      console.error('[Terraform] Network error loading registries:', err);
      setError('Failed to load registries. The backend may be offline.');
    }
  }, []);

  const loadModules = useCallback(async () => {
    try {
      const result = await apiClient.terraform.listModules({ limit: 200 });
      if (result.ok) {
        setModules(result.data.items as TerraformModuleView[]);
      } else {
        console.error('[Terraform] Failed to load modules:', result.error);
        setError('Failed to load modules. The backend may be offline.');
      }
    } catch (err) {
      console.error('[Terraform] Network error loading modules:', err);
      setError('Failed to load modules. The backend may be offline.');
    }
  }, []);

  // Load registries and modules on mount
  useEffect(() => {
    void loadRegistries();
    void loadModules();
  }, [loadRegistries, loadModules]);

  const refreshModules = useCallback(async () => {
    await loadModules();
    await loadRegistries();
  }, [loadModules, loadRegistries]);

  const syncRegistry = useCallback(
    async (id: string) => {
      try {
        const result = await apiClient.terraform.syncRegistry(id);
        if (!result.ok) {
          setError(`Sync failed: ${result.error?.message ?? 'Unknown error'}`);
          return;
        }
        await refreshModules();
      } catch (err) {
        setError(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
        console.error('[Terraform] Sync error:', err);
      }
    },
    [refreshModules]
  );

  const sendMessage = useCallback(async (content: string) => {
    if (isStreamingRef.current) return;

    setError(null);
    setComposeComplete(false);

    const userMessage: ComposeMessage = { role: 'user', content };
    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    isStreamingRef.current = true;
    setComposeStage(null);
    setMatchedModules([]);
    setGeneratedCode(null);

    // Cancel any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    let receivedDone = false;
    let receivedPartialData = false;

    try {
      // Step 1: POST to start the compose job (returns immediately with sessionId)
      const composeUrl = apiClient.terraform.getComposeUrl();
      const startResponse = await fetch(composeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: updatedMessages,
        }),
        signal: abortRef.current.signal,
      });

      if (!startResponse.ok) {
        const errorBody = await startResponse.json().catch(() => null);
        throw new Error(
          errorBody?.error?.message ?? `Compose request failed: ${startResponse.status}`
        );
      }

      const startData = (await startResponse.json()) as {
        ok: boolean;
        data: { sessionId: string };
      };
      const jobSessionId = startData.data.sessionId;

      // Step 2: GET the SSE event stream for this job
      const eventsUrl = apiClient.terraform.getComposeEventsUrl(jobSessionId);
      const eventsResponse = await fetch(eventsUrl, {
        signal: abortRef.current.signal,
      });

      if (!eventsResponse.ok || !eventsResponse.body) {
        throw new Error(`Failed to connect to compose event stream: ${eventsResponse.status}`);
      }

      const reader = eventsResponse.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          let event: ComposeEvent;
          try {
            event = JSON.parse(jsonStr) as ComposeEvent;
          } catch (parseErr) {
            console.warn('[Terraform] Failed to parse SSE data:', jsonStr.slice(0, 100), parseErr);
            continue;
          }

          try {
            switch (event.type) {
              case 'status':
                setComposeStage(event.stage);
                receivedPartialData = true;
                break;

              case 'text':
                assistantContent += event.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    newMessages[newMessages.length - 1] = {
                      ...lastMsg,
                      content: assistantContent,
                    };
                  } else {
                    newMessages.push({ role: 'assistant', content: assistantContent });
                  }
                  return newMessages;
                });
                break;

              case 'modules':
                setMatchedModules(event.modules);
                receivedPartialData = true;
                // Attach modules to the current assistant message
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    newMessages[newMessages.length - 1] = {
                      ...lastMsg,
                      modules: event.modules,
                    };
                  }
                  return newMessages;
                });
                break;

              case 'code':
                setGeneratedCode(event.code);
                break;

              case 'done':
                receivedDone = true;
                sessionIdRef.current = event.sessionId;
                setComposeStage('finalizing');
                setComposeComplete(true);
                if (event.matchedModules) setMatchedModules(event.matchedModules);
                if (event.generatedCode) setGeneratedCode(event.generatedCode);
                break;

              case 'error':
                console.error('[Terraform] Compose error:', event.error);
                setComposeStage(null);
                setComposeComplete(false);
                setError(event.error);
                break;
            }
          } catch (processingError) {
            console.error('[Terraform] Error processing SSE event:', processingError);
          }
        }
      }

      // Flush any remaining data left in the buffer after stream ends
      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith('data: ')) {
          try {
            const event = JSON.parse(remaining.slice(6)) as ComposeEvent;
            switch (event.type) {
              case 'done':
                receivedDone = true;
                sessionIdRef.current = event.sessionId;
                setComposeStage('finalizing');
                setComposeComplete(true);
                if (event.matchedModules) setMatchedModules(event.matchedModules);
                if (event.generatedCode) setGeneratedCode(event.generatedCode);
                break;
              case 'error':
                console.error('[Terraform] Compose error (buffered):', event.error);
                setComposeStage(null);
                setComposeComplete(false);
                setError(event.error);
                break;
              case 'code':
                setGeneratedCode(event.code);
                break;
              case 'modules':
                setMatchedModules(event.modules);
                receivedPartialData = true;
                break;
              case 'text':
                assistantContent += event.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    newMessages[newMessages.length - 1] = { ...lastMsg, content: assistantContent };
                  } else {
                    newMessages.push({ role: 'assistant', content: assistantContent });
                  }
                  return newMessages;
                });
                break;
              case 'status':
                setComposeStage(event.stage);
                receivedPartialData = true;
                break;
            }
          } catch {
            // Ignore parse errors on final buffer remnant
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[Terraform] Stream error:', err);

      const errorMessage = (() => {
        if (err instanceof TypeError && err.message.includes('fetch')) {
          return 'Unable to reach the server. Please check your connection and try again.';
        }
        if (
          err instanceof Error &&
          (err.message.includes('INCOMPLETE_CHUNKED') || err.message.includes('network'))
        ) {
          return receivedPartialData
            ? 'The connection was interrupted, but partial results are shown below.'
            : 'The connection was interrupted before any data was received. Please try again.';
        }
        if (err instanceof Error && err.message.includes('timeout')) {
          return 'The request timed out. The server may be under heavy load — please try again shortly.';
        }
        return receivedPartialData
          ? 'The stream ended unexpectedly, but partial results are shown below.'
          : 'Failed to get a response. Please check your connection and try again.';
      })();

      setError(errorMessage);
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (!receivedDone) {
        setComposeStage(null);
        setComposeComplete(false);
      }
    }
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setMatchedModules([]);
    setGeneratedCode(null);
    setComposeStage(null);
    setComposeComplete(false);
    sessionIdRef.current = undefined;
    isStreamingRef.current = false;
    setIsStreaming(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const syncStatus = useMemo(
    () => ({
      lastSynced: registries[0]?.lastSyncedAt ?? null,
      moduleCount: modules.length,
    }),
    [registries, modules.length]
  );

  const contextValue = useMemo(
    () => ({
      messages,
      matchedModules,
      generatedCode,
      registries,
      modules,
      syncStatus,
      isStreaming,
      composeStage,
      composeComplete,
      error,
      selectedModuleId,
      sendMessage,
      resetConversation,
      setSelectedModuleId,
      refreshModules,
      syncRegistry,
      clearError: () => setError(null),
    }),
    [
      messages,
      matchedModules,
      generatedCode,
      registries,
      modules,
      syncStatus,
      isStreaming,
      composeStage,
      composeComplete,
      error,
      selectedModuleId,
      sendMessage,
      resetConversation,
      refreshModules,
      syncRegistry,
    ]
  );

  return <TerraformContext.Provider value={contextValue}>{children}</TerraformContext.Provider>;
}
