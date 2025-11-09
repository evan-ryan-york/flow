'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Xmark, EditPencil, Bin, Lock } from 'iconoir-react';
import { ProjectColorPicker, getProjectColorHex, type ProjectColor } from '@perfect-task-app/ui/components/custom/ProjectColorPicker';
import { DeleteProjectDialog } from '@perfect-task-app/ui/components/custom/DeleteProjectDialog';
import { RenameProjectDialog } from '@perfect-task-app/ui/components/custom/RenameProjectDialog';
import { useProjectsForUser, useCreateProject, useUpdateProject } from '@perfect-task-app/data';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectWithRole } from '@perfect-task-app/data';

interface MobileProjectsViewProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
  isCreatingProject?: boolean;
  onCreateProjectToggle?: () => void;
}

export function MobileProjectsView({
  userId,
  selectedProjectIds,
  onProjectSelectionChange,
  isCreatingProject: externalIsCreatingProject,
  onCreateProjectToggle,
}: MobileProjectsViewProps) {
  const { data: projects, isLoading, isError, error } = useProjectsForUser(userId);
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const queryClient = useQueryClient();

  // Use internal state if no external control is provided
  const [internalIsCreatingProject, setInternalIsCreatingProject] = useState(false);
  const isCreatingProject = externalIsCreatingProject ?? internalIsCreatingProject;

  const [newProjectName, setNewProjectName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteDialogProject, setDeleteDialogProject] = useState<ProjectWithRole | null>(null);
  const [renameDialogProject, setRenameDialogProject] = useState<ProjectWithRole | null>(null);

  const handleProjectClick = (projectId: string, isShiftClick: boolean = false) => {
    // Shift+click: Select ONLY this project (deselect all others)
    if (isShiftClick) {
      onProjectSelectionChange([projectId]);
      return;
    }

    // Regular click: Toggle project selection
    const newSelection = selectedProjectIds.includes(projectId)
      ? selectedProjectIds.filter(id => id !== projectId)
      : [...selectedProjectIds, projectId];
    onProjectSelectionChange(newSelection);
  };

  const handleCreateProject = async (projectName: string) => {
    try {
      const newProject = await createProjectMutation.mutateAsync({
        ownerId: userId,
        name: projectName,
      });

      onProjectSelectionChange([...selectedProjectIds, newProject.id]);
    } catch {
      // Error is handled by the mutation
    }
  };

  const _handleStartCreateProject = () => {
    if (onCreateProjectToggle) {
      onCreateProjectToggle();
    } else {
      setInternalIsCreatingProject(true);
    }
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
      if (onCreateProjectToggle) {
        onCreateProjectToggle();
      } else {
        setInternalIsCreatingProject(false);
      }
      setCreateError(null);
    } catch {
      setCreateError('Failed to create project');
    }
  };

  const handleCancelCreateProject = () => {
    setNewProjectName('');
    if (onCreateProjectToggle) {
      onCreateProjectToggle();
    } else {
      setInternalIsCreatingProject(false);
    }
    setCreateError(null);
  };

  const handleColorChange = (projectId: string, color: ProjectColor) => {
    const queryKey = ['projects', 'list', userId];

    queryClient.setQueryData(queryKey, (oldData: ProjectWithRole[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map((project) =>
        project.id === projectId ? { ...project, color } : project
      );
    });

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
      <div className="flex flex-col h-full p-4">
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="text-red-500 text-sm">
          Failed to load projects: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Project List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
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
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitCreateProject();
                      } else if (e.key === 'Escape') {
                        handleCancelCreateProject();
                      }
                    }}
                    placeholder="Project name..."
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    disabled={createProjectMutation.isPending}
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={handleCancelCreateProject}
                      disabled={createProjectMutation.isPending}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 rounded-lg"
                    >
                      <Xmark className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleSubmitCreateProject}
                      disabled={createProjectMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {createError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-red-500 text-sm mt-2"
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
        <div className="space-y-3">
          {projects?.map((project: ProjectWithRole) => (
            <div key={project.id}>
              <div className="flex items-center justify-between py-2">
                {/* Left: Color indicator + Project name (clickable area) */}
                <button
                  onClick={(e) => handleProjectClick(project.id, e.shiftKey)}
                  className="flex items-center flex-1 min-w-0 active:bg-gray-50 rounded-lg p-2 -ml-2"
                >
                  {/* Color indicator with color picker */}
                  <div className="relative mr-3 flex-shrink-0">
                    <motion.div
                      animate={{
                        scale: selectedProjectIds.includes(project.id) ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                    >
                      {selectedProjectIds.includes(project.id) ? (
                        // Solid dot for selected projects
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: getProjectColorHex(project.color || 'blue') }}
                        />
                      ) : (
                        // Hollow circle for unselected projects
                        <div
                          className="w-4 h-4 rounded-full border-2"
                          style={{ borderColor: getProjectColorHex(project.color || 'blue') }}
                        />
                      )}
                    </motion.div>

                    {/* Color picker overlay */}
                    <ProjectColorPicker
                      currentColor={project.color || 'blue'}
                      onColorChange={(color) => handleColorChange(project.id, color)}
                    >
                      <button
                        className="absolute inset-0 w-full h-full rounded-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </ProjectColorPicker>
                  </div>

                  {/* Project name */}
                  <span
                    className={`flex-1 text-left truncate text-base ${
                      selectedProjectIds.includes(project.id)
                        ? 'font-semibold text-gray-900'
                        : 'font-normal text-gray-700'
                    }`}
                  >
                    {project.name}
                    {project.is_general && (
                      <Lock className="inline-block h-3 w-3 ml-1 text-gray-500" />
                    )}
                  </span>
                </button>

                {/* Right: Action buttons (only for non-general projects) */}
                {!project.is_general && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setRenameDialogProject(project)}
                      className="p-2 text-gray-500 hover:text-gray-900 active:bg-gray-100 rounded-lg"
                    >
                      <EditPencil className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setDeleteDialogProject(project)}
                      className="p-2 text-red-500 hover:text-red-700 active:bg-red-50 rounded-lg"
                    >
                      <Bin className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              <hr className="border-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex space-x-3">
          <button
            onClick={handleSelectAll}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100"
          >
            Select All
          </button>
          <button
            onClick={handleSelectNone}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Dialogs */}
      {deleteDialogProject && (
        <DeleteProjectDialog
          project={deleteDialogProject}
          userId={userId}
          open={!!deleteDialogProject}
          onOpenChange={(open) => !open && setDeleteDialogProject(null)}
        />
      )}

      {renameDialogProject && (
        <RenameProjectDialog
          project={renameDialogProject}
          userId={userId}
          open={!!renameDialogProject}
          onOpenChange={(open) => !open && setRenameDialogProject(null)}
        />
      )}
    </div>
  );
}
