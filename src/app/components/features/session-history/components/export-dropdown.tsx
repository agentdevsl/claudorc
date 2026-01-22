import { CaretDown, Export, FileCode, FileCsv, FileDoc } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import type { ExportDropdownProps, ExportFormat } from '../types';

const exportOptions: Array<{
  format: ExportFormat;
  label: string;
  icon: typeof FileCode;
}> = [
  { format: 'json', label: 'JSON', icon: FileCode },
  { format: 'markdown', label: 'Markdown', icon: FileDoc },
  { format: 'csv', label: 'CSV', icon: FileCsv },
];

export function ExportDropdown({
  onExport,
  disabled = false,
}: ExportDropdownProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          data-testid="export-dropdown-trigger"
        >
          <Export className="h-4 w-4" />
          Export Session
          <CaretDown className="h-3 w-3 text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {exportOptions.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            onClick={() => onExport(format)}
            data-testid={`export-${format}`}
          >
            <Icon className="h-4 w-4 text-fg-muted" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
