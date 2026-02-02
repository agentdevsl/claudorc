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

const PROVIDER_COLORS: Record<string, string> = {
  aws: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  azure: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  gcp: 'bg-green-500/15 text-green-400 border-green-500/30',
  unknown: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  aws: 'text-amber-400',
  azure: 'text-blue-400',
  gcp: 'text-green-400',
  unknown: 'text-gray-400',
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-400';
  if (confidence >= 0.5) return 'bg-amber-400';
  return 'bg-gray-500';
}

export const TerraformModuleNode = memo(function TerraformModuleNode({ data }: NodeProps) {
  const { label, provider, confidence, nodeIndex } = data as TerraformModuleNodeData;
  const providerKey = provider in PROVIDER_COLORS ? provider : 'unknown';

  return (
    <div className="animate-fade-slide-in" style={{ animationDelay: `${(nodeIndex ?? 0) * 60}ms` }}>
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!h-1.5 !w-1.5 !border-0 !bg-fg-subtle/40"
      />
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm transition-shadow hover:shadow-md',
          PROVIDER_COLORS[providerKey]
        )}
        style={{ height: 32 }}
      >
        {/* Provider icon circle */}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/20">
          <ProviderIcon provider={providerKey} className="h-3 w-3" />
        </div>
        {/* Module name */}
        <span className="max-w-[140px] truncate text-xs font-medium text-fg">{label}</span>
        {/* Provider micro badge */}
        <span
          className={cn('text-[9px] font-semibold uppercase', PROVIDER_BADGE_COLORS[providerKey])}
        >
          {providerKey === 'unknown' ? '' : providerKey}
        </span>
        {/* Confidence dot */}
        {confidence > 0 && (
          <span
            className={cn('ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full', confidenceColor(confidence))}
            title={`Confidence: ${Math.round(confidence * 100)}%`}
          />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="!h-1.5 !w-1.5 !border-0 !bg-fg-subtle/40"
      />
    </div>
  );
});
