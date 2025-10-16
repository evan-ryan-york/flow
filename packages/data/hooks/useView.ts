import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  getViewsForUser,
  createView,
  updateView,
  deleteView,
  type CreateViewData,
  type UpdateViewData
} from '../services/viewService';

// Query key constants
const VIEW_KEYS = {
  all: ['views'] as const,
  user: (userId: string) => ['views', 'user', userId] as const,
};

export const useUserViews = (userId: string) => {
  return useQuery({
    queryKey: VIEW_KEYS.user(userId),
    queryFn: () => getViewsForUser(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes - views don't change often
  });
};

/**
 * Hook to get the user's default view
 * @param userId - The ID of the user
 * @returns The default view or undefined if not found
 */
export const useDefaultView = (userId: string) => {
  const { data: views } = useUserViews(userId);
  return views?.find(v => v.is_default);
};

export const useCreateView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (viewData: CreateViewData) => createView(viewData),
    onSuccess: (newView) => {
      // Invalidate user views query to refetch the list
      queryClient.invalidateQueries({
        queryKey: VIEW_KEYS.user(newView.user_id)
      });
    },
  });
};

export const useUpdateView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ viewId, updates }: { viewId: string; updates: UpdateViewData }) =>
      updateView(viewId, updates),
    onSuccess: (updatedView) => {
      // Invalidate user views query to ensure consistency
      queryClient.invalidateQueries({
        queryKey: VIEW_KEYS.user(updatedView.user_id)
      });
    },
  });
};

export const useDeleteView = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (viewId: string) => deleteView(viewId),
    onSuccess: () => {
      // Invalidate all views queries since we don't know which user it belonged to
      queryClient.invalidateQueries({ queryKey: VIEW_KEYS.all });
    },
  });
};

/**
 * Hook to ensure a user has at least one default view.
 * Automatically creates an "All Tasks" view if the user has no views.
 *
 * @param userId - The ID of the user to check for views
 * @returns Object containing hasDefaultView (boolean) and isCreatingDefault (boolean)
 *
 * @example
 * ```tsx
 * function MyComponent({ userId }: { userId: string }) {
 *   const { hasDefaultView, isCreatingDefault } = useEnsureDefaultView(userId);
 *
 *   if (isCreatingDefault) {
 *     return <div>Setting up your workspace...</div>;
 *   }
 *
 *   return <div>Views ready!</div>;
 * }
 * ```
 */
export const useEnsureDefaultView = (userId: string) => {
  const { data: views, isLoading } = useUserViews(userId);
  const createViewMutation = useCreateView();
  const hasCreatedDefault = useRef(false);

  useEffect(() => {
    // Only run if:
    // 1. Views have loaded
    // 2. User has no views
    // 3. We haven't already created a default view in this session
    // 4. userId is provided (ensures auth is ready)
    if (!isLoading && views && views.length === 0 && !hasCreatedDefault.current && !createViewMutation.isPending && userId) {
      hasCreatedDefault.current = true;

      createViewMutation.mutate(
        {
          name: 'All Tasks',
          type: 'list',
          config: {
            projectIds: [],
            groupBy: 'project',
            sortBy: 'due_date',
          },
        },
        {
          onError: (error) => {
            console.error('Failed to create default view:', error);
            // Reset flag so we can retry if needed
            hasCreatedDefault.current = false;
          },
        }
      );
    }
  }, [isLoading, views, createViewMutation, userId]);

  return {
    hasDefaultView: !isLoading && (views?.length ?? 0) > 0,
    isCreatingDefault: createViewMutation.isPending,
  };
};