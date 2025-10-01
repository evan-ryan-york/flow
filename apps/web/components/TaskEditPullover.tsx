'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Xmark } from 'iconoir-react';
import {
  useTask,
  useUpdateTask,
  useTaskPropertyValues,
  useSetPropertyValue,
  useProjectDefinitions,
  useAllProfiles,
  useProjectsForUser,
} from '@perfect-task-app/data';
import { Input } from '@perfect-task-app/ui/components/ui/input';
import { ProjectChip } from '@perfect-task-app/ui/components/custom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@perfect-task-app/ui/components/ui/dialog';
import { Button } from '@perfect-task-app/ui/components/ui/button';

interface TaskEditPulloverProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskSwitch?: (taskId: string) => void;
  userId: string;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

/**
 * Custom hook for debounced auto-save
 */
function useDebouncedSave<T>(
  saveFunction: (value: T) => Promise<void>,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPending, setIsPending] = useState(false);

  const debouncedSave = useCallback(
    (value: T) => {
      setIsPending(true);

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        try {
          await saveFunction(value);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsPending(false);
        }
      }, delay);
    },
    [saveFunction, delay]
  );

  const cancelPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setIsPending(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedSave, isPending, cancelPending };
}

export function TaskEditPullover({
  taskId,
  isOpen,
  onClose,
  userId,
  hasUnsavedChanges,
  setHasUnsavedChanges,
}: TaskEditPulloverProps) {
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [localTaskName, setLocalTaskName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [customPropertyValues, setCustomPropertyValues] = useState<Record<string, string>>({});
  const initializedTaskIdRef = useRef<string | null>(null);

  // Data fetching
  const { data: task } = useTask(taskId || '');
  const { data: propertyValues = [] } = useTaskPropertyValues(taskId || '');
  const { data: customProperties = [] } = useProjectDefinitions(task?.project_id || '');
  const { data: allProfiles = [] } = useAllProfiles();
  const { data: projects = [] } = useProjectsForUser(userId);

  // Mutations
  const updateTaskMutation = useUpdateTask();
  const setPropertyValueMutation = useSetPropertyValue();

  // Find current project
  const currentProject = projects.find((p) => p.id === task?.project_id);

  // Initialize local state when task changes
  useEffect(() => {
    if (task && task.id !== initializedTaskIdRef.current) {
      setLocalTaskName(task.name || '');
      setLocalDescription(task.description || '');
      initializedTaskIdRef.current = task.id;
    }
  }, [task]);

  // Initialize custom property values
  useEffect(() => {
    if (taskId && propertyValues.length > 0 && taskId !== initializedTaskIdRef.current) {
      const values: Record<string, string> = {};
      propertyValues.forEach((pv) => {
        values[pv.definition_id] = pv.value;
      });
      setCustomPropertyValues(values);
    }
  }, [taskId, propertyValues.length]); // Depend on length, not the array itself

  // Auto-save functions
  const saveTaskName = useCallback(
    async (name: string) => {
      if (!taskId || !name.trim()) return;
      await updateTaskMutation.mutateAsync({
        taskId,
        updates: { name: name.trim() },
      });
    },
    [taskId, updateTaskMutation]
  );

  const saveDescription = useCallback(
    async (description: string) => {
      if (!taskId) return;
      await updateTaskMutation.mutateAsync({
        taskId,
        updates: { description: description.trim() || undefined },
      });
    },
    [taskId, updateTaskMutation]
  );

  const saveCustomProperty = useCallback(
    async (definitionId: string, value: string) => {
      if (!taskId) return;
      await setPropertyValueMutation.mutateAsync({
        taskId,
        definitionId,
        value: value.trim(),
        userId,
      });
    },
    [taskId, userId, setPropertyValueMutation]
  );

  // Debounced saves
  const { debouncedSave: debouncedSaveTaskName, isPending: isTaskNamePending } =
    useDebouncedSave(saveTaskName, 500);
  const { debouncedSave: debouncedSaveDescription, isPending: isDescriptionPending } =
    useDebouncedSave(saveDescription, 500);

  // Track if there are any pending saves
  useEffect(() => {
    setHasUnsavedChanges(isTaskNamePending || isDescriptionPending);
  }, [isTaskNamePending, isDescriptionPending, setHasUnsavedChanges]);

  // Handlers
  const handleTaskNameChange = (value: string) => {
    setLocalTaskName(value);
    debouncedSaveTaskName(value);
  };

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    debouncedSaveDescription(value);
  };

  const handleCustomPropertyChange = async (definitionId: string, value: string) => {
    setCustomPropertyValues((prev) => ({ ...prev, [definitionId]: value }));
    // For select/date, save immediately. For text/number, debounce.
    const property = customProperties.find((p) => p.id === definitionId);
    if (property?.type === 'select' || property?.type === 'date') {
      await saveCustomProperty(definitionId, value);
    } else {
      // For text/number, we'll implement debouncing per-property
      // For now, save immediately
      await saveCustomProperty(definitionId, value);
    }
  };

  const handleAssignedToChange = async (assignedTo: string) => {
    if (!taskId) return;
    await updateTaskMutation.mutateAsync({
      taskId,
      updates: { assigned_to: assignedTo },
    });
  };

  const handleDueDateChange = async (dueDate: string) => {
    if (!taskId) return;
    await updateTaskMutation.mutateAsync({
      taskId,
      updates: { due_date: dueDate || undefined },
    });
  };

  const handleStatusChange = async (status: string) => {
    if (!taskId) return;
    await updateTaskMutation.mutateAsync({
      taskId,
      updates: { status, is_completed: status === 'Done' },
    });
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseWarning(true);
    } else {
      onClose();
    }
  };

  const handleForceClose = () => {
    setShowCloseWarning(false);
    onClose();
  };

  if (!isOpen || !taskId || !task) {
    return null;
  }

  return (
    <>
      {/* Pullover Panel */}
      <div
        className={`fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl transition-transform duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'calc(33.333% - 2rem)' }} // Approximately 1/3 of screen minus some margin
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0 mr-4">
            <Input
              type="text"
              value={localTaskName}
              onChange={(e) => handleTaskNameChange(e.target.value)}
              className="font-semibold text-lg border-0 px-0 focus:ring-0 focus:border-b focus:border-blue-500"
              placeholder="Task name"
            />
            {currentProject && (
              <div className="mt-2">
                <ProjectChip project={currentProject} onRemove={() => {}} />
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Close"
          >
            <Xmark className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="overflow-y-auto h-[calc(100vh-88px)] px-6 py-4">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={localDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y"
                placeholder="Add description..."
              />
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <select
                value={task.assigned_to || ''}
                onChange={(e) => handleAssignedToChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {allProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.first_name || profile.last_name || 'Unknown User'}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={task.due_date || ''}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={task.status || 'To Do'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Custom Properties */}
            {customProperties.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Custom Properties</h3>
                <div className="space-y-4">
                  {customProperties.map((property) => {
                    const value = customPropertyValues[property.id] || '';

                    return (
                      <div key={property.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {property.name}
                        </label>
                        {property.type === 'text' && (
                          <Input
                            type="text"
                            value={value}
                            onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === 'number' && (
                          <Input
                            type="number"
                            value={value}
                            onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === 'date' && (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        )}
                        {property.type === 'select' && (
                          <select
                            value={value}
                            onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select {property.name.toLowerCase()}...</option>
                            {property.options &&
                              Array.isArray(property.options) &&
                              property.options.map((option: string, index: number) => (
                                <option key={index} value={option}>
                                  {option}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save Status Indicator */}
            {hasUnsavedChanges && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Saving...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning Dialog */}
      <Dialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              Your changes are still being saved. Are you sure you want to close?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseWarning(false)}>
              Wait
            </Button>
            <Button variant="destructive" onClick={handleForceClose}>
              Close Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
