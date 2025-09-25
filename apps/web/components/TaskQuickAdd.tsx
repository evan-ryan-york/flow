'use client';

import { useState } from 'react';
import { useCreateTask, useProjectsForUser } from '@perfect-task-app/data';

interface TaskQuickAddProps {
  userId: string;
  defaultProjectId: string;
}

export function TaskQuickAdd({ userId, defaultProjectId }: TaskQuickAddProps) {
  const [taskName, setTaskName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);

  // Use real data hooks
  const { data: projects = [] } = useProjectsForUser(userId);
  const createTaskMutation = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskName.trim()) return;

    try {
      await createTaskMutation.mutateAsync({
        name: taskName,
        description: '',
        project_id: projectId || defaultProjectId,
        assigned_to: userId,
        due_date: dueDate || undefined,
        status: 'To Do',
      });

      // Reset form
      setTaskName('');
      setDueDate('');
      setShowAdvanced(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      // TODO: Show error message to user
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Main Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
          title="Advanced options"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          type="submit"
          disabled={!taskName.trim() || createTaskMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createTaskMutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projects.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </form>
  );
}