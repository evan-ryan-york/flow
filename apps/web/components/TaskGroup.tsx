'use client';

import React, { useState } from 'react';
import { NavArrowDown, NavArrowRight } from 'iconoir-react';
import { TaskItem } from './TaskItem';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';
import { TaskGroup as TaskGroupType } from '@perfect-task-app/ui/lib/taskGrouping';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface TaskGroupProps {
  group: TaskGroupType;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: (groupKey: string) => void;
  isDraggingActive?: boolean;
}

export function TaskGroup({
  group,
  customPropertyDefinitions,
  userId,
  isCollapsed = false,
  onToggleCollapse,
  isDraggingActive = false
}: TaskGroupProps) {
  const handleToggle = () => {
    onToggleCollapse?.(group.key);
  };

  const completionPercentage = group.count > 0 ? (group.completedCount / group.count) * 100 : 0;

  return (
    <div className="mb-6">
      {/* Group Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          {/* Collapse/Expand Icon */}
          <button
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
          >
            {isCollapsed ? (
              <NavArrowRight className="h-4 w-4 text-gray-600" />
            ) : (
              <NavArrowDown className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Group Title */}
          <h3 className="font-medium text-gray-900">{group.label}</h3>

          {/* Task Count Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {group.count} task{group.count !== 1 ? 's' : ''}
            </span>

            {/* Completion Badge */}
            {group.completedCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {group.completedCount} done
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {group.count > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-16 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium min-w-[3rem]">
              {Math.round(completionPercentage)}%
            </span>
          </div>
        )}
      </div>

      {/* Group Tasks */}
      {!isCollapsed && group.tasks.length > 0 && (
        <div className="bg-white">
          <SortableContext
            items={group.tasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            {group.tasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                customPropertyDefinitions={customPropertyDefinitions}
                userId={userId}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* Empty State */}
      {!isCollapsed && group.tasks.length === 0 && (
        <div className="bg-white px-4 py-8 text-center text-gray-500">
          <p className="text-sm">No tasks in this group</p>
        </div>
      )}
    </div>
  );
}

// Separate component for sortable task items within groups
function SortableTaskItem({
  task,
  customPropertyDefinitions,
  userId
}: {
  task: Task;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-40 z-50' : ''} ${
        transform ? 'shadow-lg' : ''
      }`}
    >
      <TaskItem
        task={task}
        customPropertyDefinitions={customPropertyDefinitions}
        userId={userId}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

// Import necessary dependencies
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';