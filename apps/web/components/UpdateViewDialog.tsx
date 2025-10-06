'use client';

import { useState, useEffect } from 'react';
import { useUpdateView, useDeleteView } from '@perfect-task-app/data';
import type { View } from '@perfect-task-app/models';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@perfect-task-app/ui';

/**
 * Props for the UpdateViewDialog component
 */
interface UpdateViewDialogProps {
  /** Controls whether the dialog is visible */
  isOpen: boolean;
  /** Callback fired when the dialog should close */
  onClose: () => void;
  /** The view to edit */
  view: View;
  /** Optional callback fired when the view is deleted */
  onViewDeleted?: () => void;
}

/**
 * UpdateViewDialog Component
 *
 * A simple modal dialog for renaming a view and deleting it.
 * Following the "snapshot approach", views capture workspace state automatically,
 * so the only editable property is the name. To change settings, users should
 * arrange their workspace and create a new view.
 *
 * @example
 * ```tsx
 * <UpdateViewDialog
 *   isOpen={isEditDialogOpen}
 *   onClose={() => setIsEditDialogOpen(false)}
 *   view={selectedView}
 *   onViewDeleted={() => handleViewDeleted()}
 * />
 * ```
 */
export function UpdateViewDialog({
  isOpen,
  onClose,
  view,
  onViewDeleted,
}: UpdateViewDialogProps) {
  const [viewName, setViewName] = useState(view.name);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateView = useUpdateView();
  const deleteView = useDeleteView();

  // Update form when view changes
  useEffect(() => {
    setViewName(view.name);
  }, [view]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!viewName.trim()) {
      setError('View name is required');
      return;
    }

    if (viewName.length > 50) {
      setError('View name must be 50 characters or less');
      return;
    }

    try {
      await updateView.mutateAsync({
        viewId: view.id,
        updates: {
          name: viewName.trim(),
        },
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update view');
    }
  };

  const handleClose = () => {
    if (!updateView.isPending && !deleteView.isPending) {
      // Reset form to original value
      setViewName(view.name);
      setError('');
      onClose();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteView.mutateAsync(view.id);
      setShowDeleteConfirm(false);
      onClose();
      onViewDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete view');
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* View Name */}
              <div className="space-y-2">
                <Label htmlFor="viewName">
                  View Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="viewName"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g., My To-Dos, Work Projects"
                  disabled={updateView.isPending}
                  autoFocus
                  maxLength={50}
                />
                <p className="text-xs text-gray-500">
                  To change view settings, create a new view with your preferred configuration.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex justify-between w-full">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={updateView.isPending || deleteView.isPending}
                >
                  Delete View
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={updateView.isPending || deleteView.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateView.isPending || deleteView.isPending}>
                    {updateView.isPending ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{view.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteView.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteView.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteView.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
