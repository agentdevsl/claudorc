import {
  Code,
  Copy,
  DownloadSimple,
  LinkSimple,
  MagnifyingGlass,
  SignIn,
  SignOut,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import type { ModuleMatch } from '@/lib/terraform/types';
import { PROVIDER_COLORS } from '@/lib/terraform/types';
import { useTerraform } from './terraform-context';
import { downloadAsFile, getConfidenceColor } from './terraform-utils';

type Tab = 'modules' | 'code';

export function TerraformRightPanel(): React.JSX.Element {
  const { matchedModules, generatedCode, setSelectedModuleId } = useTerraform();
  const [activeTab, setActiveTab] = useState<Tab>('modules');

  return (
    <div className="flex flex-1 flex-col bg-surface">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'modules'
              ? 'border-b-2 border-accent text-accent'
              : 'border-b-2 border-transparent text-fg-muted hover:text-fg hover:bg-surface-subtle'
          }`}
        >
          Matched Modules
          {matchedModules.length > 0 && (
            <span className="text-[10px]">({matchedModules.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'code'
              ? 'border-b-2 border-accent text-accent'
              : 'border-b-2 border-transparent text-fg-muted hover:text-fg hover:bg-surface-subtle'
          }`}
        >
          Code Preview
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {activeTab === 'modules' ? (
          <ModulesTab matchedModules={matchedModules} onSelect={setSelectedModuleId} />
        ) : (
          <CodeTab code={generatedCode} />
        )}
      </div>
    </div>
  );
}

function ModulesTab({
  matchedModules,
  onSelect,
}: {
  matchedModules: ModuleMatch[];
  onSelect: (id: string | null) => void;
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (moduleId: string) => {
    const newId = selectedId === moduleId ? null : moduleId;
    setSelectedId(newId);
    onSelect(newId);
  };

  if (matchedModules.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-emphasis">
          <MagnifyingGlass className="h-6 w-6 text-fg-subtle" />
        </div>
        <p className="max-w-[200px] text-[13px] text-fg-subtle">
          Start a conversation to see matched modules here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {matchedModules.map((mod) => {
        const colorClass =
          PROVIDER_COLORS[mod.provider.toLowerCase()] ?? 'bg-surface-emphasis text-fg-muted';
        const isSelected = selectedId === mod.moduleId;

        return (
          <button
            key={mod.moduleId}
            type="button"
            onClick={() => handleSelect(mod.moduleId)}
            className={`w-full rounded-lg border p-3 text-left transition-all ${
              isSelected
                ? 'border-accent bg-surface shadow-[0_0_0_1px_var(--accent),0_0_8px_rgba(31,111,235,0.15)]'
                : 'border-border bg-surface hover:border-accent/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-medium text-fg">{mod.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}
                  >
                    {mod.provider}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-fg-muted">v{mod.version}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-emphasis"
                  title={`${Math.round(mod.confidence * 100)}% confidence`}
                >
                  <div
                    className={`h-full rounded-full ${getConfidenceColor(mod.confidence)}`}
                    style={{ width: `${mod.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-fg-muted">
                  {Math.round(mod.confidence * 100)}%
                </span>
              </div>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-fg-subtle">{mod.source}</div>
            <div className="mt-1 text-[11px] text-fg-muted">{mod.matchReason}</div>
            <div className="mt-2 flex gap-3 text-[11px] text-fg-subtle">
              <span className="flex items-center gap-1">
                <SignIn className="h-3 w-3" />
                12 inputs
              </span>
              <span className="flex items-center gap-1">
                <SignOut className="h-3 w-3" />8 outputs
              </span>
              <span className="flex items-center gap-1">
                <LinkSimple className="h-3 w-3" />2 deps
              </span>
            </div>
            {isSelected && (
              <>
                <div className="my-2 border-t border-border" />
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-fg">Variables</div>
                  <div className="space-y-1 text-[11px] text-fg-muted">
                    <div className="flex items-center justify-between rounded bg-surface-subtle px-2 py-1">
                      <span className="font-mono">name</span>
                      <span className="text-fg-subtle">string</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-surface-subtle px-2 py-1">
                      <span className="font-mono">environment</span>
                      <span className="text-fg-subtle">string</span>
                    </div>
                    <div className="flex items-center justify-between rounded bg-surface-subtle px-2 py-1">
                      <span className="font-mono">instance_type</span>
                      <span className="text-fg-subtle">string</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </button>
        );
      })}
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

function CodeTab({ code }: { code: string | null }): React.JSX.Element {
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
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
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
