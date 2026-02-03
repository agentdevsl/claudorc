import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import { ProviderIcon } from './provider-icons';

interface TerraformModuleNodeData {
  label: string;
  provider: string;
  confidence: number;
  nodeIndex: number;
  [key: string]: unknown;
}

/** Provider-keyed visual configs — accent color, bg tint, border, and glow. */
const PROVIDER_THEME: Record<
  string,
  { accent: string; bg: string; border: string; glow: string; badge: string }
> = {
  aws: {
    accent: 'bg-amber-400',
    bg: 'bg-amber-500/[0.06]',
    border: 'border-amber-500/25',
    glow: 'shadow-[0_0_12px_-3px_rgba(245,158,11,0.25)]',
    badge: 'bg-amber-500/15 text-amber-400',
  },
  azure: {
    accent: 'bg-blue-400',
    bg: 'bg-blue-500/[0.06]',
    border: 'border-blue-500/25',
    glow: 'shadow-[0_0_12px_-3px_rgba(59,130,246,0.25)]',
    badge: 'bg-blue-500/15 text-blue-400',
  },
  gcp: {
    accent: 'bg-green-400',
    bg: 'bg-green-500/[0.06]',
    border: 'border-green-500/25',
    glow: 'shadow-[0_0_12px_-3px_rgba(34,197,94,0.25)]',
    badge: 'bg-green-500/15 text-green-400',
  },
  unknown: {
    accent: 'bg-gray-400',
    bg: 'bg-gray-500/[0.06]',
    border: 'border-gray-500/25',
    glow: 'shadow-[0_0_12px_-3px_rgba(156,163,175,0.15)]',
    badge: 'bg-gray-500/15 text-gray-400',
  },
};

function confidenceDot(confidence: number): string {
  if (confidence >= 0.8) return 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]';
  if (confidence >= 0.5) return 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]';
  return 'bg-gray-500';
}

export const TerraformModuleNode = memo(function TerraformModuleNode({ data }: NodeProps) {
  const { label, provider, confidence, nodeIndex } = data as TerraformModuleNodeData;
  const providerKey = provider in PROVIDER_THEME ? provider : 'unknown';
  const theme = PROVIDER_THEME[providerKey] as (typeof PROVIDER_THEME)[string];

  return (
    <div className="animate-fade-slide-in" style={{ animationDelay: `${(nodeIndex ?? 0) * 60}ms` }}>
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!h-2 !w-2 !rounded-full !border !border-border-subtle !bg-surface-emphasis"
      />

      <div
        className={cn(
          'group relative flex items-center gap-2 rounded-lg border backdrop-blur-sm',
          'px-3 py-1.5 transition-all duration-200',
          'hover:scale-[1.02]',
          theme.bg,
          theme.border,
          theme.glow
        )}
        style={{ height: 36 }}
      >
        {/* Left accent stripe */}
        <div
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[3px] rounded-r-full',
            theme.accent
          )}
        />

        {/* Provider icon */}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.07]">
          <ProviderIcon provider={providerKey} className="h-3 w-3" />
        </div>

        {/* Module name */}
        <span className="max-w-[130px] truncate text-[12px] font-medium tracking-tight text-fg">
          {label}
        </span>

        {/* Provider badge */}
        {providerKey !== 'unknown' && (
          <span
            className={cn(
              'rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider',
              theme.badge
            )}
          >
            {providerKey}
          </span>
        )}

        {/* Confidence indicator */}
        {confidence > 0 && (
          <span
            className={cn('ml-auto h-2 w-2 shrink-0 rounded-full', confidenceDot(confidence))}
            title={`Confidence: ${Math.round(confidence * 100)}%`}
          />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="!h-2 !w-2 !rounded-full !border !border-border-subtle !bg-surface-emphasis"
      />
    </div>
  );
});
