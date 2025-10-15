'use client';

import { useState, memo, useEffect } from 'react';
import { useUpdateTask, useTaskPropertyValues, useSetPropertyValue } from '@perfect-task-app/data';
import { Task, CustomPropertyDefinition, Project } from '@perfect-task-app/models';
import { Trash } from 'iconoir-react';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { getProjectColorHex, getProjectColorLightBackground } from '@perfect-task-app/ui/colors';

type BuiltInColumn = 'assigned_to' | 'due_date' | 'project';

interface TaskItemProps {
  task: Task;
  customPropertyDefinitions?: CustomPropertyDefinition[];
  userId: string;
  isDragging?: boolean;
  dragAttributes?: Record<string, unknown> & { [key: string]: unknown };
  dragListeners?: Record<string, unknown> & { [key: string]: unknown };
  userMapping?: Record<string, string>;
  projectMapping?: Record<string, string>;
  projects?: Project[];
  profiles?: Array<{ id: string; first_name?: string | null; last_name?: string | null }>;
  visibleBuiltInColumns?: Set<BuiltInColumn>;
  onEditClick?: (taskId: string) => void;
}

// Removed unused projectNames constant

const TaskItem = memo(function TaskItem({ task, customPropertyDefinitions = [], userId, isDragging = false, dragAttributes, dragListeners, userMapping = {}, projectMapping: _projectMapping = {}, projects = [], profiles = [], visibleBuiltInColumns = new Set(['assigned_to', 'due_date', 'project']), onEditClick }: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDraggingActive, setIsDraggingActive] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.is_completed;
  const isDone = task.is_completed;
  const updateTaskMutation = useUpdateTask();
  const { data: propertyValues = [] } = useTaskPropertyValues(task.id);
  const setPropertyValueMutation = useSetPropertyValue();
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  // Handle fade-out animation before task disappears
  useEffect(() => {
    if (isDone && justCompleted) {
      // Start fade out after 1.5 seconds (leaves 0.5s for fade animation)
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 1500);

      return () => clearTimeout(fadeTimer);
    }
  }, [isDone, justCompleted]);

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

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    const newCompletedState = !isDone;

    // If marking as complete, dispatch event to parent to keep it visible
    if (newCompletedState) {
      setJustCompleted(true);
      window.dispatchEvent(new CustomEvent('task-completed', {
        detail: { taskId: task.id }
      }));
    } else {
      // Reset animation states when uncompleting
      setJustCompleted(false);
      setIsFadingOut(false);
    }

    updateTaskMutation.mutate({
      taskId: task.id,
      updates: {
        is_completed: newCompletedState,
        completed_at: newCompletedState ? new Date().toISOString() : null,
      }
    }, {
      onError: (error) => {
        console.error('Failed to update task completion status:', error);
        // Reset animation states on error
        setJustCompleted(false);
        setIsFadingOut(false);
      }
    });
  };

  const handleDragHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Drag handle for @dnd-kit sorting is passed via dragListeners
  };

  // Track drag start/end to prevent clicks during drag
  const handleDragHandlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // Don't let this trigger row click
    setIsDraggingActive(true);
    console.log('🎯 Drag handle pointer down');
  };

  const handleDragHandlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation(); // Don't let this trigger row click
    // Delay reset to avoid race condition with click event
    setTimeout(() => setIsDraggingActive(false), 50);
    console.log('🎯 Drag handle pointer up');
  };

  const handleRowClick = () => {
    // Only trigger if not dragging and onEditClick is provided
    if (!isDraggingActive && onEditClick) {
      onEditClick(task.id);
    }
  };

  // HTML5 drag handlers for dragging to calendar
  const handleCalendarDragStart = (e: React.DragEvent) => {
    // Prevent drag from interfering with row click
    e.stopPropagation();

    // Set data for calendar drop
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', task.id); // Simple data transfer

    // Dispatch custom event for calendar to listen to (this is what the calendar actually uses)
    window.dispatchEvent(new CustomEvent('task-drag-start', { detail: task }));

    console.log('🎯 Task drag to calendar started:', task.name);
  };

  const handleCalendarDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();

    // Notify calendar that drag ended
    window.dispatchEvent(new CustomEvent('task-drag-end'));
    console.log('🎯 Task drag to calendar ended');
  };

  return (
    <div
      className={`relative border-b border-gray-200 transition-all duration-500 ${
        isDragging ? 'bg-blue-50 shadow-lg' : 'bg-white'
      } ${!isDragging && !isDone ? 'hover:bg-gray-50 cursor-pointer' : ''} ${isFadingOut ? 'opacity-0' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleRowClick}
    >
      {/* Animated background overlay for completion - needs overflow hidden */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {justCompleted && isDone && (
          <div
            className="absolute inset-0 bg-green-50"
            style={{
              animation: 'slideInLR 0.6s ease-out forwards'
            }}
          />
        )}
      </div>
      {/* Table Row Layout */}
      <div className="relative flex items-center gap-3 px-4 py-3">
        {/* Drag Handle */}
        <button
          {...dragAttributes}
          {...dragListeners}
          onClick={(e) => {
            e.stopPropagation();
            handleDragHandleClick(e);
          }}
          onPointerDown={(e) => {
            handleDragHandlePointerDown(e);
            // Call the original listener if it exists
            if (dragListeners && 'onPointerDown' in dragListeners && typeof dragListeners.onPointerDown === 'function') {
              (dragListeners.onPointerDown as (e: React.PointerEvent) => void)(e);
            }
          }}
          onPointerUp={(e) => {
            handleDragHandlePointerUp(e);
            // Call the original listener if it exists
            if (dragListeners && 'onPointerUp' in dragListeners && typeof dragListeners.onPointerUp === 'function') {
              (dragListeners.onPointerUp as (e: React.PointerEvent) => void)(e);
            }
          }}
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
          onClick={(e) => handleStatusToggle(e)}
          disabled={updateTaskMutation.isPending}
          className={`flex-shrink-0 p-1 rounded-full transition-all ${
            updateTaskMutation.isPending
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
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

        {/* Name Column - clickable to open details */}
        <div className="flex-1 min-w-0 flex items-center gap-2 group/title relative">
          <span className={`font-medium text-sm truncate block ${
            isDone ? 'text-gray-500 line-through' : 'text-gray-900'
          }`}>
            {task.name}
          </span>
          {/* Tooltip - shows full task name on hover */}
          <div className="absolute left-0 bottom-full mb-2 invisible group-hover/title:visible opacity-0 group-hover/title:opacity-100 transition-opacity duration-200 z-50 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 max-w-md whitespace-normal break-words">
              {task.name}
              {/* Arrow pointing down */}
              <div className="absolute top-full left-8 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
          {/* Action Icons - appear on hover */}
          {isHovered && (
            <div className="flex items-center gap-1">
              <button
                draggable
                onDragStart={handleCalendarDragStart}
                onDragEnd={handleCalendarDragEnd}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  handleDragHandlePointerDown(e);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  handleDragHandlePointerUp(e);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-grab active:cursor-grabbing"
                title="Drag to calendar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteDialogOpen(true);
                }}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete task"
                draggable={false}
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
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

              const mainColor = getProjectColorHex(project.color || 'blue');
              const lightBg = getProjectColorLightBackground(project.color || 'blue');

              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: lightBg,
                    borderColor: mainColor,
                    color: mainColor,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: mainColor }}
                  />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPropertyId(property.id);
                  }}
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

      {/* Delete Confirmation Dialog */}
      <DeleteTaskDialog
        task={task}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  );
});

export { TaskItem };