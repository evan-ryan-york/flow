'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@perfect-task-app/ui/components/ui/dialog';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { useDeleteTask } from '@perfect-task-app/data';
import type { Task } from '@perfect-task-app/models';

interface DeleteTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTaskDialog({
  task,
  open,
  onOpenChange
}: DeleteTaskDialogProps) {
  const deleteTaskMutation = useDeleteTask();

  const handleDelete = async () => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete task:', error);
      // Error is handled by the mutation
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{task.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={deleteTaskMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteTaskMutation.isPending}
          >
            {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
