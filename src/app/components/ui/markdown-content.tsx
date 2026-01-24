/**
 * Markdown Content Renderer
 *
 * Renders markdown content with proper styling for code blocks,
 * lists, headings, and other formatting.
 */

import Markdown from 'react-markdown';
import { cn } from '@/lib/utils/cn';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps): React.JSX.Element {
  // Convert escaped newlines and tabs to actual characters for proper rendering
  const processedContent = content.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

  return (
    <div className={cn('min-w-0 break-words', className)}>
      <Markdown
        components={{
          // Code blocks and inline code
          pre({ children, ...props }) {
            return (
              <pre
                className="overflow-x-auto rounded-md border border-border bg-surface-muted p-3 font-mono text-xs"
                {...props}
              >
                {children}
              </pre>
            );
          },
          code({ children, className, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-accent"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-xs text-fg" {...props}>
                {children}
              </code>
            );
          },
          // Paragraphs
          p({ children, ...props }) {
            return (
              <p className="mb-2 last:mb-0" {...props}>
                {children}
              </p>
            );
          },
          // Lists
          ul({ children, ...props }) {
            return (
              <ul className="mb-2 list-disc pl-4 last:mb-0" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="mb-2 list-decimal pl-4 last:mb-0" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li className="mb-1" {...props}>
                {children}
              </li>
            );
          },
          // Headings
          h1({ children, ...props }) {
            return (
              <h1 className="mb-2 text-lg font-semibold" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2 className="mb-2 text-base font-semibold" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="mb-1 text-sm font-semibold" {...props}>
                {children}
              </h3>
            );
          },
          // Links
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                className="text-accent underline hover:text-accent/80"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-2 border-accent/50 pl-3 italic text-fg-muted"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Horizontal rule
          hr({ ...props }) {
            return <hr className="my-3 border-border" {...props} />;
          },
          // Strong/bold
          strong({ children, ...props }) {
            return (
              <strong className="font-semibold" {...props}>
                {children}
              </strong>
            );
          },
          // Emphasis/italic
          em({ children, ...props }) {
            return (
              <em className="italic" {...props}>
                {children}
              </em>
            );
          },
        }}
      >
        {processedContent}
      </Markdown>
    </div>
  );
}
