import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Dynamic import to handle Next.js client components
const TaskFiltersBar = require('../../components/TaskFiltersBar').TaskFiltersBar;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.NodeNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('TaskFiltersBar', () => {
  const mockOnSearchChange = jest.fn();
  const mockOnFilterChange = jest.fn();
  const mockOnGroupByChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search input', () => {
    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should call onSearchChange when typing in search box', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    await user.type(searchInput, 'test');

    await waitFor(() => {
      expect(mockOnSearchChange).toHaveBeenCalled();
    });
  });

  it('should debounce search input', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    await user.type(searchInput, 'test');

    // Should not call immediately
    expect(mockOnSearchChange).not.toHaveBeenCalled();

    // Should call after debounce delay (300ms)
    await waitFor(() => {
      expect(mockOnSearchChange).toHaveBeenCalled();
    }, { timeout: 500 });
  });

  it('should display status filter dropdown', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const statusButton = screen.getByText(/Status/i);
    await user.click(statusButton);

    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('should call onFilterChange when status filter is selected', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const statusButton = screen.getByText(/Status/i);
    await user.click(statusButton);

    await waitFor(() => {
      const todoOption = screen.getByText('To Do');
      expect(todoOption).toBeInTheDocument();
    });

    const todoOption = screen.getByText('To Do');
    await user.click(todoOption);

    expect(mockOnFilterChange).toHaveBeenCalledWith('status', ['To Do']);
  });

  it('should display active filter count', () => {
    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: ['To Do', 'In Progress'], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Badge showing filter count
  });

  it('should display group by dropdown', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const groupByButton = screen.getByText(/Group by/i);
    await user.click(groupByButton);

    await waitFor(() => {
      expect(screen.getByText(/Project/i)).toBeInTheDocument();
      expect(screen.getByText(/Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Assignee/i)).toBeInTheDocument();
    });
  });

  it('should call onGroupByChange when grouping option is selected', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
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

    expect(mockOnGroupByChange).toHaveBeenCalledWith('project');
  });

  it('should show clear filters button when filters are active', () => {
    render(
      <TaskFiltersBar
        searchQuery="test"
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: ['To Do'], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const clearButton = screen.getByText(/Clear/i);
    expect(clearButton).toBeInTheDocument();
  });

  it('should clear all filters when clear button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery="test"
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: ['To Do'], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const clearButton = screen.getByText(/Clear/i);
    await user.click(clearButton);

    expect(mockOnSearchChange).toHaveBeenCalledWith('');
    expect(mockOnFilterChange).toHaveBeenCalledWith('status', []);
  });

  it('should show search icon', () => {
    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    // Search icon should be visible (iconoir-react Search icon)
    const searchIcon = screen.getByTestId('search-icon') || document.querySelector('svg');
    expect(searchIcon).toBeInTheDocument();
  });

  it('should support keyboard navigation in search', async () => {
    const user = userEvent.setup();

    render(
      <TaskFiltersBar
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedFilters={{ status: [], assignee: [], dueDate: [] }}
        onFilterChange={mockOnFilterChange}
        groupBy={null}
        onGroupByChange={mockOnGroupByChange}
      />,
      { wrapper: createWrapper() }
    );

    const searchInput = screen.getByPlaceholderText(/Search tasks/i);
    await user.click(searchInput);
    await user.keyboard('test{Escape}');

    expect(document.activeElement).not.toBe(searchInput);
  });
});
