'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@perfect-task-app/ui/components/ui/dialog';
import { Button } from '@perfect-task-app/ui/components/ui/button';
import { Label } from '@perfect-task-app/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@perfect-task-app/ui/components/ui/select';

interface BatchProjectSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectId: string) => void;
  projects: { id: string; name: string }[];
  selectedTaskCount: number;
}

export function BatchProjectSelectorDialog({
  isOpen,
  onClose,
  onConfirm,
  projects,
  selectedTaskCount,
}: BatchProjectSelectorDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const handleConfirm = () => {
    if (selectedProjectId) {
      onConfirm(selectedProjectId);
      onClose();
      setSelectedProjectId('');
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedProjectId('');
  };

  const taskLabel = selectedTaskCount === 1 ? 'task' : 'tasks';

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Project</DialogTitle>
          <DialogDescription>
            Move {selectedTaskCount} {taskLabel} to a different project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project">Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedProjectId}>
            Move Tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
