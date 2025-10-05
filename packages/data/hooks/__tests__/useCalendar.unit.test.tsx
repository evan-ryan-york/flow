/**
 * Unit Tests for Calendar Hooks
 * Tests hook behavior with mocked service layer (following testing strategy)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useGoogleCalendarConnections,
  useDisconnectGoogleCalendar,
  useUpdateConnectionLabel,
  useCalendarSubscriptions,
  useToggleCalendarVisibility,
  useCalendarEvents,
} from '../useCalendar';
import * as calendarService from '../../services/calendarService';

// Mock the calendar service layer
jest.mock('../../services/calendarService');

// Mock Supabase (still needed for real-time subscriptions)
jest.mock('../../supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
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

describe('useGoogleCalendarConnections (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return loading state initially', () => {
    (calendarService.getCalendarConnections as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves (stays loading)
    );

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should fetch and return calendar connections', async () => {
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

    (calendarService.getCalendarConnections as jest.Mock).mockResolvedValue(mockConnections);

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockConnections);
    expect(result.current.isLoading).toBe(false);
    expect(calendarService.getCalendarConnections).toHaveBeenCalledTimes(1);
  });

  it('should handle service errors correctly', async () => {
    const mockError = new Error('Service error: Failed to fetch connections');

    (calendarService.getCalendarConnections as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(mockError);
    expect(result.current.data).toBeUndefined();
  });

  it('should return empty array when no connections exist', async () => {
    (calendarService.getCalendarConnections as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useGoogleCalendarConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });
});

describe('useCalendarSubscriptions (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all subscriptions when no connectionId provided', async () => {
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

    (calendarService.getCalendarSubscriptions as jest.Mock).mockResolvedValue(mockSubscriptions);

    const { result } = renderHook(() => useCalendarSubscriptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSubscriptions);
    expect(calendarService.getCalendarSubscriptions).toHaveBeenCalledWith(undefined);
  });

  it('should fetch subscriptions filtered by connectionId', async () => {
    const connectionId = 'conn-1';
    const mockSubscriptions = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        connection_id: connectionId,
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

    (calendarService.getCalendarSubscriptions as jest.Mock).mockResolvedValue(mockSubscriptions);

    const { result } = renderHook(() => useCalendarSubscriptions(connectionId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSubscriptions);
    expect(calendarService.getCalendarSubscriptions).toHaveBeenCalledWith(connectionId);
  });

  it('should handle service errors', async () => {
    (calendarService.getCalendarSubscriptions as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch subscriptions')
    );

    const { result } = renderHook(() => useCalendarSubscriptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useToggleCalendarVisibility (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call service with correct parameters', async () => {
    (calendarService.toggleCalendarVisibility as jest.Mock).mockResolvedValue(undefined);

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
      expect(calendarService.toggleCalendarVisibility).toHaveBeenCalledWith('sub-1', false);
    });
  });

  it('should handle service errors during toggle', async () => {
    const mockError = new Error('Failed to toggle visibility');
    (calendarService.toggleCalendarVisibility as jest.Mock).mockRejectedValue(mockError);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useToggleCalendarVisibility(), {
      wrapper,
    });

    result.current.mutate({
      subscriptionId: 'sub-1',
      isVisible: false,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(mockError);
  });
});

describe('useCalendarEvents (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch events in date range', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    const mockEvents = [
      {
        id: 'event-1',
        connection_id: 'conn-1',
        subscription_id: 'sub-1',
        google_calendar_event_id: 'gcal-event-1',
        google_calendar_id: 'cal-1',
        user_id: 'user-1',
        title: 'Test Event',
        description: 'Test Description',
        start_time: new Date('2025-10-15T10:00:00Z').toISOString(),
        end_time: new Date('2025-10-15T11:00:00Z').toISOString(),
        is_all_day: false,
        location: null,
        color: null,
        last_synced_at: new Date().toISOString(),
        etag: 'etag-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    (calendarService.getCalendarEvents as jest.Mock).mockResolvedValue(mockEvents);

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
    expect(calendarService.getCalendarEvents).toHaveBeenCalledWith({
      startDate,
      endDate,
    });
  });

  it('should pass visibleOnly filter to service', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    (calendarService.getCalendarEvents as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(
      () => useCalendarEvents(startDate, endDate, { visibleOnly: true }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(calendarService.getCalendarEvents).toHaveBeenCalledWith({
      startDate,
      endDate,
      visibleOnly: true,
    });
  });

  it('should handle empty event list', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    (calendarService.getCalendarEvents as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(
      () => useCalendarEvents(startDate, endDate),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should handle service errors', async () => {
    const startDate = new Date('2025-10-01');
    const endDate = new Date('2025-10-31');

    (calendarService.getCalendarEvents as jest.Mock).mockRejectedValue(
      new Error('Failed to fetch events')
    );

    const { result } = renderHook(
      () => useCalendarEvents(startDate, endDate),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});

describe('useDisconnectGoogleCalendar (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call service with connection ID', async () => {
    (calendarService.deleteCalendarConnection as jest.Mock).mockResolvedValue(undefined);

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
      expect(calendarService.deleteCalendarConnection).toHaveBeenCalledWith('conn-1');
    });
  });

  it('should handle deletion errors', async () => {
    const mockError = new Error('Failed to delete connection');
    (calendarService.deleteCalendarConnection as jest.Mock).mockRejectedValue(mockError);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDisconnectGoogleCalendar(), {
      wrapper,
    });

    result.current.mutate('conn-1');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(mockError);
  });
});

describe('useUpdateConnectionLabel (Unit Tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call service with connectionId and new label', async () => {
    const updatedConnection = {
      id: 'conn-1',
      user_id: 'user-1',
      email: 'test@gmail.com',
      label: 'Updated Label',
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: new Date().toISOString(),
      requires_reauth: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (calendarService.updateCalendarConnectionLabel as jest.Mock).mockResolvedValue(updatedConnection);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateConnectionLabel(), {
      wrapper,
    });

    result.current.mutate({
      connectionId: 'conn-1',
      label: 'Updated Label',
    });

    await waitFor(() => {
      expect(calendarService.updateCalendarConnectionLabel).toHaveBeenCalledWith(
        'conn-1',
        'Updated Label'
      );
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle update errors', async () => {
    const mockError = new Error('Failed to update label');
    (calendarService.updateCalendarConnectionLabel as jest.Mock).mockRejectedValue(mockError);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateConnectionLabel(), {
      wrapper,
    });

    result.current.mutate({
      connectionId: 'conn-1',
      label: 'Updated Label',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(mockError);
  });
});
