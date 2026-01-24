import { Brain } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { AVAILABLE_MODELS } from '@/lib/constants/models';
import { cn } from '@/lib/utils/cn';

export interface ModelSelectorProps {
  /** Current selected model ID */
  value: string | null | undefined;
  /** Called when model selection changes */
  onChange: (modelId: string | null) => void;
  /** Allow selecting "inherit" option */
  allowInherit?: boolean;
  /** Label for inherit option */
  inheritLabel?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * Reusable model selector component.
 * Shows available Claude models with their descriptions.
 */
export function ModelSelector({
  value,
  onChange,
  allowInherit = false,
  inheritLabel = 'Use default',
  className,
  compact = false,
  'data-testid': testId = 'model-selector',
}: ModelSelectorProps): React.JSX.Element {
  // Get display name for current value
  const getDisplayValue = () => {
    if (!value && allowInherit) return inheritLabel;
    const model = AVAILABLE_MODELS.find((m) => m.id === value);
    return model?.name ?? value ?? 'Select model';
  };

  return (
    <Select
      value={value ?? '__inherit__'}
      onValueChange={(v) => onChange(v === '__inherit__' ? null : v)}
    >
      <SelectTrigger
        className={cn('min-w-[180px]', compact && 'h-8', className)}
        data-testid={testId}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-fg-muted flex-shrink-0" />
          <SelectValue placeholder={getDisplayValue()}>{getDisplayValue()}</SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {allowInherit && (
          <SelectItem value="__inherit__" className="flex flex-col items-start">
            <div className="font-medium">{inheritLabel}</div>
            <div className="text-[11px] text-fg-muted">Inherit from project or global settings</div>
          </SelectItem>
        )}
        {AVAILABLE_MODELS.map((model) => (
          <SelectItem key={model.id} value={model.id} className="flex flex-col items-start">
            <div className="font-medium">{model.name}</div>
            <div className="text-[11px] text-fg-muted">{model.description}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Inline model selector for compact spaces (e.g., metadata sections).
 */
export function ModelSelectorInline({
  value,
  onChange,
  allowInherit = true,
  inheritLabel = 'Default',
}: Omit<ModelSelectorProps, 'compact'>): React.JSX.Element {
  return (
    <ModelSelector
      value={value}
      onChange={onChange}
      allowInherit={allowInherit}
      inheritLabel={inheritLabel}
      compact
      className="h-7 text-xs"
    />
  );
}
