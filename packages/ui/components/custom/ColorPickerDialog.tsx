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
import { useUpdateProject } from '@perfect-task-app/data';
import type { Project } from '@perfect-task-app/models';

interface ColorPickerDialogProps {
  project: Project;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Predefined color palette
const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#A855F7', // Violet
];

export function ColorPickerDialog({
  project,
  userId,
  open,
  onOpenChange
}: ColorPickerDialogProps) {
  const [selectedColor, setSelectedColor] = useState(project.project_color);
  const updateProjectMutation = useUpdateProject();

  const handleSubmit = async () => {
    if (selectedColor === project.project_color) {
      onOpenChange(false);
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        updates: { project_color: selectedColor }
      });
      onOpenChange(false);
    } catch (err) {
      // Error is handled by the mutation
    }
  };

  const handleCancel = () => {
    setSelectedColor(project.project_color);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Project Color</DialogTitle>
          <DialogDescription>
            Choose a color for "{project.project_name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className={`w-12 h-12 rounded-lg border-2 transition-all ${
                  selectedColor === color
                    ? 'border-gray-900 scale-110'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                disabled={updateProjectMutation.isPending}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="text-sm font-medium">{project.project_name}</span>
          </div>
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