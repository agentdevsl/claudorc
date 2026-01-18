import { FunnelSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cva } from 'class-variance-authority';
import { useCallback, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { TextInput } from '@/app/components/ui/text-input';
import type { FilterValue, FilterValues } from '@/app/hooks/use-list-filters';
import { cn } from '@/lib/utils/cn';

// =============================================================================
// Types
// =============================================================================

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  /** Unique identifier for this filter */
  id: string;
  /** Display label for the filter */
  label: string;
  /** Type of filter input */
  type: 'select' | 'multi-select' | 'search' | 'date-range';
  /** Options for select/multi-select filters */
  options?: FilterOption[];
  /** Placeholder text */
  placeholder?: string;
}

export interface ListFiltersProps {
  /** Filter configurations */
  filters: FilterConfig[];
  /** Current filter values */
  values: FilterValues;
  /** Callback when filter values change */
  onChange: (values: FilterValues) => void;
  /** Callback to clear all filters */
  onClear: () => void;
  /** Number of active filters (for badge) */
  activeCount?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Styles
// =============================================================================

const filterBarVariants = cva('flex items-center gap-2 flex-wrap', {
  variants: {
    variant: {
      default: '',
      compact: 'gap-1.5',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// =============================================================================
// Mobile Filters Popover
// =============================================================================

interface MobileFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (key: string, value: FilterValue) => void;
  onClear: () => void;
  activeCount: number;
}

function MobileFilters({
  filters,
  values,
  onChange,
  onClear,
  activeCount,
}: MobileFiltersProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="outline" className="relative md:hidden">
          <FunnelSimple className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-fg">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-50 w-72 rounded-lg border border-border bg-surface p-4 shadow-lg"
          sideOffset={8}
          align="end"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-fg">Filters</h4>
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Clear all
                </Button>
              )}
            </div>

            {filters.map((filter) => (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <label
                  htmlFor={`mobile-filter-${filter.id}`}
                  className="text-xs font-medium text-fg-muted"
                >
                  {filter.label}
                </label>
                <FilterInput
                  id={`mobile-filter-${filter.id}`}
                  config={filter}
                  value={values[filter.id]}
                  onChange={(value) => onChange(filter.id, value)}
                />
              </div>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// =============================================================================
// Filter Input Component
// =============================================================================

interface FilterInputProps {
  id: string;
  config: FilterConfig;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  className?: string;
}

function FilterInput({
  id,
  config,
  value,
  onChange,
  className,
}: FilterInputProps): React.JSX.Element {
  const handleSelectChange = useCallback(
    (newValue: string) => {
      // Treat empty string or "all" as clearing the filter
      onChange(newValue === '' || newValue === 'all' ? undefined : newValue);
    },
    [onChange]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue === '' ? undefined : newValue);
    },
    [onChange]
  );

  switch (config.type) {
    case 'search':
      return (
        <div className={cn('relative', className)}>
          <MagnifyingGlass className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <TextInput
            id={id}
            type="text"
            placeholder={config.placeholder ?? `Search ${config.label.toLowerCase()}...`}
            value={typeof value === 'string' ? value : ''}
            onChange={handleSearchChange}
            className="pl-8"
            aria-label={config.label}
          />
        </div>
      );

    case 'select':
      return (
        <Select
          value={typeof value === 'string' ? value : 'all'}
          onValueChange={handleSelectChange}
        >
          <SelectTrigger
            id={id}
            className={cn('min-w-[140px]', className)}
            aria-label={config.label}
          >
            <SelectValue placeholder={config.placeholder ?? `All ${config.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {config.label}</SelectItem>
            {config.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'multi-select':
      // For multi-select, we'll use a simplified approach with a dropdown
      // showing checkboxes - this could be enhanced later
      return (
        <Select
          value={Array.isArray(value) && value.length > 0 ? value[0] : 'all'}
          onValueChange={handleSelectChange}
        >
          <SelectTrigger
            id={id}
            className={cn('min-w-[140px]', className)}
            aria-label={config.label}
          >
            <SelectValue placeholder={config.placeholder ?? `All ${config.label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {config.label}</SelectItem>
            {config.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'date-range':
      // Date range filter - placeholder for future implementation
      return (
        <div className={cn('flex items-center gap-2', className)}>
          <TextInput
            id={id}
            type="date"
            placeholder="Start date"
            className="w-32"
            aria-label={`${config.label} start date`}
          />
          <span className="text-fg-muted">to</span>
          <TextInput
            type="date"
            placeholder="End date"
            className="w-32"
            aria-label={`${config.label} end date`}
          />
        </div>
      );

    default:
      return <div>Unknown filter type</div>;
  }
}

// =============================================================================
// Desktop Filter Bar
// =============================================================================

interface DesktopFiltersProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (key: string, value: FilterValue) => void;
  onClear: () => void;
  activeCount: number;
}

function DesktopFilters({
  filters,
  values,
  onChange,
  onClear,
  activeCount,
}: DesktopFiltersProps): React.JSX.Element {
  // Separate search filters from other filters
  const searchFilters = filters.filter((f) => f.type === 'search');
  const otherFilters = filters.filter((f) => f.type !== 'search');

  return (
    <div className="hidden items-center gap-3 md:flex">
      {/* Search filters first */}
      {searchFilters.map((filter) => (
        <FilterInput
          key={filter.id}
          id={`filter-${filter.id}`}
          config={filter}
          value={values[filter.id]}
          onChange={(value) => onChange(filter.id, value)}
          className="w-64"
        />
      ))}

      {/* Divider if we have both search and other filters */}
      {searchFilters.length > 0 && otherFilters.length > 0 && (
        <div className="h-6 w-px bg-border" aria-hidden="true" />
      )}

      {/* Select filters */}
      {otherFilters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-1.5">
          <label
            htmlFor={`filter-${filter.id}`}
            className="text-xs font-medium text-fg-muted whitespace-nowrap"
          >
            {filter.label}:
          </label>
          <FilterInput
            id={`filter-${filter.id}`}
            config={filter}
            value={values[filter.id]}
            onChange={(value) => onChange(filter.id, value)}
          />
        </div>
      ))}

      {/* Clear button */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-fg-muted hover:text-fg">
          <X className="mr-1 h-3 w-3" />
          Clear ({activeCount})
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// ListFilters Component
// =============================================================================

export function ListFilters({
  filters,
  values,
  onChange,
  onClear,
  activeCount = 0,
  className,
}: ListFiltersProps): React.JSX.Element {
  const handleFilterChange = useCallback(
    (key: string, value: FilterValue) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange]
  );

  return (
    <search className={cn(filterBarVariants(), className)} aria-label="List filters">
      {/* Desktop filters */}
      <DesktopFilters
        filters={filters}
        values={values}
        onChange={handleFilterChange}
        onClear={onClear}
        activeCount={activeCount}
      />

      {/* Mobile filters popover */}
      <MobileFilters
        filters={filters}
        values={values}
        onChange={handleFilterChange}
        onClear={onClear}
        activeCount={activeCount}
      />
    </search>
  );
}

// =============================================================================
// Exports
// =============================================================================

export type { FilterValue, FilterValues } from '@/app/hooks/use-list-filters';
