import { Code, Copy, DownloadSimple } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useTerraform } from './terraform-context';
import { downloadAsFile } from './terraform-utils';

export function TerraformRightPanel(): React.JSX.Element {
  const { generatedCode } = useTerraform();

  return (
    <div className="flex flex-1 flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-3 text-xs font-semibold text-fg-muted">
        <Code className="h-3.5 w-3.5" />
        Code Preview
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <CodePreview code={generatedCode} />
      </div>
    </div>
  );
}

function useHighlightedCode(code: string | null): string | null {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    import('shiki')
      .then(({ codeToHtml }) =>
        codeToHtml(code, {
          lang: 'hcl',
          theme: 'github-dark-default',
        }).then((result) => {
          if (!cancelled) setHtml(result);
        })
      )
      .catch((err) => {
        if (!cancelled) {
          console.error('[Terraform] Failed to load syntax highlighting:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return html;
}

function CodePreview({ code }: { code: string | null }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const highlightedHtml = useHighlightedCode(code);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[Terraform] Failed to copy to clipboard:', err);
    }
  }, [code]);

  const handleDownload = useCallback(() => {
    if (!code) return;
    downloadAsFile(code, 'main.tf');
  }, [code]);

  if (!code) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Code className="h-8 w-8 text-fg-subtle" />
        <p className="text-sm text-fg-muted">Generated Terraform code will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Filename bar + actions */}
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-3 py-2">
        <span className="font-mono text-xs text-fg-muted">main.tf</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied && <span className="ml-1 text-[10px] text-success">Copied</span>}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            title="Download as .tf file"
            aria-label="Download as .tf file"
          >
            <DownloadSimple className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Code block with optional syntax highlighting */}
      <div className="flex-1 overflow-auto">
        {highlightedHtml ? (
          <div
            className="terraform-code-preview p-3 text-xs leading-relaxed [&_pre]:!bg-transparent [&_code]:font-mono"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki escapes code input and produces safe HTML
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="p-3 font-mono text-xs leading-relaxed text-fg">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
