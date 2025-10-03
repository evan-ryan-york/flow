'use client';

import React from 'react';
import { useTimeBlockTasks, useUnassignTaskFromTimeBlock } from '@perfect-task-app/data';
import type { Task } from '@perfect-task-app/models';

interface TimeBlockEventProps {
  event: {
    id: string;
    title: string;
    resource?: {
      type: string;
      onTaskChange?: () => void;
    };
  };
}

/**
 * TaskChip component - displays a single task within a time block
 * Shows first 100 characters of task name
 * Completed tasks are shown with strikethrough
 */
function TaskChip({ task, onRemove }: { task: Task; onRemove: () => void }) {
  const displayName = task.name.length > 100
    ? `${task.name.slice(0, 100)}...`
    : task.name;

  return (
    <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 text-xs flex items-center gap-1 group hover:bg-white/30 transition-colors">
      <span
        className={`flex-1 truncate ${task.is_completed ? 'line-through opacity-70' : ''}`}
        title={task.name}
      >
        {task.is_completed && '✓ '}
        {displayName}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove task from time block"
      >
        ×
      </button>
    </div>
  );
}

/**
 * TimeBlockEvent component - custom event renderer for work time blocks
 * Displays the time block title and list of assigned tasks
 */
export function TimeBlockEvent({ event }: TimeBlockEventProps) {
  console.log('📅 TimeBlockEvent BEFORE useTimeBlockTasks:', event.id);
  const { data: tasks = [], isLoading } = useTimeBlockTasks(event.id);
  console.log('📅 TimeBlockEvent AFTER useTimeBlockTasks:', event.id, 'tasks:', tasks.length);
  const unassignMutation = useUnassignTaskFromTimeBlock();

  const handleRemoveTask = (taskId: string) => {
    console.log('🗑️ Removing task from block:', taskId);
    unassignMutation.mutate({
      taskId,
      timeBlockId: event.id,
    }, {
      onSuccess: () => {
        console.log('✅ Task removed, calling onTaskChange');
        // Trigger calendar re-render
        event.resource?.onTaskChange?.();
      }
    });
  };

  return (
    <div className="h-full flex flex-col p-1">
      {/* Time block title */}
      <div className="font-semibold mb-1 text-sm">
        {event.title}
      </div>

      {/* Tasks list */}
      {isLoading && (
        <div className="text-xs opacity-70">Loading tasks...</div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="space-y-1 flex-1 overflow-y-auto">
          {tasks.map((task) => (
            <TaskChip
              key={task.id}
              task={task}
              onRemove={() => handleRemoveTask(task.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <div className="text-xs opacity-50 italic">
          Drop tasks here
        </div>
      )}
    </div>
  );
}
