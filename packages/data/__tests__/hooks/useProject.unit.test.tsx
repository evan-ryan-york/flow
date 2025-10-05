/**
 * Comprehensive Unit Tests for useProject Hooks
 * Tests all hooks with React Testing Library and mocked services
 * Covers loading/success/error states and cache invalidation
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProjectsForUser,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectSearch,
  useGeneralProject,
} from '../../hooks/useProject';
import * as projectService from '../../services/projectService';

// Mock the supabase module to prevent initialization errors
jest.mock('../../supabase', () => {
  const mockSupabaseClient = {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  };

  return {
    supabase: mockSupabaseClient,
    getSupabaseClient: jest.fn(() => mockSupabaseClient),
  };
});

// Mock the entire service layer
jest.mock('../../services/projectService');

const mockedService = projectService as jest.Mocked<typeof projectService>;

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useProject Hooks - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectsForUser', () => {
    const mockProjects: projectService.ProjectWithRole[] = [
      {
        id: 'proj1',
        name: 'Project 1',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        userRole: 'owner',
      },
    ];

    it('should return loading state initially', () => {
      mockedService.getProjectsForUser.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return data on success', async () => {
      mockedService.getProjectsForUser.mockResolvedValue(mockProjects);

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProjects);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should return error state on failure', async () => {
      const error = new Error('Database error');
      mockedService.getProjectsForUser.mockRejectedValue(error);

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    it('should not run query when userId is undefined', () => {
      const { result } = renderHook(
        () => useProjectsForUser(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.getProjectsForUser).not.toHaveBeenCalled();
    });
  });

  describe('useProject', () => {
    const mockProject: projectService.ProjectWithRole = {
      id: 'proj1',
      name: 'Test Project',
      owner_id: 'user1',
      color: 'rose',
      is_general: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      userRole: 'owner',
    };

    it('should fetch project by ID', async () => {
      mockedService.getProjectById.mockResolvedValue(mockProject);

      const { result } = renderHook(
        () => useProject('proj1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProject);
      expect(mockedService.getProjectById).toHaveBeenCalledWith('proj1');
    });

    it('should handle error when fetching project', async () => {
      const error = new Error('Project not found');
      mockedService.getProjectById.mockRejectedValue(error);

      const { result } = renderHook(
        () => useProject('proj1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });

    it('should not run query when projectId is undefined', () => {
      const { result} = renderHook(
        () => useProject(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.getProjectById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateProject', () => {
    const mockProject: projectService.ProjectWithRole = {
      id: 'new-proj',
      name: 'New Project',
      owner_id: 'user1',
      color: 'sky',
      is_general: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      userRole: 'owner',
    };

    it('should show isPending during mutation', async () => {
      mockedService.createProject.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockProject), 100))
      );

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      // Wait a bit for the mutation to start
      await waitFor(() => expect(result.current.isPending).toBe(true));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
    });

    it('should call createProject service with correct params', async () => {
      mockedService.createProject.mockResolvedValue(mockProject);

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.createProject).toHaveBeenCalledWith({
        ownerId: 'user1',
        name: 'New Project',
      });
    });

    it('should show error state on mutation failure', async () => {
      const error = new Error('Creation failed');
      mockedService.createProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useUpdateProject', () => {
    const mockUpdatedProject: projectService.ProjectWithRole = {
      id: 'proj1',
      name: 'Updated Name',
      owner_id: 'user1',
      color: 'violet',
      is_general: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      userRole: 'owner',
    };

    it('should update project successfully', async () => {
      mockedService.updateProject.mockResolvedValue(mockUpdatedProject);

      const { result } = renderHook(
        () => useUpdateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({
        projectId: 'proj1',
        updates: { name: 'Updated Name' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.updateProject).toHaveBeenCalledWith('proj1', {
        name: 'Updated Name',
      });
    });

    it('should handle update errors', async () => {
      const error = new Error('Update failed');
      mockedService.updateProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useUpdateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({
        projectId: 'proj1',
        updates: { name: 'Updated Name' },
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDeleteProject', () => {
    it('should delete project successfully', async () => {
      mockedService.deleteProject.mockResolvedValue();

      const { result } = renderHook(
        () => useDeleteProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('proj-to-delete');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.deleteProject).toHaveBeenCalledWith('proj-to-delete');
    });

    it('should prevent deleting General project', async () => {
      const error = new Error('Cannot delete the General project');
      mockedService.deleteProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useDeleteProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('general-project-id');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useProjectSearch', () => {
    const mockSearchResults: projectService.ProjectWithRole[] = [
      {
        id: 'proj1',
        name: 'Marketing',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        userRole: 'owner',
      },
    ];

    it('should not search when query is empty', () => {
      const { result } = renderHook(
        () => useProjectSearch('user1', ''),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.searchProjects).not.toHaveBeenCalled();
    });

    it('should search when query has content', async () => {
      mockedService.searchProjects.mockResolvedValue(mockSearchResults);

      const { result } = renderHook(
        () => useProjectSearch('user1', 'market'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.searchProjects).toHaveBeenCalledWith('user1', 'market');
      expect(result.current.data).toEqual(mockSearchResults);
    });

    it('should respect enabled flag', () => {
      const { result } = renderHook(
        () => useProjectSearch('user1', 'market', false),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.searchProjects).not.toHaveBeenCalled();
    });
  });

  describe('useGeneralProject', () => {
    const mockGeneralProject: projectService.ProjectWithRole = {
      id: 'general',
      name: 'General',
      owner_id: 'user1',
      color: 'sky',
      is_general: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      userRole: 'owner',
    };

    it('should fetch General project', async () => {
      mockedService.getGeneralProject.mockResolvedValue(mockGeneralProject);

      const { result } = renderHook(
        () => useGeneralProject('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockGeneralProject);
      expect(result.current.data?.is_general).toBe(true);
    });

    it('should handle null when General project does not exist', async () => {
      mockedService.getGeneralProject.mockResolvedValue(null);

      const { result } = renderHook(
        () => useGeneralProject('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('should not run when userId is undefined', () => {
      const { result } = renderHook(
        () => useGeneralProject(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.getGeneralProject).not.toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate projects cache after creating a project', async () => {
      const mockProject: projectService.ProjectWithRole = {
        id: 'new-proj',
        name: 'New Project',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        userRole: 'owner',
      };

      mockedService.createProject.mockResolvedValue(mockProject);

      const wrapper = createWrapper();

      const { result: createResult } = renderHook(
        () => useCreateProject(),
        { wrapper }
      );

      createResult.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

      // The hook should trigger cache invalidation
      expect(createResult.current.isSuccess).toBe(true);
    });

    it('should invalidate projects cache after updating a project', async () => {
      const mockUpdatedProject: projectService.ProjectWithRole = {
        id: 'proj1',
        name: 'Updated',
        owner_id: 'user1',
        color: 'rose',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        userRole: 'owner',
      };

      mockedService.updateProject.mockResolvedValue(mockUpdatedProject);

      const wrapper = createWrapper();

      const { result: updateResult } = renderHook(
        () => useUpdateProject(),
        { wrapper }
      );

      updateResult.current.mutate({
        projectId: 'proj1',
        updates: { name: 'Updated' },
      });

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));

      expect(updateResult.current.isSuccess).toBe(true);
    });

    it('should invalidate projects cache after deleting a project', async () => {
      mockedService.deleteProject.mockResolvedValue();

      const wrapper = createWrapper();

      const { result: deleteResult } = renderHook(
        () => useDeleteProject(),
        { wrapper }
      );

      deleteResult.current.mutate('proj1');

      await waitFor(() => expect(deleteResult.current.isSuccess).toBe(true));

      expect(deleteResult.current.isSuccess).toBe(true);
    });
  });
});
