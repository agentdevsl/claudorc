import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg outline-none transition duration-fast ease-out placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent-muted',
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
