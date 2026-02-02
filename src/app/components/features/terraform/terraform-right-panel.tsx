import { Code, Copy, DownloadSimple, FileCode, GitBranch } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useTerraform } from './terraform-context';
import { TerraformDependencyDiagram } from './terraform-dependency-diagram';
import { downloadAsFile } from './terraform-utils';

export function TerraformRightPanel(): React.JSX.Element {
  const { generatedCode } = useTerraform();
  const [activeTab, setActiveTab] = useState('code');
  const prevCodeRef = useRef<string | null>(null);

  // Auto-switch to dependencies tab when code is first generated
  useEffect(() => {
    if (generatedCode && !prevCodeRef.current) {
      setActiveTab('dependencies');
    }
    prevCodeRef.current = generatedCode;
  }, [generatedCode]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex min-h-0 flex-1 flex-col bg-surface"
    >
      {/* Header with tabs */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-gradient-to-r from-surface to-surface-subtle px-3 py-2">
        <TabsList className="h-7 border-0 bg-transparent p-0">
          <TabsTrigger value="code" className="h-6 gap-1 px-2 text-[11px]">
            <Code className="h-3 w-3" />
            Code
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="h-6 gap-1 px-2 text-[11px]">
            <GitBranch className="h-3 w-3" />
            Dependencies
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Code tab */}
      <TabsContent value="code" className="mt-0 min-h-0 flex-1 overflow-y-auto">
        <CodePreview code={generatedCode} />
      </TabsContent>

      {/* Dependencies tab */}
      <TabsContent value="dependencies" className="mt-0 min-h-0 flex-1">
        <TerraformDependencyDiagram />
      </TabsContent>
    </Tabs>
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-emphasis">
          <Code className="h-6 w-6 text-fg-subtle" />
        </div>
        <p className="text-sm text-fg-muted">Generated Terraform code will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-slide-up">
      {/* Filename bar + actions */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-subtle px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-xs text-fg-muted">
          <FileCode className="h-3.5 w-3.5 text-fg-subtle" />
          main.tf
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded p-1.5 text-fg-muted transition-all hover:bg-surface-emphasis hover:text-fg"
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied && <span className="ml-1 text-[10px] text-success">Copied!</span>}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="rounded p-1.5 text-fg-muted transition-all hover:bg-surface-emphasis hover:text-fg"
            title="Download as .tf file"
            aria-label="Download as .tf file"
          >
            <DownloadSimple className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Code block with optional syntax highlighting */}
      <div className="min-h-0 flex-1 overflow-auto">
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
