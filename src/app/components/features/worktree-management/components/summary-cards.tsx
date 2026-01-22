import { GitBranch, HardDrives, Robot, Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import type { SummaryCardsProps } from '../types';

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  variant?: 'default' | 'warning';
}

function SummaryCard({
  icon,
  label,
  value,
  variant = 'default',
}: SummaryCardProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface-subtle p-3">
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md',
          variant === 'warning' ? 'bg-warning/15 text-warning' : 'bg-accent/15 text-accent'
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-fg-muted">{label}</p>
        <p className="text-lg font-semibold text-fg">{value}</p>
      </div>
    </div>
  );
}

export function SummaryCards({
  total,
  activeWithAgent,
  stale,
  diskUsage,
}: SummaryCardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCard icon={<GitBranch className="h-5 w-5" />} label="Total Worktrees" value={total} />
      <SummaryCard
        icon={<Robot className="h-5 w-5" />}
        label="Active with Agent"
        value={activeWithAgent}
      />
      <SummaryCard
        icon={<Warning className="h-5 w-5" />}
        label="Stale (>7 days)"
        value={stale}
        variant={stale > 0 ? 'warning' : 'default'}
      />
      {diskUsage && (
        <SummaryCard
          icon={<HardDrives className="h-5 w-5" />}
          label="Disk Usage"
          value={diskUsage}
        />
      )}
    </div>
  );
}
