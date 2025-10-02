import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../supabase';
import {
  GoogleCalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
  type GoogleCalendarConnection,
  type CalendarSubscription,
  type CalendarEvent,
} from '@perfect-task-app/models';

// Query key factory for consistent caching
const CALENDAR_KEYS = {
  connections: ['calendar-connections'] as const,
  subscriptions: {
    all: ['calendar-subscriptions'] as const,
    byConnection: (connectionId?: string) =>
      ['calendar-subscriptions', connectionId] as const,
  },
  events: {
    all: ['calendar-events'] as const,
    byDateRange: (startDate: string, endDate: string, visibleOnly?: boolean) =>
      ['calendar-events', startDate, endDate, visibleOnly] as const,
  },
};

// Helper to get Supabase Functions URL
const getSupabaseFunctionsUrl = () => {
  const supabaseUrl =
    (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_URL) ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';

  if (!supabaseUrl) throw new Error('Supabase URL not configured');
  return `${supabaseUrl}/functions/v1`;
};

// Helper to get current user session token
const getSessionToken = async () => {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No active session');
  return session.access_token;
};

// ---------------------------------
// Connection Management Hooks
// ---------------------------------

/**
 * Query: Fetch all Google Calendar connections for current user
 */
export function useGoogleCalendarConnections() {
  return useQuery({
    queryKey: CALENDAR_KEYS.connections,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');

      console.log('🔍 Fetching google_calendar_connections...');
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .order('created_at', { ascending: true });

      console.log('🔍 Raw data:', data);
      console.log('🔍 Error:', error);

      if (error) throw error;

      try {
        const parsed = data?.map(conn => {
          console.log('🔍 Parsing connection:', conn);
          return GoogleCalendarConnectionSchema.parse(conn);
        }) || [];
        console.log('🔍 Parsed connections:', parsed);
        return parsed;
      } catch (parseError) {
        console.error('❌ Zod parsing error:', parseError);
        throw parseError;
      }
    },
  });
}

/**
 * Mutation: Initiate OAuth flow to connect a new Google Calendar account
 */
export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async (label?: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      console.log('🔑 Session token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
      console.log('🌐 Functions URL:', SUPABASE_FUNCTIONS_URL);

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-oauth?action=initiate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth flow');
      }

      const { authUrl } = await response.json();

      // Store label in localStorage for callback handler
      if (label && typeof window !== 'undefined') {
        localStorage.setItem('pending_calendar_label', label);
      }

      // Open OAuth in a popup window
      if (typeof window !== 'undefined') {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          'google-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // Listen for the OAuth success message from the popup
        return new Promise((resolve, reject) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'oauth-success') {
              window.removeEventListener('message', handleMessage);
              resolve(event.data.connectionId);
            } else if (event.data?.type === 'oauth-error') {
              window.removeEventListener('message', handleMessage);
              reject(new Error(event.data.error));
            }
          };

          window.addEventListener('message', handleMessage);

          // Check if popup was blocked
          if (!popup || popup.closed) {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Popup was blocked. Please allow popups for this site.'));
          }

          // Monitor popup closure
          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              // Don't reject here - the message might have been sent
            }
          }, 500);
        });
      }
    },
  });
}

/**
 * Mutation: Disconnect (delete) a Google Calendar connection
 */
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.connections });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
    },
  });
}

/**
 * Mutation: Update the label for a Google Calendar connection
 */
export function useUpdateConnectionLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, label }: { connectionId: string; label: string }) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ label })
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.connections });
    },
  });
}

// ---------------------------------
// Subscription Management Hooks
// ---------------------------------

/**
 * Query: Fetch calendar subscriptions (optionally filtered by connection)
 */
export function useCalendarSubscriptions(connectionId?: string) {
  return useQuery({
    queryKey: CALENDAR_KEYS.subscriptions.byConnection(connectionId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');

      console.log('🔍 Fetching subscriptions for connectionId:', connectionId);
      let query = supabase
        .from('calendar_subscriptions')
        .select('*')
        .order('calendar_name');

      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }

      const { data, error } = await query;
      console.log('🔍 Subscriptions data:', data);
      console.log('🔍 Subscriptions error:', error);

      if (error) throw error;

      return data?.map(sub => CalendarSubscriptionSchema.parse(sub)) || [];
    },
  });
}

/**
 * Mutation: Toggle calendar visibility with optimistic updates
 */
export function useToggleCalendarVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, isVisible }: { subscriptionId: string; isVisible: boolean }) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error } = await supabase
        .from('calendar_subscriptions')
        .update({ is_visible: isVisible })
        .eq('id', subscriptionId);

      if (error) throw error;
    },
    onMutate: async ({ subscriptionId, isVisible }) => {
      // Cancel outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: CALENDAR_KEYS.subscriptions.all });

      // Snapshot the previous value
      const previousSubscriptions = queryClient.getQueryData(CALENDAR_KEYS.subscriptions.all);

      // Optimistically update all subscription queries
      queryClient.setQueriesData(
        { queryKey: CALENDAR_KEYS.subscriptions.all },
        (old: CalendarSubscription[] | undefined) => {
          if (!old) return old;
          return old.map(sub =>
            sub.id === subscriptionId ? { ...sub, is_visible: isVisible } : sub
          );
        }
      );

      // Return context with previous data for rollback
      return { previousSubscriptions };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSubscriptions) {
        queryClient.setQueryData(
          CALENDAR_KEYS.subscriptions.all,
          context.previousSubscriptions
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.subscriptions.all });
    },
  });
}

/**
 * Mutation: Trigger calendar list sync from Google
 */
export function useSyncCalendarList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      console.log('🔍 Sync Calendar List Debug:', {
        url: `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-calendars`,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) : 'NONE',
        connectionId,
      });

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-calendars`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      );

      console.log('🔍 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 Error response:', errorText);
        throw new Error('Calendar list sync failed');
      }

      const result = await response.json();

      // After syncing calendar list, trigger event sync
      const eventSyncResponse = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      );

      if (!eventSyncResponse.ok) {
        console.error('Event sync failed after calendar list sync');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
    },
  });
}

// ---------------------------------
// Event Query Hooks
// ---------------------------------

/**
 * Query: Fetch calendar events in date range
 */
export function useCalendarEvents(
  startDate: Date,
  endDate: Date,
  options?: { visibleOnly?: boolean }
) {
  return useQuery({
    queryKey: CALENDAR_KEYS.events.byDateRange(
      startDate.toISOString(),
      endDate.toISOString(),
      options?.visibleOnly
    ),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client not initialized');

      let query = supabase
        .from('calendar_events')
        .select('*, calendar_subscriptions!inner(*)')
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time');

      // Filter to only visible calendars if requested
      if (options?.visibleOnly) {
        query = query.eq('calendar_subscriptions.is_visible', true);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse and extract just the event data (remove the joined subscription data)
      return data?.map(event => {
        const { calendar_subscriptions, ...eventData } = event as any;
        return CalendarEventSchema.parse(eventData);
      }) || [];
    },
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
  });
}

/**
 * Mutation: Manually trigger event sync from Google
 */
export function useTriggerEventSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId?: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(connectionId ? { connectionId } : {}),
        }
      );

      if (!response.ok) {
        throw new Error('Event sync failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
    },
  });
}

/**
 * Real-time subscription: Listen to calendar events changes
 * Automatically invalidates queries when events are updated
 */
export function useCalendarEventsRealtime(startDate: Date, endDate: Date) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;

    const subscription = supabase
      .channel('calendar_events_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
        },
        (payload) => {
          // Invalidate event queries when changes occur
          queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [startDate, endDate, queryClient]);
}
