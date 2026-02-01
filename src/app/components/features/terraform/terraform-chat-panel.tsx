import { ArrowUp, Eraser, Lightning } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerraform } from './terraform-context';

const QUICK_START_PROMPTS = [
  'I need a VPC with private subnets and NAT gateway',
  'Set up an EKS cluster with managed node groups',
  'Create an S3 bucket with CloudFront distribution',
  'Deploy an RDS PostgreSQL with read replicas',
];

export function TerraformChatPanel(): React.JSX.Element {
  const { messages, isStreaming, sendMessage, resetConversation } = useTerraform();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll must trigger on message changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    await sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Welcome state
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
            <Lightning className="h-8 w-8 text-accent" weight="duotone" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-fg">Terraform Composer</h2>
            <p className="mt-1 max-w-md text-sm text-fg-muted">
              Describe the infrastructure you need and I'll compose Terraform configurations using
              your private modules.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_START_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent hover:text-accent"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
        <ChatInput
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={`${msg.role}-${msg.content.length}-${msg.content.slice(0, 40)}`}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user' ? 'bg-accent text-white' : 'bg-surface-subtle text-fg'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-surface-subtle px-4 py-2.5">
                <div className="flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-fg-muted"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-fg-muted"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-fg-muted"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <button
          type="button"
          onClick={resetConversation}
          className="rounded-md p-2 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          title="New conversation"
          aria-label="New conversation"
        >
          <Eraser className="h-4 w-4" />
        </button>
        <ChatInput
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          inline
        />
      </div>
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  isStreaming,
  onSubmit,
  onKeyDown,
  inputRef,
  inline,
}: {
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  inline?: boolean;
}): React.JSX.Element {
  return (
    <div className={`flex items-end gap-2 ${inline ? 'flex-1' : 'px-4 pb-4'}`}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe the infrastructure you need..."
        rows={1}
        className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        disabled={isStreaming}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!input.trim() || isStreaming}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        aria-label="Send message"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}
