'use client';

import { useState } from 'react';
import { useCreateView } from '@perfect-task-app/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@perfect-task-app/ui';
// No special icons needed - using inline spinner

/**
 * Props for the CreateViewDialog component
 */
interface CreateViewDialogProps {
  /** Controls whether the dialog is visible */
  isOpen: boolean;
  /** Callback fired when the dialog should close */
  onClose: () => void;
  /** The ID of the current user creating the view */
  userId: string;
  /** Array of project IDs currently selected */
  currentProjectIds?: string[];
  /** Current groupBy setting */
  currentGroupBy?: string | null;
  /** Current sortBy setting */
  currentSortBy?: string;
  /** Current view type (list or kanban) */
  currentViewType?: 'list' | 'kanban';
  /** Array of visible custom property/column IDs */
  currentVisibleProperties?: string[];
  /** Array of visible built-in columns */
  currentVisibleBuiltInColumns?: ('assigned_to' | 'due_date' | 'project')[];
  /** Optional callback fired when view is successfully created, receives the new view ID */
  onViewCreated?: (viewId: string) => void;
}

/**
 * CreateViewDialog Component
 *
 * A modal dialog for creating a new view. Pre-populates with current UI state
 * (selected projects, grouping, sorting) and allows users to customize the view
 * before saving.
 *
 * @example
 * ```tsx
 * <CreateViewDialog
 *   isOpen={isCreateDialogOpen}
 *   onClose={() => setIsCreateDialogOpen(false)}
 *   userId="user-123"
 *   currentProjectIds={selectedProjects}
 *   currentGroupBy="project"
 *   currentSortBy="due_date"
 *   onViewCreated={(viewId) => switchToView(viewId)}
 * />
 * ```
 */
export function CreateViewDialog({
  isOpen,
  onClose,
  userId: _userId,
  currentProjectIds = [],
  currentGroupBy = null,
  currentSortBy = 'due_date',
  currentViewType = 'list',
  currentVisibleProperties = [],
  currentVisibleBuiltInColumns = [],
  onViewCreated,
}: CreateViewDialogProps) {

  const [viewName, setViewName] = useState('');
  const [error, setError] = useState('');

  const createView = useCreateView();

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
      const viewData = {
        name: viewName.trim(),
        type: currentViewType,
        config: {
          projectIds: currentProjectIds,
          groupBy: currentGroupBy || undefined,
          sortBy: currentSortBy || undefined,
          visibleProperties: currentVisibleProperties,
          visibleBuiltInColumns: currentVisibleBuiltInColumns,
        },
      };

      console.log('💾 [CREATE VIEW] Saving view:', viewData);

      // Save the current state as-is (snapshot of current workspace)
      const newView = await createView.mutateAsync(viewData);

      console.log('✅ [CREATE VIEW] View created:', newView.name, newView.config);

      // Wait a short moment for TanStack Query cache to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reset form and close
      setViewName('');
      onClose();

      // Notify parent that view was created (so it can switch to it)
      if (onViewCreated && newView?.id) {
        onViewCreated(newView.id);
      }
    } catch (err) {
      console.error('[CreateViewDialog] Failed to create view:', err);
      setError(err instanceof Error ? err.message : 'Failed to create view');
    }
  };

  const handleClose = () => {
    if (!createView.isPending) {
      setViewName('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New View</DialogTitle>
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
                disabled={createView.isPending}
                autoFocus
              />
            </div>

            {/* Info message about snapshot */}
            <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
              This will save your current workspace setup (selected projects, grouping, and sorting).
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createView.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createView.isPending}>
              {createView.isPending ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create View'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
