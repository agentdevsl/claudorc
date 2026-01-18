import { useCallback, useState } from 'react';
import type { TaskColumn } from '@/db/schema/tasks';

const COLLAPSED_STORAGE_KEY = 'kanban-collapsed-columns';

function loadCollapsedColumns(): Set<TaskColumn> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored) {
      return new Set(JSON.parse(stored) as TaskColumn[]);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function saveCollapsedColumns(columns: Set<TaskColumn>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...columns]));
  } catch {
    // Ignore storage errors
  }
}

export interface BoardState {
  selectedIds: Set<string>;
  collapsedColumns: Set<TaskColumn>;
}

export interface BoardActions {
  selectCard: (taskId: string, multiSelect: boolean) => void;
  selectRange: (startId: string, endId: string, taskIds: string[]) => void;
  clearSelection: () => void;
  toggleColumnCollapse: (column: TaskColumn) => void;
  setSelectedIds: (ids: Set<string>) => void;
}

export function useBoardState(): [BoardState, BoardActions] {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskColumn>>(() =>
    loadCollapsedColumns()
  );

  const selectCard = useCallback((taskId: string, multiSelect: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
      } else {
        next.clear();
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const selectRange = useCallback((startId: string, endId: string, taskIds: string[]) => {
    const startIdx = taskIds.indexOf(startId);
    const endIdx = taskIds.indexOf(endId);

    if (startIdx === -1 || endIdx === -1) return;

    const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const rangeIds = taskIds.slice(from, to + 1);

    setSelectedIds(new Set(rangeIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleColumnCollapse = useCallback((column: TaskColumn) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }
      saveCollapsedColumns(next);
      return next;
    });
  }, []);

  return [
    { selectedIds, collapsedColumns },
    { selectCard, selectRange, clearSelection, toggleColumnCollapse, setSelectedIds },
  ];
}
