import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface-subtle px-3 text-sm text-fg outline-none transition duration-fast ease-out placeholder:text-fg-subtle focus:border-accent focus:ring-2 focus:ring-accent-muted',
          className
        )}
        {...props}
      />
    );
  }
);

TextInput.displayName = 'TextInput';
