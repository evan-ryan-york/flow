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
import { useUpdateTask } from '@perfect-task-app/data';
import { Task, CustomPropertyDefinition, Project, Profile } from '@perfect-task-app/models';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

interface KanbanViewProps {
  tasks: Task[];
  userId: string;
  projects?: Project[];
  profiles?: Profile[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
}

// Default status columns for Kanban view
const DEFAULT_COLUMNS = [
  { id: 'To Do', label: 'To Do', color: 'bg-gray-100' },
  { id: 'In Progress', label: 'In Progress', color: 'bg-blue-100' },
  { id: 'Done', label: 'Done', color: 'bg-green-100' },
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

  // Group tasks by status
  const tasksByStatus = DEFAULT_COLUMNS.reduce((acc, column) => {
    acc[column.id] = tasks.filter(task => task.status === column.id);
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
    const newStatus = over.id as string;

    // Find the task being dragged
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

    // Only update if status actually changed
    if (task.status !== newStatus) {
      updateTaskMutation.mutate({
        taskId: task.id,
        updates: {
          status: newStatus,
          is_completed: newStatus === 'Done',
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
