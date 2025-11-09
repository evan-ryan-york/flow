import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ProjectItem } from './ProjectItem';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Check, Xmark, Plus } from 'iconoir-react';
import type { ProjectColor } from './ProjectColorPicker';
import { useProjectsForUser, useCreateProject, useUpdateProject } from '@perfect-task-app/data';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectWithRole } from '@perfect-task-app/data';

interface ProjectsPanelProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[], clickedProjectId?: string) => void;
  className?: string;
}

export function ProjectsPanel({
  userId,
  selectedProjectIds,
  onProjectSelectionChange,
  className
}: ProjectsPanelProps) {
  const { data: projects, isLoading, isError, error } = useProjectsForUser(userId);
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const queryClient = useQueryClient();
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleProjectClick = (projectId: string, _isCtrlClick: boolean, isShiftClick: boolean) => {
    // Shift+click: Select ONLY this project (deselect all others)
    if (isShiftClick) {
      console.log('[ProjectsPanel] Shift+click detected, selecting only project:', projectId);
      onProjectSelectionChange([projectId], projectId);
      return;
    }

    // Both regular clicks and Ctrl/Cmd+clicks toggle project selection
    // This allows for multiple projects to be selected at once
    const newSelection = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter(id => id !== projectId)
      : [...selectedProjectIds, projectId];
    console.log('[ProjectsPanel] Project clicked, calling onProjectSelectionChange with:', newSelection);
    onProjectSelectionChange(newSelection, projectId);
  };

  const handleCreateProject = async (projectName: string) => {
    try {
      const newProject = await createProjectMutation.mutateAsync({
        ownerId: userId,
        name: projectName,
      });

      // Add the new project to existing selection
      onProjectSelectionChange([...selectedProjectIds, newProject.id], newProject.id);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleStartCreateProject = () => {
    setIsCreatingProject(true);
    setCreateError(null);
  };

  const handleSubmitCreateProject = async () => {
    const trimmedName = newProjectName.trim();

    if (!trimmedName) {
      setCreateError('Project name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setCreateError('Project name must be 50 characters or less');
      return;
    }

    try {
      await handleCreateProject(trimmedName);
      setNewProjectName('');
      setIsCreatingProject(false);
      setCreateError(null);
    } catch {
      setCreateError('Failed to create project');
    }
  };

  const handleCancelCreateProject = () => {
    setNewProjectName('');
    setIsCreatingProject(false);
    setCreateError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmitCreateProject();
    } else if (event.key === 'Escape') {
      handleCancelCreateProject();
    }
  };

  const handleColorChange = (projectId: string, color: ProjectColor) => {
    // Optimistic update - update local state immediately
    const queryKey = ['projects', 'list', userId];

    queryClient.setQueryData(queryKey, (oldData: ProjectWithRole[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map((project) =>
        project.id === projectId ? { ...project, color } : project
      );
    });

    // Then make the server call
    updateProjectMutation.mutate({
      projectId,
      updates: { color }
    });
  };

  const handleSelectAll = () => {
    if (projects) {
      const allProjectIds = projects.map(project => project.id);
      onProjectSelectionChange(allProjectIds);
    }
  };

  const handleSelectNone = () => {
    onProjectSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-red-500 text-sm">
          Failed to load projects: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="h-[57px] px-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Projects</h2>
        <motion.button
          onClick={handleStartCreateProject}
          className="text-gray-500 hover:text-gray-700 p-1"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={{ rotate: isCreatingProject ? 45 : 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <Plus className="h-4 w-4" />
          </motion.div>
        </motion.button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div>
          {/* Animated Inline Create Project Form */}
          <AnimatePresence>
            {isCreatingProject && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: 'easeInOut',
                  opacity: { duration: 0.15 }
                }}
                className="mb-4 overflow-hidden"
              >
                <motion.div
                  initial={{ y: -10 }}
                  animate={{ y: 0 }}
                  exit={{ y: -10 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <div className="space-y-3">
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Project name..."
                      className="w-full"
                      autoFocus
                      disabled={createProjectMutation.isPending}
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelCreateProject}
                        disabled={createProjectMutation.isPending}
                      >
                        <Xmark className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitCreateProject}
                        disabled={createProjectMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {createError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-red-500 text-xs mt-2"
                    >
                      {createError}
                    </motion.div>
                  )}
                  <hr className="mt-4 border-gray-200" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Project Items */}
          {projects?.map((project: ProjectWithRole, index) => (
            <div key={project.id}>
              <div className="py-3">
                <ProjectItem
                  project={project}
                  isSelected={selectedProjectIds.includes(project.id)}
                  onClick={handleProjectClick}
                  onColorChange={handleColorChange}
                  userId={userId}
                />
              </div>
              {index < projects.length - 1 && <hr className="border-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="flex-1"
          >
            All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectNone}
            className="flex-1"
          >
            None
          </Button>
        </div>
      </div>
    </div>
  );
}