'use client';

import { useUpdateTask } from '@perfect-task-app/data';

interface TaskItemProps {
  task: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    due_date?: string | null;
    project_id: string;
    assigned_to?: string;
  };
  isDragging?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
}

const projectNames: Record<string, string> = {
  '1': 'General',
  '2': 'Work Projects',
  '3': 'Personal',
  '4': 'Side Hustle',
};

// Mock user names for now
const userNames: Record<string, string> = {
  'user-1': 'You',
  'user-2': 'John Doe',
  'user-3': 'Jane Smith',
};

export function TaskItem({ task, isDragging = false, dragAttributes, dragListeners }: TaskItemProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';
  const isDone = task.status === 'Done';
  const updateTaskMutation = useUpdateTask();

  const handleStatusToggle = () => {
    const newStatus = isDone ? 'To Do' : 'Done';
    const newCompletedState = !isDone;

    updateTaskMutation.mutate({
      taskId: task.id,
      updates: {
        status: newStatus,
        is_completed: newCompletedState,
      }
    }, {
      onError: (error) => {
        console.error('Failed to update task status:', error);
        // TODO: Add proper error handling/notification
      }
    });
  };

  const handleDragHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Drag functionality handled by parent DraggableTaskItem
  };

  return (
    <div className={`bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors ${
      isDragging ? 'bg-blue-50 shadow-lg' : ''
    } ${isDone ? 'opacity-75' : ''}`}>
      {/* Table Row Layout */}
      <div className="flex items-center px-4 py-3 gap-4">
        {/* Drag Handle */}
        <button
          {...dragListeners}
          {...dragAttributes}
          onClick={handleDragHandleClick}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-1"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1"/>
            <circle cx="15" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/>
            <circle cx="15" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="19" r="1"/>
          </svg>
        </button>

        {/* Completion Circle */}
        <button
          onClick={handleStatusToggle}
          disabled={updateTaskMutation.isPending}
          className={`flex-shrink-0 transition-colors ${
            updateTaskMutation.isPending
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-400 hover:text-green-600'
          }`}
          title={isDone ? "Mark as not done" : "Mark as done"}
        >
          {isDone ? (
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          )}
        </button>

        {/* Name Column - Flexible */}
        <div className="flex-1 min-w-0">
          <span className={`font-medium text-sm truncate block ${
            isDone ? 'text-gray-500 line-through' : 'text-gray-900'
          }`}>
            {task.name}
          </span>
        </div>

        {/* Assigned To Column - Fixed width */}
        <div className="flex-shrink-0 w-24 text-right">
          <span className="text-sm text-gray-600 truncate block">
            {task.assigned_to ? (userNames[task.assigned_to] || 'Unknown User') : 'Unassigned'}
          </span>
        </div>

        {/* Due Date Column - Fixed width */}
        <div className="flex-shrink-0 w-28 text-right">
          {task.due_date ? (
            <span className={`text-sm truncate block ${
              isOverdue && !isDone ? 'text-red-600 font-medium' : 'text-gray-600'
            }`}>
              {new Date(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </div>
      </div>
    </div>
  );
}