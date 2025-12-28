import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '../supabase';
import {
  type CalendarSubscription,
  type CalendarProvider,
} from '@flow-app/models';
import {
  getCalendarConnections,
  deleteCalendarConnection,
  updateCalendarConnectionLabel,
  getCalendarSubscriptions,
  toggleCalendarVisibility,
  updateCalendarColor,
  getCalendarEvents,
} from '../services/calendarService';

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
// NOTE: In Capacitor, getSession() hangs, so we read from storage directly
const getSessionToken = async () => {
  // Detect if we're in Capacitor
  const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

  if (isCapacitor) {
    // Read session directly from Capacitor Preferences
    const { Preferences } = await import('@capacitor/preferences');
    const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';
    const { value } = await Preferences.get({ key: storageKey });

    if (!value) throw new Error('No active session');

    const session = JSON.parse(value);
    const accessToken = session.access_token;

    if (!accessToken) throw new Error('No access token in session');
    return accessToken;
  } else {
    // For web/desktop, getSession() works fine
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No active session');
    return session.access_token;
  }
};

// ---------------------------------
// Connection Management Hooks
// ---------------------------------

/**
 * Query: Fetch all calendar connections for current user
 * Optionally filter by provider
 */
export function useCalendarConnections(provider?: CalendarProvider) {
  return useQuery({
    queryKey: provider ? [...CALENDAR_KEYS.connections, provider] : CALENDAR_KEYS.connections,
    queryFn: () => getCalendarConnections(provider ? { provider } : undefined),
  });
}

// Backwards compatibility alias
export const useGoogleCalendarConnections = () => useCalendarConnections();

/**
 * Mutation: Initiate OAuth flow to connect a new Google Calendar account
 */
export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async (label?: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      const _supabase = getSupabaseClient();
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-oauth?action=initiate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth flow');
      }

      const { authUrl } = await response.json();

      // Store label in localStorage for callback handler
      // eslint-disable-next-line no-undef
      if (label && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage) {
        // eslint-disable-next-line no-undef
        localStorage.setItem('pending_calendar_label', label);
      }

      // Open OAuth in a popup window
      if (typeof window !== 'undefined') {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const _popup = window.open(
          authUrl,
          'google-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // Listen for the OAuth success message from the popup
        return new Promise((resolve, reject) => {
          const handleMessage = (event: { data?: { type?: string; connectionId?: string; error?: string } }) => {
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
          if (!_popup || _popup.closed) {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Popup was blocked. Please allow popups for this site.'));
          }

          // Monitor popup closure
          const checkClosed = setInterval(() => {
            if (_popup?.closed) {
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
 * Mutation: Initiate OAuth flow to connect a new Microsoft Calendar account
 */
export function useConnectMicrosoftCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label?: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/microsoft-calendar-oauth?action=initiate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to initiate Microsoft OAuth flow');
      }

      const { authUrl } = await response.json();

      // Store label in localStorage for callback handler
      // eslint-disable-next-line no-undef
      if (label && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage) {
        // eslint-disable-next-line no-undef
        localStorage.setItem('pending_calendar_label', label);
      }

      // Open OAuth in a popup window
      if (typeof window !== 'undefined') {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const _popup = window.open(
          authUrl,
          'microsoft-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // Listen for the OAuth success message from the popup
        return new Promise((resolve, reject) => {
          const handleMessage = (event: { data?: { type?: string; success?: boolean; connectionId?: string; error?: string } }) => {
            if (event.data?.type === 'microsoft-calendar-oauth') {
              window.removeEventListener('message', handleMessage);
              if (event.data.success) {
                resolve(event.data.connectionId);
              } else {
                reject(new Error(event.data.error || 'Microsoft OAuth failed'));
              }
            }
          };

          window.addEventListener('message', handleMessage);

          // Check if popup was blocked
          if (!_popup || _popup.closed) {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Popup was blocked. Please allow popups for this site.'));
          }

          // Monitor popup closure
          const checkClosed = setInterval(() => {
            if (_popup?.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
              // Don't reject here - the message might have been sent
            }
          }, 500);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.connections });
    },
  });
}

/**
 * Mutation: Disconnect (delete) a Google Calendar connection
 */
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCalendarConnection,
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
      await updateCalendarConnectionLabel(connectionId, label);
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
      return getCalendarSubscriptions(connectionId);
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
      await toggleCalendarVisibility(subscriptionId, isVisible);
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
 * Mutation: Update calendar subscription color
 */
export function useUpdateCalendarColor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, color }: { subscriptionId: string; color: string }) => {
      await updateCalendarColor(subscriptionId, color);
    },
    onMutate: async ({ subscriptionId, color }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: CALENDAR_KEYS.subscriptions.all });

      // Snapshot the previous value
      const previousSubscriptions = queryClient.getQueryData(CALENDAR_KEYS.subscriptions.all);

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: CALENDAR_KEYS.subscriptions.all },
        (old: CalendarSubscription[] | undefined) => {
          if (!old) return old;
          return old.map(sub =>
            sub.id === subscriptionId ? { ...sub, background_color: color } : sub
          );
        }
      );

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
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
    },
  });
}

/**
 * Mutation: Trigger calendar list sync (supports both Google and Microsoft)
 */
export function useSyncCalendarList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, provider }: { connectionId: string; provider: CalendarProvider }) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      // Select the correct endpoint based on provider
      const syncCalendarsEndpoint = provider === 'microsoft'
        ? 'microsoft-calendar-sync-calendars'
        : 'google-calendar-sync-calendars';

      const syncEventsEndpoint = provider === 'microsoft'
        ? 'microsoft-calendar-sync-events'
        : 'google-calendar-sync-events';

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/${syncCalendarsEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 Error response:', errorText);
        throw new Error('Calendar list sync failed');
      }

      const result = await response.json();

      // After syncing calendar list, trigger event sync
      const eventSyncResponse = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/${syncEventsEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
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
      const events = await getCalendarEvents({
        startDate,
        endDate,
        visibleOnly: options?.visibleOnly,
      });
      return events;
    },
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
  });
}

/**
 * Mutation: Manually trigger event sync (supports both Google and Microsoft)
 */
export function useTriggerEventSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { connectionId?: string; provider?: CalendarProvider }) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();

      // eslint-disable-next-line no-undef
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort('Request timeout after 2 minutes'), 120000) : null; // 2 minute timeout

      try {
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        // Determine which endpoint(s) to call
        const providers = params?.provider ? [params.provider] : ['google', 'microsoft'] as CalendarProvider[];
        const results: { provider: CalendarProvider; error?: string; message?: string }[] = [];

        for (const provider of providers) {
          const endpoint = provider === 'microsoft'
            ? 'microsoft-calendar-sync-events'
            : 'google-calendar-sync-events';

          const response = await fetch(
            `${SUPABASE_FUNCTIONS_URL}/${endpoint}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseAnonKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(params?.connectionId ? { connectionId: params.connectionId } : {}),
              signal: controller?.signal,
            }
          );

          if (response.ok) {
            const result = await response.json();
            results.push({ provider, ...result });
          } else {
            const errorText = await response.text();
            console.error(`🔄 Event sync failed for ${provider}:`, errorText);
            results.push({ provider, error: errorText });
          }
        }

        if (timeoutId) clearTimeout(timeoutId);

        return results;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('🔄 Event sync error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.events.all });
    },
    onError: (error) => {
      console.error('🔄 Event sync mutation error:', error);
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
    const supabase = getSupabaseClient();

    const subscription = supabase
      .channel('calendar_events_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
        },
        (_payload) => {
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
