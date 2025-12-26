import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tantml:react-query';
import { Task } from '@flow-app/models';

// Dynamic import to handle Next.js client components
const TaskList = require('../../components/TaskList').TaskList;

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

describe('TaskList', () => {
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
      status: 'In Progress',
      is_completed: false,
      created_by: 'user-1',
      assigned_to: 'user-1',
      due_date: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'task-3',
      project_id: 'proj-1',
      name: 'Third Task',
      description: null,
      status: 'Done',
      is_completed: true,
      created_by: 'user-1',
      assigned_to: 'user-1',
      due_date: null,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    },
  ];

  it('should render all tasks', () => {
    render(
      <TaskList tasks={mockTasks} userId="user-1" onEditClick={jest.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
    expect(screen.getByText('Third Task')).toBeInTheDocument();
  });

  it('should display empty state when no tasks', () => {
    render(
      <TaskList tasks={[]} userId="user-1" onEditClick={jest.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/No tasks/i)).toBeInTheDocument();
  });

  it('should call onEditClick when task is clicked', () => {
    const mockOnEditClick = jest.fn();

    render(
      <TaskList tasks={mockTasks} userId="user-1" onEditClick={mockOnEditClick} />,
      { wrapper: createWrapper() }
    );

    const firstTask = screen.getByText('First Task');
    fireEvent.click(firstTask);

    expect(mockOnEditClick).toHaveBeenCalledWith('task-1');
  });

  it('should render tasks in correct order', () => {
    render(
      <TaskList tasks={mockTasks} userId="user-1" onEditClick={jest.fn()} />,
      { wrapper: createWrapper() }
    );

    const taskElements = screen.getAllByRole('article'); // Assuming tasks have role="article"
    expect(taskElements[0]).toHaveTextContent('First Task');
    expect(taskElements[1]).toHaveTextContent('Second Task');
    expect(taskElements[2]).toHaveTextContent('Third Task');
  });

  it('should display user mapping when provided', () => {
    const userMapping = {
      'user-1': 'John Doe',
      'user-2': 'Jane Smith',
    };

    render(
      <TaskList
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
        userMapping={userMapping}
        visibleBuiltInColumns={new Set(['assigned_to'])}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
  });

  it('should show loading state', () => {
    render(
      <TaskList tasks={[]} userId="user-1" onEditClick={jest.fn()} isLoading={true} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(
      <TaskList tasks={[]} userId="user-1" onEditClick={jest.fn()} error="Failed to load tasks" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Failed to load tasks/i)).toBeInTheDocument();
  });

  it('should support keyboard navigation', () => {
    const mockOnEditClick = jest.fn();

    render(
      <TaskList tasks={mockTasks} userId="user-1" onEditClick={mockOnEditClick} />,
      { wrapper: createWrapper() }
    );

    const firstTask = screen.getByText('First Task');

    // Press Enter key
    fireEvent.keyDown(firstTask, { key: 'Enter', code: 'Enter' });

    expect(mockOnEditClick).toHaveBeenCalledWith('task-1');
  });

  it('should handle drag and drop', () => {
    render(
      <TaskList tasks={mockTasks} userId="user-1" onEditClick={jest.fn()} />,
      { wrapper: createWrapper() }
    );

    const firstTask = screen.getByText('First Task').closest('div');

    if (firstTask) {
      fireEvent.dragStart(firstTask);
      expect(firstTask).toHaveAttribute('draggable', 'true');
    }
  });

  it('should display custom property columns when provided', () => {
    const customPropertyDefinitions = [
      {
        id: 'prop-1',
        project_id: 'proj-1',
        created_by: 'user-1',
        name: 'Priority',
        type: 'select' as const,
        options: { values: ['High', 'Medium', 'Low'] },
        display_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    render(
      <TaskList
        tasks={mockTasks}
        userId="user-1"
        onEditClick={jest.fn()}
        customPropertyDefinitions={customPropertyDefinitions}
      />,
      { wrapper: createWrapper() }
    );

    // The custom property column header should be visible
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });
});
