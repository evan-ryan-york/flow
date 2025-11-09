'use client';

import React from 'react';
import { Check, Xmark, Trash, Calendar, User, Folder } from 'iconoir-react';
import { Button } from '@perfect-task-app/ui/components/ui/button';

interface BatchActionBarProps {
  isBatchMode: boolean;
  selectedTaskIds: Set<string>;
  onMarkComplete: () => void;
  onMarkIncomplete: () => void;
  onSetProject: () => void;
  onSetDueDate: () => void;
  onSetOwner: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
  profiles?: { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null }[];
  projects?: { id: string; name: string }[];
}

export function BatchActionBar({
  isBatchMode,
  selectedTaskIds,
  onMarkComplete,
  onMarkIncomplete,
  onSetProject,
  onSetDueDate,
  onSetOwner,
  onDelete,
  onClearSelection,
}: BatchActionBarProps) {
  // Don't render if not in batch mode
  if (!isBatchMode) {
    return null;
  }

  const taskCount = selectedTaskIds.size;
  const taskLabel = taskCount === 1 ? 'task' : 'tasks';
  const hasSelection = taskCount > 0;

  return (
    <div className="bg-gray-700 text-white px-4 py-3 border-b border-gray-600">
      <div className="flex items-center justify-between">
        {/* Left: Selection info and clear */}
        <div className="flex items-center gap-3">
          {hasSelection ? (
            <>
              <span className="text-sm font-medium">
                {taskCount} {taskLabel} selected
              </span>
              <button
                onClick={onClearSelection}
                className="text-xs text-gray-300 hover:text-white transition-colors underline"
              >
                Clear
              </button>
            </>
          ) : (
            <span className="text-sm font-medium">
              0 tasks selected
            </span>
          )}
        </div>

        {/* Right: Action buttons - always visible but disabled when no selection */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onMarkComplete}
            disabled={!hasSelection}
            className="text-white hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Mark Complete
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onMarkIncomplete}
            disabled={!hasSelection}
            className="text-white hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Xmark className="w-4 h-4 mr-1.5" />
            Mark Incomplete
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onSetProject}
            disabled={!hasSelection}
            className="text-white hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Folder className="w-4 h-4 mr-1.5" />
            Set Project
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onSetDueDate}
            disabled={!hasSelection}
            className="text-white hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Set Due Date
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onSetOwner}
            disabled={!hasSelection}
            className="text-white hover:bg-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <User className="w-4 h-4 mr-1.5" />
            Set Owner
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={!hasSelection}
            className="text-white hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash className="w-4 h-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
