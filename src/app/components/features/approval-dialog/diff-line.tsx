import { cva, type VariantProps } from 'class-variance-authority';
import type { DiffLine as DiffLineType, DiffLineType as LineType } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';

/**
 * CVA variants for diff line styling
 */
const diffLineVariants = cva('group flex min-h-6 font-mono text-[13px] leading-6', {
  variants: {
    type: {
      addition: 'bg-[var(--syntax-added)]/10',
      deletion: 'bg-[var(--syntax-removed)]/10',
      context: 'hover:bg-surface-muted',
    },
  },
  defaultVariants: {
    type: 'context',
  },
});

const lineNumberVariants = cva(
  'flex w-12 shrink-0 select-none items-center justify-end px-2 text-right text-fg-subtle',
  {
    variants: {
      type: {
        addition: 'bg-[var(--syntax-added)]/20 text-[var(--syntax-added)]',
        deletion: 'bg-[var(--syntax-removed)]/20 text-[var(--syntax-removed)]',
        context: '',
      },
    },
    defaultVariants: {
      type: 'context',
    },
  }
);

const lineIndicatorVariants = cva(
  'flex w-6 shrink-0 select-none items-center justify-center text-fg-subtle',
  {
    variants: {
      type: {
        addition: 'text-[var(--syntax-added)]',
        deletion: 'text-[var(--syntax-removed)]',
        context: '',
      },
    },
    defaultVariants: {
      type: 'context',
    },
  }
);

const lineContentVariants = cva('flex-1 overflow-x-auto whitespace-pre px-4', {
  variants: {
    type: {
      addition: 'text-[var(--syntax-added)]',
      deletion: 'text-[var(--syntax-removed)]',
      context: 'text-fg-muted',
    },
  },
  defaultVariants: {
    type: 'context',
  },
});

interface DiffLineProps extends VariantProps<typeof diffLineVariants> {
  line: DiffLineType;
}

/**
 * Single line rendering with:
 * - Line number (old and new)
 * - Line type indicator (+/-/space)
 * - Line content with syntax highlighting
 * - Background color based on type
 */
export function DiffLine({ line }: DiffLineProps): React.JSX.Element {
  const { type, content, oldLineNumber, newLineNumber } = line;

  return (
    <div className={diffLineVariants({ type })} data-testid={`diff-line-${type}`}>
      {/* Old line number */}
      <span className={lineNumberVariants({ type })}>{oldLineNumber ?? ''}</span>

      {/* New line number */}
      <span className={cn(lineNumberVariants({ type }), 'border-r border-border')}>
        {newLineNumber ?? ''}
      </span>

      {/* Line type indicator */}
      <span className={lineIndicatorVariants({ type })}>
        {type === 'addition' && '+'}
        {type === 'deletion' && '-'}
        {type === 'context' && ' '}
      </span>

      {/* Line content with syntax highlighting */}
      <span className={lineContentVariants({ type })}>
        <SyntaxHighlight content={content} lineType={type} />
      </span>
    </div>
  );
}

interface SyntaxHighlightProps {
  content: string;
  lineType: LineType;
}

/**
 * Token types for syntax highlighting
 */
type TokenType = 'keyword' | 'string' | 'function' | 'comment' | 'type' | 'number' | 'text';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize content for syntax highlighting
 * Supports: keywords, strings, comments, functions, types, numbers
 */
