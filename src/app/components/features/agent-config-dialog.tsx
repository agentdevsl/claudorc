import type { Agent, AgentConfig } from '@/db/schema/agents';

interface AgentConfigDialogProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Partial<AgentConfig>) => Promise<void>;
}

export function AgentConfigDialog({
  agent,
  open,
  onOpenChange,
  onSave,
}: AgentConfigDialogProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-surface p-6">
        <h2 className="text-lg font-semibold text-fg">Configure Agent</h2>
        <p className="text-sm text-fg-muted">{agent.name}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-hover"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1.5 text-sm text-accent-fg hover:bg-accent-hover"
            onClick={() => {
              void onSave({});
              onOpenChange(false);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
