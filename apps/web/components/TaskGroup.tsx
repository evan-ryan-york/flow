'use client';

import React, { useState } from 'react';
import { NavArrowDown, NavArrowRight } from 'iconoir-react';
import { TaskItem } from './TaskItem';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';
import { TaskGroup as TaskGroupType, GroupByOption } from '@perfect-task-app/ui/lib/taskGrouping';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TaskGroupProps {
  group: TaskGroupType;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: (groupKey: string) => void;
  isDraggingActive?: boolean;
  groupBy?: GroupByOption | null;
  userMapping?: Record<string, string>;
}

export function TaskGroup({
  group,
  customPropertyDefinitions,
  userId,
  isCollapsed = false,
  onToggleCollapse,
  isDraggingActive = false,
  groupBy,
  userMapping = {}
}: TaskGroupProps) {
  const handleToggle = () => {
    onToggleCollapse?.(group.key);
  };

  const completionPercentage = group.count > 0 ? (group.completedCount / group.count) * 100 : 0;

  // Make the group header a droppable area for cross-group drops
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.key}`,
    data: {
      type: 'group',
      groupKey: group.key,
      groupLabel: group.label,
      groupBy: groupBy
    }
  });

  console.log('🔍 GROUP DROPPABLE SETUP:', {
    groupKey: group.key,
    groupLabel: group.label,
    groupBy: groupBy,
    droppableId: `group-${group.key}`
  });

  // Check if drag-and-drop should be enabled for this grouping type
  const isDragDropEnabled = groupBy && (
    groupBy === 'project' ||
    groupBy === 'status' ||
    groupBy === 'assignee' ||
    (typeof groupBy === 'object' && groupBy.type === 'customProperty')
  );

  return (
    <div
      ref={setNodeRef}
      className={`mb-6 rounded-lg transition-all duration-200 ${
        isOver
          ? 'bg-blue-50 border-2 border-blue-300 shadow-lg'
          : isDraggingActive && isDragDropEnabled
          ? 'bg-blue-50/30 border-2 border-blue-200 hover:border-blue-300'
          : 'border-2 border-transparent'
      }`}
    >
      {/* Group Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer transition-colors ${
          isOver
            ? 'bg-blue-100'
            : isDraggingActive && isDragDropEnabled
            ? 'bg-blue-50 hover:bg-blue-100'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
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
          <h3 className="font-medium text-gray-900">
            {group.label}
            {isDraggingActive && isDragDropEnabled && !isOver && (
              <span className="ml-2 text-xs text-blue-500 font-normal opacity-75">
                Drop anywhere in this section
              </span>
            )}
            {isOver && (
              <span className="ml-2 text-xs text-blue-700 font-medium">
                Release to move here
              </span>
            )}
          </h3>

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
        <div className={`transition-colors ${
          isOver ? 'bg-blue-50/50' : 'bg-white'
        }`}>
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
                userMapping={userMapping}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* Empty State */}
      {!isCollapsed && group.tasks.length === 0 && (
        <div className={`px-4 py-8 text-center text-gray-500 transition-colors ${
          isOver ? 'bg-blue-50/50' : 'bg-white'
        }`}>
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
  userId,
  userMapping
}: {
  task: Task;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string;
  userMapping?: Record<string, string>;
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
        userMapping={userMapping}
      />
    </div>
  );
}