function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let remaining = content;

  // Language keywords (TypeScript/JavaScript focus)
  const keywords =
    /^(import|export|from|const|let|var|function|class|interface|type|extends|implements|return|if|else|for|while|do|switch|case|break|continue|throw|try|catch|finally|new|this|super|async|await|static|public|private|protected|readonly|void|null|undefined|true|false|typeof|instanceof|in|of|as|is)\b/;

  // Type annotations (common TypeScript types)
  const types =
    /^(string|number|boolean|object|any|unknown|never|void|null|undefined|Array|Map|Set|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|InstanceType)\b/;

  while (remaining.length > 0) {
    // Single-line comment
    if (remaining.startsWith('//')) {
      tokens.push({ type: 'comment', value: remaining });
      break;
    }

    // Multi-line comment start (just detect, don't handle across lines)
    if (remaining.startsWith('/*')) {
      const endIndex = remaining.indexOf('*/');
      if (endIndex !== -1) {
        tokens.push({ type: 'comment', value: remaining.slice(0, endIndex + 2) });
        remaining = remaining.slice(endIndex + 2);
        continue;
      }
      tokens.push({ type: 'comment', value: remaining });
      break;
    }

    // JSDoc style comment content (lines starting with *)
    if (remaining.startsWith(' * ') || remaining.startsWith(' */') || remaining.startsWith('/**')) {
      tokens.push({ type: 'comment', value: remaining });
      break;
    }

    // String (double quotes)
    if (remaining.startsWith('"')) {
      const endIndex = findClosingQuote(remaining, '"');
      const value = remaining.slice(0, endIndex + 1);
      tokens.push({ type: 'string', value });
      remaining = remaining.slice(endIndex + 1);
      continue;
    }

    // String (single quotes)
    if (remaining.startsWith("'")) {
      const endIndex = findClosingQuote(remaining, "'");
      const value = remaining.slice(0, endIndex + 1);
      tokens.push({ type: 'string', value });
      remaining = remaining.slice(endIndex + 1);
      continue;
    }

    // Template literal (backticks)
    if (remaining.startsWith('`')) {
      const endIndex = findClosingQuote(remaining, '`');
      const value = remaining.slice(0, endIndex + 1);
      tokens.push({ type: 'string', value });
      remaining = remaining.slice(endIndex + 1);
      continue;
    }

    // Number
    const numberMatch = remaining.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Type (check before keyword)
    const typeMatch = remaining.match(types);
    if (typeMatch) {
      tokens.push({ type: 'type', value: typeMatch[0] });
      remaining = remaining.slice(typeMatch[0].length);
      continue;
    }

    // Keyword
    const keywordMatch = remaining.match(keywords);
    if (keywordMatch) {
      tokens.push({ type: 'keyword', value: keywordMatch[0] });
      remaining = remaining.slice(keywordMatch[0].length);
      continue;
    }

    // Function call (identifier followed by parenthesis)
    const funcMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*)\(/);
    if (funcMatch?.[1]) {
      tokens.push({ type: 'function', value: funcMatch[1] });
      remaining = remaining.slice(funcMatch[1].length);
      continue;
    }

    // Type annotation after colon (e.g., `: string`)
    const typeAnnotationMatch = remaining.match(/^(:\s*)([A-Z][a-zA-Z0-9_$]*)/);
    if (typeAnnotationMatch?.[1] && typeAnnotationMatch[2]) {
      tokens.push({ type: 'text', value: typeAnnotationMatch[1] });
      tokens.push({ type: 'type', value: typeAnnotationMatch[2] });
      remaining = remaining.slice(typeAnnotationMatch[0].length);
      continue;
    }

    // Generic type parameter (e.g., `<string>`, `<T>`)
    const genericMatch = remaining.match(/^<([A-Z][a-zA-Z0-9_$,\s]*)>/);
    if (genericMatch?.[1]) {
      tokens.push({ type: 'text', value: '<' });
      tokens.push({ type: 'type', value: genericMatch[1] });
      tokens.push({ type: 'text', value: '>' });
      remaining = remaining.slice(genericMatch[0].length);
      continue;
    }

    // Default: single character as text
    const char = remaining[0];
    if (char !== undefined) {
      tokens.push({ type: 'text', value: char });
      remaining = remaining.slice(1);
    } else {
      // Safety break in case of empty string
      break;
    }
  }

  return tokens;
}

/**
 * Find the closing quote, handling escape sequences
 */
function findClosingQuote(str: string, quote: string): number {
  let i = 1;
  while (i < str.length) {
    if (str[i] === '\\') {
      i += 2; // Skip escaped character
      continue;
    }
    if (str[i] === quote) {
      return i;
    }
    i++;
  }
  return str.length - 1;
}

/**
 * Get CSS class for token type using CSS custom properties
 */
function getTokenClassName(tokenType: TokenType): string {
  const classMap: Record<TokenType, string> = {
    keyword: 'text-[var(--syntax-keyword)]',
    string: 'text-[var(--syntax-string)]',
    function: 'text-[var(--syntax-function)]',
    comment: 'text-[var(--syntax-comment)] italic',
    type: 'text-[var(--syntax-type)]',
    number: 'text-[var(--syntax-number)]',
    text: '',
  };
  return classMap[tokenType];
}

/**
 * Syntax highlighting component using CSS custom properties
 * for theme-aware colors.
 */
function SyntaxHighlight({ content, lineType }: SyntaxHighlightProps): React.JSX.Element {
  // For additions and deletions, use the line type color
  // For context, apply syntax highlighting
  if (lineType !== 'context') {
    // Still tokenize for structure but use line type color as base
    const tokens = tokenize(content);
    return (
      <>
        {tokens.map((token, index) => {
          // For additions/deletions, use a subtle version of syntax highlighting
          // Keywords and types get slightly different treatment
          const shouldHighlight = token.type === 'keyword' || token.type === 'type';
          return (
            <span
              key={`${token.type}-${index}-${token.value.slice(0, 10)}`}
              className={shouldHighlight ? 'font-semibold' : undefined}
              data-token-type={token.type}
            >
              {token.value}
            </span>
          );
        })}
      </>
    );
  }

  // Full syntax highlighting for context lines
  const tokens = tokenize(content);
  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={`${token.type}-${index}-${token.value.slice(0, 10)}`}
          className={getTokenClassName(token.type)}
          data-token-type={token.type}
        >
          {token.value}
        </span>
      ))}
    </>
  );
}
