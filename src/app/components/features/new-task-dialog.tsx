import {
  ArrowRight,
  Check,
  Lightning,
  Notebook,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  Spinner,
  User,
  Warning,
  X,
} from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TaskMode } from '@/db/schema/tasks';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { getLabelColors, PRIORITY_CONFIG, type Priority } from './kanban-board/constants';
import { useTaskCreation, type Message, type TaskSuggestion } from './new-task-dialog/use-task-creation';

// ============================================================================
// TYPES
// ============================================================================

interface NewTaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
}

// SuggestedTask type for local editing state (extends TaskSuggestion with Priority type)
interface EditableSuggestion {
  title: string;
  description: string;
  labels: string[];
  priority: Priority;
  mode: TaskMode;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVAILABLE_LABELS = ['bug', 'feature', 'enhancement', 'docs', 'refactor', 'test'];

const INITIAL_SUGGESTIONS = [
  'Add user authentication with OAuth',
  'Fix the dashboard loading performance',
  'Create API documentation',
  'Refactor the database queries',
];

const DEFAULT_SUGGESTION: EditableSuggestion = {
  title: '',
  description: '',
  labels: [],
  priority: 'medium',
  mode: 'implement',
};


// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Typing indicator for AI response
 */
function TypingIndicator(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-secondary/60"
          style={{
            animation: 'bounce 1.4s infinite ease-in-out both',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Chat message bubble
 */
function MessageBubble({ message }: { message: Message }): React.JSX.Element {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-accent/10 text-accent border border-accent/20'
            : 'bg-secondary/10 text-secondary border border-secondary/20'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" weight="bold" />
        ) : (
          <Sparkle className="h-4 w-4" weight="fill" />
        )}
      </div>

      {/* Message */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5',
          isUser
            ? 'rounded-tr-md bg-accent text-white'
            : 'rounded-tl-md bg-surface-muted border border-border'
        )}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
      </div>
    </div>
  );
}

/**
 * Streaming message bubble (shows content as it streams)
 */
function StreamingBubble({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
        <Sparkle className="h-4 w-4" weight="fill" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-surface-muted border border-border px-4 py-2.5">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {content}
          <span className="inline-block w-2 h-4 ml-0.5 bg-secondary/60 animate-pulse" />
        </p>
      </div>
    </div>
  );
}

/**
 * Suggestion card showing the generated task
 */
function SuggestionCard({
  suggestion,
  onAccept,
  onEdit,
}: {
  suggestion: TaskSuggestion;
  onAccept: () => void;
  onEdit: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-11 mt-3 rounded-xl border border-secondary/30 bg-secondary/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-1">
            Suggested Task
          </p>
          <h4 className="font-semibold text-fg">{suggestion.title}</h4>
        </div>
        <div className="flex items-center gap-1">
          {suggestion.labels.map((label) => {
            const colors = getLabelColors(label);
            return (
              <span
                key={label}
                className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', colors.bg, colors.text)}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-fg-muted line-clamp-3 mb-4">
        {suggestion.description.slice(0, 150)}...
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded',
            suggestion.mode === 'plan' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'
          )}>
            {suggestion.mode === 'plan' ? <Notebook className="h-3 w-3" /> : <Lightning className="h-3 w-3" />}
            {suggestion.mode === 'plan' ? 'Plan' : 'Implement'}
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded',
            PRIORITY_CONFIG[suggestion.priority].color.replace('bg-', 'bg-opacity-20 text-')
          )}>
            {suggestion.priority}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 text-xs font-medium text-fg-muted hover:text-fg border border-border rounded-lg hover:bg-surface-muted transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-secondary hover:bg-secondary/90 rounded-lg transition-colors"
          >
            <Check className="h-3 w-3" weight="bold" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Quick suggestion chips
 */
function QuickSuggestions({
  onSelect,
  onCreateManually,
}: {
  onSelect: (text: string) => void;
  onCreateManually: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-t border-border">
      <div className="flex flex-wrap gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle mr-2 self-center">
          Try:
        </span>
        {INITIAL_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium',
              'bg-surface-muted border border-border text-fg-muted',
              'hover:bg-surface hover:text-fg hover:border-fg-subtle',
              'transition-colors duration-150'
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onCreateManually}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium',
            'text-fg-muted hover:text-fg',
            'transition-colors duration-150'
          )}
        >
          or <span className="underline">create manually</span> without AI
        </button>
      </div>
    </div>
  );
}

/**
 * Mode selector (minimal version for edit panel)
 */
function ModeSelector({
  value,
  onChange,
}: {
  value: TaskMode;
  onChange: (mode: TaskMode) => void;
}): React.JSX.Element {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange('plan')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
          value === 'plan'
            ? 'bg-secondary/15 text-secondary border border-secondary/30'
            : 'bg-surface-muted text-fg-muted border border-border hover:text-fg'
        )}
      >
        <Notebook weight={value === 'plan' ? 'fill' : 'regular'} className="h-4 w-4" />
        Plan
      </button>
      <button
        type="button"
        onClick={() => onChange('implement')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
          value === 'implement'
            ? 'bg-accent/15 text-accent border border-accent/30'
            : 'bg-surface-muted text-fg-muted border border-border hover:text-fg'
        )}
      >
        <Lightning weight={value === 'implement' ? 'fill' : 'regular'} className="h-4 w-4" />
        Implement
      </button>
    </div>
  );
}

