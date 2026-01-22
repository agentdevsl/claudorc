import { CircleNotch, Warning, X } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { STATUS_CONFIG } from '../constants';
import type { WorktreeStatusBadgeProps } from '../types';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
  {
    variants: {
      size: {
        sm: 'text-[10px] px-1 py-0',
        md: 'text-xs px-1.5 py-0.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export function WorktreeStatusBadge({
  status,
  size = 'md',
}: WorktreeStatusBadgeProps): React.JSX.Element {
  const config = STATUS_CONFIG[status];

  const iconSize = size === 'sm' ? 10 : 12;

  const renderIcon = () => {
    switch (config.icon) {
      case 'spinner':
        return <CircleNotch className="animate-spin" size={iconSize} />;
      case 'warning':
        return <Warning size={iconSize} />;
      case 'x':
        return <X size={iconSize} />;
      default:
        return (
          <span
            className={cn('inline-block rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')}
            style={{ backgroundColor: 'currentColor' }}
          />
        );
    }
  };

  return (
    <span className={cn(badgeVariants({ size }), config.badgeColor, config.textColor)}>
      {renderIcon()}
      {config.label}
    </span>
  );
}
