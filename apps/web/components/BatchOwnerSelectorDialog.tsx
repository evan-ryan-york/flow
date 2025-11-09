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

interface BatchOwnerSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ownerId: string) => void;
  profiles: { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null }[];
  currentUserId: string;
  selectedTaskCount: number;
}

export function BatchOwnerSelectorDialog({
  isOpen,
  onClose,
  onConfirm,
  profiles,
  currentUserId,
  selectedTaskCount,
}: BatchOwnerSelectorDialogProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  const handleConfirm = () => {
    if (selectedOwnerId) {
      onConfirm(selectedOwnerId);
      onClose();
      setSelectedOwnerId('');
    }
  };

  const handleCancel = () => {
    onClose();
    setSelectedOwnerId('');
  };

  const handleClearOwner = () => {
    onConfirm('');
    onClose();
    setSelectedOwnerId('');
  };

  const taskLabel = selectedTaskCount === 1 ? 'task' : 'tasks';

  // Format profile display name
  const getProfileDisplayName = (profile: { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null }) => {
    if (profile.id === currentUserId) {
      return 'You';
    }
    const fullName = profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : profile.first_name || profile.last_name || profile.full_name || 'Unknown User';
    return fullName;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Owner</DialogTitle>
          <DialogDescription>
            Assign {selectedTaskCount} {taskLabel} to a team member.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="owner">Owner</Label>
            <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
              <SelectTrigger id="owner">
                <SelectValue placeholder="Select an owner" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {getProfileDisplayName(profile)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="ghost" onClick={handleClearOwner}>
            Unassign
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedOwnerId}>
              Assign Tasks
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
