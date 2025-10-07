import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Task } from '@perfect-task-app/models';

// Dynamic import to handle Next.js client components
const TaskGroup = require('../../components/TaskGroup').TaskGroup;

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

describe('TaskGroup', () => {
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
      project_id: 'proj-1',
      name: 'Second Task',
      description: null,
      status: 'To Do',
      is_completed: false,
      created_by: 'user-1',
      assigned_to: 'user-1',
      due_date: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  it('should render group header with title', () => {
    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should display task count in header', () => {
    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Badge with count
  });

  it('should render all tasks in group', () => {
    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });

  it('should be collapsible', async () => {
    const user = userEvent.setup();

    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Tasks should be visible initially
    expect(screen.getByText('First Task')).toBeVisible();

    // Click to collapse
    const header = screen.getByText('To Do');
    await user.click(header);

    // Tasks should be hidden
    expect(screen.queryByText('First Task')).not.toBeVisible();
  });

  it('should expand when clicked again', async () => {
    const user = userEvent.setup();

    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const header = screen.getByText('To Do');

    // Collapse
    await user.click(header);
    expect(screen.queryByText('First Task')).not.toBeVisible();

    // Expand
    await user.click(header);
    expect(screen.getByText('First Task')).toBeVisible();
  });

  it('should show collapse/expand icon', () => {
    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    // Icon should be present (chevron or similar)
    const icon = document.querySelector('svg') || screen.getByTestId('collapse-icon');
    expect(icon).toBeInTheDocument();
  });

  it('should remember collapse state', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const header = screen.getByText('To Do');
    await user.click(header);

    // Collapsed
    expect(screen.queryByText('First Task')).not.toBeVisible();

    // Rerender with same props
    rerender(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />
    );

    // Should remain collapsed
    expect(screen.queryByText('First Task')).not.toBeVisible();
  });

  it('should handle empty group', () => {
    render(
      <TaskGroup
        groupName="Done"
        tasks={[]}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should pass onEditClick to tasks', async () => {
    const mockOnEditClick = jest.fn();
    const user = userEvent.setup();

    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={mockOnEditClick}
      />,
      { wrapper: createWrapper() }
    );

    const task = screen.getByText('First Task');
    await user.click(task);

    expect(mockOnEditClick).toHaveBeenCalledWith('task-1');
  });

  it('should support keyboard navigation for collapse', async () => {
    const user = userEvent.setup();

    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const header = screen.getByText('To Do');
    header.focus();

    // Press Enter to toggle
    await user.keyboard('{Enter}');

    expect(screen.queryByText('First Task')).not.toBeVisible();
  });

  it('should show visual indicator when collapsed', async () => {
    const user = userEvent.setup();

    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const header = screen.getByText('To Do').closest('button') || screen.getByText('To Do').closest('div');

    // Click to collapse
    if (header) {
      await user.click(header);

      // Should have collapsed visual indicator (rotated chevron, etc.)
      const icon = header.querySelector('svg');
      expect(icon).toHaveClass(/rotate/i) || expect(icon).toHaveAttribute('data-collapsed', 'true');
    }
  });

  it('should support drag and drop within group', () => {
    render(
      <TaskGroup
        groupName="To Do"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const firstTask = screen.getByText('First Task').closest('div');

    if (firstTask) {
      const dragEvent = new Event('dragstart', { bubbles: true });
      firstTask.dispatchEvent(dragEvent);

      expect(firstTask).toHaveAttribute('draggable', 'true');
    }
  });

  it('should display group with custom color or styling', () => {
    render(
      <TaskGroup
        groupName="High Priority"
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
        color="red"
      />,
      { wrapper: createWrapper() }
    );

    const header = screen.getByText('High Priority').closest('div');
    expect(header).toHaveClass(/red/i) || expect(header).toHaveStyle({ color: /red/i });
  });
});
