'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { useUpdateTask } from '@flow-app/data';
import { Task, CustomPropertyDefinition, Project, Profile } from '@flow-app/models';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

interface KanbanViewProps {
  tasks: Task[];
  userId: string;
  projects?: Project[];
  profiles?: Profile[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
}

// Default columns for Kanban view (using completion status)
const DEFAULT_COLUMNS = [
  { id: 'incomplete', label: 'To Do', color: 'bg-gray-100' },
  { id: 'completed', label: 'Done', color: 'bg-green-100' },
];

export function KanbanView({
  tasks,
  userId,
  projects = [],
  profiles = [],
  customPropertyDefinitions = [],
}: KanbanViewProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const updateTaskMutation = useUpdateTask();

  // Set up sensors for drag handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required to start drag
      },
    }),
  );

  // Group tasks by completion status
  const tasksByStatus = DEFAULT_COLUMNS.reduce((acc, column) => {
    if (column.id === 'completed') {
      acc[column.id] = tasks.filter(task => task.is_completed);
    } else {
      acc[column.id] = tasks.filter(task => !task.is_completed);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setDraggedTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTask(null);

    if (!over) {
      return;
    }

    const taskId = active.id as string;
    const newColumnId = over.id as string;

    // Find the task being dragged
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

    // Determine new completion status based on column
    const newCompletedStatus = newColumnId === 'completed';

    // Only update if completion status actually changed
    if (task.is_completed !== newCompletedStatus) {
      updateTaskMutation.mutate({
        taskId: task.id,
        updates: {
          is_completed: newCompletedStatus,
          completed_at: newCompletedStatus ? new Date().toISOString() : null,
        },
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-x-auto bg-gray-50 p-4">
        <div className="flex gap-4 min-h-0">
          {DEFAULT_COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.label}
              tasks={tasksByStatus[column.id] || []}
              color={column.color}
              userId={userId}
              projects={projects}
              profiles={profiles}
              customPropertyDefinitions={customPropertyDefinitions}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedTask ? (
          <div className="rotate-3 opacity-90">
            <KanbanCard
              task={draggedTask}
              isDragging={true}
              userId={userId}
              projects={projects}
              profiles={profiles}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
