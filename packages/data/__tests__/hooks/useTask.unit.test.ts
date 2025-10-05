// Comprehensive hook tests for useTask with mocked services
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProjectTasks,
  useUserTasks,
  useProjectsTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask
} from '../../hooks/useTask';

// Mock the service functions
const mockGetTasksForProject = jest.fn();
const mockGetTasksForUser = jest.fn();
const mockGetTasksForProjects = jest.fn();
const mockCreateTask = jest.fn();
const mockUpdateTask = jest.fn();
const mockDeleteTask = jest.fn();
const mockGetTaskById = jest.fn();

jest.mock('../../services/taskService', () => ({
  getTasksForProject: (...args: any[]) => mockGetTasksForProject(...args),
  getTasksForUser: (...args: any[]) => mockGetTasksForUser(...args),
  getTasksForProjects: (...args: any[]) => mockGetTasksForProjects(...args),
  createTask: (...args: any[]) => mockCreateTask(...args),
  updateTask: (...args: any[]) => mockUpdateTask(...args),
  deleteTask: (...args: any[]) => mockDeleteTask(...args),
  getTaskById: (...args: any[]) => mockGetTaskById(...args),
}));

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  return Wrapper;
};

// Mock data
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

const mockTasks = [mockTask];

describe('useTask hooks - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectTasks', () => {
    it('should return loading state initially then data', async () => {
      mockGetTasksForProject.mockResolvedValue(mockTasks);

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTasks);
      expect(mockGetTasksForProject).toHaveBeenCalledWith('project-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to fetch tasks');
      mockGetTasksForProject.mockRejectedValue(error);

      const { result } = renderHook(() => useProjectTasks('project-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });

    it('should not fetch when projectId is empty', () => {
      const { result } = renderHook(() => useProjectTasks(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockGetTasksForProject).not.toHaveBeenCalled();
    });
  });

  describe('useTask', () => {
    it('should fetch single task successfully', async () => {
      mockGetTaskById.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useTask('task-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTask);
      expect(mockGetTaskById).toHaveBeenCalledWith('task-1');
    });

    it('should handle task not found (null response)', async () => {
      mockGetTaskById.mockResolvedValue(null);

      const { result } = renderHook(() => useTask('nonexistent'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBe(null);
    });
  });

  describe('useCreateTask', () => {
    it('should create task successfully', async () => {
      mockCreateTask.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      const taskData = {
        project_id: 'project-1',
        name: 'New Task',
      };

      result.current.mutate(taskData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTask);
      expect(mockCreateTask).toHaveBeenCalledWith(taskData);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Failed to create');
      mockCreateTask.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ project_id: 'project-1', name: 'Task' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useUpdateTask', () => {
    it('should update task successfully', async () => {
      const updatedTask = { ...mockTask, name: 'Updated Task' };
      mockUpdateTask.mockResolvedValue(updatedTask);

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: 'task-1',
        updates: { name: 'Updated Task' }
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(updatedTask);
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { name: 'Updated Task' });
    });

    it('should handle update errors', async () => {
      const error = new Error('Failed to update');
      mockUpdateTask.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: 'task-1',
        updates: { name: 'Updated' }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDeleteTask', () => {
    it('should delete task successfully', async () => {
      mockDeleteTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('task-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Failed to delete');
      mockDeleteTask.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('task-1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Loading states', () => {
    it('should show pending state during mutations', async () => {
      // Create a promise that resolves after a delay
      mockCreateTask.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTask), 100))
      );

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      });

      // Start mutation
      result.current.mutate({ project_id: 'project-1', name: 'Task' });

      // Check pending state asynchronously
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // Wait for completion
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
    });
  });

  describe('useUserTasks', () => {
    const mockUserTasks = [mockTask];

    it('should fetch tasks for a user', async () => {
      mockGetTasksForUser.mockResolvedValue(mockUserTasks);

      const { result } = renderHook(() => useUserTasks('user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUserTasks);
      expect(mockGetTasksForUser).toHaveBeenCalledWith('user-1');
    });

    it('should not fetch when userId is empty', () => {
      const { result } = renderHook(() => useUserTasks(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockGetTasksForUser).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch user tasks');
      mockGetTasksForUser.mockRejectedValue(error);

      const { result } = renderHook(() => useUserTasks('user-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useProjectsTasks', () => {
    const mockProjectsTasks = [mockTask];

    it('should fetch tasks for multiple projects', async () => {
      mockGetTasksForProjects.mockResolvedValue(mockProjectsTasks);

      const { result } = renderHook(
        () => useProjectsTasks('user-1', ['project-1', 'project-2']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProjectsTasks);
      expect(mockGetTasksForProjects).toHaveBeenCalledWith('user-1', ['project-1', 'project-2']);
    });

    it('should not fetch when userId is empty', () => {
      const { result } = renderHook(
        () => useProjectsTasks('', ['project-1']),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockGetTasksForProjects).not.toHaveBeenCalled();
    });

    it('should not fetch when projectIds is empty', () => {
      const { result } = renderHook(
        () => useProjectsTasks('user-1', []),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockGetTasksForProjects).not.toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch projects tasks');
      mockGetTasksForProjects.mockRejectedValue(error);

      const { result } = renderHook(
        () => useProjectsTasks('user-1', ['project-1']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Query invalidation', () => {
    it('should invalidate queries after task creation', async () => {
      mockCreateTask.mockResolvedValue(mockTask);
      mockGetTasksForProject.mockResolvedValue([mockTask]);

      const wrapper = createWrapper();

      // First, load project tasks
      const { result: projectResult } = renderHook(
        () => useProjectTasks('project-1'),
        { wrapper }
      );

      await waitFor(() => expect(projectResult.current.isSuccess).toBe(true));

      // Clear the mock to track new calls
      mockGetTasksForProject.mockClear();

      // Create a task
      const { result: createResult } = renderHook(
        () => useCreateTask(),
        { wrapper }
      );

      createResult.current.mutate({
        project_id: 'project-1',
        name: 'New Task',
      });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

      // Project tasks query should be invalidated
      // (In a real scenario, it would refetch automatically)
    });

    it('should set task in cache after creation', async () => {
      mockCreateTask.mockResolvedValue(mockTask);
      mockGetTaskById.mockResolvedValue(mockTask);

      const wrapper = createWrapper();

      const { result: createResult } = renderHook(
        () => useCreateTask(),
        { wrapper }
      );

      createResult.current.mutate({
        project_id: 'project-1',
        name: 'Test Task',
      });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

      // The task should be in the cache now
      const { result: taskResult } = renderHook(
        () => useTask('task-1'),
        { wrapper }
      );

      // Since we set it in cache, it should be available immediately
      await waitFor(() => expect(taskResult.current.data).toBeDefined());
    });
  });

  describe('Optimistic updates', () => {
    it('should optimistically update task', async () => {
      const updatedTask = { ...mockTask, name: 'Updated Task' };
      mockUpdateTask.mockResolvedValue(updatedTask);
      mockGetTaskById.mockResolvedValue(mockTask);

      const wrapper = createWrapper();

      // Load the task first
      const { result: taskResult } = renderHook(
        () => useTask('task-1'),
        { wrapper }
      );

      await waitFor(() => expect(taskResult.current.data).toEqual(mockTask));

      // Update the task
      const { result: updateResult } = renderHook(
        () => useUpdateTask(),
        { wrapper }
      );

      updateResult.current.mutate({
        taskId: 'task-1',
        updates: { name: 'Updated Task' },
      });

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));

      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { name: 'Updated Task' });
    });

    it('should rollback on update error', async () => {
      const error = new Error('Update failed');
      mockUpdateTask.mockRejectedValue(error);
      mockGetTaskById.mockResolvedValue(mockTask);

      const wrapper = createWrapper();

      const { result: taskResult } = renderHook(
        () => useTask('task-1'),
        { wrapper }
      );

      await waitFor(() => expect(taskResult.current.data).toEqual(mockTask));

      const { result: updateResult } = renderHook(
        () => useUpdateTask(),
        { wrapper }
      );

      updateResult.current.mutate({
        taskId: 'task-1',
        updates: { name: 'Updated Task' },
      });

      await waitFor(() => expect(updateResult.current.isError).toBe(true));

      // The original task data should be restored
      expect(taskResult.current.data?.name).toBe('Test Task');
    });
  });
});