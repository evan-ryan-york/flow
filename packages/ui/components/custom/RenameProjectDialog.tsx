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
import { Input } from '../ui/input';
import { useUpdateProject } from '@perfect-task-app/data';
import type { Project } from '@perfect-task-app/models';

interface RenameProjectDialogProps {
  project: Project;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameProjectDialog({
  project,
  userId: _userId,
  open,
  onOpenChange
}: RenameProjectDialogProps) {
  const [projectName, setProjectName] = useState(project.name);
  const [error, setError] = useState<string | null>(null);
  const updateProjectMutation = useUpdateProject();

  const handleSubmit = async () => {
    const trimmedName = projectName.trim();

    if (!trimmedName) {
      setError('Project name is required');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Project name must be 50 characters or less');
      return;
    }

    if (trimmedName === project.name) {
      onOpenChange(false);
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        updates: { name: trimmedName }
      });
      onOpenChange(false);
      setError(null);
    } catch (_err) {
      setError('Failed to rename project');
    }
  };

  const handleCancel = () => {
    setProjectName(project.name);
    setError(null);
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
          <DialogDescription>
            Enter a new name for "{project.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Project name"
            disabled={updateProjectMutation.isPending}
            autoFocus
          />
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={updateProjectMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateProjectMutation.isPending}
          >
            {updateProjectMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}