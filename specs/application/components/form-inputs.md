# Form Components Specification

## Overview

This specification covers all form-related components for the AgentPane application. Components follow the established design system tokens, Radix UI primitives, and class-variance-authority patterns.

**Related Documentation:**

- [Component Patterns](../implementation/component-patterns.md) - Base component implementations
- [Design Tokens](../wireframes/design-tokens.css) - CSS custom properties
- [Error Catalog](../errors/error-catalog.md) - Validation error messages

---

## Table of Contents

1. [TextInput](#1-textinput)
2. [Textarea](#2-textarea)
3. [Select/Dropdown](#3-selectdropdown)
4. [Checkbox](#4-checkbox)
5. [Radio Group](#5-radio-group)
6. [Switch/Toggle](#6-switchtoggle)
7. [NumberInput](#7-numberinput)
8. [DatePicker](#8-datepicker)
9. [FileInput](#9-fileinput)
10. [Form Layout Components](#10-form-layout-components)
11. [Validation Patterns](#11-validation-patterns)
12. [Accessibility](#12-accessibility)

---

## 1. TextInput

Single-line text input component with support for variants, sizes, icons, and character counting.

### Interface Definition

```typescript
// app/components/ui/text-input.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

export interface TextInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof textInputVariants> {
  /** Left icon element */
  leftIcon?: React.ReactNode;
  /** Right icon element */
  rightIcon?: React.ReactNode;
  /** Error message to display */
  error?: string;
  /** Success state indicator */
  success?: boolean;
  /** Maximum character count */
  maxLength?: number;
  /** Show character counter */
  showCounter?: boolean;
  /** Callback when character limit is reached */
  onLimitReached?: () => void;
}
```

### CVA Variants

```typescript
const textInputVariants = cva(
  [
    'flex w-full rounded-[6px] border bg-[var(--bg-default)] px-3 text-sm',
    'text-[var(--fg-default)] placeholder:text-[var(--fg-subtle)]',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-muted)]',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-[var(--border-default)]',
          'hover:border-[var(--fg-subtle)]',
          'focus:border-[var(--accent-fg)] focus:ring-[var(--accent-fg)]',
        ],
        error: [
          'border-[var(--danger-fg)]',
          'hover:border-[var(--danger-fg)]',
          'focus:border-[var(--danger-fg)] focus:ring-[var(--danger-fg)]',
          'bg-[var(--danger-muted)]',
        ],
        success: [
          'border-[var(--success-fg)]',
          'hover:border-[var(--success-fg)]',
          'focus:border-[var(--success-fg)] focus:ring-[var(--success-fg)]',
        ],
      },
      size: {
        sm: 'h-8 text-xs',
        md: 'h-9 text-sm',
        lg: 'h-10 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);
```

### Visual States

| State | Border | Background | Ring |
|-------|--------|------------|------|
| Default | `var(--border-default)` | `var(--bg-default)` | None |
| Hover | `var(--fg-subtle)` | `var(--bg-default)` | None |
| Focus | `var(--accent-fg)` | `var(--bg-default)` | `2px var(--accent-fg)` |
| Error | `var(--danger-fg)` | `var(--danger-muted)` | `2px var(--danger-fg)` |
| Success | `var(--success-fg)` | `var(--bg-default)` | `2px var(--success-fg)` |
| Disabled | `var(--border-default)` | `var(--bg-muted)` | None |

### Implementation

```typescript
// app/components/ui/text-input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      variant,
      size,
      leftIcon,
      rightIcon,
      error,
      success,
      maxLength,
      showCounter = false,
      onLimitReached,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(
      typeof value === 'string' ? value.length : 0
    );

    const computedVariant = error ? 'error' : success ? 'success' : variant;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setCharCount(newValue.length);

      if (maxLength && newValue.length >= maxLength) {
        onLimitReached?.();
      }

      onChange?.(e);
    };

    return (
      <div className="relative w-full">
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 flex items-center text-[var(--fg-muted)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            value={value}
            onChange={handleChange}
            maxLength={maxLength}
            className={cn(
              textInputVariants({ variant: computedVariant, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 flex items-center text-[var(--fg-muted)]">
              {rightIcon}
            </span>
          )}
        </div>

        {/* Character Counter */}
        {showCounter && maxLength && (
          <div className="mt-1 flex justify-end">
            <span
              className={cn(
                'text-xs',
                charCount >= maxLength
                  ? 'text-[var(--danger-fg)]'
                  : charCount >= maxLength * 0.9
                    ? 'text-[var(--attention-fg)]'
                    : 'text-[var(--fg-muted)]'
              )}
            >
              {charCount}/{maxLength}
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p
            id={`${props.id}-error`}
            className="mt-1.5 text-xs text-[var(--danger-fg)]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
TextInput.displayName = 'TextInput';
```

### Usage Examples

```typescript
// Basic usage
<TextInput
  id="project-name"
  placeholder="Enter project name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

// With icons
<TextInput
  id="search"
  placeholder="Search agents..."
  leftIcon={<SearchIcon className="h-4 w-4" />}
  rightIcon={<KbdIcon>Cmd+K</KbdIcon>}
/>

// Error state with character counter
<TextInput
  id="description"
  placeholder="Task description"
  error={errors.description}
  maxLength={500}
  showCounter
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

// Size variants
<TextInput size="sm" placeholder="Small input" />
<TextInput size="md" placeholder="Medium input" />
<TextInput size="lg" placeholder="Large input" />
```

---

## 2. Textarea

Multi-line text input with auto-resize, character limits, and optional markdown preview.

### Interface Definition

```typescript
// app/components/ui/textarea.tsx
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  /** Enable auto-resize based on content */
  autoResize?: boolean;
  /** Minimum number of rows */
  minRows?: number;
  /** Maximum number of rows (for auto-resize) */
  maxRows?: number;
  /** Maximum character count */
  maxLength?: number;
  /** Show character counter */
  showCounter?: boolean;
  /** Error message */
  error?: string;
  /** Enable markdown preview mode */
  enableMarkdownPreview?: boolean;
  /** Callback when limit reached */
  onLimitReached?: () => void;
}
```

### CVA Variants

```typescript
const textareaVariants = cva(
  [
    'flex w-full rounded-[6px] border bg-[var(--bg-default)] px-3 py-2 text-sm',
    'text-[var(--fg-default)] placeholder:text-[var(--fg-subtle)]',
    'transition-all duration-150 resize-y',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-muted)]',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-[var(--border-default)]',
          'hover:border-[var(--fg-subtle)]',
          'focus:border-[var(--accent-fg)] focus:ring-[var(--accent-fg)]',
        ],
        error: [
          'border-[var(--danger-fg)]',
          'focus:border-[var(--danger-fg)] focus:ring-[var(--danger-fg)]',
          'bg-[var(--danger-muted)]',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/textarea.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      variant,
      autoResize = false,
      minRows = 3,
      maxRows = 10,
      maxLength,
      showCounter = false,
      error,
      enableMarkdownPreview = false,
      onLimitReached,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(
      typeof value === 'string' ? value.length : 0
    );
    const [isPreview, setIsPreview] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Auto-resize logic
    React.useEffect(() => {
      if (!autoResize || !textareaRef.current) return;

      const textarea = textareaRef.current;
      textarea.style.height = 'auto';

      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;

      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }, [value, autoResize, minRows, maxRows]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setCharCount(newValue.length);

      if (maxLength && newValue.length >= maxLength) {
        onLimitReached?.();
      }

      onChange?.(e);
    };

    const computedVariant = error ? 'error' : variant;

    // Merge refs
    const mergedRef = React.useMemo(() => {
      return (node: HTMLTextAreaElement) => {
        textareaRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      };
    }, [ref]);

    return (
      <div className="relative w-full">
        {/* Markdown Preview Toggle */}
        {enableMarkdownPreview && (
          <div className="mb-2 flex gap-2 border-b border-[var(--border-default)] pb-2">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                'px-3 py-1 text-sm rounded-[4px] transition-colors',
                !isPreview
                  ? 'bg-[var(--bg-emphasis)] text-[var(--fg-default)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
              )}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className={cn(
                'px-3 py-1 text-sm rounded-[4px] transition-colors',
                isPreview
                  ? 'bg-[var(--bg-emphasis)] text-[var(--fg-default)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
              )}
            >
              Preview
            </button>
          </div>
        )}

        {/* Textarea or Preview */}
        {isPreview ? (
          <div
            className={cn(
              'min-h-[120px] rounded-[6px] border border-[var(--border-default)]',
              'bg-[var(--bg-default)] px-3 py-2 text-sm',
              'prose prose-invert prose-sm max-w-none'
            )}
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(String(value || '')),
            }}
          />
        ) : (
          <textarea
            ref={mergedRef}
            value={value}
            onChange={handleChange}
            maxLength={maxLength}
            rows={minRows}
            className={cn(
              textareaVariants({ variant: computedVariant }),
              autoResize && 'resize-none overflow-hidden',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
        )}

        {/* Footer: Counter and Error */}
        <div className="mt-1.5 flex items-center justify-between">
          {error && (
            <p
              id={`${props.id}-error`}
              className="text-xs text-[var(--danger-fg)]"
              role="alert"
            >
              {error}
            </p>
          )}
          {showCounter && maxLength && (
            <span
              className={cn(
                'ml-auto text-xs',
                charCount >= maxLength
                  ? 'text-[var(--danger-fg)]'
                  : charCount >= maxLength * 0.9
                    ? 'text-[var(--attention-fg)]'
                    : 'text-[var(--fg-muted)]'
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
```

### Usage Examples

```typescript
// Basic textarea
<Textarea
  id="feedback"
  placeholder="Enter your feedback..."
  value={feedback}
  onChange={(e) => setFeedback(e.target.value)}
/>

// Auto-resize with character limit
<Textarea
  id="task-description"
  placeholder="Describe the task..."
  autoResize
  minRows={3}
  maxRows={8}
  maxLength={2000}
  showCounter
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

// With markdown preview
<Textarea
  id="agent-prompt"
  placeholder="Enter agent prompt (markdown supported)..."
  enableMarkdownPreview
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
/>
```

---

## 3. Select/Dropdown

Comprehensive select component supporting single select, multi-select, searchable options, async loading, and grouped sections.

### Interface Definition

```typescript
// app/components/ui/select-advanced.tsx
import * as SelectPrimitive from '@radix-ui/react-select';

export interface SelectOption<T = string> {
  /** Option value */
  value: T;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
}

export interface SelectGroup<T = string> {
  /** Group label */
  label: string;
  /** Options in this group */
  options: SelectOption<T>[];
}

export interface SelectProps<T = string> {
  /** Selected value (single select) */
  value?: T;
  /** Selected values (multi-select) */
  values?: T[];
  /** Callback when value changes */
  onValueChange?: (value: T) => void;
  /** Callback when values change (multi-select) */
  onValuesChange?: (values: T[]) => void;
  /** Options list */
  options?: SelectOption<T>[];
  /** Grouped options */
  groups?: SelectGroup<T>[];
  /** Placeholder text */
  placeholder?: string;
  /** Enable search/filter */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Enable multi-select */
  multiple?: boolean;
  /** Async loading state */
  isLoading?: boolean;
  /** Async load function */
  onLoadMore?: () => Promise<void>;
  /** Has more items to load */
  hasMore?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: string;
  /** Custom render for selected value */
  renderValue?: (selected: SelectOption<T> | SelectOption<T>[]) => React.ReactNode;
}
```

### CVA Variants

```typescript
const selectTriggerVariants = cva(
  [
    'flex h-9 w-full items-center justify-between rounded-[6px] border px-3 py-2 text-sm',
    'bg-[var(--bg-default)] text-[var(--fg-default)]',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-[var(--border-default)]',
          'hover:border-[var(--fg-subtle)] hover:bg-[var(--bg-subtle)]',
          'focus:border-[var(--accent-fg)] focus:ring-[var(--accent-fg)]',
        ],
        error: [
          'border-[var(--danger-fg)]',
          'focus:border-[var(--danger-fg)] focus:ring-[var(--danger-fg)]',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const selectItemVariants = cva(
  [
    'relative flex cursor-pointer select-none items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm',
    'text-[var(--fg-default)] outline-none',
    'transition-colors duration-100',
  ],
  {
    variants: {
      state: {
        default: 'hover:bg-[var(--bg-subtle)]',
        selected: 'bg-[var(--accent-muted)] text-[var(--accent-fg)]',
        disabled: 'pointer-events-none opacity-50',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);
```

### Implementation (Single Select)

```typescript
// app/components/ui/select.tsx
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons';

export function Select<T extends string>({
  value,
  onValueChange,
  options = [],
  groups,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  error,
}: SelectProps<T>) {
  const [search, setSearch] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.description?.toLowerCase().includes(lower)
    );
  }, [options, search, searchable]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative w-full">
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className={cn(
            selectTriggerVariants({ variant: error ? 'error' : 'default' })
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder}>
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.icon}
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-[var(--fg-subtle)]">{placeholder}</span>
            )}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon asChild>
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              'relative z-50 min-w-[8rem] overflow-hidden rounded-[6px]',
              'border border-[var(--border-default)] bg-[var(--bg-default)]',
              'shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=top]:slide-in-from-bottom-2',
              'duration-150'
            )}
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-[var(--bg-default)]">
              <ChevronUpIcon className="h-4 w-4" />
            </SelectPrimitive.ScrollUpButton>

            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-[var(--border-default)]">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'w-full rounded-[4px] border border-[var(--border-default)]',
                    'bg-[var(--bg-canvas)] px-2 py-1.5 text-sm',
                    'placeholder:text-[var(--fg-subtle)]',
                    'focus:outline-none focus:border-[var(--accent-fg)]'
                  )}
                />
              </div>
            )}

            <SelectPrimitive.Viewport className="p-1 max-h-[300px]">
              {/* Grouped Options */}
              {groups?.map((group) => (
                <SelectPrimitive.Group key={group.label}>
                  <SelectPrimitive.Label className="px-2 py-1.5 text-xs font-semibold text-[var(--fg-muted)]">
                    {group.label}
                  </SelectPrimitive.Label>
                  {group.options.map((option) => (
                    <SelectItem key={String(option.value)} option={option} />
                  ))}
                </SelectPrimitive.Group>
              ))}

              {/* Flat Options */}
              {!groups &&
                filteredOptions.map((option) => (
                  <SelectItem key={String(option.value)} option={option} />
                ))}

              {/* Empty State */}
              {!groups && filteredOptions.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-[var(--fg-muted)]">
                  No options found
                </div>
              )}
            </SelectPrimitive.Viewport>

            <SelectPrimitive.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-[var(--bg-default)]">
              <ChevronDownIcon className="h-4 w-4" />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error && (
        <p className="mt-1.5 text-xs text-[var(--danger-fg)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectItem<T>({ option }: { option: SelectOption<T> }) {
  return (
    <SelectPrimitive.Item
      value={String(option.value)}
      disabled={option.disabled}
      className={cn(
        selectItemVariants({
          state: option.disabled ? 'disabled' : 'default',
        })
      )}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2">
        <CheckIcon className="h-4 w-4 text-[var(--accent-fg)]" />
      </SelectPrimitive.ItemIndicator>
      <span className="pl-6 flex items-center gap-2">
        {option.icon}
        <span className="flex flex-col">
          <span>{option.label}</span>
          {option.description && (
            <span className="text-xs text-[var(--fg-muted)]">
              {option.description}
            </span>
          )}
        </span>
      </span>
    </SelectPrimitive.Item>
  );
}
```

### Multi-Select Implementation

```typescript
// app/components/ui/multi-select.tsx
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { Checkbox } from './checkbox';
import { Badge } from './badge';

export function MultiSelect<T extends string>({
  values = [],
  onValuesChange,
  options = [],
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  isLoading = false,
  onLoadMore,
  hasMore = false,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(lower)
    );
  }, [options, search]);

  const selectedOptions = options.filter((opt) =>
    values.includes(opt.value)
  );

  const toggleOption = (optionValue: T) => {
    const newValues = values.includes(optionValue)
      ? values.filter((v) => v !== optionValue)
      : [...values, optionValue];
    onValuesChange?.(newValues);
  };

  // Infinite scroll handler
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current || !onLoadMore || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoading]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          selectTriggerVariants({ variant: 'default' }),
          'min-h-9 h-auto flex-wrap gap-1 py-1'
        )}
      >
        {selectedOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.slice(0, 3).map((opt) => (
              <Badge key={String(opt.value)} variant="secondary">
                {opt.label}
              </Badge>
            ))}
            {selectedOptions.length > 3 && (
              <Badge variant="secondary">
                +{selectedOptions.length - 3} more
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-[var(--fg-subtle)]">{placeholder}</span>
        )}
        <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50 shrink-0" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] rounded-[6px]',
            'border border-[var(--border-default)] bg-[var(--bg-default)]',
            'shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          sideOffset={4}
        >
          {/* Search */}
          {searchable && (
            <div className="p-2 border-b border-[var(--border-default)]">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full rounded-[4px] border border-[var(--border-default)]',
                  'bg-[var(--bg-canvas)] px-2 py-1.5 text-sm',
                  'focus:outline-none focus:border-[var(--accent-fg)]'
                )}
              />
            </div>
          )}

          {/* Options */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[300px] overflow-auto p-1"
          >
            {filteredOptions.map((option) => (
              <div
                key={String(option.value)}
                onClick={() => !option.disabled && toggleOption(option.value)}
                className={cn(
                  'flex items-center gap-2 rounded-[4px] px-2 py-1.5 cursor-pointer',
                  'hover:bg-[var(--bg-subtle)]',
                  option.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Checkbox
                  checked={values.includes(option.value)}
                  disabled={option.disabled}
                />
                <span className="flex flex-col">
                  <span className="text-sm">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-[var(--fg-muted)]">
                      {option.description}
                    </span>
                  )}
                </span>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Spinner className="h-5 w-5 text-[var(--fg-muted)]" />
              </div>
            )}

            {/* Empty state */}
            {filteredOptions.length === 0 && !isLoading && (
              <div className="py-4 text-center text-sm text-[var(--fg-muted)]">
                No options found
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

### Usage Examples

```typescript
// Single select
<Select
  value={agentType}
  onValueChange={setAgentType}
  options={[
    { value: 'task', label: 'Task Agent', icon: <TaskIcon /> },
    { value: 'conversational', label: 'Conversational', icon: <ChatIcon /> },
    { value: 'background', label: 'Background', icon: <BgIcon /> },
  ]}
  placeholder="Select agent type"
/>

// Searchable with groups
<Select
  value={project}
  onValueChange={setProject}
  searchable
  groups={[
    {
      label: 'Recent',
      options: recentProjects.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      label: 'All Projects',
      options: allProjects.map((p) => ({ value: p.id, label: p.name })),
    },
  ]}
/>

// Multi-select with async loading
<MultiSelect
  values={selectedTags}
  onValuesChange={setSelectedTags}
  options={tags}
  searchable
  isLoading={isLoadingTags}
  onLoadMore={loadMoreTags}
  hasMore={hasMoreTags}
  placeholder="Select tags..."
/>
```

---

## 4. Checkbox

Selection control for boolean and multiple options with indeterminate state support.

### Interface Definition

```typescript
// app/components/ui/checkbox.tsx
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Indeterminate state for "select all" scenarios */
  indeterminate?: boolean;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Error state */
  error?: string;
}

export interface CheckboxGroupProps {
  /** Group label */
  label?: string;
  /** Group description */
  description?: string;
  /** Options */
  options: CheckboxOption[];
  /** Selected values */
  value: string[];
  /** Change handler */
  onChange: (value: string[]) => void;
  /** Error state */
  error?: string;
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
}

export interface CheckboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
```

### CVA Variants

```typescript
const checkboxVariants = cva(
  [
    'peer h-4 w-4 shrink-0 rounded-[4px] border',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-fg)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      state: {
        unchecked: [
          'border-[var(--border-default)] bg-[var(--bg-default)]',
          'hover:border-[var(--fg-subtle)] hover:bg-[var(--bg-subtle)]',
        ],
        checked: [
          'border-[var(--accent-emphasis)] bg-[var(--accent-emphasis)]',
          'hover:bg-[var(--accent-fg)]',
        ],
        indeterminate: [
          'border-[var(--accent-emphasis)] bg-[var(--accent-emphasis)]',
        ],
        error: [
          'border-[var(--danger-fg)] bg-[var(--bg-default)]',
        ],
      },
    },
    defaultVariants: {
      state: 'unchecked',
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/checkbox.tsx
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@/lib/utils';
import { CheckIcon, MinusIcon } from '@/components/icons';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, checked, indeterminate, label, description, error, id, ...props }, ref) => {
  const checkboxId = id || React.useId();
  const state = error
    ? 'error'
    : indeterminate
      ? 'indeterminate'
      : checked
        ? 'checked'
        : 'unchecked';

  return (
    <div className="flex items-start gap-3">
      <CheckboxPrimitive.Root
        ref={ref}
        id={checkboxId}
        checked={indeterminate ? 'indeterminate' : checked}
        className={cn(checkboxVariants({ state }), className)}
        aria-invalid={!!error}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
          {indeterminate ? (
            <MinusIcon className="h-3 w-3" />
          ) : (
            <CheckIcon className="h-3 w-3" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-[var(--fg-default)] cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-xs text-[var(--fg-muted)]">{description}</span>
          )}
          {error && (
            <span className="text-xs text-[var(--danger-fg)]" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = 'Checkbox';
```

### Checkbox Group Implementation

```typescript
// app/components/ui/checkbox-group.tsx
export function CheckboxGroup({
  label,
  description,
  options,
  value,
  onChange,
  error,
  orientation = 'vertical',
}: CheckboxGroupProps) {
  const allChecked = options.every((opt) => value.includes(opt.value));
  const someChecked = options.some((opt) => value.includes(opt.value));
  const indeterminate = someChecked && !allChecked;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onChange(options.filter((opt) => !opt.disabled).map((opt) => opt.value));
    } else {
      onChange([]);
    }
  };

  const handleToggle = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <fieldset className="space-y-3">
      {label && (
        <legend className="text-sm font-medium text-[var(--fg-default)]">
          {label}
        </legend>
      )}
      {description && (
        <p className="text-xs text-[var(--fg-muted)]">{description}</p>
      )}

      {/* Select All */}
      <Checkbox
        checked={allChecked}
        indeterminate={indeterminate}
        onCheckedChange={handleSelectAll}
        label="Select all"
        className="border-b border-[var(--border-default)] pb-3"
      />

      {/* Options */}
      <div
        className={cn(
          'flex gap-3',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
        )}
      >
        {options.map((option) => (
          <Checkbox
            key={option.value}
            checked={value.includes(option.value)}
            onCheckedChange={(checked) =>
              handleToggle(option.value, Boolean(checked))
            }
            disabled={option.disabled}
            label={option.label}
            description={option.description}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-[var(--danger-fg)]" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
```

### Usage Examples

```typescript
// Single checkbox
<Checkbox
  checked={acceptTerms}
  onCheckedChange={setAcceptTerms}
  label="I accept the terms and conditions"
/>

// With description
<Checkbox
  checked={notifications}
  onCheckedChange={setNotifications}
  label="Email notifications"
  description="Receive updates when agents complete tasks"
/>

// Indeterminate (select all)
<Checkbox
  checked={allSelected}
  indeterminate={someSelected && !allSelected}
  onCheckedChange={handleSelectAll}
  label={`Select all (${selectedCount}/${totalCount})`}
/>

// Checkbox group
<CheckboxGroup
  label="Agent Permissions"
  options={[
    { value: 'bash', label: 'Bash', description: 'Execute shell commands' },
    { value: 'edit', label: 'Edit', description: 'Modify files' },
    { value: 'write', label: 'Write', description: 'Create new files' },
    { value: 'mcp', label: 'MCP', description: 'Use MCP tools' },
  ]}
  value={permissions}
  onChange={setPermissions}
/>
```

---

## 5. Radio Group

Single selection from a set of options with horizontal/vertical layouts and card-style variants.

### Interface Definition

```typescript
// app/components/ui/radio-group.tsx
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Selected value */
  value?: string;
  /** Change handler */
  onValueChange?: (value: string) => void;
  /** Options */
  options: RadioOption[];
  /** Group label */
  label?: string;
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Use card-style layout */
  variant?: 'default' | 'card';
  /** Error state */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
}
```

### CVA Variants

```typescript
const radioVariants = cva(
  [
    'h-4 w-4 rounded-full border',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-fg)]',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      state: {
        unchecked: [
          'border-[var(--border-default)] bg-[var(--bg-default)]',
          'hover:border-[var(--fg-subtle)]',
        ],
        checked: [
          'border-[var(--accent-emphasis)] bg-[var(--accent-emphasis)]',
        ],
      },
    },
  }
);

const radioCardVariants = cva(
  [
    'flex cursor-pointer rounded-[6px] border p-4',
    'transition-all duration-150',
  ],
  {
    variants: {
      state: {
        unchecked: [
          'border-[var(--border-default)] bg-[var(--bg-default)]',
          'hover:border-[var(--fg-subtle)] hover:bg-[var(--bg-subtle)]',
        ],
        checked: [
          'border-[var(--accent-fg)] bg-[var(--accent-muted)]',
        ],
        disabled: [
          'border-[var(--border-muted)] bg-[var(--bg-muted)] opacity-50 cursor-not-allowed',
        ],
      },
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/radio-group.tsx
import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@/lib/utils';

export function RadioGroup({
  value,
  onValueChange,
  options,
  label,
  orientation = 'vertical',
  variant = 'default',
  error,
  disabled,
}: RadioGroupProps) {
  return (
    <fieldset className="space-y-3">
      {label && (
        <legend className="text-sm font-medium text-[var(--fg-default)]">
          {label}
        </legend>
      )}

      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        className={cn(
          'flex gap-3',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
        )}
      >
        {options.map((option) =>
          variant === 'card' ? (
            <RadioCardItem key={option.value} option={option} value={value} />
          ) : (
            <RadioDefaultItem key={option.value} option={option} />
          )
        )}
      </RadioGroupPrimitive.Root>

      {error && (
        <p className="text-xs text-[var(--danger-fg)]" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function RadioDefaultItem({ option }: { option: RadioOption }) {
  const id = React.useId();

  return (
    <div className="flex items-start gap-3">
      <RadioGroupPrimitive.Item
        id={id}
        value={option.value}
        disabled={option.disabled}
        className={cn(radioVariants({ state: 'unchecked' }))}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-white" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>

      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--fg-default)] cursor-pointer"
        >
          {option.label}
        </label>
        {option.description && (
          <span className="text-xs text-[var(--fg-muted)]">
            {option.description}
          </span>
        )}
      </div>
    </div>
  );
}

function RadioCardItem({
  option,
  value,
}: {
  option: RadioOption;
  value?: string;
}) {
  const id = React.useId();
  const isChecked = value === option.value;
  const state = option.disabled ? 'disabled' : isChecked ? 'checked' : 'unchecked';

  return (
    <label
      htmlFor={id}
      className={cn(radioCardVariants({ state }), 'flex-1 min-w-[200px]')}
    >
      <RadioGroupPrimitive.Item
        id={id}
        value={option.value}
        disabled={option.disabled}
        className="sr-only"
      />

      <div className="flex items-start gap-3 w-full">
        {option.icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px]',
              isChecked ? 'bg-[var(--accent-emphasis)]' : 'bg-[var(--bg-emphasis)]'
            )}
          >
            {option.icon}
          </div>
        )}

        <div className="flex-1">
          <span className="block text-sm font-medium text-[var(--fg-default)]">
            {option.label}
          </span>
          {option.description && (
            <span className="block text-xs text-[var(--fg-muted)] mt-0.5">
              {option.description}
            </span>
          )}
        </div>

        {/* Check indicator */}
        <div
          className={cn(
            'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
            isChecked
              ? 'border-[var(--accent-fg)] bg-[var(--accent-fg)]'
              : 'border-[var(--border-default)]'
          )}
        >
          {isChecked && <CheckIcon className="h-3 w-3 text-white" />}
        </div>
      </div>
    </label>
  );
}
```

### Usage Examples

```typescript
// Default vertical layout
<RadioGroup
  label="Agent Mode"
  value={mode}
  onValueChange={setMode}
  options={[
    { value: 'autonomous', label: 'Autonomous', description: 'Agent works independently' },
    { value: 'supervised', label: 'Supervised', description: 'Requires approval for actions' },
    { value: 'manual', label: 'Manual', description: 'User controls each step' },
  ]}
/>

// Horizontal layout
<RadioGroup
  label="Priority"
  value={priority}
  onValueChange={setPriority}
  orientation="horizontal"
  options={[
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]}
/>

// Card-style options
<RadioGroup
  label="Choose a plan"
  value={plan}
  onValueChange={setPlan}
  variant="card"
  options={[
    {
      value: 'free',
      label: 'Free',
      description: 'Up to 3 agents',
      icon: <FreeIcon className="h-5 w-5" />,
    },
    {
      value: 'pro',
      label: 'Pro',
      description: 'Unlimited agents',
      icon: <ProIcon className="h-5 w-5" />,
    },
    {
      value: 'enterprise',
      label: 'Enterprise',
      description: 'Custom solutions',
      icon: <EnterpriseIcon className="h-5 w-5" />,
    },
  ]}
/>
```

---

## 6. Switch/Toggle

Reference the existing implementation in [Component Patterns](../implementation/component-patterns.md#7-switchtoggle).

The Switch component is already documented with:

- Radix UI primitive integration
- Green checked state (`bg-green-600`)
- Smooth thumb transition
- Focus ring styling
- Usage examples for settings toggles

---

## 7. NumberInput

Numeric input with increment/decrement buttons, min/max validation, and step configuration.

### Interface Definition

```typescript
// app/components/ui/number-input.tsx
export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  /** Current value */
  value?: number;
  /** Change handler */
  onChange?: (value: number) => void;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Show increment/decrement buttons */
  showButtons?: boolean;
  /** Button position */
  buttonPosition?: 'sides' | 'right';
  /** Precision for decimal values */
  precision?: number;
  /** Format value for display */
  formatValue?: (value: number) => string;
  /** Parse input string to number */
  parseValue?: (value: string) => number;
  /** Error state */
  error?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}
```

### CVA Variants

```typescript
const numberInputVariants = cva(
  [
    'flex items-center rounded-[6px] border',
    'bg-[var(--bg-default)]',
    'transition-all duration-150',
    'focus-within:ring-2 focus-within:ring-[var(--accent-fg)]',
    'focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg-canvas)]',
  ],
  {
    variants: {
      variant: {
        default: 'border-[var(--border-default)] hover:border-[var(--fg-subtle)]',
        error: 'border-[var(--danger-fg)]',
      },
      size: {
        sm: 'h-8',
        md: 'h-9',
        lg: 'h-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const stepButtonVariants = cva(
  [
    'flex items-center justify-center',
    'text-[var(--fg-muted)] hover:text-[var(--fg-default)]',
    'hover:bg-[var(--bg-subtle)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
    'transition-colors duration-100',
  ],
  {
    variants: {
      position: {
        left: 'rounded-l-[5px] border-r border-[var(--border-default)]',
        right: 'rounded-r-[5px] border-l border-[var(--border-default)]',
        stacked: 'border-l border-[var(--border-default)]',
      },
      size: {
        sm: 'w-7 h-full',
        md: 'w-8 h-full',
        lg: 'w-9 h-full',
      },
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/number-input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';
import { MinusIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon } from '@/components/icons';

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      min,
      max,
      step = 1,
      showButtons = true,
      buttonPosition = 'sides',
      precision,
      formatValue,
      parseValue,
      error,
      size = 'md',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value ?? 0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const clamp = (val: number): number => {
      let clamped = val;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      if (precision !== undefined) {
        clamped = Number(clamped.toFixed(precision));
      }
      return clamped;
    };

    const updateValue = (newValue: number) => {
      const clamped = clamp(newValue);
      setInternalValue(clamped);
      onChange?.(clamped);
    };

    const handleIncrement = () => {
      updateValue(internalValue + step);
    };

    const handleDecrement = () => {
      updateValue(internalValue - step);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const parsed = parseValue ? parseValue(rawValue) : parseFloat(rawValue);
      if (!isNaN(parsed)) {
        updateValue(parsed);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleIncrement();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDecrement();
      }
    };

    const displayValue = formatValue
      ? formatValue(internalValue)
      : String(internalValue);

    const canIncrement = max === undefined || internalValue < max;
    const canDecrement = min === undefined || internalValue > min;

    const variant = error ? 'error' : 'default';

    // Merge refs
    const mergedRef = React.useMemo(() => {
      return (node: HTMLInputElement) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      };
    }, [ref]);

    if (buttonPosition === 'right') {
      return (
        <div className="w-full">
          <div className={cn(numberInputVariants({ variant, size }), className)}>
            <input
              ref={mergedRef}
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={cn(
                'flex-1 bg-transparent px-3 text-sm text-[var(--fg-default)]',
                'focus:outline-none',
                'disabled:cursor-not-allowed'
              )}
              {...props}
            />

            {showButtons && (
              <div className="flex flex-col border-l border-[var(--border-default)]">
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={disabled || !canIncrement}
                  className={cn(
                    'flex h-1/2 w-6 items-center justify-center',
                    'hover:bg-[var(--bg-subtle)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'border-b border-[var(--border-default)]'
                  )}
                  tabIndex={-1}
                  aria-label="Increment"
                >
                  <ChevronUpIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={disabled || !canDecrement}
                  className={cn(
                    'flex h-1/2 w-6 items-center justify-center',
                    'hover:bg-[var(--bg-subtle)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  tabIndex={-1}
                  aria-label="Decrement"
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-1.5 text-xs text-[var(--danger-fg)]" role="alert">
              {error}
            </p>
          )}
        </div>
      );
    }

    // buttonPosition === 'sides'
    return (
      <div className="w-full">
        <div className={cn(numberInputVariants({ variant, size }), className)}>
          {showButtons && (
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disabled || !canDecrement}
              className={cn(stepButtonVariants({ position: 'left', size }))}
              tabIndex={-1}
              aria-label="Decrement"
            >
              <MinusIcon className="h-4 w-4" />
            </button>
          )}

          <input
            ref={mergedRef}
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              'flex-1 bg-transparent px-3 text-center text-sm text-[var(--fg-default)]',
              'focus:outline-none',
              'disabled:cursor-not-allowed'
            )}
            {...props}
          />

          {showButtons && (
            <button
              type="button"
              onClick={handleIncrement}
              disabled={disabled || !canIncrement}
              className={cn(stepButtonVariants({ position: 'right', size }))}
              tabIndex={-1}
              aria-label="Increment"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-xs text-[var(--danger-fg)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';
```

### Usage Examples

```typescript
// Basic number input
<NumberInput
  value={quantity}
  onChange={setQuantity}
  min={1}
  max={100}
/>

// With step and precision
<NumberInput
  value={price}
  onChange={setPrice}
  min={0}
  step={0.01}
  precision={2}
  formatValue={(v) => `$${v.toFixed(2)}`}
/>

// Button position variants
<NumberInput
  value={count}
  onChange={setCount}
  buttonPosition="right"
  min={0}
/>

// Without buttons
<NumberInput
  value={year}
  onChange={setYear}
  showButtons={false}
  min={1900}
  max={2100}
/>
```

---

## 8. DatePicker

Date selection component supporting date-only, date-time, and range selection modes.

### Interface Definition

```typescript
// app/components/ui/date-picker.tsx
export interface DatePickerProps {
  /** Selected date */
  value?: Date;
  /** Change handler */
  onChange?: (date: Date | undefined) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Disabled dates */
  disabledDates?: Date[];
  /** Include time selection */
  showTime?: boolean;
  /** Time step in minutes */
  timeStep?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Date format for display */
  format?: string;
  /** Error state */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface DateRangePickerProps {
  /** Selected date range */
  value?: { start?: Date; end?: Date };
  /** Change handler */
  onChange?: (range: { start?: Date; end?: Date }) => void;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Preset ranges */
  presets?: DateRangePreset[];
  /** Error state */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface DateRangePreset {
  label: string;
  range: { start: Date; end: Date };
}
```

### CVA Variants

```typescript
const datePickerTriggerVariants = cva(
  [
    'flex h-9 w-full items-center gap-2 rounded-[6px] border px-3',
    'bg-[var(--bg-default)] text-sm text-[var(--fg-default)]',
    'transition-all duration-150',
    'hover:border-[var(--fg-subtle)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--accent-fg)]',
    'focus:ring-offset-2 focus:ring-offset-[var(--bg-canvas)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: 'border-[var(--border-default)]',
        error: 'border-[var(--danger-fg)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const calendarDayVariants = cva(
  [
    'h-8 w-8 rounded-[4px] text-sm',
    'transition-colors duration-100',
    'focus:outline-none focus:ring-2 focus:ring-[var(--accent-fg)]',
  ],
  {
    variants: {
      state: {
        default: 'hover:bg-[var(--bg-subtle)] text-[var(--fg-default)]',
        selected: 'bg-[var(--accent-emphasis)] text-white',
        today: 'border border-[var(--accent-fg)] text-[var(--accent-fg)]',
        disabled: 'text-[var(--fg-subtle)] cursor-not-allowed',
        outside: 'text-[var(--fg-subtle)] opacity-50',
        inRange: 'bg-[var(--accent-muted)] text-[var(--fg-default)]',
        rangeStart: 'bg-[var(--accent-emphasis)] text-white rounded-r-none',
        rangeEnd: 'bg-[var(--accent-emphasis)] text-white rounded-l-none',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/date-picker.tsx
import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@/components/icons';

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates = [],
  showTime = false,
  timeStep = 15,
  placeholder = 'Select date',
  format = 'MMM d, yyyy',
  error,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(value || new Date());
  const [selectedTime, setSelectedTime] = React.useState({
    hours: value?.getHours() || 12,
    minutes: value?.getMinutes() || 0,
  });

  const formatDate = (date: Date): string => {
    // Simple format implementation - use date-fns in real implementation
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    if (showTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return date.toLocaleDateString('en-US', options);
  };

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    if (showTime) {
      newDate.setHours(selectedTime.hours, selectedTime.minutes);
    }
    onChange?.(newDate);
    if (!showTime) {
      setOpen(false);
    }
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    setSelectedTime({ hours, minutes });
    if (value) {
      const newDate = new Date(value);
      newDate.setHours(hours, minutes);
      onChange?.(newDate);
    }
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return disabledDates.some(
      (d) => d.toDateString() === date.toDateString()
    );
  };

  const variant = error ? 'error' : 'default';

  return (
    <div className="w-full">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={disabled}
          className={cn(datePickerTriggerVariants({ variant }))}
        >
          <CalendarIcon className="h-4 w-4 text-[var(--fg-muted)]" />
          {value ? (
            <span>{formatDate(value)}</span>
          ) : (
            <span className="text-[var(--fg-subtle)]">{placeholder}</span>
          )}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-50 rounded-[6px] border border-[var(--border-default)]',
              'bg-[var(--bg-default)] p-3 shadow-lg',
              'animate-in fade-in-0 zoom-in-95 duration-150'
            )}
            sideOffset={4}
            align="start"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() =>
                  setViewDate(
                    new Date(viewDate.getFullYear(), viewDate.getMonth() - 1)
                  )
                }
                className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)]"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {viewDate.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setViewDate(
                    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1)
                  )
                }
                className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)]"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar Grid */}
            <CalendarGrid
              viewDate={viewDate}
              selectedDate={value}
              onSelect={handleDateSelect}
              isDisabled={isDateDisabled}
            />

            {/* Time Picker */}
            {showTime && (
              <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
                <TimePicker
                  hours={selectedTime.hours}
                  minutes={selectedTime.minutes}
                  onChange={handleTimeChange}
                  step={timeStep}
                />
              </div>
            )}

            {/* Done button for datetime */}
            {showTime && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-[6px]',
                    'bg-[var(--accent-emphasis)] text-white',
                    'hover:bg-[var(--accent-fg)]'
                  )}
                >
                  Done
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && (
        <p className="mt-1.5 text-xs text-[var(--danger-fg)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function CalendarGrid({
  viewDate,
  selectedDate,
  onSelect,
  isDisabled,
}: {
  viewDate: Date;
  selectedDate?: Date;
  onSelect: (date: Date) => void;
  isDisabled: (date: Date) => boolean;
}) {
  const today = new Date();
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();

  const days: (Date | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
  }

  const getDayState = (date: Date | null) => {
    if (!date) return 'outside';
    if (isDisabled(date)) return 'disabled';
    if (selectedDate?.toDateString() === date.toDateString()) return 'selected';
    if (today.toDateString() === date.toDateString()) return 'today';
    return 'default';
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {/* Day labels */}
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
        <div
          key={day}
          className="h-8 w-8 flex items-center justify-center text-xs text-[var(--fg-muted)]"
        >
          {day}
        </div>
      ))}

      {/* Day cells */}
      {days.map((date, index) => (
        <button
          key={index}
          type="button"
          disabled={!date || isDisabled(date)}
          onClick={() => date && onSelect(date)}
          className={cn(
            calendarDayVariants({ state: getDayState(date) }),
            'flex items-center justify-center'
          )}
        >
          {date?.getDate()}
        </button>
      ))}
    </div>
  );
}

function TimePicker({
  hours,
  minutes,
  onChange,
  step,
}: {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
  step: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--fg-muted)]">Time:</span>
      <select
        value={hours}
        onChange={(e) => onChange(parseInt(e.target.value), minutes)}
        className={cn(
          'rounded-[4px] border border-[var(--border-default)]',
          'bg-[var(--bg-default)] px-2 py-1 text-sm'
        )}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
      <span>:</span>
      <select
        value={minutes}
        onChange={(e) => onChange(hours, parseInt(e.target.value))}
        className={cn(
          'rounded-[4px] border border-[var(--border-default)]',
          'bg-[var(--bg-default)] px-2 py-1 text-sm'
        )}
      >
        {Array.from({ length: 60 / step }, (_, i) => i * step).map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### Date Range Picker

```typescript
// app/components/ui/date-range-picker.tsx
export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  presets = [],
  error,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selecting, setSelecting] = React.useState<'start' | 'end'>('start');

  const handleDateSelect = (date: Date) => {
    if (selecting === 'start') {
      onChange?.({ start: date, end: undefined });
      setSelecting('end');
    } else {
      if (value?.start && date < value.start) {
        onChange?.({ start: date, end: value.start });
      } else {
        onChange?.({ ...value, end: date });
      }
      setSelecting('start');
      setOpen(false);
    }
  };

  const handlePreset = (preset: DateRangePreset) => {
    onChange?.(preset.range);
    setOpen(false);
  };

  const formatRange = (): string => {
    if (!value?.start) return 'Select date range';
    if (!value.end) return `${formatDate(value.start)} - ...`;
    return `${formatDate(value.start)} - ${formatDate(value.end)}`;
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(datePickerTriggerVariants({ variant: error ? 'error' : 'default' }))}
      >
        <CalendarIcon className="h-4 w-4 text-[var(--fg-muted)]" />
        <span className={!value?.start ? 'text-[var(--fg-subtle)]' : ''}>
          {formatRange()}
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 rounded-[6px] border border-[var(--border-default)]',
            'bg-[var(--bg-default)] shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          sideOffset={4}
        >
          <div className="flex">
            {/* Presets */}
            {presets.length > 0 && (
              <div className="border-r border-[var(--border-default)] p-3">
                <div className="text-xs font-medium text-[var(--fg-muted)] mb-2">
                  Quick select
                </div>
                <div className="space-y-1">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-sm rounded-[4px]',
                        'hover:bg-[var(--bg-subtle)]'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar */}
            <div className="p-3">
              <DualCalendarGrid
                value={value}
                onSelect={handleDateSelect}
                minDate={minDate}
                maxDate={maxDate}
                selecting={selecting}
              />
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

### Usage Examples

```typescript
// Date only
<DatePicker
  value={dueDate}
  onChange={setDueDate}
  placeholder="Select due date"
  minDate={new Date()}
/>

// Date and time
<DatePicker
  value={scheduledAt}
  onChange={setScheduledAt}
  showTime
  timeStep={15}
  placeholder="Schedule for..."
/>

// Date range with presets
<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  presets={[
    { label: 'Today', range: { start: today, end: today } },
    { label: 'Last 7 days', range: { start: weekAgo, end: today } },
    { label: 'Last 30 days', range: { start: monthAgo, end: today } },
    { label: 'This month', range: { start: monthStart, end: monthEnd } },
  ]}
/>
```

---

## 9. FileInput

File upload component supporting single/multiple files, drag-and-drop, type restrictions, and previews.

### Interface Definition

```typescript
// app/components/ui/file-input.tsx
export interface FileInputProps {
  /** Selected files */
  value?: File[];
  /** Change handler */
  onChange?: (files: File[]) => void;
  /** Allow multiple files */
  multiple?: boolean;
  /** Accepted file types (MIME types or extensions) */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Show file previews */
  showPreview?: boolean;
  /** Enable drag and drop zone */
  dropzone?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: string;
  /** Helper text */
  helperText?: string;
}

export interface FilePreview {
  file: File;
  previewUrl?: string;
  progress?: number;
  error?: string;
}
```

### CVA Variants

```typescript
const dropzoneVariants = cva(
  [
    'relative flex flex-col items-center justify-center',
    'rounded-[6px] border-2 border-dashed p-6',
    'transition-all duration-150',
    'cursor-pointer',
  ],
  {
    variants: {
      state: {
        default: [
          'border-[var(--border-default)] bg-[var(--bg-default)]',
          'hover:border-[var(--accent-fg)] hover:bg-[var(--accent-muted)]',
        ],
        active: [
          'border-[var(--accent-fg)] bg-[var(--accent-muted)]',
        ],
        error: [
          'border-[var(--danger-fg)] bg-[var(--danger-muted)]',
        ],
        disabled: [
          'border-[var(--border-muted)] bg-[var(--bg-muted)]',
          'cursor-not-allowed opacity-50',
        ],
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

const fileItemVariants = cva(
  [
    'flex items-center gap-3 p-3 rounded-[6px] border',
    'bg-[var(--bg-default)] border-[var(--border-default)]',
  ],
  {
    variants: {
      state: {
        default: '',
        uploading: 'animate-pulse',
        error: 'border-[var(--danger-fg)] bg-[var(--danger-muted)]',
        success: 'border-[var(--success-fg)]',
      },
    },
  }
);
```

### Implementation

```typescript
// app/components/ui/file-input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  UploadIcon,
  FileIcon,
  ImageIcon,
  XIcon,
  AlertCircleIcon,
} from '@/components/icons';

export function FileInput({
  value = [],
  onChange,
  multiple = false,
  accept,
  maxSize,
  maxFiles = 10,
  showPreview = true,
  dropzone = true,
  disabled = false,
  error,
  helperText,
}: FileInputProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [previews, setPreviews] = React.useState<FilePreview[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Generate previews for image files
  React.useEffect(() => {
    const newPreviews = value.map((file) => {
      const preview: FilePreview = { file };

      if (file.type.startsWith('image/')) {
        preview.previewUrl = URL.createObjectURL(file);
      }

      return preview;
    });

    setPreviews(newPreviews);

    // Cleanup URLs on unmount
    return () => {
      newPreviews.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [value]);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File too large. Maximum size is ${formatBytes(maxSize)}`;
    }

    if (accept) {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const fileType = file.type;
      const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;

      const isAccepted = acceptedTypes.some(
        (type) =>
          type === fileType ||
          type === fileExt ||
          (type.endsWith('/*') && fileType.startsWith(type.replace('/*', '/')))
      );

      if (!isAccepted) {
        return `File type not accepted. Allowed: ${accept}`;
      }
    }

    return null;
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    if (!multiple) {
      onChange?.(validFiles.slice(0, 1));
    } else {
      const combined = [...value, ...validFiles].slice(0, maxFiles);
      onChange?.(combined);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...value];
    newFiles.splice(index, 1);
    onChange?.(newFiles);
  };

  const getState = () => {
    if (disabled) return 'disabled';
    if (error) return 'error';
    if (isDragging) return 'active';
    return 'default';
  };

  return (
    <div className="w-full space-y-3">
      {/* Dropzone */}
      {dropzone && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(dropzoneVariants({ state: getState() }))}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
          />

          <UploadIcon className="h-8 w-8 text-[var(--fg-muted)] mb-2" />
          <p className="text-sm text-[var(--fg-default)] mb-1">
            {isDragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">
            or <span className="text-[var(--accent-fg)]">browse</span> to select
          </p>

          {helperText && (
            <p className="text-xs text-[var(--fg-muted)] mt-2">{helperText}</p>
          )}
        </div>
      )}

      {/* Simple file input (non-dropzone) */}
      {!dropzone && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={cn(
              'px-4 py-2 text-sm rounded-[6px] border',
              'border-[var(--border-default)] bg-[var(--bg-default)]',
              'hover:bg-[var(--bg-subtle)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Choose file{multiple ? 's' : ''}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
          />
          <span className="text-sm text-[var(--fg-muted)]">
            {value.length === 0
              ? 'No file selected'
              : `${value.length} file${value.length > 1 ? 's' : ''} selected`}
          </span>
        </div>
      )}

      {/* File previews */}
      {showPreview && previews.length > 0 && (
        <div className="space-y-2">
          {previews.map((preview, index) => (
            <div key={index} className={cn(fileItemVariants({ state: 'default' }))}>
              {/* Preview thumbnail */}
              {preview.previewUrl ? (
                <img
                  src={preview.previewUrl}
                  alt={preview.file.name}
                  className="h-10 w-10 rounded-[4px] object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[var(--bg-subtle)]">
                  <FileIcon className="h-5 w-5 text-[var(--fg-muted)]" />
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--fg-default)] truncate">
                  {preview.file.name}
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {formatBytes(preview.file.size)}
                </p>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 rounded-[4px] hover:bg-[var(--bg-subtle)]"
                aria-label="Remove file"
              >
                <XIcon className="h-4 w-4 text-[var(--fg-muted)]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-[var(--danger-fg)] flex items-center gap-1" role="alert">
          <AlertCircleIcon className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

### Usage Examples

```typescript
// Single file upload
<FileInput
  value={files}
  onChange={setFiles}
  accept=".pdf,.doc,.docx"
  maxSize={10 * 1024 * 1024} // 10MB
  helperText="PDF or Word documents up to 10MB"
/>

// Multiple image upload with previews
<FileInput
  value={images}
  onChange={setImages}
  multiple
  maxFiles={5}
  accept="image/*"
  showPreview
  helperText="Up to 5 images (PNG, JPG, GIF)"
/>

// Simple file input (no dropzone)
<FileInput
  value={attachment}
  onChange={setAttachment}
  dropzone={false}
  accept=".csv,.xlsx"
/>
```

---

## 10. Form Layout Components

Compound components for structuring forms with consistent spacing, labels, and error handling.

### FormField

```typescript
// app/components/ui/form-field.tsx
export interface FormFieldProps {
  /** Field label */
  label: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string;
  /** Required indicator */
  required?: boolean;
  /** Field ID for label association */
  htmlFor?: string;
  /** Field content */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

export function FormField({
  label,
  description,
  error,
  required = false,
  htmlFor,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-[var(--fg-default)]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[var(--danger-fg)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {description && (
          <span className="text-xs text-[var(--fg-muted)]">{description}</span>
        )}
      </div>

      {children}

      {error && (
        <p
          className="text-xs text-[var(--danger-fg)] flex items-center gap-1"
          role="alert"
          id={htmlFor ? `${htmlFor}-error` : undefined}
        >
          <AlertCircleIcon className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
```

### FormSection

```typescript
// app/components/ui/form-section.tsx
export interface FormSectionProps {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Section content */
  children: React.ReactNode;
  /** Collapsible section */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Additional class name */
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <section
      className={cn(
        'rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-default)]',
        className
      )}
    >
      {(title || description) && (
        <div
          className={cn(
            'px-4 py-3 border-b border-[var(--border-default)]',
            collapsible && 'cursor-pointer hover:bg-[var(--bg-subtle)]'
          )}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-sm font-semibold text-[var(--fg-default)]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                  {description}
                </p>
              )}
            </div>
            {collapsible && (
              <ChevronDownIcon
                className={cn(
                  'h-4 w-4 text-[var(--fg-muted)] transition-transform',
                  collapsed && '-rotate-90'
                )}
              />
            )}
          </div>
        </div>
      )}

      {!collapsed && <div className="p-4 space-y-4">{children}</div>}
    </section>
  );
}
```

### FormActions

```typescript
// app/components/ui/form-actions.tsx
export interface FormActionsProps {
  /** Action buttons */
  children: React.ReactNode;
  /** Alignment */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Sticky to bottom */
  sticky?: boolean;
  /** Additional class name */
  className?: string;
}

export function FormActions({
  children,
  align = 'right',
  sticky = false,
  className,
}: FormActionsProps) {
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 pt-4',
        alignmentClasses[align],
        sticky && [
          'sticky bottom-0 -mx-4 -mb-4 px-4 py-4',
          'bg-[var(--bg-default)] border-t border-[var(--border-default)]',
        ],
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Form Component

```typescript
// app/components/ui/form.tsx
export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /** Form-level error */
  error?: string;
  /** Success message */
  success?: string;
  /** Loading state */
  isSubmitting?: boolean;
}

export function Form({
  children,
  error,
  success,
  isSubmitting,
  className,
  ...props
}: FormProps) {
  return (
    <form className={cn('space-y-6', className)} {...props}>
      {/* Form-level messages */}
      {error && (
        <div
          className={cn(
            'flex items-start gap-2 p-3 rounded-[6px]',
            'bg-[var(--danger-muted)] border border-[var(--danger-fg)]'
          )}
          role="alert"
        >
          <AlertCircleIcon className="h-4 w-4 text-[var(--danger-fg)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--danger-fg)]">{error}</p>
        </div>
      )}

      {success && (
        <div
          className={cn(
            'flex items-start gap-2 p-3 rounded-[6px]',
            'bg-[var(--success-muted)] border border-[var(--success-fg)]'
          )}
          role="status"
        >
          <CheckCircleIcon className="h-4 w-4 text-[var(--success-fg)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--success-fg)]">{success}</p>
        </div>
      )}

      {children}

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Spinner className="h-8 w-8 text-[var(--accent-fg)]" />
        </div>
      )}
    </form>
  );
}
```

### Usage Examples

```typescript
// Complete form example
<Form onSubmit={handleSubmit} error={formError} isSubmitting={isSubmitting}>
  <FormSection title="Basic Information" description="Configure the agent's identity">
    <FormField label="Agent Name" required htmlFor="name" error={errors.name}>
      <TextInput
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Agent"
      />
    </FormField>

    <FormField label="Description" htmlFor="description" error={errors.description}>
      <Textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What does this agent do?"
        maxLength={500}
        showCounter
      />
    </FormField>
  </FormSection>

  <FormSection title="Permissions" collapsible defaultCollapsed>
    <CheckboxGroup
      label="Allowed Tools"
      options={toolOptions}
      value={permissions}
      onChange={setPermissions}
    />
  </FormSection>

  <FormActions>
    <Button variant="ghost" type="button" onClick={onCancel}>
      Cancel
    </Button>
    <Button variant="primary" type="submit" isLoading={isSubmitting}>
      Create Agent
    </Button>
  </FormActions>
</Form>
```

---

## 11. Validation Patterns

### Zod Integration

```typescript
// lib/validation/form-schemas.ts
import { z } from 'zod';

export const agentFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  type: z.enum(['task', 'conversational', 'background'], {
    required_error: 'Please select an agent type',
  }),
  permissions: z
    .array(z.enum(['bash', 'edit', 'write', 'mcp']))
    .min(1, 'Select at least one permission'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  maxTokens: z.number().min(1000).max(100000).optional(),
});

export type AgentFormData = z.infer<typeof agentFormSchema>;
```

### useFormValidation Hook

```typescript
// hooks/use-form-validation.ts
import { useState, useCallback } from 'react';
import { z } from 'zod';

export interface UseFormValidationOptions<T> {
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useFormValidation<T extends Record<string, unknown>>({
  schema,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormValidationOptions<T>) {
  const [values, setValues] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validateField = useCallback(
    (name: keyof T, value: unknown): string | null => {
      try {
        const fieldSchema = schema.shape?.[name as string];
        if (fieldSchema) {
          fieldSchema.parse(value);
        }
        return null;
      } catch (err) {
        if (err instanceof z.ZodError) {
          return err.errors[0]?.message || 'Invalid value';
        }
        return 'Validation error';
      }
    },
    [schema]
  );

  const validateAll = useCallback((): boolean => {
    const result = schema.safeParse(values);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!newErrors[path]) {
          newErrors[path] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  }, [schema, values]);

  const setValue = useCallback(
    (name: keyof T, value: unknown) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      if (validateOnChange && touched[name as string]) {
        const error = validateField(name, value);
        setErrors((prev) => ({
          ...prev,
          [name]: error || '',
        }));
      }
    },
    [validateOnChange, touched, validateField]
  );

  const setFieldTouched = useCallback(
    (name: keyof T) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      if (validateOnBlur) {
        const error = validateField(name, values[name]);
        setErrors((prev) => ({
          ...prev,
          [name]: error || '',
        }));
      }
    },
    [validateOnBlur, validateField, values]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      if (!validateAll()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values as T);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Submission failed');
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateAll, values, onSubmit]
  );

  const reset = useCallback(() => {
    setValues({});
    setErrors({});
    setTouched({});
    setFormError(null);
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    formError,
    setValue,
    setFieldTouched,
    handleSubmit,
    reset,
    validateField,
    validateAll,
  };
}
```

### Async Validation

```typescript
// lib/validation/async-validators.ts
export async function validateUniqueAgentName(
  name: string,
  projectId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/projects/${projectId}/agents/check-name?name=${encodeURIComponent(name)}`
    );
    const data = await response.json();
    return data.exists ? 'An agent with this name already exists' : null;
  } catch {
    return 'Unable to validate name';
  }
}

// Usage in component
const [asyncError, setAsyncError] = useState<string | null>(null);
const debouncedName = useDebounce(name, 500);

useEffect(() => {
  if (debouncedName) {
    validateUniqueAgentName(debouncedName, projectId).then(setAsyncError);
  }
}, [debouncedName, projectId]);

<FormField
  label="Agent Name"
  error={errors.name || asyncError}
  // ...
/>
```

### Inline Error Display Pattern

```typescript
// Immediate feedback on blur
<TextInput
  id="email"
  value={email}
  onChange={(e) => setValue('email', e.target.value)}
  onBlur={() => setFieldTouched('email')}
  error={touched.email ? errors.email : undefined}
/>

// Character limit feedback
<Textarea
  id="prompt"
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  maxLength={5000}
  showCounter
  error={prompt.length > 5000 ? 'Prompt is too long' : undefined}
/>
```

---

## 12. Accessibility

### Labels and ARIA

All form inputs must have associated labels:

```typescript
// Using htmlFor
<FormField label="Agent Name" htmlFor="agent-name">
  <TextInput id="agent-name" />
</FormField>

// Using aria-labelledby for complex labels
<div>
  <span id="priority-label">Priority Level</span>
  <span id="priority-desc">Higher priority agents run first</span>
</div>
<RadioGroup
  aria-labelledby="priority-label"
  aria-describedby="priority-desc"
  // ...
/>
```

### Error Announcements

Errors should be announced to screen readers:

```typescript
// Using role="alert" for immediate announcement
{error && (
  <p role="alert" className="text-xs text-[var(--danger-fg)]">
    {error}
  </p>
)}

// Using aria-describedby for association
<TextInput
  id="name"
  aria-invalid={!!error}
  aria-describedby={error ? 'name-error' : undefined}
/>
{error && <p id="name-error" role="alert">{error}</p>}

// Live region for async validation
<div aria-live="polite" aria-atomic="true">
  {asyncError && <span className="sr-only">{asyncError}</span>}
</div>
```

### Required Field Indicators

```typescript
// Visual indicator with aria-required
<FormField label="Email" required>
  <TextInput
    id="email"
    aria-required="true"
    // ...
  />
</FormField>

// The label shows asterisk, screen reader announces "required"
<label htmlFor="email">
  Email
  <span className="text-[var(--danger-fg)]" aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</label>
```

### Keyboard Navigation

All form components support standard keyboard interactions:

| Component | Key | Action |
|-----------|-----|--------|
| TextInput, Textarea | `Tab` | Focus next/previous |
| Select | `Space/Enter` | Open dropdown |
| Select | `ArrowUp/Down` | Navigate options |
| Select | `Escape` | Close dropdown |
| Checkbox | `Space` | Toggle checked |
| RadioGroup | `ArrowUp/Down/Left/Right` | Navigate options |
| NumberInput | `ArrowUp/Down` | Increment/decrement |
| DatePicker | `ArrowKeys` | Navigate calendar |
| DatePicker | `Enter` | Select date |
| FileInput | `Enter/Space` | Open file browser |

### Focus Management

```typescript
// Auto-focus first error field on submit
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateAll()) {
    // Find and focus first error field
    const firstErrorKey = Object.keys(errors).find((key) => errors[key]);
    if (firstErrorKey) {
      const element = document.getElementById(firstErrorKey);
      element?.focus();
    }
    return;
  }

  // ...
};

// Focus trap in modals with forms
<DialogPrimitive.Content
  onOpenAutoFocus={(e) => {
    // Focus first input in form
    const firstInput = e.currentTarget.querySelector('input, textarea, select');
    firstInput?.focus();
    e.preventDefault();
  }}
>
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Component Patterns](../implementation/component-patterns.md) | Base component implementations |
| [Design Tokens](../wireframes/design-tokens.css) | CSS custom properties |
| [Animation System](../implementation/animation-system.md) | Transition timing |
| [Error Catalog](../errors/error-catalog.md) | Validation error messages |
| [Approval Dialog](./approval-dialog.md) | Form usage in dialog |
| [Agent Session View](./agent-session-view.md) | Form usage in settings |
