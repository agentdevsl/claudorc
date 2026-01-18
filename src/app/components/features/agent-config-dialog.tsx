import { Gear, SlidersHorizontal } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Textarea } from '@/app/components/ui/textarea';
import type { Agent, AgentConfig } from '@/db/schema/agents';

interface AgentConfigDialogProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Partial<AgentConfig>) => Promise<void>;
}

const TOOL_GROUPS: Record<string, string[]> = {
  Files: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
  System: ['Bash'],
  Web: ['WebFetch'],
  Agent: ['Task'],
};

export function AgentConfigDialog({
  agent,
  open,
  onOpenChange,
  onSave,
}: AgentConfigDialogProps): React.JSX.Element {
  const [tab, setTab] = useState<'execution' | 'tools' | 'prompt'>('execution');
  const [config, setConfig] = useState<AgentConfig>({
    allowedTools: agent.config?.allowedTools ?? [],
    maxTurns: agent.config?.maxTurns ?? 50,
    model: agent.config?.model,
    systemPrompt: agent.config?.systemPrompt,
    temperature: agent.config?.temperature,
  });

  const toggleTool = (tool: string): void => {
    const current = config.allowedTools ?? [];
    const next = current.includes(tool)
      ? current.filter((item) => item !== tool)
      : [...current, tool];
    setConfig((prev) => ({ ...prev, allowedTools: next }));
  };

  const handleSave = async (): Promise<void> => {
    await onSave(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="agent-config-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gear className="h-5 w-5" />
            Configure {agent.name}
          </DialogTitle>
          <DialogDescription>Fine tune tools, model, and system prompts.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="execution" data-testid="tab-general">
              Execution
            </TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-limits">
              Tools
            </TabsTrigger>
            <TabsTrigger value="prompt" data-testid="tab-sandbox">
              Prompt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="execution" className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                Max turns
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={500}
                  aria-label="Max turns"
                  value={config.maxTurns ?? 50}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxTurns: Number(event.target.value),
                    }))
                  }
                  className="flex-1"
                  data-testid="max-turns-slider"
                />
                <span className="w-12 text-right text-sm font-medium text-fg tabular-nums">
                  {config.maxTurns ?? 50}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                Temperature
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  aria-label="Temperature"
                  value={(config.temperature ?? 0.2) * 100}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      temperature: Number(event.target.value) / 100,
                    }))
                  }
                  className="flex-1"
                />
                <span className="w-12 text-right text-sm font-medium text-fg tabular-nums">
                  {(config.temperature ?? 0.2).toFixed(2)}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {Object.entries(TOOL_GROUPS).map(([group, tools]) => (
              <div key={group} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {group}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {tools.map((tool) => (
                    <div key={tool} className="flex items-center gap-2 text-sm text-fg">
                      <Checkbox
                        id={`tool-${tool}`}
                        aria-label={tool}
                        checked={config.allowedTools?.includes(tool) ?? false}
                        onCheckedChange={() => toggleTool(tool)}
                      />
                      <label htmlFor={`tool-${tool}`}>{tool}</label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="prompt" className="space-y-2">
            <label
              htmlFor="system-prompt"
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            >
              System prompt
            </label>
            <Textarea
              id="system-prompt"
              value={config.systemPrompt ?? ''}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  systemPrompt: event.target.value,
                }))
              }
              rows={6}
              placeholder="You are an expert agent..."
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-button">
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} data-testid="save-config-button">
            Save configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
