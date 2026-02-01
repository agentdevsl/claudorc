import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export interface ComposeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModuleMatch {
  moduleId: string;
  name: string;
  provider: string;
  version: string;
  source: string;
  confidence: number;
  matchReason: string;
}

export interface TerraformRegistry {
  id: string;
  name: string;
  orgName: string;
  status: 'active' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  syncError: string | null;
  moduleCount: number;
  syncIntervalMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerraformModule {
  id: string;
  registryId: string;
  name: string;
  namespace: string;
  provider: string;
  version: string;
  source: string;
  description: string | null;
  readme?: string | null;
  inputs: unknown[] | null;
  outputs: unknown[] | null;
  dependencies: string[] | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TerraformContextValue {
  messages: ComposeMessage[];
  matchedModules: ModuleMatch[];
  generatedCode: string | null;
  registries: TerraformRegistry[];
  modules: TerraformModule[];
  syncStatus: { lastSynced: string | null; moduleCount: number };
  isStreaming: boolean;
  selectedModuleId: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
  setSelectedModuleId: (id: string | null) => void;
  refreshModules: () => Promise<void>;
  syncRegistry: (id: string) => Promise<void>;
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
  const [registries, setRegistries] = useState<TerraformRegistry[]>([]);
  const [modules, setModules] = useState<TerraformModule[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ComposeMessage[]>([]);
  messagesRef.current = messages;

  const loadRegistries = useCallback(async () => {
    const result = await apiClient.terraform.listRegistries();
    if (result.ok) {
      setRegistries(result.data.items as TerraformRegistry[]);
    }
  }, []);

  const loadModules = useCallback(async () => {
    const result = await apiClient.terraform.listModules({ limit: 200 });
    if (result.ok) {
      setModules(result.data.items as TerraformModule[]);
    }
  }, []);

  // Load registries and modules on mount
  useEffect(() => {
    loadRegistries();
    loadModules();
  }, [loadRegistries, loadModules]);

  const refreshModules = useCallback(async () => {
    await loadModules();
    await loadRegistries();
  }, [loadModules, loadRegistries]);

  const syncRegistry = useCallback(
    async (id: string) => {
      await apiClient.terraform.syncRegistry(id);
      await refreshModules();
    },
    [refreshModules]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      const userMessage: ComposeMessage = { role: 'user', content };
      const updatedMessages = [...messagesRef.current, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);
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

            try {
              const event = JSON.parse(jsonStr);

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
                  break;
              }
            } catch {
              // Ignore parse errors for partial lines
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('[Terraform] Stream error:', error);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming]
  );

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

  const syncStatus = {
    lastSynced: registries[0]?.lastSyncedAt ?? null,
    moduleCount: modules.length,
  };

  return (
    <TerraformContext.Provider
      value={{
        messages,
        matchedModules,
        generatedCode,
        registries,
        modules,
        syncStatus,
        isStreaming,
        selectedModuleId,
        sendMessage,
        resetConversation,
        setSelectedModuleId,
        refreshModules,
        syncRegistry,
      }}
    >
      {children}
    </TerraformContext.Provider>
  );
}
