import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { ProjectItem } from './ProjectItem';
import { AddProjectButton } from './AddProjectButton';
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
        project_name: projectName,
      });

      // Auto-select the new project
      onProjectSelectionChange([newProject.id]);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="text-red-500 text-sm">
          Failed to load projects: {error?.message}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-gray-700">Projects</h2>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {projects?.map((project: ProjectWithRole) => (
            <ProjectItem
              key={project.id}
              project={project}
              isSelected={selectedProjectIds.includes(project.id)}
              onClick={handleProjectClick}
              userId={userId}
            />
          ))}
        </div>
      </div>

      {/* Add Project Button */}
      <div className="p-4 border-t">
        <AddProjectButton
          onCreateProject={handleCreateProject}
          isLoading={createProjectMutation.isPending}
        />
      </div>
    </Card>
  );
}