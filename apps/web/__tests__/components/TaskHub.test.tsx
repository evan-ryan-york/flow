import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as dataHooks from '@perfect-task-app/data';
import { Task, Project } from '@perfect-task-app/models';

// Dynamic import to handle Next.js client components
const TaskHub = require('../../components/TaskHub').TaskHub;

jest.mock('@perfect-task-app/data');

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

describe('TaskHub', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      project_id: 'proj-1',
      name: 'First Task',
      description: null,
      status: 'To Do',
      is_completed: false,
      created_by: 'user-1',
      assigned_to: 'user-1',
      due_date: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'task-2',
      project_id: 'proj-2',
      name: 'Second Task',
      description: null,
      status: 'In Progress',
      is_completed: false,
      created_by: 'user-1',
      assigned_to: 'user-2',
      due_date: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  const mockProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Project 1',
      owner_id: 'user-1',
      color: 'blue',
      is_general: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'proj-2',
      name: 'Project 2',
      owner_id: 'user-1',
      color: 'green',
      is_general: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockProfiles = [
    {
      id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock all required hooks
    mockedHooks.useProjectsTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    mockedHooks.useProjectsForUser.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
    } as any);

    mockedHooks.useAllProfiles.mockReturnValue({
      data: mockProfiles,
      isLoading: false,
      isError: false,
    } as any);

    mockedHooks.useProjectDefinitions.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    mockedHooks.useTasksPropertyValues.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    mockedHooks.useRealtimeTaskSync.mockReturnValue({
      isConnected: true,
    } as any);

    mockedHooks.useTaskEditPanel.mockReturnValue({
      isOpen: false,
      selectedTaskId: null,
      openPanel: jest.fn(),
      closePanel: jest.fn(),
      switchTask: jest.fn(),
      hasUnsavedChanges: false,
      setHasUnsavedChanges: jest.fn(),
    } as any);

    mockedHooks.useUpdateTask.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockedHooks.useSetPropertyValue.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
  });

  it('should render task hub with tasks', () => {
    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mockedHooks.useProjectsTasks.mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('should display error state', () => {
    mockedHooks.useProjectsTasks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
    } as any);

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
  });

  it('should filter tasks by search query', async () => {
    const user = userEvent.setup();

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    await user.type(searchInput, 'First');

    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument();
      expect(screen.queryByText('Second Task')).not.toBeInTheDocument();
    });
  });

  it('should group tasks by project', async () => {
    const user = userEvent.setup();

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const groupByButton = screen.getByText(/Group by/i);
    await user.click(groupByButton);

    await waitFor(() => {
      const projectOption = screen.getByText(/Project/i);
      expect(projectOption).toBeInTheDocument();
    });

    const projectOption = screen.getByText(/Project/i);
    await user.click(projectOption);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });
  });

  it('should open task edit panel when task is clicked', async () => {
    const mockOpenPanel = jest.fn();

    mockedHooks.useTaskEditPanel.mockReturnValue({
      isOpen: false,
      selectedTaskId: null,
      openPanel: mockOpenPanel,
      closePanel: jest.fn(),
      switchTask: jest.fn(),
      hasUnsavedChanges: false,
      setHasUnsavedChanges: jest.fn(),
    } as any);

    const user = userEvent.setup();

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const taskElement = screen.getByText('First Task');
    await user.click(taskElement);

    expect(mockOpenPanel).toHaveBeenCalledWith('task-1');
  });

  it('should show real-time connection status', () => {
    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Real-time indicator should be present
    const indicator = screen.getByTestId('realtime-indicator') || document.querySelector('[data-connected="true"]');
    expect(indicator).toBeInTheDocument();
  });

  it('should handle drag and drop task reordering', async () => {
    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const firstTask = screen.getByText('First Task').closest('div');

    if (firstTask) {
      const dragStartEvent = new Event('dragstart', { bubbles: true });
      firstTask.dispatchEvent(dragStartEvent);

      expect(firstTask).toHaveAttribute('draggable', 'true');
    }
  });

  it('should display user names in task assignments', () => {
    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1', 'proj-2']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Current user should show "You"
    expect(screen.getByText('You')).toBeInTheDocument();

    // Other users should show their names
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('should handle empty project selection', () => {
    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={[]}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/No projects selected/i)).toBeInTheDocument();
  });

  it('should support keyboard shortcuts', async () => {
    const user = userEvent.setup();

    render(
      <TaskHub
        userId="user-1"
        selectedProjectIds={['proj-1']}
        selectedViewId={null}
        onViewChange={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Press '/' to focus search
    await user.keyboard('/');

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    expect(document.activeElement).toBe(searchInput);
  });
});
