'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@flow-app/ui/components/ui/dialog';
import { Button } from '@flow-app/ui/components/ui/button';
import { Label } from '@flow-app/ui/components/ui/label';
import { Input } from '@flow-app/ui/components/ui/input';

interface BatchDueDateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dueDate: string) => void;
  selectedTaskCount: number;
}

export function BatchDueDateDialog({
  isOpen,
  onClose,
  onConfirm,
  selectedTaskCount,
}: BatchDueDateDialogProps) {
  const [dueDate, setDueDate] = useState<string>('');

  const handleConfirm = () => {
    if (dueDate) {
      onConfirm(dueDate);
      onClose();
      setDueDate('');
    }
  };

  const handleCancel = () => {
    onClose();
    setDueDate('');
  };

  const handleClearDueDate = () => {
    onConfirm('');
    onClose();
    setDueDate('');
  };

  const taskLabel = selectedTaskCount === 1 ? 'task' : 'tasks';

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Due Date</DialogTitle>
          <DialogDescription>
            Set the due date for {selectedTaskCount} {taskLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleClearDueDate}>
            Clear Due Date
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!dueDate}>
              Set Due Date
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