/**
 * Edit panel for refining the task
 */
function EditPanel({
  suggestion,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
}: {
  suggestion: EditableSuggestion;
  onChange: (updates: Partial<EditableSuggestion>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}): React.JSX.Element {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>
        <div>
          <h3 className="text-base font-semibold text-fg">Refine Task</h3>
          <p className="text-xs text-fg-muted">Edit the details before creating</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <label
            htmlFor="task-title-input"
            className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle"
          >
            Title
          </label>
          <input
            id="task-title-input"
            type="text"
            value={suggestion.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={cn(
              'w-full h-10 px-3 rounded-lg',
              'bg-surface-muted border border-border text-sm text-fg',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
            )}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label
            htmlFor="task-description-input"
            className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle"
          >
            Description
          </label>
          <textarea
            id="task-description-input"
            value={suggestion.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={8}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg resize-none',
              'bg-surface-muted border border-border text-sm text-fg',
              'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'
            )}
          />
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Execution Mode
          </span>
          <ModeSelector value={suggestion.mode} onChange={(mode) => onChange({ mode })} />
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Priority
          </span>
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as Priority[]).map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => onChange({ priority })}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all border',
                  suggestion.priority === priority
                    ? cn(
                        priority === 'high' && 'bg-danger/10 text-danger border-danger/30',
                        priority === 'medium' && 'bg-attention/10 text-attention border-attention/30',
                        priority === 'low' && 'bg-success/10 text-success border-success/30'
                      )
                    : 'bg-surface-muted text-fg-muted border-border hover:text-fg'
                )}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Labels
          </span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_LABELS.map((label) => {
              const colors = getLabelColors(label);
              const isSelected = suggestion.labels.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange({
                      labels: isSelected
                        ? suggestion.labels.filter((l) => l !== label)
                        : [...suggestion.labels, label],
                    });
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    colors.bg,
                    colors.text,
                    isSelected ? 'ring-1 ring-current' : 'opacity-60 hover:opacity-100'
                  )}
                >
                  {label}
                  {isSelected && <Check className="inline ml-1 h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-4 rounded-lg text-sm font-medium text-fg-muted border border-border hover:bg-surface-muted transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!suggestion.title.trim() || isSubmitting}
          className={cn(
            'h-9 px-4 rounded-lg inline-flex items-center gap-2 text-sm font-medium transition-all',
            suggestion.title.trim() && !isSubmitting
              ? 'bg-accent text-white hover:bg-accent/90'
              : 'bg-surface-muted text-fg-subtle cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create Task
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NewTaskDialog({
  projectId,
  open,
  onOpenChange,
  onTaskCreated,
}: NewTaskDialogProps): React.JSX.Element {
  // Use the real AI task creation hook
  const {
    sessionId,
    status,
    messages,
    streamingContent,
    isStreaming,
    suggestion,
    createdTaskId,
    error,
    startConversation,
    sendMessage,
    acceptSuggestion,
    cancel,
    reset,
  } = useTaskCreation(projectId);

  const [input, setInput] = useState('');
  const [editableSuggestion, setEditableSuggestion] = useState<EditableSuggestion | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Convert TaskSuggestion to EditableSuggestion when suggestion changes
  useEffect(() => {
    if (suggestion) {
      setEditableSuggestion({
        title: suggestion.title,
        description: suggestion.description,
        labels: suggestion.labels,
        priority: suggestion.priority as Priority,
        mode: suggestion.mode,
      });
    }
  }, [suggestion]);

  // Start conversation when dialog opens
  useEffect(() => {
    if (open && status === 'idle') {
      startConversation();
    }
  }, [open, status, startConversation]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset();
      setInput('');
      setEditableSuggestion(null);
      setShowEditPanel(false);
      setIsSubmitting(false);
      setIsManualMode(false);
      setLocalError(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, reset]);

  // Handle task creation completion
  useEffect(() => {
    if (createdTaskId) {
      onTaskCreated?.(createdTaskId);
      onOpenChange(false);
    }
  }, [createdTaskId, onTaskCreated, onOpenChange]);

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAcceptSuggestion = () => {
    if (editableSuggestion) {
      setShowEditPanel(true);
    }
  };

  const handleCreateManually = () => {
    // Cancel any active AI session
    if (sessionId && status === 'active') {
      cancel();
    }
    // Set up empty suggestion and go to edit panel
    setEditableSuggestion({ ...DEFAULT_SUGGESTION });
    setShowEditPanel(true);
    setIsManualMode(true);
  };

  const handleSubmit = async () => {
    if (!editableSuggestion || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isManualMode) {
        // Manual mode: Create task directly without AI session
        const result = await apiClient.tasks.create({
          projectId,
          title: editableSuggestion.title,
          description: editableSuggestion.description,
          labels: editableSuggestion.labels,
          priority: editableSuggestion.priority,
          mode: editableSuggestion.mode,
        });

        if (result.ok) {
          onTaskCreated?.(result.data.taskId);
          onOpenChange(false);
        } else {
          setLocalError(result.error.message);
        }
      } else {
        // AI mode: Use the acceptSuggestion from the hook
        await acceptSuggestion({
          title: editableSuggestion.title,
          description: editableSuggestion.description,
          labels: editableSuggestion.labels,
          priority: editableSuggestion.priority,
          mode: editableSuggestion.mode,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (sessionId && status === 'active') {
      await cancel();
    }
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
            'w-full max-w-3xl h-[85vh] max-h-[800px]',
            'bg-surface border border-border rounded-xl overflow-hidden',
            'shadow-xl flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
          data-testid="new-task-dialog"
        >
          {showEditPanel && editableSuggestion ? (
            <EditPanel
              suggestion={editableSuggestion}
              onChange={(updates) => setEditableSuggestion((prev) => prev ? { ...prev, ...updates } : null)}
              onSubmit={handleSubmit}
              onBack={() => setShowEditPanel(false)}
              isSubmitting={isSubmitting}
            />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-subtle/50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border',
                    status === 'connecting' ? 'bg-attention/10 text-attention border-attention/20' :
                    status === 'error' ? 'bg-danger/10 text-danger border-danger/20' :
                    'bg-secondary/10 text-secondary border-secondary/20'
                  )}>
                    {status === 'connecting' ? (
                      <Spinner className="h-4 w-4 animate-spin" />
                    ) : status === 'error' ? (
                      <Warning className="h-4 w-4" weight="fill" />
                    ) : (
                      <Sparkle className="h-4 w-4" weight="fill" />
                    )}
                  </div>
                  <div>
                    <DialogPrimitive.Title className="text-base font-semibold text-fg">
                      Create with AI
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-xs text-fg-muted">
                      {status === 'connecting' ? 'Connecting...' :
                       status === 'error' ? 'Connection error' :
                       'Describe what you want to build'}
                    </DialogPrimitive.Description>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Error banner */}
              {(error || localError) && (
                <div className="px-4 py-3 bg-danger/10 border-b border-danger/20 flex items-center gap-2">
                  <Warning className="h-4 w-4 text-danger" weight="fill" />
                  <p className="text-sm text-danger">{error || localError}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <MessageBubble message={message} />
                    {message.role === 'assistant' && suggestion && message.id === messages[messages.length - 1]?.id && (
                      <SuggestionCard
                        suggestion={suggestion}
                        onAccept={handleAcceptSuggestion}
                        onEdit={() => setShowEditPanel(true)}
                      />
                    )}
                  </div>
                ))}
                {/* Streaming content */}
                {isStreaming && streamingContent && (
                  <StreamingBubble content={streamingContent} />
                )}
                {/* Typing indicator when streaming but no content yet */}
                {isStreaming && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
                      <Sparkle className="h-4 w-4 animate-pulse" weight="fill" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-surface-muted border border-border">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestions (show if no messages, or show manual option on error) */}
              {messages.length === 0 && (status === 'active' || status === 'error' || status === 'connecting') && (
                <QuickSuggestions
                  onSelect={(text) => setInput(text)}
                  onCreateManually={handleCreateManually}
                />
              )}

              {/* Create Task button - always visible after messages */}
              {messages.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-surface-subtle/50 flex items-center justify-between">
                  <p className="text-xs text-fg-muted">
                    Ready to create your task?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill with user's original request as description
                      const firstUserMsg = messages.find(m => m.role === 'user');
                      setEditableSuggestion({
                        title: '',
                        description: firstUserMsg?.content || '',
                        labels: [],
                        priority: 'medium',
                        mode: 'implement',
                      });
                      setShowEditPanel(true);
                      setIsManualMode(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Create Task
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t border-border bg-surface-subtle/30">
                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what you want to accomplish..."
                    rows={2}
                    disabled={status !== 'active'}
                    className={cn(
                      'w-full px-4 py-3 pr-12 rounded-xl resize-none',
                      'bg-surface border border-border text-sm text-fg',
                      'placeholder:text-fg-subtle',
                      'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/30',
                      'transition-all duration-150',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() || isStreaming || status !== 'active'}
                    className={cn(
                      'absolute right-2 bottom-2 h-8 w-8 rounded-lg',
                      'flex items-center justify-center transition-all duration-150',
                      input.trim() && !isStreaming && status === 'active'
                        ? 'bg-secondary text-white hover:bg-secondary/90'
                        : 'bg-surface-muted text-fg-subtle cursor-not-allowed'
                    )}
                  >
                    <PaperPlaneTilt className="h-4 w-4" weight="fill" />
                  </button>
                </div>
                <p className="text-[11px] text-fg-subtle mt-2 px-1">
                  Press <kbd className="px-1 py-0.5 rounded bg-surface-muted border border-border font-mono text-[10px]">Enter</kbd> to send
                </p>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
