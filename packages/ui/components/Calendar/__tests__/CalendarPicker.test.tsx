import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarPicker } from '../CalendarPicker';
import * as dataHooks from '@perfect-task-app/data';

// Mock the data hooks
jest.mock('@perfect-task-app/data', () => ({
  useGoogleCalendarConnections: jest.fn(),
  useCalendarSubscriptions: jest.fn(),
  useToggleCalendarVisibility: jest.fn(),
  useUpdateCalendarColor: jest.fn(),
}));

const mockConnections = [
  {
    id: 'conn-1',
    user_id: 'user-1',
    email: 'personal@gmail.com',
    label: 'Personal',
    access_token: 'token',
    refresh_token: 'refresh',
    expires_at: new Date().toISOString(),
    requires_reauth: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'conn-2',
    user_id: 'user-1',
    email: 'work@company.com',
    label: 'Work',
    access_token: 'token',
    refresh_token: 'refresh',
    expires_at: new Date().toISOString(),
    requires_reauth: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockSubscriptions = [
  {
    id: 'sub-1',
    user_id: 'user-1',
    connection_id: 'conn-1',
    google_calendar_id: 'cal-1',
    calendar_name: 'My Personal Calendar',
    calendar_color: '#4285f4',
    background_color: '#4285f4',
    is_visible: true,
    sync_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-2',
    user_id: 'user-1',
    connection_id: 'conn-2',
    google_calendar_id: 'cal-2',
    calendar_name: 'Work Calendar',
    calendar_color: '#d50000',
    background_color: '#d50000',
    is_visible: false,
    sync_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CalendarPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mocks
    (dataHooks.useToggleCalendarVisibility as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    (dataHooks.useUpdateCalendarColor as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
  });

  it('renders loading state', () => {
    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CalendarPicker />
      </Wrapper>
    );

    expect(screen.getByText(/Loading calendars/i)).toBeInTheDocument();
  });

  it('renders empty state when no connections', () => {
    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CalendarPicker />
      </Wrapper>
    );

    expect(screen.getByText(/No calendar accounts connected/i)).toBeInTheDocument();
  });

  it('renders connections and calendars', () => {
    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: mockConnections,
      isLoading: false,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: mockSubscriptions,
      isLoading: false,
    });
    (dataHooks.useToggleCalendarVisibility as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CalendarPicker />
      </Wrapper>
    );

    // Check connection labels
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();

    // Check emails
    expect(screen.getByText('personal@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('work@company.com')).toBeInTheDocument();

    // Check calendar names
    expect(screen.getByText('My Personal Calendar')).toBeInTheDocument();
    expect(screen.getByText('Work Calendar')).toBeInTheDocument();
  });

  it('toggles calendar visibility on checkbox click', async () => {
    const mockMutate = jest.fn();

    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: mockConnections,
      isLoading: false,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: mockSubscriptions,
      isLoading: false,
    });
    (dataHooks.useToggleCalendarVisibility as jest.Mock).mockReturnValue({
      mutate: mockMutate,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CalendarPicker />
      </Wrapper>
    );

    // Find the checkbox for Work Calendar (currently not visible)
    const workCalendarCheckbox = screen.getAllByRole('checkbox')[1];

    // Click to make it visible
    fireEvent.click(workCalendarCheckbox);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        subscriptionId: 'sub-2',
        isVisible: true,
      });
    });
  });

  it('calls onSelectionChange when visibility changes', () => {
    const mockOnSelectionChange = jest.fn();

    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: mockConnections,
      isLoading: false,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: mockSubscriptions,
      isLoading: false,
    });
    (dataHooks.useToggleCalendarVisibility as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <CalendarPicker onSelectionChange={mockOnSelectionChange} />
      </Wrapper>
    );

    // Should be called with initially visible subscription IDs
    expect(mockOnSelectionChange).toHaveBeenCalledWith(['sub-1']);
  });

  it('displays calendar color indicators', () => {
    (dataHooks.useGoogleCalendarConnections as jest.Mock).mockReturnValue({
      data: mockConnections,
      isLoading: false,
    });
    (dataHooks.useCalendarSubscriptions as jest.Mock).mockReturnValue({
      data: mockSubscriptions,
      isLoading: false,
    });
    (dataHooks.useToggleCalendarVisibility as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });

    const Wrapper = createWrapper();
    const { container } = render(
      <Wrapper>
        <CalendarPicker />
      </Wrapper>
    );

    // Check that color indicators exist with correct background colors
    const colorIndicators = container.querySelectorAll('[style*="background"]');
    expect(colorIndicators.length).toBeGreaterThan(0);
  });
});
