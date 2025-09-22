import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useUserViews,
  useCreateView,
  useUpdateView,
  useDeleteView
} from '../../hooks/useView';
import * as viewService from '../../services/viewService';

// Mock the entire view service
jest.mock('../../services/viewService');
const mockedViewService = viewService as jest.Mocked<typeof viewService>;

// Helper to create a test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useView hooks unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useUserViews', () => {
    it('should return loading state initially and then return data', async () => {
      const mockViews = [
        {
          id: 'view-1',
          user_id: 'user-1',
          name: 'My Project View',
          type: 'list' as const,
          config: { projectIds: ['project-1'] },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockedViewService.getViewsForUser.mockResolvedValue(mockViews);

      const { result } = renderHook(
        () => useUserViews('user-1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockViews);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockedViewService.getViewsForUser).toHaveBeenCalledWith('user-1');
    });

    it('should return error state when service throws', async () => {
      const mockError = new Error('Failed to fetch views');
      mockedViewService.getViewsForUser.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useUserViews('user-1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when userId is not provided', () => {
      renderHook(
        () => useUserViews(''),
        { wrapper: createWrapper() }
      );

      expect(mockedViewService.getViewsForUser).not.toHaveBeenCalled();
    });
  });

  describe('useCreateView', () => {
    it('should handle view creation successfully', async () => {
      const mockView = {
        id: 'new-view-1',
        user_id: 'user-1',
        name: 'New View',
        type: 'kanban' as const,
        config: { projectIds: ['project-1'], groupBy: 'status' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockedViewService.createView.mockResolvedValue(mockView);

      const { result } = renderHook(
        () => useCreateView(),
        { wrapper: createWrapper() }
      );

      const createViewData = {
        name: 'New View',
        type: 'kanban' as const,
        config: { projectIds: ['project-1'], groupBy: 'status' },
      };

      expect(result.current.isPending).toBe(false);

      result.current.mutate(createViewData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockView);
      expect(mockedViewService.createView).toHaveBeenCalledWith(createViewData);
    });

    it('should handle view creation errors', async () => {
      const mockError = new Error('Failed to create view');
      mockedViewService.createView.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useCreateView(),
        { wrapper: createWrapper() }
      );

      const createViewData = {
        name: 'New View',
        type: 'list' as const,
        config: { projectIds: [] },
      };

      result.current.mutate(createViewData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useUpdateView', () => {
    it('should handle view updates successfully', async () => {
      const mockUpdatedView = {
        id: 'view-1',
        user_id: 'user-1',
        name: 'Updated View Name',
        type: 'list' as const,
        config: { projectIds: ['project-1', 'project-2'] },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T01:00:00Z',
      };

      mockedViewService.updateView.mockResolvedValue(mockUpdatedView);

      const { result } = renderHook(
        () => useUpdateView(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        viewId: 'view-1',
        updates: {
          name: 'Updated View Name',
          config: { projectIds: ['project-1', 'project-2'] },
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUpdatedView);
      expect(mockedViewService.updateView).toHaveBeenCalledWith(
        'view-1',
        updateData.updates
      );
    });
  });

  describe('useDeleteView', () => {
    it('should handle view deletion successfully', async () => {
      mockedViewService.deleteView.mockResolvedValue();

      const { result } = renderHook(
        () => useDeleteView(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('view-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedViewService.deleteView).toHaveBeenCalledWith('view-1');
    });

    it('should handle view deletion errors', async () => {
      const mockError = new Error('Failed to delete view');
      mockedViewService.deleteView.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useDeleteView(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('view-1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });
});