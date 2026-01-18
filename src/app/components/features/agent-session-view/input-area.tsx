import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface InputAreaProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_HISTORY = 50;

export function InputArea({
  onSubmit,
  disabled = false,
  placeholder = 'Send a message or command to the agent...',
}: InputAreaProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue || disabled) return;

    // Add to history
    setHistory((prev) => {
      const newHistory = [trimmedValue, ...prev.filter((h) => h !== trimmedValue)];
      return newHistory.slice(0, MAX_HISTORY);
    });

    // Submit and clear
    onSubmit(trimmedValue);
    setValue('');
    setHistoryIndex(-1);
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (history.length === 0) return;

        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        const historyValue = history[newIndex];
        if (historyValue !== undefined) {
          setValue(historyValue);
        }

        // Move cursor to end
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.value.length;
            inputRef.current.selectionEnd = inputRef.current.value.length;
          }
        });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setValue('');
          return;
        }

        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historyValue = history[newIndex];
        if (historyValue !== undefined) {
          setValue(historyValue);
        }

        // Move cursor to end
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.value.length;
            inputRef.current.selectionEnd = inputRef.current.value.length;
          }
        });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setValue('');
        setHistoryIndex(-1);
      }
    },
    [handleSubmit, history, historyIndex]
  );

  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-border bg-canvas p-4 pr-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-fg-subtle',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        />

        {/* Shortcut hint */}
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-surface-subtle px-2 py-1 text-xs font-mono text-fg-subtle">
          Enter
        </kbd>

        {/* Submit button - matches wireframe styling */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            canSubmit
              ? 'bg-accent text-white hover:bg-accent-hover'
              : 'bg-surface-subtle text-fg-muted cursor-not-allowed opacity-60'
          )}
        >
          Send
          <PaperPlaneTilt className="h-4 w-4" weight="fill" />
        </button>
      </div>

      {/* Command history hint - shows only when history exists and input is enabled */}
      {history.length > 0 && !disabled && (
        <p className="mt-2 text-xs text-fg-subtle flex items-center gap-1">
          Use{' '}
          <kbd className="inline-flex items-center justify-center rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-mono">
            &#8593;
          </kbd>
          <kbd className="inline-flex items-center justify-center rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-mono">
            &#8595;
          </kbd>{' '}
          to navigate command history ({history.length} command{history.length !== 1 ? 's' : ''})
        </p>
      )}
    </div>
  );
}
