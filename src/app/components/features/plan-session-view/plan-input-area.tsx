import { ArrowUp, Command } from '@phosphor-icons/react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PlanInputAreaProps } from './types';

/**
 * Input area for sending messages in the plan session
 */
export function PlanInputArea({
  onSubmit,
  disabled,
  placeholder = 'Describe what you want to plan...',
}: PlanInputAreaProps): React.JSX.Element {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        setInput('');
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [input, disabled, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const hasContent = input.trim().length > 0;

  return (
    <div
      className={cn(
        'border-t border-border p-4',
        'bg-gradient-to-t from-canvas via-canvas to-transparent'
      )}
    >
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'relative rounded-xl overflow-hidden',
            'bg-surface border',
            'transition-all duration-200',
            isFocused
              ? 'border-secondary/50 shadow-[0_0_0_3px_rgba(247,120,186,0.1)]'
              : 'border-border hover:border-border-default'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 py-3 pr-14',
              'text-sm text-fg placeholder:text-fg-subtle',
              'focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[48px] max-h-[200px]'
            )}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={disabled || !hasContent}
            className={cn(
              'absolute bottom-2 right-2',
              'flex h-9 w-9 items-center justify-center rounded-lg',
              'transition-all duration-200',
              hasContent && !disabled
                ? 'bg-secondary text-white shadow-md hover:bg-secondary/90 hover:shadow-lg active:scale-95'
                : 'bg-surface-muted text-fg-subtle cursor-not-allowed'
            )}
          >
            <ArrowUp className="h-4 w-4" weight="bold" />
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[11px] text-fg-subtle">
            <kbd
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
                'bg-surface-muted border border-border/50',
                'font-mono text-[10px] font-medium'
              )}
            >
              <Command className="h-2.5 w-2.5" />
              Enter
            </kbd>
            <span className="mx-1.5">to send</span>
            <kbd
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
                'bg-surface-muted border border-border/50',
                'font-mono text-[10px] font-medium'
              )}
            >
              Shift + Enter
            </kbd>
            <span className="ml-1.5">for new line</span>
          </p>
          {hasContent && (
            <span className="text-[11px] text-fg-subtle animate-fade-in">
              {input.length} characters
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
