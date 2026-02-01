import { Code, Copy, Cube, DownloadSimple } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { useTerraform } from './terraform-context';

type Tab = 'modules' | 'code';

export function TerraformRightPanel(): React.JSX.Element {
  const { matchedModules, generatedCode, modules, setSelectedModuleId } = useTerraform();
  const [activeTab, setActiveTab] = useState<Tab>('modules');

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('modules')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'modules'
              ? 'border-b-2 border-accent text-accent'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Cube className="h-3.5 w-3.5" />
          Matched Modules
          {matchedModules.length > 0 && (
            <span className="rounded-full bg-accent-muted px-1.5 text-[10px] text-accent">
              {matchedModules.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'code'
              ? 'border-b-2 border-accent text-accent'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Code className="h-3.5 w-3.5" />
          Code Preview
          {generatedCode && <span className="h-2 w-2 rounded-full bg-success" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'modules' ? (
          <ModulesTab
            matchedModules={matchedModules}
            allModules={modules}
            onSelect={setSelectedModuleId}
          />
        ) : (
          <CodeTab code={generatedCode} />
        )}
      </div>
    </div>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  aws: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  azure: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  azurerm: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  google: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  gcp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

function ModulesTab({
  matchedModules,
  allModules: _allModules,
  onSelect,
}: {
  matchedModules: Array<{
    moduleId: string;
    name: string;
    provider: string;
    version: string;
    source: string;
    confidence: number;
    matchReason: string;
  }>;
  allModules: unknown[];
  onSelect: (id: string | null) => void;
}): React.JSX.Element {
  if (matchedModules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <Cube className="h-8 w-8 text-fg-subtle" />
        <p className="text-sm text-fg-muted">
          Matched modules will appear here as you compose infrastructure.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {matchedModules.map((mod) => {
        const colorClass =
          PROVIDER_COLORS[mod.provider.toLowerCase()] ?? 'bg-surface-emphasis text-fg-muted';

        return (
          <button
            key={mod.moduleId}
            type="button"
            onClick={() => onSelect(mod.moduleId)}
            className="w-full rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-accent"
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
              <div className="flex items-center gap-1">
                <div
                  className="h-1.5 w-8 overflow-hidden rounded-full bg-surface-emphasis"
                  title={`${Math.round(mod.confidence * 100)}% confidence`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${mod.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-fg-subtle">{mod.source}</div>
            <div className="mt-1 text-[11px] text-fg-muted">{mod.matchReason}</div>
          </button>
        );
      })}
    </div>
  );
}

function CodeTab({ code }: { code: string | null }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.tf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <div className="flex h-full flex-col">
      {/* Actions */}
      <div className="flex items-center justify-end gap-1 border-b border-border px-3 py-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          title="Copy to clipboard"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied && <span className="ml-1 text-[10px] text-success">Copied</span>}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
          title="Download as .tf file"
        >
          <DownloadSimple className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <pre className="p-3 font-mono text-xs leading-relaxed text-fg">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
