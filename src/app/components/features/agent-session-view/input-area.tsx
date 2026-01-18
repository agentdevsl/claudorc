import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
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
            'flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:text-fg-muted',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        />

        {/* Shortcut hint */}
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-surface-subtle px-2 py-0.5 text-xs text-fg-muted">
          Enter
        </kbd>

        {/* Submit button */}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="h-8"
        >
          <PaperPlaneTilt className="h-4 w-4" weight="fill" />
          <span className="sr-only">Send</span>
        </Button>
      </div>

      {/* Command history hint */}
      {history.length > 0 && !disabled && (
        <p className="mt-2 text-xs text-fg-subtle">
          Use <kbd className="rounded border border-border px-1">&#8593;</kbd> /{' '}
          <kbd className="rounded border border-border px-1">&#8595;</kbd> for command history
        </p>
      )}
    </div>
  );
}
