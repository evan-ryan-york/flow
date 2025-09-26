'use client';

import { useDraggable } from '@dnd-kit/core';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: any[];
  selectedProjectIds: string[];
  isLoading?: boolean;
}

export function TaskList({ tasks, selectedProjectIds, isLoading }: TaskListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-sm">Loading tasks...</p>
        </div>
      </div>
    );
  }
  const displayedTasks = tasks.sort((a, b) => {
    // Sort by due date first, then by created date (no status-based reordering)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-sm">
            {selectedProjectIds.length > 0 ? 'No tasks in selected projects' : 'No tasks yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Create your first task using the form above
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table Headers */}
      <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
        {/* Space for drag handle and completion circle */}
        <div className="flex-shrink-0 w-16"></div>
        {/* Name Column */}
        <div className="flex-1 min-w-0">Name</div>
        {/* Assigned To Column */}
        <div className="flex-shrink-0 w-24 text-right">Assigned</div>
        {/* Due Date Column */}
        <div className="flex-shrink-0 w-28 text-right">Due Date</div>
      </div>

      {/* Task Rows */}
      <div className="flex-1 overflow-y-auto bg-white">
        {displayedTasks.map((task) => (
          <DraggableTaskItem key={task.taskId || task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function DraggableTaskItem({ task }: { task: any }) {
  const taskId = task.taskId || task.id;
  console.log('🎯 DraggableTaskItem render:', {
    taskId,
    taskName: task.taskName || task.name,
    hasTaskId: !!task.taskId,
    hasId: !!task.id,
    status: task.status
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: taskId,
  });

  console.log('🖱️ Draggable state:', { taskId, isDragging, transform });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-50' : ''}
    >
      <TaskItem
        task={task}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}