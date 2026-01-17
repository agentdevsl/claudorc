import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import { KanbanCard } from './kanban-card';
import { KanbanColumn } from './kanban-column';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, column: TaskColumn, position: number) => Promise<void>;
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
}

const COLUMNS: { id: TaskColumn; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting_approval', label: 'Waiting Approval' },
  { id: 'verified', label: 'Verified' },
];

export function KanbanBoard({
  tasks,
  onTaskMove,
  onTaskClick,
  isLoading,
}: KanbanBoardProps): React.JSX.Element {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((item) => item.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      return;
    }

    const taskId = String(active.id);
    const overId = String(over.id);

    const columnMatch = COLUMNS.find((column) => column.id === overId);
    if (columnMatch) {
      const position = tasks.filter((task) => task.column === columnMatch.id).length;
      void onTaskMove(taskId, columnMatch.id, position);
      return;
    }

    const overTask = tasks.find((task) => task.id === overId);
    if (!overTask) {
      return;
    }

    void onTaskMove(taskId, overTask.column, overTask.position ?? 0);
  };

  const getTasksByColumn = (column: TaskColumn) =>
    tasks
      .filter((task) => task.column === column)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 md:flex-row md:overflow-x-auto md:overflow-y-hidden">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.label}
            tasks={getTasksByColumn(column.id)}
            onTaskClick={onTaskClick}
            isLoading={isLoading}
          />
        ))}
      </div>

      <DragOverlay>{activeTask ? <KanbanCard task={activeTask} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
