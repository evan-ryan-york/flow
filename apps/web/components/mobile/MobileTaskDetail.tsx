'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NavArrowLeft } from 'iconoir-react';
import {
  useTask,
  useUpdateTask,
  useTaskPropertyValues,
  useSetPropertyValue,
  useProjectDefinitions,
  useAllProfiles,
  useProjectsForUser,
} from '@flow-app/data';
import { Input } from '@flow-app/ui/components/ui/input';
import { ProjectChip } from '@flow-app/ui/components/custom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@flow-app/ui/components/ui/dialog';
import { Button } from '@flow-app/ui/components/ui/button';

interface MobileTaskDetailProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  userId: string;
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

export function MobileTaskDetail({
  taskId,
  isOpen,
  onClose,
  userId,
}: MobileTaskDetailProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [localTaskName, setLocalTaskName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [customPropertyValues, setCustomPropertyValues] = useState<Record<string, string>>({});
  const initializedTaskIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Initialize local state when task changes
  useEffect(() => {
    if (task && task.id !== initializedTaskIdRef.current) {
      setLocalTaskName(task.name || '');
      setLocalDescription(task.description || '');

      // Initialize custom property values
      const values: Record<string, string> = {};
      propertyValues.forEach((pv) => {
        values[pv.definition_id] = pv.value;
      });
      setCustomPropertyValues(values);

      initializedTaskIdRef.current = task.id;

      // Auto-grow textarea after task name is set
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
      }, 0);
    }
  }, [task, propertyValues]);

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
  }, [isTaskNamePending, isDescriptionPending]);

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
    const property = customProperties.find((p) => p.id === definitionId);
    if (property?.type === 'select' || property?.type === 'date') {
      await saveCustomProperty(definitionId, value);
    } else {
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

  const handleProjectChange = async (project: typeof currentProject) => {
    if (!taskId || !project) return;
    await updateTaskMutation.mutateAsync({
      taskId,
      updates: { project_id: project.id },
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

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (hasUnsavedChanges) {
          setShowCloseWarning(true);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, hasUnsavedChanges, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
          <button
            onClick={handleClose}
            className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Back"
          >
            <NavArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
          {hasUnsavedChanges && (
            <div className="ml-auto text-xs text-gray-500 flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Saving...
            </div>
          )}
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {task ? (
            <div className="space-y-6">
              {/* Task Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Name
                </label>
                <textarea
                  ref={textareaRef}
                  value={localTaskName || task.name || ''}
                  onChange={(e) => {
                    handleTaskNameChange(e.target.value);
                    // Auto-grow as user types
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none overflow-y-hidden min-h-[44px]"
                  placeholder="Task name"
                  rows={1}
                />
              </div>

              {/* Project */}
              {currentProject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project
                  </label>
                  <ProjectChip
                    project={currentProject}
                    onRemove={() => {}}
                    onProjectSelect={handleProjectChange}
                    projects={projects}
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={localDescription || task.description || ''}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                />
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
                              className="text-base min-h-[44px]"
                              placeholder={`Enter ${property.name.toLowerCase()}`}
                            />
                          )}
                          {property.type === 'number' && (
                            <Input
                              type="number"
                              value={value}
                              onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                              className="text-base min-h-[44px]"
                              placeholder={`Enter ${property.name.toLowerCase()}`}
                            />
                          )}
                          {property.type === 'date' && (
                            <input
                              type="date"
                              value={value}
                              onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                            />
                          )}
                          {property.type === 'select' && (
                            <select
                              value={value}
                              onChange={(e) => handleCustomPropertyChange(property.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
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
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading task...</div>
            </div>
          )}
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
