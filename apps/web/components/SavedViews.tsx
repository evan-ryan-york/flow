'use client';

import { useState } from 'react';
import { useUserViews, useDeleteView } from '@flow-app/data';
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@flow-app/ui';
import { ViewGrid, Plus, Trash } from 'iconoir-react';
import type { View } from '@flow-app/models';

/**
 * Props for the SavedViews component
 */
interface SavedViewsProps {
  /** The ID of the current user */
  userId: string;
  /** The ID of the currently selected view, or null if none selected */
  selectedViewId: string | null;
  /** Callback fired when a different view is selected */
  onViewChange: (viewId: string) => void;
  /** Callback fired when the user clicks the create view button */
  onCreateView: () => void;
}

/**
 * SavedViews Component
 *
 * Displays a horizontal tab bar showing all user views with delete buttons.
 * Users can click tabs to switch between views or create new ones.
 *
 * @example
 * ```tsx
 * <SavedViews
 *   userId="user-123"
 *   selectedViewId="view-456"
 *   onViewChange={(viewId) => setSelectedView(viewId)}
 *   onCreateView={() => setShowCreateDialog(true)}
 * />
 * ```
 */

export function SavedViews({ userId, selectedViewId, onViewChange, onCreateView }: SavedViewsProps) {
  const { data: views, isLoading, isError, error } = useUserViews(userId);
  const deleteViewMutation = useDeleteView();
  const [viewToDelete, setViewToDelete] = useState<View | null>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">Loading views...</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-24 bg-gray-100 rounded-md animate-pulse"
              data-testid="loading-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="text-sm text-red-600">
          Failed to load views: {error?.message || 'Unknown error'}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (!views || views.length === 0) {
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">No views yet</p>
          <Button variant="outline" size="sm" onClick={onCreateView}>
            <Plus className="h-4 w-4 mr-1" />
            Create your first view
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Views</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateView}
          className="h-7 px-2"
          aria-label="Create new view"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
        {views.map((view) => {
          const isActive = selectedViewId === view.id;

          return (
            <div
              key={view.id}
              role="tab"
              aria-selected={isActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
              }`}
            >
              <button
                onClick={() => {
                  console.log('[SavedViews] View tab clicked:', {
                    viewId: view.id,
                    viewName: view.name,
                    viewType: view.type,
                    config: view.config,
                    isActive,
                  });
                  onViewChange(view.id);
                }}
                className="flex items-center gap-1.5 flex-1"
              >
                <ViewGrid className="h-3.5 w-3.5" />
                <span>{view.name}</span>
              </button>

              {!view.is_default && (
                <button
                  className="flex items-center hover:opacity-70 transition-opacity"
                  aria-label={`Delete ${view.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewToDelete(view);
                  }}
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!viewToDelete} onOpenChange={(open) => !open && setViewToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{viewToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (viewToDelete) {
                  deleteViewMutation.mutate(viewToDelete.id);
                  setViewToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}