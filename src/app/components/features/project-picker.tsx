import { CaretUpDown, Check, FolderSimple, Plus } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import type { Project } from '@/db/schema/projects';
import { cn } from '@/lib/utils/cn';

interface ProjectPickerProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelect: (project: Project) => void;
  onNewProject: () => void;
}

export function ProjectPicker({
  projects,
  selectedProject,
  onSelect,
  onNewProject,
}: ProjectPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-64 justify-between">
          <span className="flex items-center gap-2">
            <FolderSimple className="h-4 w-4" />
            <span className="truncate">{selectedProject?.name ?? 'Select project'}</span>
          </span>
          <CaretUpDown className="h-4 w-4 text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => {
              onSelect(project);
              setOpen(false);
            }}
          >
            <Check
              className={cn(
                'mr-2 h-4 w-4',
                selectedProject?.id === project.id ? 'opacity-100' : 'opacity-0'
              )}
            />
            <span className="truncate">{project.name}</span>
          </DropdownMenuItem>
        ))}

        {projects.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={onNewProject}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
