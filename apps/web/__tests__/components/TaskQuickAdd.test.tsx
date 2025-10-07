import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as dataHooks from '@perfect-task-app/data';
import { Project } from '@perfect-task-app/models';

// Dynamic import to handle Next.js client components
const TaskQuickAdd = require('../../components/TaskQuickAdd').TaskQuickAdd;

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

describe('TaskQuickAdd', () => {
  const mockProjects: Project[] = [
    {
      id: 'general-proj',
      name: 'General',
      owner_id: 'user-1',
      color: 'gray',
      is_general: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'work-proj',
      name: 'Work Project',
      owner_id: 'user-1',
      color: 'blue',
      is_general: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'personal-proj',
      name: 'Personal',
      owner_id: 'user-1',
      color: 'green',
      is_general: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockCreateTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock all required hooks
    mockedHooks.useProjectsForUser.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
    } as any);

    mockedHooks.useLastUsedProject.mockReturnValue({
      data: 'work-proj',
      isLoading: false,
    } as any);

    mockedHooks.useGeneralProject.mockReturnValue({
      data: mockProjects[0],
      isLoading: false,
    } as any);

    mockedHooks.useProjectDefinitions.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    mockedHooks.useAllProfiles.mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    mockedHooks.useCreateTask.mockReturnValue({
      mutate: mockCreateTask,
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
      isSuccess: false,
      isError: false,
    } as any);

    mockedHooks.useSetPropertyValue.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
  });

  it('should render task input field', () => {
    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    expect(input).toBeInTheDocument();
  });

  it('should create task on Enter key press', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Buy groceries{Enter}');

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled();
    });
  });

  it('should show project autocomplete when /in is typed', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Buy milk /in');

    await waitFor(() => {
      expect(screen.getByText('Work Project')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });

  it('should filter projects in autocomplete', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Task /in work');

    await waitFor(() => {
      expect(screen.getByText('Work Project')).toBeInTheDocument();
      expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    });
  });

  it('should select project from autocomplete on click', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Task /in');

    await waitFor(() => {
      const workProject = screen.getByText('Work Project');
      expect(workProject).toBeInTheDocument();
    });

    const workProject = screen.getByText('Work Project');
    await user.click(workProject);

    await waitFor(() => {
      expect(screen.queryByText('Work Project')).not.toBeInTheDocument();
    });
  });

  it('should use last used project as default', async () => {
    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const projectChip = screen.getByText('Work Project');
      expect(projectChip).toBeInTheDocument();
    });
  });

  it('should show advanced options when clicked', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const advancedButton = screen.getByText(/Advanced/i);
    await user.click(advancedButton);

    await waitFor(() => {
      expect(screen.getByText(/Due Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Assigned To/i)).toBeInTheDocument();
    });
  });

  it('should clear input after successful task creation', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i) as HTMLInputElement;
    await user.type(input, 'Test Task{Enter}');

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should not create task with empty name', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, '{Enter}');

    await waitFor(() => {
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  it('should handle Escape key to blur input', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Test{Escape}');

    expect(document.activeElement).not.toBe(input);
  });

  it('should navigate autocomplete with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="general-proj" />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText(/Add a task/i);
    await user.type(input, 'Task /in');

    await waitFor(() => {
      expect(screen.getByText('Work Project')).toBeInTheDocument();
    });

    // Arrow down should highlight first project
    await user.keyboard('{ArrowDown}');

    // Enter should select highlighted project
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByText('Work Project')).not.toBeInTheDocument();
    });
  });

  it('should display selected project chip', async () => {
    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="work-proj" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const chip = screen.getByText('Work Project');
      expect(chip).toBeInTheDocument();
    });
  });

  it('should allow changing project by clicking on chip', async () => {
    const user = userEvent.setup();

    render(
      <TaskQuickAdd userId="user-1" defaultProjectId="work-proj" />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const chip = screen.getByText('Work Project');
      expect(chip).toBeInTheDocument();
    });

    const chip = screen.getByText('Work Project');
    await user.click(chip);

    // Should show project list
    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });
});
