import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useDeleteProjectWithReassignment, useProjectsForUser } from '@perfect-task-app/data';
import type { Project } from '@perfect-task-app/models';
import type { ProjectWithRole } from '@perfect-task-app/data';

interface DeleteProjectDialogProps {
  project: Project;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProjectDialog({
  project,
  userId,
  open,
  onOpenChange
}: DeleteProjectDialogProps) {
  const [reassignToProjectId, setReassignToProjectId] = useState<string>('');
  const { data: projects = [] } = useProjectsForUser(userId);
  const deleteProjectMutation = useDeleteProjectWithReassignment();

  // Get other projects that can receive tasks (excluding current project)
  const availableProjects = projects.filter((p: ProjectWithRole) => p.id !== project.id);

  const handleDelete = async () => {
    try {
      await deleteProjectMutation.mutateAsync({
        projectId: project.id,
        reassignToProjectId: reassignToProjectId || undefined
      });
      onOpenChange(false);
      setReassignToProjectId('');
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setReassignToProjectId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{project.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {availableProjects.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Reassign tasks to another project (optional):
            </label>
            <Select value={reassignToProjectId} onValueChange={setReassignToProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project or leave empty to delete tasks" />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((p: ProjectWithRole) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: '#3B82F6' }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={deleteProjectMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProjectMutation.isPending}
          >
            {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}