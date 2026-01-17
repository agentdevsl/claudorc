import { GithubLogo, Plug } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';

interface GitHubAppSetupProps {
  connected: boolean;
  repo?: string;
  onConnect: () => void;
}

export function GitHubAppSetup({
  connected,
  repo,
  onConnect,
}: GitHubAppSetupProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-muted">
          <GithubLogo className="h-5 w-5 text-fg-muted" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-fg">GitHub connection</h2>
          <p className="text-sm text-fg-muted">
            {connected
              ? `Connected to ${repo ?? 'repository'}`
              : 'Connect GitHub to enable sync and PR automation.'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Button variant={connected ? 'outline' : 'default'} onClick={onConnect}>
          <Plug className="h-4 w-4" />
          {connected ? 'Manage connection' : 'Connect GitHub'}
        </Button>
      </div>
    </section>
  );
}
