import { Check, ClipboardText, Users } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import type { ProjectIconColor, ProjectPickerItem } from './types';

interface ProjectItemProps {
  project: ProjectPickerItem;
  isSelected: boolean;
  isCurrentProject: boolean;
  onClick: () => void;
}

const iconColorClasses: Record<ProjectIconColor, string> = {
  blue: 'bg-accent/15 text-accent',
  green: 'bg-success/15 text-success',
  purple: 'bg-done/15 text-done',
  orange: 'bg-attention/15 text-attention',
  red: 'bg-danger/15 text-danger',
};

/**
 * Project item in the picker list with icon, name, path, stats, and active indicator
 */
export function ProjectItem({
  project,
  isSelected,
  isCurrentProject,
  onClick,
}: ProjectItemProps): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'flex items-center gap-3 px-5 py-2.5 cursor-pointer',
        'transition-colors duration-100',
        isSelected ? 'bg-accent/10' : 'hover:bg-surface-hover'
      )}
      data-testid="project-item"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-md',
          'text-lg font-semibold flex-shrink-0',
          iconColorClasses[project.icon.color]
        )}
      >
        {project.icon.type === 'emoji' ? project.icon.value : project.icon.value}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-fg truncate">{project.name}</span>
          {project.isActive && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-success/15 text-success border border-success/40">
              Active
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-fg-muted truncate">{project.path}</div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {project.isActive && project.stats.activeAgents > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <Users className="w-3.5 h-3.5" />
            <span>{project.stats.activeAgents}</span>
          </div>
        )}
        {project.stats.totalTasks > 0 && (
          <div className="flex items-center gap-1 text-xs text-fg-muted">
            <ClipboardText className="w-3.5 h-3.5" />
            <span>{project.stats.totalTasks}</span>
          </div>
        )}
        {isCurrentProject && <Check className="w-4 h-4 text-accent" weight="bold" />}
      </div>
    </div>
  );
}
