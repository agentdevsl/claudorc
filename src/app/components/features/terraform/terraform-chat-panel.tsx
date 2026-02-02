import { ArrowUp, Check, Cube, Eraser, Stack } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClarifyingQuestion, ModuleMatch } from '@/lib/terraform/types';
import { PROVIDER_COLORS } from '@/lib/terraform/types';
import { useTerraform } from './terraform-context';

const QUICK_START_PROMPTS = [
  { icon: 'stack' as const, text: 'VPC with private subnets' },
  { icon: 'cube' as const, text: 'EKS cluster with autoscaling' },
  { icon: 'stack' as const, text: 'RDS PostgreSQL database' },
  { icon: 'cube' as const, text: 'S3 bucket with encryption' },
  { icon: 'stack' as const, text: 'Lambda with API Gateway' },
  { icon: 'cube' as const, text: 'IAM roles and policies' },
];

function PromptIcon({ type, className }: { type: 'stack' | 'cube'; className?: string }) {
  return type === 'stack' ? (
    <Stack className={className ?? 'h-3.5 w-3.5'} />
  ) : (
    <Cube className={className ?? 'h-3.5 w-3.5'} />
  );
}

function InlineModuleMatches({ modules }: { modules: ModuleMatch[] }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {modules.map((mod) => (
        <div
          key={mod.moduleId}
          className="flex items-center gap-2 rounded border border-border-muted bg-surface-subtle px-3 py-2 text-xs"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${mod.confidence >= 0.8 ? 'bg-success' : 'bg-attention'}`}
          />
          <span className="font-mono font-medium text-fg">{mod.name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${PROVIDER_COLORS[mod.provider.toLowerCase()] ?? 'bg-surface-emphasis text-fg-muted'}`}
          >
            {mod.provider}
          </span>
          <span className="ml-auto text-[11px] text-fg-subtle">{mod.matchReason}</span>
        </div>
      ))}
    </div>
  );
}

function ClarifyingQuestionsUI({
  questions,
  round,
  totalRounds,
  onSubmit,
  onSkip,
}: {
  questions: ClarifyingQuestion[];
  round: number;
  totalRounds: number;
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg">
          Clarifying Questions ({round}/{totalRounds})
        </span>
        <button type="button" onClick={onSkip} className="text-xs text-fg-muted hover:text-fg">
          Skip
        </button>
      </div>
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.question} className="space-y-1.5">
            <div className="text-xs font-medium text-fg">{q.question}</div>
            <div className="text-[11px] text-fg-subtle">{q.category}</div>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.question]: opt }))}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    answers[q.question] === opt
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-fg-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onSubmit(answers)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        >
          Submit Answers
        </button>
      </div>
    </div>
  );
}

function SuccessBanner({
  moduleCount,
  variableCount,
  outputCount,
}: {
  moduleCount: number;
  variableCount: number;
  outputCount: number;
}) {
  return (
    <div className="mt-3 rounded-md border border-success/30 bg-success-muted p-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
        <Check className="h-3.5 w-3.5" />
        Configuration generated
      </div>
      <div className="mt-1 text-xs text-fg-muted">
        {moduleCount} modules &middot; {variableCount} variables configured &middot; {outputCount}{' '}
        outputs
      </div>
    </div>
  );
}

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
        void handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Welcome state
  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-auto px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(132,79,186,0.15)]">
            <Cube className="h-8 w-8 text-[#844fba]" weight="duotone" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-fg">Compose Infrastructure</h2>
            <p className="mt-1 max-w-md text-sm text-fg-muted">
              Describe what you need in plain English. We'll match your requirements to private
              modules and compose the Terraform configuration.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_START_PROMPTS.map((prompt) => (
              <button
                key={prompt.text}
                type="button"
                onClick={() => void sendMessage(prompt.text)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent hover:text-accent"
              >
                <PromptIcon type={prompt.icon} className="h-3 w-3" />
                {prompt.text}
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
              key={`${msg.role}-${messages.indexOf(msg)}`}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {msg.role === 'user' ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[11px] font-semibold text-accent">
                  SL
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-done-muted text-[11px] font-semibold text-done">
                  AI
                </div>
              )}
              {/* Bubble */}
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[#1f6feb] text-white'
                    : 'border border-border bg-surface text-fg'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                {msg.role === 'assistant' && msg.modules && msg.modules.length > 0 && (
                  <InlineModuleMatches modules={msg.modules} />
                )}
                {msg.role === 'assistant' &&
                  msg.clarifyingQuestions &&
                  msg.clarifyingQuestions.length > 0 && (
                    <ClarifyingQuestionsUI
                      questions={msg.clarifyingQuestions}
                      round={1}
                      totalRounds={1}
                      onSubmit={(answers) => {
                        const answerText = Object.entries(answers)
                          .map(([q, a]) => `${q}: ${a}`)
                          .join('\n');
                        void sendMessage(answerText);
                      }}
                      onSkip={() => void sendMessage('Skip clarifying questions')}
                    />
                  )}
                {msg.role === 'assistant' && msg.successBanner && (
                  <SuccessBanner
                    moduleCount={msg.successBanner.moduleCount}
                    variableCount={msg.successBanner.variableCount}
                    outputCount={msg.successBanner.outputCount}
                  />
                )}
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-done-muted text-[11px] font-semibold text-done">
                AI
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 py-2.5">
                <div className="flex items-center gap-2">
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
                  <span className="text-xs text-fg-muted">Composing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            type="button"
            onClick={resetConversation}
            className="rounded-md p-2 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            title="New conversation"
            aria-label="New conversation"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-end gap-2 rounded-xl border border-border bg-canvas p-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your infrastructure needs..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
              disabled={isStreaming}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1f6feb] text-white transition-colors hover:bg-[#1f6feb]/90 disabled:opacity-50"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
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
}: {
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}): React.JSX.Element {
  return (
    <div className="border-t border-border bg-surface px-6 py-4">
      <div className="flex items-end gap-3 rounded-xl border border-border bg-canvas p-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe your infrastructure needs..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!input.trim() || isStreaming}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1f6feb] text-white transition-colors hover:bg-[#1f6feb]/90 disabled:opacity-50"
          aria-label="Send message"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
