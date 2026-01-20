import { Check, Spinner } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { InteractionQuestion, PlanInteractionProps } from './types';

/**
 * Single question with options
 */
function QuestionCard({
  question,
  selectedAnswers,
  onSelect,
}: {
  question: InteractionQuestion;
  selectedAnswers: string[];
  onSelect: (answers: string[]) => void;
}): React.JSX.Element {
  const handleOptionClick = (label: string) => {
    if (question.multiSelect) {
      // Toggle selection for multi-select
      if (selectedAnswers.includes(label)) {
        onSelect(selectedAnswers.filter((a) => a !== label));
      } else {
        onSelect([...selectedAnswers, label]);
      }
    } else {
      // Replace selection for single-select
      onSelect([label]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-secondary-muted text-secondary text-xs font-medium">
          {question.header}
        </span>
        {question.multiSelect && <span className="text-xs text-fg-muted">(Select multiple)</span>}
      </div>
      <p className="text-sm font-medium text-fg">{question.question}</p>
      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedAnswers.includes(option.label);
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => handleOptionClick(option.label)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-colors duration-fast',
                isSelected
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-surface hover:border-fg-subtle'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                    question.multiSelect ? 'rounded' : 'rounded-full',
                    isSelected ? 'bg-accent text-white' : 'border border-border bg-surface'
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" weight="bold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg">{option.label}</p>
                  <p className="text-xs text-fg-muted mt-0.5">{option.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Interaction modal for answering Claude's questions
 */
export function PlanInteraction({
  interaction,
  onAnswer,
  onCancel,
  isSubmitting,
}: PlanInteractionProps): React.JSX.Element {
  // Track answers for each question by header
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const handleQuestionAnswers = useCallback((header: string, selectedAnswers: string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [header]: selectedAnswers,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    // Convert answers to the expected format (header -> comma-separated values)
    const formattedAnswers: Record<string, string> = {};
    for (const [header, values] of Object.entries(answers)) {
      formattedAnswers[header] = values.join(', ');
    }
    onAnswer(formattedAnswers);
  }, [answers, onAnswer]);

  // Check if all required questions have answers
  const allQuestionsAnswered = interaction.questions.every(
    (q) => (answers[q.header]?.length ?? 0) > 0
  );

  return (
    <div className="rounded-lg border border-accent bg-surface shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-accent-muted">
        <h3 className="text-sm font-medium text-fg">Claude needs your input</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-fg-muted hover:text-fg transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* Questions */}
      <div className="p-4 space-y-6">
        {interaction.questions.map((question) => (
          <QuestionCard
            key={question.header}
            question={question}
            selectedAnswers={answers[question.header] ?? []}
            onSelect={(selected) => handleQuestionAnswers(question.header, selected)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 bg-surface-muted">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allQuestionsAnswered || isSubmitting}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
            'bg-accent text-white hover:bg-accent/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-fast'
          )}
        >
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" weight="bold" />
              Submit Answers
            </>
          )}
        </button>
      </div>
    </div>
  );
}
