'use client';

import { useState } from 'react';
import { useProjectsForUser, useCreateProject } from '@perfect-task-app/data';

interface ProjectsPanelProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
}

export function ProjectsPanel({
  userId,
  selectedProjectIds,
  onProjectSelectionChange
}: ProjectsPanelProps) {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Use real data hooks
  const { data: projects = [], isLoading } = useProjectsForUser(userId);
  const createProjectMutation = useCreateProject();

  const handleProjectClick = (projectId: string, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Multi-select with Cmd/Ctrl
      const newSelection = selectedProjectIds.includes(projectId)
        ? selectedProjectIds.filter(id => id !== projectId)
        : [...selectedProjectIds, projectId];
      onProjectSelectionChange(newSelection);
    } else {
      // Single select
      onProjectSelectionChange([projectId]);
    }
  };

  const handleCreateProject = async () => {
    if (newProjectName.trim()) {
      try {
        await createProjectMutation.mutateAsync({
          name: newProjectName,
          ownerId: userId,
        });
        setNewProjectName('');
        setIsCreatingProject(false);
      } catch (error) {
        console.error('Failed to create project:', error);
        // TODO: Show error message to user
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Projects</h2>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-sm">Loading projects...</p>
          </div>
        ) : (
          <div className="p-2">
            {projects.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">No projects yet</p>
                <p className="text-xs text-gray-400 mt-1">Create your first project below</p>
              </div>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  onClick={(e) => handleProjectClick(project.id, e)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedProjectIds.includes(project.id)
                      ? 'bg-blue-100 text-blue-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={project.name === 'General' ? 'font-medium' : ''}>
                      {project.name}
                    </span>
                    {project.name === 'General' && (
                      <span className="text-xs text-gray-500">Default</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Project */}
      <div className="p-4 border-t border-gray-200">
        {isCreatingProject ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateProject();
                if (e.key === 'Escape') setIsCreatingProject(false);
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreatingProject(false)}
                className="flex-1 px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreatingProject(true)}
            className="w-full px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 text-sm rounded-md hover:border-gray-400 hover:text-gray-700"
          >
            + New Project
          </button>
        )}
      </div>
    </div>
  );
}