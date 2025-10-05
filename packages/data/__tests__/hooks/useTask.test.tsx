import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProjectTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask
} from '../../hooks/useTask';
import * as taskService from '../../services/taskService';

// Mock the entire taskService
jest.mock('../../services/taskService');
const mockedTaskService = taskService as jest.Mocked<typeof taskService>;

// Test wrapper component for TanStack Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock task data
const mockTask = {
  id: 'task-1',
  project_id: 'project-1',
  created_by: 'user-1',
  assigned_to: 'user-1',
  name: 'Test Task',
  description: 'Test Description',
  due_date: '2024-12-31',
  status: 'todo',
  is_completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockTasks = [
  mockTask,
  {
    ...mockTask,
    id: 'task-2',
    name: 'Another Task',
  },
];

describe('useTask hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectTasks', () => {
    it('should return loading state initially', async () => {
      // Mock the service to return a promise that doesn't resolve immediately
      mockedTaskService.getTasksForProject.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTasks), 100))
      );

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);
    });

    it('should return data when service resolves successfully', async () => {
      mockedTaskService.getTasksForProject.mockResolvedValue(mockTasks);

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockTasks);
      expect(result.current.isError).toBe(false);
      expect(mockedTaskService.getTasksForProject).toHaveBeenCalledWith('project-1');
    });

    it('should return error state when service throws an error', async () => {
      const errorMessage = 'Failed to fetch tasks';
      mockedTaskService.getTasksForProject.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it('should not execute query when projectId is not provided', () => {
      mockedTaskService.getTasksForProject.mockResolvedValue(mockTasks);

      const { result } = renderHook(() => useProjectTasks(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockedTaskService.getTasksForProject).not.toHaveBeenCalled();
    });
  });

  describe('useTask', () => {
    it('should return loading state initially', async () => {
      mockedTaskService.getTaskById.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTask), 100))
      );

      const { result } = renderHook(() => useTask('task-1'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.isError).toBe(false);
    });

    it('should return data when service resolves successfully', async () => {
      mockedTaskService.getTaskById.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useTask('task-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(mockTask);
      expect(result.current.isError).toBe(false);
      expect(mockedTaskService.getTaskById).toHaveBeenCalledWith('task-1');
    });

    it('should handle null response (task not found)', async () => {
      mockedTaskService.getTaskById.mockResolvedValue(null);

      const { result } = renderHook(() => useTask('non-existent-task'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBe(null);
      expect(result.current.isError).toBe(false);
    });

    it('should return error state when service throws an error', async () => {
      const errorMessage = 'Failed to fetch task';
      mockedTaskService.getTaskById.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTask('task-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe('useCreateTask', () => {
    it('should initially not be loading or error', () => {
      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should handle successful task creation', async () => {
      const newTaskData = {
        project_id: 'project-1',
        name: 'New Task',
        description: 'New task description',
      };

      mockedTaskService.createTask.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newTaskData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toEqual(mockTask);
      expect(result.current.isError).toBe(false);
      expect(mockedTaskService.createTask).toHaveBeenCalledWith(newTaskData);
    });

    it('should handle task creation error', async () => {
      const errorMessage = 'Failed to create task';
      const newTaskData = {
        project_id: 'project-1',
        name: 'New Task',
      };

      mockedTaskService.createTask.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(newTaskData);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it('should complete task creation successfully', async () => {
      mockedTaskService.createTask.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        project_id: 'project-1',
        name: 'New Task',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTask);
    });
  });

  describe('useUpdateTask', () => {
    it('should handle successful task update', async () => {
      const updatedTask = { ...mockTask, name: 'Updated Task' };
      const updateData = { name: 'Updated Task' };

      mockedTaskService.updateTask.mockResolvedValue(updatedTask);

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ taskId: 'task-1', updates: updateData });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(updatedTask);
      expect(mockedTaskService.updateTask).toHaveBeenCalledWith('task-1', updateData);
    });

    it('should handle task update error', async () => {
      const errorMessage = 'Failed to update task';
      const updateData = { name: 'Updated Task' };

      mockedTaskService.updateTask.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ taskId: 'task-1', updates: updateData });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });
  });

  describe('useDeleteTask', () => {
    it('should handle successful task deletion', async () => {
      mockedTaskService.deleteTask.mockResolvedValue();

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('task-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isError).toBe(false);
      expect(mockedTaskService.deleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should handle task deletion error', async () => {
      const errorMessage = 'Failed to delete task';

      mockedTaskService.deleteTask.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('task-1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(Error);
      expect((result.current.error as Error).message).toBe(errorMessage);
    });

    it('should complete task deletion successfully without data', async () => {
      mockedTaskService.deleteTask.mockResolvedValue();

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('task-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedTaskService.deleteTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('State management behavior', () => {
    it('should maintain correct loading states throughout lifecycle', async () => {
      // Test that hooks properly transition through loading states
      let resolvePromise: (value: typeof mockTasks) => void;
      const promise = new Promise<typeof mockTasks>((resolve) => {
        resolvePromise = resolve;
      });

      mockedTaskService.getTasksForProject.mockReturnValue(promise);

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Resolve the promise
      resolvePromise!(mockTasks);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Final state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockTasks);
    });
  });
});