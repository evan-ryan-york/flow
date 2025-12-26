'use client';

import React from 'react';
import { Task, Project, Profile } from '@flow-app/models';
import { useUpdateTask } from '@flow-app/data';
import { Calendar, User } from 'iconoir-react';

interface KanbanCardProps {
  task: Task;
  isDragging?: boolean;
  userId: string;
  projects?: Project[];
  profiles?: Profile[];
}

export function KanbanCard({
  task,
  isDragging = false,
  userId,
  projects = [],
  profiles = [],
}: KanbanCardProps) {
  const updateTaskMutation = useUpdateTask();
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed;
  const isDone = task.is_completed;

  // Get project info
  const project = projects.find(p => p.id === task.project_id);

  // Get assignee info
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const assigneeName = assignee
    ? task.assigned_to === userId
      ? 'You'
      : assignee.first_name || assignee.last_name || 'Unknown'
    : null;

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newCompletedState = !isDone;

    updateTaskMutation.mutate({
      taskId: task.id,
      updates: {
        is_completed: newCompletedState,
        completed_at: newCompletedState ? new Date().toISOString() : null,
      },
    });
  };

  // Format due date
  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    // Otherwise show month and day
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isDragging ? 'opacity-50' : ''
      } ${isDone ? 'opacity-60' : ''}`}
    >
      {/* Task Name */}
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={handleStatusToggle}
          className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 transition-colors ${
            isDone
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {isDone && (
            <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-gray-900 ${isDone ? 'line-through' : ''}`}>
            {task.name}
          </p>
        </div>
      </div>

      {/* Task Description (if exists) */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      {/* Task Metadata */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        {/* Due Date */}
        {task.due_date && (
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
            <Calendar className="h-3 w-3" />
            <span>{formatDueDate(task.due_date)}</span>
          </div>
        )}

        {/* Assignee */}
        {assigneeName && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{assigneeName}</span>
          </div>
        )}

        {/* Project Badge */}
        {project && (
          <div
            className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: project.color ? `${project.color}20` : '#f3f4f6',
              color: project.color || '#6b7280',
            }}
          >
            {project.name}
          </div>
        )}
      </div>
    </div>
  );
}
