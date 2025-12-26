/**
 * Component Tests for ProjectsPanel
 * Tests user interactions, rendering, and state management
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ProjectsPanel } from '../ProjectsPanel';
import * as dataHooks from '@flow-app/data';

// Mock the data hooks
jest.mock('@flow-app/data', () => ({
  useProjectsForUser: jest.fn(),
  useCreateProject: jest.fn(),
  useUpdateProject: jest.fn(),
  useDeleteProjectWithReassignment: jest.fn(),
}));

const mockedHooks = dataHooks as jest.Mocked<typeof dataHooks>;

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

describe('ProjectsPanel', () => {
  const mockOnProjectSelectionChange = jest.fn();
  const mockProjects: dataHooks.ProjectWithRole[] = [
    {
      id: 'general-id',
      name: 'General',
      owner_id: 'user1',
      color: 'sky',
      is_general: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      userRole: 'owner',
    },
    {
      id: 'proj1',
      name: 'Marketing',
      owner_id: 'user1',
      color: 'rose',
      is_general: false,
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      userRole: 'owner',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockedHooks.useProjectsForUser.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: true,
      refetch: jest.fn(),
      status: 'success',
      fetchStatus: 'idle',
      isPending: false,
      isRefetching: false,
      isLoadingError: false,
      isRefetchError: false,
      isStale: false,
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isPlaceholderData: false,
      isPaused: false,
    } as any);

    mockedHooks.useCreateProject.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
      data: undefined,
      error: null,
      reset: jest.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      variables: undefined,
      submittedAt: 0,
      context: undefined,
    } as any);

    mockedHooks.useUpdateProject.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
      data: undefined,
      error: null,
      reset: jest.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      variables: undefined,
      submittedAt: 0,
      context: undefined,
    } as any);

    mockedHooks.useDeleteProjectWithReassignment.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
      data: undefined,
      error: null,
      reset: jest.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      variables: undefined,
      submittedAt: 0,
      context: undefined,
    } as any);
  });

  describe('Loading State', () => {
    it('should render loading skeleton while loading', () => {
      mockedHooks.useProjectsForUser.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        isSuccess: false,
        isPending: true,
      } as any);

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Check for loading indicators
      const loadingElements = screen.getAllByRole('generic', { hidden: true });
      expect(loadingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should render error message on error', () => {
      mockedHooks.useProjectsForUser.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Database error'),
        isSuccess: false,
      } as any);

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Failed to load projects/i)).toBeInTheDocument();
      expect(screen.getByText(/Database error/i)).toBeInTheDocument();
    });
  });

  describe('Project List Rendering', () => {
    it('should render list of projects', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('should render General project first', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const projectButtons = screen.getAllByRole('button');
      // Find buttons with project names
      const projectNameButtons = projectButtons.filter(btn =>
        btn.textContent?.includes('General') || btn.textContent?.includes('Marketing')
      );

      expect(projectNameButtons[0].textContent).toContain('General');
    });
  });

  describe('Project Selection', () => {
    it('should call onProjectSelectionChange when project clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingButton = screen.getByText('Marketing').closest('button');
      fireEvent.click(marketingButton!);

      // Second param is the clicked project ID (for enabling selection)
      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith(['proj1'], 'proj1');
    });

    it('should toggle selection when clicking selected project', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={['proj1']}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingButton = screen.getByText('Marketing').closest('button');
      fireEvent.click(marketingButton!);

      // Second param is undefined when deselecting (toggling off)
      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([], undefined);
    });
  });

  describe('Select All/None Buttons', () => {
    it('should select all projects when "All" clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const allButton = screen.getByText('All');
      fireEvent.click(allButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([
        'general-id',
        'proj1',
      ]);
    });

    it('should deselect all projects when "None" clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={['general-id', 'proj1']}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const noneButton = screen.getByText('None');
      fireEvent.click(noneButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Create Project Flow', () => {
    it('should show create form when + button clicked', () => {
      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // The Plus button is in the header - find it by the className pattern
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
    });

    it('should validate empty project name', async () => {
      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
      });

      // Try to submit empty by pressing Enter on the input
      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Project name is required')).toBeInTheDocument();
      });
    });

    it('should validate project name length > 50', async () => {
      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      // Enter long name
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, {
        target: { value: 'A'.repeat(51) },
      });

      // Submit by pressing Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(
          screen.getByText('Project name must be 50 characters or less')
        ).toBeInTheDocument();
      });
    });

    it('should submit valid project name on Enter', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        id: 'new-proj',
        name: 'New Project',
      });

      mockedHooks.useCreateProject.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: false,
        isError: false,
      } as any);

      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      // Enter name
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, { target: { value: 'New Project' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          ownerId: 'user1',
          name: 'New Project',
        });
      });
    });

    it('should cancel create form on Escape', async () => {
      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Project name...')).not.toBeInTheDocument();
      });
    });

    it('should auto-select new project after creation', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        id: 'new-proj',
        name: 'New Project',
      });

      mockedHooks.useCreateProject.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: false,
        isError: false,
      } as any);

      const { container } = render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open and submit
      const plusButton = container.querySelector('.text-gray-500');
      if (plusButton) {
        fireEvent.click(plusButton);
      }

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, { target: { value: 'New Project' } });

      // Submit by pressing Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        // Second param is the new project ID (for auto-selecting after creation)
        expect(mockOnProjectSelectionChange).toHaveBeenCalledWith(['new-proj'], 'new-proj');
      });
    });
  });
});
