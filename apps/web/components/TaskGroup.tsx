'use client';

import React from 'react';
import { NavArrowDown, NavArrowRight } from 'iconoir-react';
import { TaskItem } from './TaskItem';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';
import { TaskGroup as TaskGroupType, GroupByOption } from '@perfect-task-app/ui/lib/taskGrouping';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BRAND_COLOR } from '@perfect-task-app/ui/colors';

interface TaskGroupProps {
  group: TaskGroupType;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string;
  isCollapsed?: boolean;
  onToggleCollapse?: (groupKey: string) => void;
  isDraggingActive?: boolean;
  groupBy?: GroupByOption | null;
  userMapping?: Record<string, string>;
  projectMapping?: Record<string, string>;
  projects?: Array<{ id: string; name: string; color: string }>;
  profiles?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  visibleBuiltInColumns?: Set<'assigned_to' | 'due_date' | 'project' | 'created_at'>;
  onTaskEditClick?: (taskId: string) => void;
}

export function TaskGroup({
  group,
  customPropertyDefinitions,
  userId,
  isCollapsed = false,
  onToggleCollapse,
  isDraggingActive = false,
  groupBy,
  userMapping = {},
  projectMapping = {},
  projects = [],
  profiles = [],
  visibleBuiltInColumns = new Set(['assigned_to', 'due_date', 'project', 'created_at']),
  onTaskEditClick
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
    groupBy === 'assignee' ||
    (typeof groupBy === 'object' && groupBy.type === 'customProperty')
  );

  return (
    <div
      ref={setNodeRef}
      className={`mb-6 rounded-lg transition-all duration-200 border-2 ${
        isOver
          ? 'shadow-lg'
          : isDraggingActive && isDragDropEnabled
          ? ''
          : 'border-transparent'
      }`}
      style={
        isOver
          ? { backgroundColor: BRAND_COLOR.lighter, borderColor: BRAND_COLOR.main }
          : isDraggingActive && isDragDropEnabled
          ? { backgroundColor: `${BRAND_COLOR.lighter}50`, borderColor: BRAND_COLOR.light }
          : undefined
      }
    >
      {/* Group Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 cursor-pointer transition-colors ${
          !(isOver || (isDraggingActive && isDragDropEnabled))
            ? 'bg-gray-50 hover:bg-gray-100'
            : ''
        }`}
        style={
          isOver
            ? { backgroundColor: BRAND_COLOR.light }
            : isDraggingActive && isDragDropEnabled
            ? { backgroundColor: BRAND_COLOR.lighter }
            : undefined
        }
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
              <span className="ml-2 text-xs font-normal opacity-75" style={{ color: BRAND_COLOR.main }}>
                Drop anywhere in this section
              </span>
            )}
            {isOver && (
              <span className="ml-2 text-xs font-medium" style={{ color: BRAND_COLOR.main }}>
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
        <div
          className="transition-colors"
          style={isOver ? { backgroundColor: `${BRAND_COLOR.lighter}80` } : { backgroundColor: 'white' }}
        >
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
                projectMapping={projectMapping}
                projects={projects}
                profiles={profiles}
                visibleBuiltInColumns={visibleBuiltInColumns}
                onTaskEditClick={onTaskEditClick}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* Empty State */}
      {!isCollapsed && group.tasks.length === 0 && (
        <div
          className="mx-4 my-4 px-4 py-8 text-center text-gray-400 transition-colors border-2 border-dashed rounded-lg"
          style={
            isOver
              ? { backgroundColor: `${BRAND_COLOR.lighter}80`, borderColor: BRAND_COLOR.main }
              : { backgroundColor: '#f9fafb', borderColor: '#d1d5db' }
          }
        >
          <p className="text-sm">No Tasks</p>
          {isDraggingActive && isDragDropEnabled && (
            <p className="text-xs mt-1">Drop a task here to add it</p>
          )}
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
  userMapping,
  projectMapping,
  projects,
  profiles,
  visibleBuiltInColumns,
  onTaskEditClick
}: {
  task: Task;
  customPropertyDefinitions: CustomPropertyDefinition[];
  userId: string;
  userMapping?: Record<string, string>;
  projectMapping?: Record<string, string>;
  projects?: Array<{ id: string; name: string; color: string }>;
  profiles?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  visibleBuiltInColumns?: Set<'assigned_to' | 'due_date' | 'project' | 'created_at'>;
  onTaskEditClick?: (taskId: string) => void;
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
        dragAttributes={attributes as unknown as Record<string, unknown> & { [key: string]: unknown }}
        dragListeners={listeners as unknown as Record<string, unknown> & { [key: string]: unknown }}
        userMapping={userMapping}
        projectMapping={projectMapping}
        projects={projects}
        profiles={profiles}
        visibleBuiltInColumns={visibleBuiltInColumns}
        onEditClick={onTaskEditClick}
      />
    </div>
  );
}

