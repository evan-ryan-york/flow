import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ProjectItem } from './ProjectItem';
import { AddProjectButton } from './AddProjectButton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Check, Xmark, Plus } from 'iconoir-react';
import { useProjectsForUser, useCreateProject } from '@perfect-task-app/data';
import type { Project } from '@perfect-task-app/models';
import type { ProjectWithRole } from '@perfect-task-app/data';

interface ProjectsPanelProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
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
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleProjectClick = (projectId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Multi-select mode
      const newSelection = selectedProjectIds.includes(projectId)
        ? selectedProjectIds.filter(id => id !== projectId)
        : [...selectedProjectIds, projectId];
      onProjectSelectionChange(newSelection);
    } else {
      // Single select mode
      const newSelection = selectedProjectIds.includes(projectId) && selectedProjectIds.length === 1
        ? [] // Deselect if it's the only selected project
        : [projectId];
      onProjectSelectionChange(newSelection);
    }
  };

  const handleCreateProject = async (projectName: string) => {
    try {
      const newProject = await createProjectMutation.mutateAsync({
        ownerId: userId,
        name: projectName,
      });

      // Auto-select the new project
      onProjectSelectionChange([newProject.id]);
    } catch (error) {
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
    } catch (err) {
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
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg text-gray-900">Projects</h2>
        <button
          onClick={handleStartCreateProject}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div>
          {/* Inline Create Project Form */}
          {isCreatingProject && (
            <div className="mb-4">
              <div className="flex items-center space-x-2">
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Project name..."
                  className="flex-1"
                  autoFocus
                  disabled={createProjectMutation.isPending}
                />
                <Button
                  size="sm"
                  onClick={handleSubmitCreateProject}
                  disabled={createProjectMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelCreateProject}
                  disabled={createProjectMutation.isPending}
                >
                  <Xmark className="h-4 w-4" />
                </Button>
              </div>
              {createError && (
                <div className="text-red-500 text-xs mt-1">{createError}</div>
              )}
              <hr className="mt-4 border-gray-200" />
            </div>
          )}

          {/* Project Items */}
          {projects?.map((project: ProjectWithRole, index) => (
            <div key={project.id}>
              <div className="py-3">
                <ProjectItem
                  project={project}
                  isSelected={selectedProjectIds.includes(project.id)}
                  onClick={handleProjectClick}
                  userId={userId}
                />
              </div>
              {index < projects.length - 1 && <hr className="border-gray-200" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}