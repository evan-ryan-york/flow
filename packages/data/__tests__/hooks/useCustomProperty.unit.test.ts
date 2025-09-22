// Unit tests for useCustomProperty hooks - mocking services completely
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProjectDefinitions,
  useCreateDefinition,
  useUpdateDefinition,
  useDeleteDefinition,
  useTaskPropertyValues,
  useSetPropertyValue,
  useDeletePropertyValue
} from '../../hooks/useCustomProperty';

// Mock the service functions
const mockGetDefinitionsForProject = jest.fn();
const mockCreateDefinition = jest.fn();
const mockUpdateDefinition = jest.fn();
const mockDeleteDefinition = jest.fn();
const mockGetValuesForTask = jest.fn();
const mockSetPropertyValue = jest.fn();
const mockDeletePropertyValue = jest.fn();

jest.mock('../../services/customPropertyService', () => ({
  getDefinitionsForProject: (...args: any[]) => mockGetDefinitionsForProject(...args),
  createDefinition: (...args: any[]) => mockCreateDefinition(...args),
  updateDefinition: (...args: any[]) => mockUpdateDefinition(...args),
  deleteDefinition: (...args: any[]) => mockDeleteDefinition(...args),
  getValuesForTask: (...args: any[]) => mockGetValuesForTask(...args),
  setPropertyValue: (...args: any[]) => mockSetPropertyValue(...args),
  deletePropertyValue: (...args: any[]) => mockDeletePropertyValue(...args),
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
const mockDefinition = {
  id: 'def-1',
  project_id: 'project-1',
  created_by: 'user-1',
  name: 'Priority',
  type: 'select' as const,
  options: ['Low', 'Medium', 'High'],
  display_order: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockDefinitions = [mockDefinition];

const mockPropertyValue = {
  id: 'val-1',
  task_id: 'task-1',
  definition_id: 'def-1',
  value: 'High',
  created_by: 'user-1',
  updated_by: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockPropertyValues = [mockPropertyValue];

describe('useCustomProperty hooks - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectDefinitions', () => {
    it('should return loading state initially then data', async () => {
      mockGetDefinitionsForProject.mockResolvedValue(mockDefinitions);

      const { result } = renderHook(() => useProjectDefinitions('project-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockDefinitions);
      expect(mockGetDefinitionsForProject).toHaveBeenCalledWith('project-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to fetch definitions');
      mockGetDefinitionsForProject.mockRejectedValue(error);

      const { result } = renderHook(() => useProjectDefinitions('project-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });

    it('should not fetch when projectId is empty', () => {
      const { result } = renderHook(() => useProjectDefinitions(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockGetDefinitionsForProject).not.toHaveBeenCalled();
    });
  });

  describe('useTaskPropertyValues', () => {
    it('should fetch property values successfully', async () => {
      mockGetValuesForTask.mockResolvedValue(mockPropertyValues);

      const { result } = renderHook(() => useTaskPropertyValues('task-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPropertyValues);
      expect(mockGetValuesForTask).toHaveBeenCalledWith('task-1');
    });

    it('should handle empty values list', async () => {
      mockGetValuesForTask.mockResolvedValue([]);

      const { result } = renderHook(() => useTaskPropertyValues('task-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('should not fetch when taskId is empty', () => {
      const { result } = renderHook(() => useTaskPropertyValues(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockGetValuesForTask).not.toHaveBeenCalled();
    });
  });

  describe('useCreateDefinition', () => {
    it('should create definition successfully', async () => {
      mockCreateDefinition.mockResolvedValue(mockDefinition);

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      const definitionData = {
        project_id: 'project-1',
        name: 'Priority',
        type: 'select' as const,
        options: ['Low', 'High'],
      };

      result.current.mutate(definitionData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockDefinition);
      expect(mockCreateDefinition).toHaveBeenCalledWith(definitionData);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Failed to create definition');
      mockCreateDefinition.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        project_id: 'project-1',
        name: 'Priority',
        type: 'select',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useUpdateDefinition', () => {
    it('should update definition successfully', async () => {
      const updatedDefinition = { ...mockDefinition, name: 'Updated Priority' };
      mockUpdateDefinition.mockResolvedValue(updatedDefinition);

      const { result } = renderHook(() => useUpdateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        definitionId: 'def-1',
        updates: { name: 'Updated Priority' }
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(updatedDefinition);
      expect(mockUpdateDefinition).toHaveBeenCalledWith('def-1', { name: 'Updated Priority' });
    });

    it('should handle update errors', async () => {
      const error = new Error('Failed to update definition');
      mockUpdateDefinition.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        definitionId: 'def-1',
        updates: { name: 'Updated' }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDeleteDefinition', () => {
    it('should delete definition successfully', async () => {
      mockDeleteDefinition.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('def-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDeleteDefinition).toHaveBeenCalledWith('def-1');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Failed to delete definition');
      mockDeleteDefinition.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteDefinition(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('def-1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useSetPropertyValue', () => {
    it('should set property value successfully', async () => {
      mockSetPropertyValue.mockResolvedValue(mockPropertyValue);

      const { result } = renderHook(() => useSetPropertyValue(), {
        wrapper: createWrapper(),
      });

      const setValueData = {
        taskId: 'task-1',
        definitionId: 'def-1',
        value: 'High',
      };

      result.current.mutate(setValueData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPropertyValue);
      expect(mockSetPropertyValue).toHaveBeenCalledWith('task-1', 'def-1', 'High');
    });

    it('should handle set value errors', async () => {
      const error = new Error('Failed to set property value');
      mockSetPropertyValue.mockRejectedValue(error);

      const { result } = renderHook(() => useSetPropertyValue(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: 'task-1',
        definitionId: 'def-1',
        value: 'High',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDeletePropertyValue', () => {
    it('should delete property value successfully', async () => {
      mockDeletePropertyValue.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeletePropertyValue(), {
        wrapper: createWrapper(),
      });

      const deleteValueData = {
        taskId: 'task-1',
        definitionId: 'def-1',
      };

      result.current.mutate(deleteValueData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDeletePropertyValue).toHaveBeenCalledWith('task-1', 'def-1');
    });

    it('should handle delete value errors', async () => {
      const error = new Error('Failed to delete property value');
      mockDeletePropertyValue.mockRejectedValue(error);

      const { result } = renderHook(() => useDeletePropertyValue(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        taskId: 'task-1',
        definitionId: 'def-1',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('Loading states', () => {
    it('should show pending state during mutations', async () => {
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });

      mockCreateDefinition.mockReturnValue(createPromise);

      const { result } = renderHook(() => useCreateDefinition(), {
        wrapper: createWrapper(),
      });

      // Start mutation
      result.current.mutate({
        project_id: 'project-1',
        name: 'Priority',
        type: 'select',
      });

      // Should be pending
      expect(result.current.isPending).toBe(true);

      // Resolve the promise
      resolveCreate!(mockDefinition);

      // Wait for completion
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
    });

    it('should handle state transitions properly', async () => {
      mockGetDefinitionsForProject.mockResolvedValue(mockDefinitions);

      const { result } = renderHook(() => useProjectDefinitions('project-1'), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Wait for success
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Final state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual(mockDefinitions);
    });
  });
});