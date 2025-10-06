'use client';

import { useState } from 'react';
import { useUserViews } from '@perfect-task-app/data';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@perfect-task-app/ui';
import { ViewGrid, NavArrowDown, Plus, MoreVert, EditPencil, Copy, Trash } from 'iconoir-react';
import type { View } from '@perfect-task-app/models';

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
  /** Callback fired when the user clicks edit on a view */
  onEditView: (view: View) => void;
  /** Callback fired when the user clicks duplicate on a view */
  onDuplicateView: (view: View) => void;
}

/**
 * SavedViews Component
 *
 * Displays a horizontal tab bar showing all user views with context menus for
 * managing views (edit, duplicate, delete). Users can click tabs to switch between
 * views or create new ones.
 *
 * @example
 * ```tsx
 * <SavedViews
 *   userId="user-123"
 *   selectedViewId="view-456"
 *   onViewChange={(viewId) => setSelectedView(viewId)}
 *   onCreateView={() => setShowCreateDialog(true)}
 *   onEditView={(view) => openEditDialog(view)}
 *   onDuplicateView={(view) => duplicateView(view)}
 * />
 * ```
 */

export function SavedViews({ userId, selectedViewId, onViewChange, onCreateView, onEditView, onDuplicateView }: SavedViewsProps) {
  const { data: views, isLoading, isError, error } = useUserViews(userId);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

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
          const isKanban = view.type === 'kanban';

          return (
            <div key={view.id} className="flex items-center gap-0.5">
              <button
                role="tab"
                aria-selected={isActive}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-l-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 border-r-0'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent border-r-0'
                }`}
              >
                <ViewGrid className="h-3.5 w-3.5" />
                <span>{view.name}</span>
              </button>

              <Popover open={openPopoverId === view.id} onOpenChange={(open) => setOpenPopoverId(open ? view.id : null)}>
                <PopoverTrigger asChild>
                  <button
                    className={`px-1 py-1.5 rounded-r-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 border-l-0 hover:bg-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent border-l-0'
                    }`}
                    aria-label={`View options for ${view.name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVert className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <div className="flex flex-col">
                    <button
                      onClick={() => {
                        onEditView(view);
                        setOpenPopoverId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
                    >
                      <EditPencil className="h-4 w-4" />
                      <span>Edit view</span>
                    </button>
                    <button
                      onClick={() => {
                        onDuplicateView(view);
                        setOpenPopoverId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicate view</span>
                    </button>
                    <div className="h-px bg-gray-200 my-1" />
                    <button
                      onClick={() => {
                        onEditView(view); // Opens the edit dialog which now has delete button
                        setOpenPopoverId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
                    >
                      <Trash className="h-4 w-4" />
                      <span>Delete view</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
      </div>
    </div>
  );
}