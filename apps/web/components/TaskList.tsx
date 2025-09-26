'use client';

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from './TaskItem';
import { Task, CustomPropertyDefinition } from '@perfect-task-app/models';

interface TaskListProps {
  tasks: Task[];
  selectedProjectIds: string[];
  customPropertyDefinitions?: CustomPropertyDefinition[];
  userId: string;
  isLoading?: boolean;
  isDraggingActive?: boolean;
}

export function TaskList({ tasks, selectedProjectIds, customPropertyDefinitions = [], userId, isLoading, isDraggingActive }: TaskListProps) {
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

  // Use tasks in the order they're passed from TaskHub (preserves drag order)
  const displayedTasks = [...tasks];

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
        <div className="flex-shrink-0 w-16">
          {isDraggingActive && (
            <span className="text-blue-500">↕</span>
          )}
        </div>
        {/* Name Column */}
        <div className="flex-1 min-w-0">Name</div>
        {/* Assigned To Column */}
        <div className="flex-shrink-0 w-24 text-right">Assigned</div>
        {/* Due Date Column */}
        <div className="flex-shrink-0 w-28 text-right">Due Date</div>
        {/* Custom Property Columns */}
        {customPropertyDefinitions.map((property) => (
          <div key={property.id} className="flex-shrink-0 w-32 text-right">
            {property.name}
          </div>
        ))}
      </div>

      {/* Task Rows */}
      <div className="flex-1 overflow-y-auto bg-white">
        <SortableContext
          items={displayedTasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {displayedTasks.map((task) => (
            <SortableTaskItem key={task.id} task={task} customPropertyDefinitions={customPropertyDefinitions} userId={userId} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskItem({ task, customPropertyDefinitions, userId }: { task: Task; customPropertyDefinitions: CustomPropertyDefinition[]; userId: string }) {
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
    transition: isDragging ? 'none' : transition, // Disable transition while dragging for smoother feel
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