'use client';

import { useState, memo } from 'react';
import { useUpdateTask, useTaskPropertyValues, useSetPropertyValue } from '@perfect-task-app/data';
import { Task, CustomPropertyDefinition, Project } from '@perfect-task-app/models';
import { EditPencil } from 'iconoir-react';

type BuiltInColumn = 'assigned_to' | 'due_date' | 'project';

interface TaskItemProps {
  task: Task;
  customPropertyDefinitions?: CustomPropertyDefinition[];
  userId: string;
  isDragging?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
  userMapping?: Record<string, string>;
  projectMapping?: Record<string, string>;
  projects?: Project[];
  profiles?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  visibleBuiltInColumns?: Set<BuiltInColumn>;
  onEditClick?: (taskId: string) => void;
}

// Removed unused projectNames constant

const TaskItem = memo(function TaskItem({ task, customPropertyDefinitions = [], userId, isDragging = false, dragAttributes, dragListeners, userMapping = {}, projectMapping = {}, projects = [], profiles = [], visibleBuiltInColumns = new Set(['assigned_to', 'due_date', 'project']), onEditClick }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done';
  const isDone = task.status === 'Done';
  const updateTaskMutation = useUpdateTask();
  const { data: propertyValues = [] } = useTaskPropertyValues(task.id);
  const setPropertyValueMutation = useSetPropertyValue();
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  // Helper function to get property value for a given definition
  const getPropertyValue = (definitionId: string) => {
    const propertyValue = propertyValues.find(pv => pv.definition_id === definitionId);
    return propertyValue?.value || '';
  };

  // Handle custom property value updates
  const handlePropertyValueChange = async (definitionId: string, value: string) => {
    try {
      await setPropertyValueMutation.mutateAsync({
        taskId: task.id,
        definitionId,
        value: value.trim(),
        userId,
      });
    } catch (error) {
      console.error('Failed to update custom property value:', error);
      // TODO: Show error message to user
    }
  };

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
    // Drag handle for @dnd-kit sorting is passed via dragListeners
  };

  // HTML5 drag handlers for dragging to calendar
  const handleCalendarDragStart = (e: React.DragEvent) => {
    // Set data for calendar drop
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(task));

    // Dispatch custom event for calendar to listen to
    window.dispatchEvent(new CustomEvent('task-drag-start', { detail: task }));

    console.log('🎯 Task drag to calendar started:', task.name);
  };

  const handleCalendarDragEnd = () => {
    // Notify calendar that drag ended
    window.dispatchEvent(new CustomEvent('task-drag-end'));
    console.log('🎯 Task drag to calendar ended');
  };

  return (
    <div
      className={`bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors ${
        isDragging ? 'bg-blue-50 shadow-lg' : ''
      } ${isDone ? 'opacity-75' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Table Row Layout */}
      <div className="flex items-center gap-3 px-4 py-3">
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

        {/* Name Column - draggable to calendar */}
        <div
          draggable
          onDragStart={handleCalendarDragStart}
          onDragEnd={handleCalendarDragEnd}
          className="flex-1 min-w-0 flex items-center gap-2 cursor-grab active:cursor-grabbing"
          title="Drag to calendar to schedule"
        >
          <span className={`font-medium text-sm truncate block ${
            isDone ? 'text-gray-500 line-through' : 'text-gray-900'
          }`}>
            {task.name}
          </span>
          {/* Edit Icon - appears on hover */}
          {isHovered && onEditClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(task.id);
              }}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit task"
              draggable={false}
            >
              <EditPencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Assigned To Column - Fixed width */}
        {visibleBuiltInColumns.has('assigned_to') && (
          <div className="flex-shrink-0 w-24 flex justify-end">
            {task.assigned_to ? (
              <div
                className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium"
                title={userMapping[task.assigned_to] || 'Unknown User'}
              >
                {(() => {
                  const profile = profiles.find(p => p.id === task.assigned_to);
                  if (!profile) {
                    return 'U';
                  }

                  const firstInitial = profile.first_name?.[0]?.toUpperCase() || '';
                  const lastInitial = profile.last_name?.[0]?.toUpperCase() || '';

                  if (firstInitial && lastInitial) {
                    return firstInitial + lastInitial;
                  } else if (firstInitial) {
                    return firstInitial;
                  } else if (lastInitial) {
                    return lastInitial;
                  }
                  return 'U';
                })()}
              </div>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </div>
        )}

        {/* Due Date Column - Fixed width */}
        {visibleBuiltInColumns.has('due_date') && (
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
        )}

        {/* Project Column - Fixed width */}
        {visibleBuiltInColumns.has('project') && (
          <div className="flex-shrink-0 w-28 flex justify-end">
            {(() => {
              const project = projects.find(p => p.id === task.project_id);
              if (!project) {
                return <span className="text-sm text-gray-400">Unknown</span>;
              }

              const getColorClasses = (color: string) => {
                switch (color) {
                  case 'rose': return 'bg-rose-100 text-rose-800 border-rose-200';
                  case 'amber': return 'bg-amber-100 text-amber-800 border-amber-200';
                  case 'mint': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  case 'sky': return 'bg-sky-100 text-sky-800 border-sky-200';
                  case 'violet': return 'bg-violet-100 text-violet-800 border-violet-200';
                  case 'lime': return 'bg-lime-100 text-lime-800 border-lime-200';
                  case 'teal': return 'bg-teal-100 text-teal-800 border-teal-200';
                  case 'crimson': return 'bg-red-100 text-red-800 border-red-200';
                  default: return 'bg-gray-100 text-gray-800 border-gray-200';
                }
              };

              const getColorDot = (color: string) => {
                switch (color) {
                  case 'rose': return 'bg-rose-500';
                  case 'amber': return 'bg-amber-500';
                  case 'mint': return 'bg-emerald-500';
                  case 'sky': return 'bg-sky-500';
                  case 'violet': return 'bg-violet-500';
                  case 'lime': return 'bg-lime-500';
                  case 'teal': return 'bg-teal-500';
                  case 'crimson': return 'bg-red-600';
                  default: return 'bg-gray-500';
                }
              };

              return (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getColorClasses(project.color)}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${getColorDot(project.color)}`} />
                  <span className="truncate max-w-[80px]">{project.name}</span>
                </span>
              );
            })()}
          </div>
        )}

        {/* Custom Property Columns */}
        {customPropertyDefinitions.map((property) => {
          const value = getPropertyValue(property.id);
          const isEditing = editingPropertyId === property.id;

          return (
            <div key={property.id} className="flex-shrink-0 w-32 text-right">
              {isEditing ? (
                <div className="px-1">
                  {property.type === 'select' ? (
                    <select
                      value={value}
                      onChange={async (e) => {
                        await handlePropertyValueChange(property.id, e.target.value);
                        setEditingPropertyId(null);
                      }}
                      onBlur={() => setEditingPropertyId(null)}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    >
                      <option value="">Select...</option>
                      {property.options && Array.isArray(property.options) &&
                        property.options.map((option: string, index: number) => (
                          <option key={index} value={option}>
                            {option}
                          </option>
                        ))
                      }
                    </select>
                  ) : (
                    <input
                      type={property.type === 'date' ? 'date' : property.type === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={async (e) => {
                        await handlePropertyValueChange(property.id, e.target.value);
                        setEditingPropertyId(null);
                      }}
                      onBlur={() => setEditingPropertyId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setEditingPropertyId(null);
                        }
                        if (e.key === 'Escape') {
                          setEditingPropertyId(null);
                        }
                      }}
                      className="w-full text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setEditingPropertyId(property.id)}
                  className="w-full text-right hover:bg-gray-100 px-1 py-0.5 rounded transition-colors"
                  disabled={isDragging}
                >
                  {value ? (
                    <span className="text-sm text-gray-600 truncate block">
                      {property.type === 'date' && value ? (
                        new Date(value).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })
                      ) : (
                        value
                      )}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export { TaskItem };