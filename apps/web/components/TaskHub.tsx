'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { useProjectsTasks } from '@perfect-task-app/data';
import { TaskQuickAdd } from './TaskQuickAdd';
import { TaskList } from './TaskList';
import { SavedViews } from './SavedViews';
import { TaskItem } from './TaskItem';

interface TaskHubProps {
  userId: string;
  selectedProjectIds: string[];
  selectedViewId: string | null;
  onViewChange: (viewId: string | null) => void;
}

export function TaskHub({ userId, selectedProjectIds, selectedViewId, onViewChange }: TaskHubProps) {
  const [draggedTask, setDraggedTask] = useState<any>(null);

  // Use smart query that filters at the database level
  const { data: filteredTasks = [], isLoading, error } = useProjectsTasks(userId, selectedProjectIds);

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((t: any) => t.id === event.active.id);
    setDraggedTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Handle task reordering or moving to calendar
      console.log('Task moved:', active.id, 'to:', over.id);
      // TODO: Implement task scheduling with time blocks
    }

    setDraggedTask(null);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Quick Add Bar */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <TaskQuickAdd
            userId={userId}
            defaultProjectId={selectedProjectIds[0] || '1'}
          />
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-hidden">
          <TaskList
            tasks={filteredTasks}
            selectedProjectIds={selectedProjectIds}
            isLoading={isLoading}
          />
        </div>

        {/* Saved Views */}
        <div className="border-t border-gray-200 bg-white">
          <SavedViews
            userId={userId}
            selectedViewId={selectedViewId}
            onViewChange={onViewChange}
          />
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedTask ? (
          <div className="dnd-dragging">
            <TaskItem task={draggedTask} isDragging={true} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}