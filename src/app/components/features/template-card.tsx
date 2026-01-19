import {
  ArrowsClockwise,
  CaretRight,
  Clock,
  Code,
  GitBranch,
  Lightning,
  Pencil,
  Robot,
  Terminal,
  Trash,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import type { CachedAgent, CachedCommand, CachedSkill, Template } from '@/db/schema/templates';
import { cn } from '@/lib/utils/cn';

export interface TemplateCardProps {
  template: Template;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isSyncing?: boolean;
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    className: 'bg-success-muted text-success border-success/40',
  },
  syncing: {
    label: 'Syncing',
    className: 'bg-attention-muted text-attention border-attention/40',
  },
  error: {
    label: 'Error',
    className: 'bg-danger-muted text-danger border-danger/40',
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-surface-muted text-fg-muted border-border',
  },
} as const;

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) {
    return 'Never';
  }
  const now = Date.now();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const diff = now - dateObj.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (hours > 24) {
    return `${Math.floor(hours / 24)}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
}

// Collapsible section component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  bgClass: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  count,
  colorClass,
  bgClass,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border-t border-border-muted pt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 text-left transition-colors duration-150 hover:bg-surface-subtle rounded px-1 -mx-1"
      >
        <span className={cn('transition-transform duration-150', isOpen && 'rotate-90')}>
          <CaretRight className="h-4 w-4 text-fg-muted" />
        </span>
        <span className={cn('p-1 rounded', bgClass)}>{icon}</span>
        <span className="text-xs font-medium text-fg">{title}</span>
        {/* Badge: height 20px, px-2 (8px), rounded-full (10px) */}
        <span
          className={cn(
            'ml-auto inline-flex items-center h-5 px-2 rounded-full text-xs font-medium',
            bgClass,
            colorClass
          )}
        >
          {count}
        </span>
      </button>
      {isOpen && <div className="mt-2 space-y-1 pl-6">{children}</div>}
    </div>
  );
}

// Individual item component
interface ItemRowProps {
  name: string;
  description?: string;
  icon?: React.ReactNode;
}

function ItemRow({ name, description, icon }: ItemRowProps): React.JSX.Element {
  return (
    <div className="group flex items-start gap-2 rounded px-2 py-1 transition-colors duration-150 hover:bg-surface-subtle">
      {icon && <span className="mt-0.5 text-fg-subtle">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-fg truncate">{name}</div>
        {description && <div className="text-[11px] text-fg-muted line-clamp-2">{description}</div>}
      </div>
    </div>
  );
}

export function TemplateCard({
  template,
  onSync,
  onEdit,
  onDelete,
  isSyncing = false,
}: TemplateCardProps): React.JSX.Element {
  const effectiveStatus = isSyncing ? 'syncing' : (template.status ?? 'active');
  const statusConfig = STATUS_CONFIG[effectiveStatus];

  const skills = (template.cachedSkills ?? []) as CachedSkill[];
  const commands = (template.cachedCommands ?? []) as CachedCommand[];
  const agents = (template.cachedAgents ?? []) as CachedAgent[];

  const totalItems = skills.length + commands.length + agents.length;

  return (
    <div
      className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-150 hover:border-fg-subtle"
      data-testid="template-card"
    >
      {/* Header */}
      <div className="p-4 border-b border-border-muted">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-fg" data-testid="template-name">
              {template.name}
            </h3>
            {template.description && (
              <p className="mt-1 text-xs text-fg-muted line-clamp-2">{template.description}</p>
            )}
          </div>

          {/* Status badge - height 20px, px-2 (8px), rounded-full */}
          <span
            className={cn(
              'inline-flex items-center gap-1 h-5 px-2 text-xs font-medium rounded-full border shrink-0',
              statusConfig.className
            )}
            data-testid="template-status"
            data-status={effectiveStatus}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full bg-current',
                effectiveStatus === 'syncing' && 'animate-pulse'
              )}
            />
            {statusConfig.label}
          </span>
        </div>

        {/* Repository info */}
        <div className="mt-3 flex items-center gap-4 text-xs text-fg-muted">
          <div className="flex items-center gap-1" data-testid="template-repo">
            <GitBranch className="h-4 w-4 shrink-0" />
            <span className="truncate font-mono">
              {template.githubOwner}/{template.githubRepo}
            </span>
          </div>
          <div className="flex items-center gap-1" data-testid="template-last-synced">
            <Clock className="h-4 w-4" />
            <span>Synced {formatRelativeTime(template.lastSyncedAt)}</span>
          </div>
        </div>

        {/* Summary counts as badges - height 20px, px-2 (8px), rounded-full */}
        {totalItems > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="template-counts">
            {skills.length > 0 && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-muted text-accent text-xs font-medium">
                <Lightning className="h-3 w-3" weight="fill" />
                {skills.length} skill{skills.length !== 1 && 's'}
              </span>
            )}
            {commands.length > 0 && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-muted text-secondary text-xs font-medium">
                <Terminal className="h-3 w-3" weight="fill" />
                {commands.length} command{commands.length !== 1 && 's'}
              </span>
            )}
            {agents.length > 0 && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-done-muted text-done text-xs font-medium">
                <Robot className="h-3 w-3" weight="fill" />
                {agents.length} agent{agents.length !== 1 && 's'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable details sections */}
      {totalItems > 0 && (
        <div className="p-4 space-y-2">
          <CollapsibleSection
            title="Skills"
            icon={<Lightning className="h-4 w-4 text-accent" weight="fill" />}
            count={skills.length}
            colorClass="text-accent"
            bgClass="bg-accent-muted"
          >
            {skills.map((skill) => (
              <ItemRow
                key={skill.id}
                name={skill.name}
                description={skill.description}
                icon={<Code className="h-3 w-3" />}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            title="Slash Commands"
            icon={<Terminal className="h-4 w-4 text-secondary" weight="fill" />}
            count={commands.length}
            colorClass="text-secondary"
            bgClass="bg-secondary-muted"
          >
            {commands.map((cmd) => (
              <ItemRow
                key={cmd.name}
                name={`/${cmd.name}`}
                description={cmd.description}
                icon={<CaretRight className="h-3 w-3" />}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            title="Agents"
            icon={<Robot className="h-4 w-4 text-done" weight="fill" />}
            count={agents.length}
            colorClass="text-done"
            bgClass="bg-done-muted"
          >
            {agents.map((agent) => (
              <ItemRow
                key={agent.name}
                name={agent.name}
                description={agent.description}
                icon={<Robot className="h-3 w-3" />}
              />
            ))}
          </CollapsibleSection>
        </div>
      )}

      {/* Error message */}
      {template.status === 'error' && template.syncError && (
        <div
          className="mx-4 mb-3 rounded bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger"
          data-testid="template-error"
        >
          <span className="font-medium">Sync failed:</span> {template.syncError}
        </div>
      )}

      {/* Actions footer */}
      <div
        className="px-4 py-3 bg-surface-subtle border-t border-border-muted flex items-center justify-between"
        data-testid="template-actions"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-fg-muted hover:text-fg"
            data-testid="template-edit-button"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-danger hover:text-danger hover:bg-danger-muted"
            data-testid="template-delete-button"
          >
            <Trash className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          data-testid="template-sync-button"
        >
          <ArrowsClockwise className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>
    </div>
  );
}
