import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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