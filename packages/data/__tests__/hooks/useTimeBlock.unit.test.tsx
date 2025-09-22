import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useUserTimeBlocks,
  useTimeBlockTasks,
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
  useLinkTaskToTimeBlock,
  useUnlinkTaskFromTimeBlock
} from '../../hooks/useTimeBlock';
import * as timeBlockService from '../../services/timeBlockService';

// Mock the entire time block service
jest.mock('../../services/timeBlockService');
const mockedTimeBlockService = timeBlockService as jest.Mocked<typeof timeBlockService>;

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

describe('useTimeBlock hooks unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useUserTimeBlocks', () => {
    it('should return loading state initially and then return data', async () => {
      const mockTimeBlocks = [
        {
          id: 'block-1',
          user_id: 'user-1',
          google_calendar_event_id: null,
          title: 'Work Session',
          start_time: '2025-01-15T09:00:00Z',
          end_time: '2025-01-15T11:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockedTimeBlockService.getTimeBlocksForUser.mockResolvedValue(mockTimeBlocks);

      const dateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const { result } = renderHook(
        () => useUserTimeBlocks('user-1', dateRange),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTimeBlocks);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockedTimeBlockService.getTimeBlocksForUser).toHaveBeenCalledWith('user-1', dateRange);
    });

    it('should return error state when service throws', async () => {
      const mockError = new Error('Failed to fetch time blocks');
      mockedTimeBlockService.getTimeBlocksForUser.mockRejectedValue(mockError);

      const dateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const { result } = renderHook(
        () => useUserTimeBlocks('user-1', dateRange),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when required parameters are missing', () => {
      const { result: resultNoUser } = renderHook(
        () => useUserTimeBlocks('', { start: '2025-01-01T00:00:00Z', end: '2025-01-31T23:59:59Z' }),
        { wrapper: createWrapper() }
      );

      const { result: resultNoDateRange } = renderHook(
        () => useUserTimeBlocks('user-1', { start: '', end: '' }),
        { wrapper: createWrapper() }
      );

      expect(mockedTimeBlockService.getTimeBlocksForUser).not.toHaveBeenCalled();
      expect(resultNoUser.current.data).toBeUndefined();
      expect(resultNoDateRange.current.data).toBeUndefined();
    });
  });

  describe('useTimeBlockTasks', () => {
    it('should return loading state initially and then return tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          project_id: 'project-1',
          created_by: 'user-1',
          assigned_to: 'user-1',
          name: 'Test Task',
          description: null,
          due_date: null,
          status: 'todo',
          is_completed: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ];

      mockedTimeBlockService.getTasksForTimeBlock.mockResolvedValue(mockTasks);

      const { result } = renderHook(
        () => useTimeBlockTasks('block-1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTasks);
      expect(mockedTimeBlockService.getTasksForTimeBlock).toHaveBeenCalledWith('block-1');
    });

    it('should not fetch when blockId is not provided', () => {
      renderHook(
        () => useTimeBlockTasks(''),
        { wrapper: createWrapper() }
      );

      expect(mockedTimeBlockService.getTasksForTimeBlock).not.toHaveBeenCalled();
    });
  });

  describe('useCreateTimeBlock', () => {
    it('should handle time block creation successfully', async () => {
      const mockTimeBlock = {
        id: 'new-block-1',
        user_id: 'user-1',
        google_calendar_event_id: 'gcal-123',
        title: 'New Work Session',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      mockedTimeBlockService.createTimeBlock.mockResolvedValue(mockTimeBlock);

      const { result } = renderHook(
        () => useCreateTimeBlock(),
        { wrapper: createWrapper() }
      );

      const createData = {
        title: 'New Work Session',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
        google_calendar_event_id: 'gcal-123',
      };

      expect(result.current.isPending).toBe(false);

      result.current.mutate(createData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTimeBlock);
      expect(mockedTimeBlockService.createTimeBlock).toHaveBeenCalledWith(createData);
    });

    it('should handle time block creation errors', async () => {
      const mockError = new Error('Failed to create time block');
      mockedTimeBlockService.createTimeBlock.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useCreateTimeBlock(),
        { wrapper: createWrapper() }
      );

      const createData = {
        title: 'New Work Session',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
      };

      result.current.mutate(createData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useUpdateTimeBlock', () => {
    it('should handle time block updates successfully', async () => {
      const mockUpdatedTimeBlock = {
        id: 'block-1',
        user_id: 'user-1',
        google_calendar_event_id: null,
        title: 'Updated Work Session',
        start_time: '2025-01-20T09:00:00Z',
        end_time: '2025-01-20T13:00:00Z',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T01:00:00Z',
      };

      mockedTimeBlockService.updateTimeBlock.mockResolvedValue(mockUpdatedTimeBlock);

      const { result } = renderHook(
        () => useUpdateTimeBlock(),
        { wrapper: createWrapper() }
      );

      const updateData = {
        blockId: 'block-1',
        updates: {
          title: 'Updated Work Session',
          start_time: '2025-01-20T09:00:00Z',
          end_time: '2025-01-20T13:00:00Z',
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUpdatedTimeBlock);
      expect(mockedTimeBlockService.updateTimeBlock).toHaveBeenCalledWith(
        'block-1',
        updateData.updates
      );
    });
  });

  describe('useDeleteTimeBlock', () => {
    it('should handle time block deletion successfully', async () => {
      mockedTimeBlockService.deleteTimeBlock.mockResolvedValue();

      const { result } = renderHook(
        () => useDeleteTimeBlock(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('block-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedTimeBlockService.deleteTimeBlock).toHaveBeenCalledWith('block-1');
    });

    it('should handle time block deletion errors', async () => {
      const mockError = new Error('Failed to delete time block');
      mockedTimeBlockService.deleteTimeBlock.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useDeleteTimeBlock(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('block-1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useLinkTaskToTimeBlock', () => {
    it('should handle task linking successfully', async () => {
      mockedTimeBlockService.linkTaskToTimeBlock.mockResolvedValue();

      const { result } = renderHook(
        () => useLinkTaskToTimeBlock(),
        { wrapper: createWrapper() }
      );

      const linkData = {
        blockId: 'block-1',
        taskId: 'task-1',
      };

      result.current.mutate(linkData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedTimeBlockService.linkTaskToTimeBlock).toHaveBeenCalledWith('block-1', 'task-1');
    });

    it('should handle task linking errors', async () => {
      const mockError = new Error('Failed to link task to time block');
      mockedTimeBlockService.linkTaskToTimeBlock.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useLinkTaskToTimeBlock(),
        { wrapper: createWrapper() }
      );

      const linkData = {
        blockId: 'block-1',
        taskId: 'task-1',
      };

      result.current.mutate(linkData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useUnlinkTaskFromTimeBlock', () => {
    it('should handle task unlinking successfully', async () => {
      mockedTimeBlockService.unlinkTaskFromTimeBlock.mockResolvedValue();

      const { result } = renderHook(
        () => useUnlinkTaskFromTimeBlock(),
        { wrapper: createWrapper() }
      );

      const unlinkData = {
        blockId: 'block-1',
        taskId: 'task-1',
      };

      result.current.mutate(unlinkData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedTimeBlockService.unlinkTaskFromTimeBlock).toHaveBeenCalledWith('block-1', 'task-1');
    });

    it('should handle task unlinking errors', async () => {
      const mockError = new Error('Failed to unlink task from time block');
      mockedTimeBlockService.unlinkTaskFromTimeBlock.mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useUnlinkTaskFromTimeBlock(),
        { wrapper: createWrapper() }
      );

      const unlinkData = {
        blockId: 'block-1',
        taskId: 'task-1',
      };

      result.current.mutate(unlinkData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });
  });
});