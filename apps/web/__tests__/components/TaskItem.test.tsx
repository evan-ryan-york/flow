import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as dataHooks from '@flow-app/data';
import { Task } from '@flow-app/models';

// Dynamic import to handle Next.js client components
const TaskItem = require('../../components/TaskItem').default;

jest.mock('@flow-app/data');

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

describe('TaskItem', () => {
  const mockTask: Task = {
    id: 'task-1',
    project_id: 'proj-1',
    name: 'Test Task',
    description: null,
    status: 'To Do',
    is_completed: false,
    created_by: 'user-1',
    assigned_to: 'user-1',
    due_date: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockUpdateTask = jest.fn();
  const mockSetPropertyValue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedHooks.useUpdateTask.mockReturnValue({
      mutate: mockUpdateTask,
      isPending: false,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
    } as any);

    mockedHooks.useTaskPropertyValues.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    mockedHooks.useSetPropertyValue.mockReturnValue({
      mutateAsync: mockSetPropertyValue,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as any);
  });

  it('should render task name', () => {
    render(
      <TaskItem task={mockTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should toggle task status on checkbox click', () => {
    render(
      <TaskItem task={mockTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockUpdateTask).toHaveBeenCalledWith(
      {
        taskId: 'task-1',
        updates: {
          status: 'Done',
          is_completed: true,
        },
      },
      expect.any(Object)
    );
  });

  it('should mark task as done when status is Done', () => {
    const doneTask = { ...mockTask, status: 'Done' as const, is_completed: true };

    render(
      <TaskItem task={doneTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should show overdue styling for overdue tasks', () => {
    const overdueTask = {
      ...mockTask,
      due_date: '2020-01-01', // Past date
      status: 'To Do' as const,
    };

    const { container } = render(
      <TaskItem task={overdueTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    // Check for overdue styling classes
    expect(container.querySelector('.text-red-600')).toBeInTheDocument();
  });

  it('should not show overdue styling for done tasks', () => {
    const overdueButDoneTask = {
      ...mockTask,
      due_date: '2020-01-01',
      status: 'Done' as const,
      is_completed: true,
    };

    const { container } = render(
      <TaskItem task={overdueButDoneTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('.text-red-600')).not.toBeInTheDocument();
  });

  it('should call onEditClick when edit button is clicked', () => {
    const mockOnEditClick = jest.fn();

    render(
      <TaskItem task={mockTask} userId="user-1" onEditClick={mockOnEditClick} />,
      { wrapper: createWrapper() }
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    expect(mockOnEditClick).toHaveBeenCalledWith('task-1');
  });

  it('should apply dragging styles when isDragging is true', () => {
    const { container } = render(
      <TaskItem task={mockTask} userId="user-1" isDragging={true} />,
      { wrapper: createWrapper() }
    );

    expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
  });

  it('should display assigned user when userMapping is provided', () => {
    const userMapping = {
      'user-1': 'John Doe',
    };

    render(
      <TaskItem
        task={mockTask}
        userId="user-1"
        userMapping={userMapping}
        visibleBuiltInColumns={new Set(['assigned_to'])}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display due date when visibleBuiltInColumns includes due_date', () => {
    const taskWithDueDate = {
      ...mockTask,
      due_date: '2024-12-31',
    };

    render(
      <TaskItem
        task={taskWithDueDate}
        userId="user-1"
        visibleBuiltInColumns={new Set(['due_date'])}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Dec 31/)).toBeInTheDocument();
  });

  it('should handle drag events for calendar', () => {
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

    render(
      <TaskItem task={mockTask} userId="user-1" />,
      { wrapper: createWrapper() }
    );

    const taskElement = screen.getByText('Test Task').closest('div');

    if (taskElement) {
      fireEvent.dragStart(taskElement);

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task-drag-start',
          detail: mockTask,
        })
      );
    }

    dispatchEventSpy.mockRestore();
  });

  it('should render custom property values when provided', () => {
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

    mockedHooks.useTaskPropertyValues.mockReturnValue({
      data: [
        {
          id: 'val-1',
          task_id: 'task-1',
          definition_id: 'prop-1',
          value: 'High',
          created_by: 'user-1',
          updated_by: 'user-1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    } as any);

    render(
      <TaskItem
        task={mockTask}
        userId="user-1"
        customPropertyDefinitions={customPropertyDefinitions}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
