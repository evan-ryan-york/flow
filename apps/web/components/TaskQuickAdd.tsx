'use client';

import { useState, useEffect, useRef } from 'react';
import { Project } from '@perfect-task-app/models';
import {
  useCreateTask,
  useProjectsForUser,
  useLastUsedProject,
  useGeneralProject,
  useProjectDefinitions,
  useSetPropertyValue
} from '@perfect-task-app/data';
import { ProjectAutocomplete, ProjectChip } from '@perfect-task-app/ui/components/custom';
import { Input } from '@perfect-task-app/ui/components/ui/input';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { parseTaskInput, cleanTaskName } from '@perfect-task-app/ui/lib/textParser';

interface TaskQuickAddProps {
  userId: string;
  defaultProjectId: string;
}

export function TaskQuickAdd({ userId, defaultProjectId }: TaskQuickAddProps) {
  const [taskName, setTaskName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [customPropertyValues, setCustomPropertyValues] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { data: projects = [] } = useProjectsForUser(userId);
  const { data: lastUsedProjectId } = useLastUsedProject();
  const { data: generalProject } = useGeneralProject(userId);
  const { data: customProperties = [] } = useProjectDefinitions(selectedProject?.id || '');
  const createTaskMutation = useCreateTask();
  const setPropertyValueMutation = useSetPropertyValue();

  // Set default project based on sticky behavior (with stable dependencies)
  useEffect(() => {
    if (lastUsedProjectId && projects && projects.length > 0) {
      const lastUsedProject = projects.find(p => p.id === lastUsedProjectId);
      if (lastUsedProject && (!selectedProject || selectedProject.id !== lastUsedProject.id)) {
        setSelectedProject(lastUsedProject);
      }
    } else if (generalProject && (!selectedProject || selectedProject.id !== generalProject.id)) {
      setSelectedProject(generalProject);
    }
  }, [lastUsedProjectId, projects?.length, generalProject?.id, selectedProject?.id]);

  // Clear custom property values when project changes
  useEffect(() => {
    setCustomPropertyValues({});
  }, [selectedProject?.id]);

  const handleInputChange = (value: string) => {
    setTaskName(value);

    const parsed = parseTaskInput(value);

    if (parsed.hasProjectCommand && parsed.projectQuery !== undefined) {
      // Show autocomplete dropdown
      setShowAutocomplete(true);
      setProjectQuery(parsed.projectQuery);
    } else {
      // Hide autocomplete
      setShowAutocomplete(false);
      setProjectQuery('');
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setShowAutocomplete(false);

    // Update input to show clean task name
    const cleanName = cleanTaskName(taskName);
    setTaskName(cleanName);
    setProjectQuery('');

    // Clear custom property values when project changes
    setCustomPropertyValues({});

    // Focus back to input
    inputRef.current?.focus();
  };

  const handleProjectRemove = () => {
    setSelectedProject(null);
    // Don't restore the /in command - just leave the clean task name
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 TaskQuickAdd.handleSubmit started');

    const cleanName = cleanTaskName(taskName);

    if (!cleanName.trim()) {
      return;
    }

    // Determine project ID: selected project > last used > general > default
    const projectId = selectedProject?.id || lastUsedProjectId || generalProject?.id || defaultProjectId;

    const taskData = {
      name: cleanName,
      project_id: projectId,
      assigned_to: userId,
      created_by: userId,
      due_date: dueDate || undefined,
    };

    try {
      const newTask = await createTaskMutation.mutateAsync(taskData);

      // Save custom property values if any are set
      const customPropertyEntries = Object.entries(customPropertyValues).filter(([_, value]) => value.trim());
      if (customPropertyEntries.length > 0) {
        await Promise.all(
          customPropertyEntries.map(([definitionId, value]) =>
            setPropertyValueMutation.mutateAsync({
              taskId: newTask.id,
              definitionId,
              value: value.trim(),
              userId,
            })
          )
        );
      }

      // Reset form but keep sticky project behavior
      setTaskName('');
      setDueDate('');
      setCustomPropertyValues({});
      setShowAdvanced(false);
      setShowAutocomplete(false);
      setProjectQuery('');
      // Note: selectedProject is intentionally kept for sticky behavior
      // The backend will update lastUsedProjectId automatically
    } catch (error) {
      console.error('Failed to create task:', error);
      // TODO: Show error message to user
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts for autocomplete
    if (showAutocomplete) {
      if (e.key === 'Escape') {
        setShowAutocomplete(false);
        setProjectQuery('');
      }
    } else if (e.key === 'Enter') {
      // Explicitly handle Enter key when autocomplete is not open
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="space-y-3" data-testid="task-quick-add">
      <form onSubmit={handleSubmit} role="form">
        {/* Main Input with Project Chip */}
        <div className="relative">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                value={taskName}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a task..."
                className="pr-2"
                data-testid="task-input"
              />

              {/* Project Chip */}
              {selectedProject && !showAutocomplete && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <ProjectChip
                    project={selectedProject}
                    onRemove={handleProjectRemove}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2"
              title="Advanced options"
            >
              +
            </Button>

            <Button
              type="submit"
              disabled={!cleanTaskName(taskName).trim() || createTaskMutation.isPending}
              className="min-w-[80px]"
            >
              {createTaskMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add'
              )}
            </Button>
          </div>

          {/* Project Autocomplete */}
          <ProjectAutocomplete
            query={projectQuery}
            onSelect={handleProjectSelect}
            userId={userId}
            isOpen={showAutocomplete}
            onOpenChange={setShowAutocomplete}
          />
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project
                </label>
                <select
                  value={selectedProject?.id || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === e.target.value);
                    setSelectedProject(project || null);
                    setCustomPropertyValues({});
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Custom Properties */}
            {customProperties.length > 0 && (
              <div className="space-y-4">
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Properties</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customProperties.map((property) => (
                      <div key={property.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {property.name}
                        </label>
                        {property.type === 'text' && (
                          <Input
                            type="text"
                            value={customPropertyValues[property.id] || ''}
                            onChange={(e) => setCustomPropertyValues(prev => ({
                              ...prev,
                              [property.id]: e.target.value
                            }))}
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === 'number' && (
                          <Input
                            type="number"
                            value={customPropertyValues[property.id] || ''}
                            onChange={(e) => setCustomPropertyValues(prev => ({
                              ...prev,
                              [property.id]: e.target.value
                            }))}
                            className="text-sm"
                            placeholder={`Enter ${property.name.toLowerCase()}`}
                          />
                        )}
                        {property.type === 'date' && (
                          <Input
                            type="date"
                            value={customPropertyValues[property.id] || ''}
                            onChange={(e) => setCustomPropertyValues(prev => ({
                              ...prev,
                              [property.id]: e.target.value
                            }))}
                            className="text-sm"
                          />
                        )}
                        {property.type === 'select' && (
                          <select
                            value={customPropertyValues[property.id] || ''}
                            onChange={(e) => setCustomPropertyValues(prev => ({
                              ...prev,
                              [property.id]: e.target.value
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select {property.name.toLowerCase()}...</option>
                            {property.options && Array.isArray(property.options) &&
                              property.options.map((option: string, index: number) => (
                                <option key={index} value={option}>
                                  {option}
                                </option>
                              ))
                            }
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}