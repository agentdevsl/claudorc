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
      }
    } catch (err) {
      console.error('[Terraform] Network error loading registries:', err);
    }
  }, []);

  const loadModules = useCallback(async () => {
    try {
      const result = await apiClient.terraform.listModules({ limit: 200 });
      if (result.ok) {
        setModules(result.data.items as TerraformModuleView[]);
      } else {
        console.error('[Terraform] Failed to load modules:', result.error);
      }
    } catch (err) {
      console.error('[Terraform] Network error loading modules:', err);
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

    const userMessage: ComposeMessage = { role: 'user', content };
    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    isStreamingRef.current = true;
    setMatchedModules([]);
    setGeneratedCode(null);

    // Cancel any existing stream
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const composeUrl = apiClient.terraform.getComposeUrl();
      const response = await fetch(composeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages: updatedMessages,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Compose request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
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
          } catch {
            // Expected for partial SSE lines, will be completed in next chunk
            continue;
          }

          try {
            switch (event.type) {
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
                break;

              case 'code':
                setGeneratedCode(event.code);
                break;

              case 'done':
                sessionIdRef.current = event.sessionId;
                if (event.matchedModules) setMatchedModules(event.matchedModules);
                if (event.generatedCode) setGeneratedCode(event.generatedCode);
                break;

              case 'error':
                console.error('[Terraform] Compose error:', event.error);
                setError(event.error);
                break;
            }
          } catch (processingError) {
            console.error('[Terraform] Error processing SSE event:', processingError);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('[Terraform] Stream error:', error);
    } finally {
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setMatchedModules([]);
    setGeneratedCode(null);
    sessionIdRef.current = undefined;
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
