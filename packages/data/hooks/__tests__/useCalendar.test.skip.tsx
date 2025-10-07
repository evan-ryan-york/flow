import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useGoogleCalendarConnections,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useUpdateConnectionLabel,
  useCalendarSubscriptions,
  useToggleCalendarVisibility,
  useSyncCalendarList,
  useCalendarEvents,
  useTriggerEventSync,
} from '../useCalendar';
import { supabase } from '../../supabase';

// Mock Supabase
jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}));

// Mock fetch for Edge Functions
global.fetch = jest.fn();

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useGoogleCalendarConnections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch calendar connections', async () => {
    const mockConnections = [
      {
        id: 'conn-1',
        user_id: 'user-1',
        email: 'test@gmail.com',
        label: 'Personal',
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: new Date().toISOString(),
        requires_reauth: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockConnections,
          error: null,
        }),
      }),
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockConnections);
    expect(mockFrom).toHaveBeenCalledWith('google_calendar_connections');
  });

  it('should handle fetch errors', async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCalendarSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all subscriptions', async () => {
    const mockSubscriptions = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        connection_id: 'conn-1',
        google_calendar_id: 'cal-1',
        calendar_name: 'My Calendar',
        calendar_color: '#4285f4',
        background_color: '#4285f4',
        is_visible: true,
        sync_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockSubscriptions,
          error: null,
        }),
      }),
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(() => useCalendarSubscriptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSubscriptions);
  });

  it('should fetch subscriptions filtered by connection', async () => {
    const connectionId = 'conn-1';
    const mockEq = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      }),
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(() => useCalendarSubscriptions(connectionId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockEq).toHaveBeenCalledWith('connection_id', connectionId);
  });
});

describe('useToggleCalendarVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should toggle calendar visibility', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const mockFrom = jest.fn().mockReturnValue({
      update: mockUpdate,
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useToggleCalendarVisibility(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    result.current.mutate({
      subscriptionId: 'sub-1',
      isVisible: false,
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ is_visible: false });
    });
  });
});

describe('useCalendarEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch events in date range', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    const mockEvents = [
      {
        id: 'event-1',
        google_calendar_event_id: 'gcal-event-1',
        subscription_id: 'sub-1',
        title: 'Test Event',
        description: 'Test Description',
        start_time: new Date('2025-10-15T10:00:00Z').toISOString(),
        end_time: new Date('2025-10-15T11:00:00Z').toISOString(),
        is_all_day: false,
        location: null,
        color: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockOrder = jest.fn().mockResolvedValue({
      data: mockEvents,
      error: null,
    });

    const mockLte = jest.fn().mockReturnValue({
      order: mockOrder,
    });

    const mockGte = jest.fn().mockReturnValue({
      lte: mockLte,
    });

    const mockSelect = jest.fn().mockReturnValue({
      gte: mockGte,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(
      () => useCalendarEvents(startDate, endDate),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockEvents);
    expect(mockGte).toHaveBeenCalledWith('start_time', startDate.toISOString());
    expect(mockLte).toHaveBeenCalledWith('end_time', endDate.toISOString());
  });

  it('should filter visible only events', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    const mockEq = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockOrder = jest.fn().mockReturnValue({
      eq: mockEq,
    });

    const mockLte = jest.fn().mockReturnValue({
      order: mockOrder,
    });

    const mockGte = jest.fn().mockReturnValue({
      lte: mockLte,
    });

    const mockSelect = jest.fn().mockReturnValue({
      gte: mockGte,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const { result } = renderHook(
      () => useCalendarEvents(startDate, endDate, { visibleOnly: true }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockEq).toHaveBeenCalledWith('calendar_subscriptions.is_visible', true);
  });
});

describe('useDisconnectGoogleCalendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should disconnect calendar', async () => {
    const mockDelete = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const mockFrom = jest.fn().mockReturnValue({
      delete: mockDelete,
    });

    (supabase.from as jest.Mock).mockImplementation(mockFrom);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDisconnectGoogleCalendar(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    result.current.mutate('conn-1');

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

describe('useTriggerEventSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should trigger event sync', async () => {
    const mockSession = {
      access_token: 'test-token',
    };

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ syncedCount: 5 }),
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTriggerEventSync(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    result.current.mutate(undefined);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
