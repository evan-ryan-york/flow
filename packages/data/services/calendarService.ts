import { getSupabaseClient } from '../supabase';
import {
  CalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
  type CalendarConnection,
  type CalendarSubscription,
  type CalendarEvent,
  type CalendarProvider,
} from '@flow-app/models';

// Re-export for backwards compatibility
export type GoogleCalendarConnection = CalendarConnection;

// ---------------------------------
// Calendar Connections
// ---------------------------------

export interface CalendarConnectionFilter {
  provider?: CalendarProvider;
}

/**
 * Get all calendar connections for the current user
 */
export async function getCalendarConnections(
  filter?: CalendarConnectionFilter
): Promise<CalendarConnection[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('calendar_connections')
    .select('*')
    .order('created_at', { ascending: true });

  if (filter?.provider) {
    query = query.eq('provider', filter.provider);
  }

  const { data, error } = await query;

  if (error) throw error;

  const result = data?.map(conn => CalendarConnectionSchema.parse(conn)) || [];
  return result;
}

/**
 * Get a specific calendar connection by ID
 */
export async function getCalendarConnectionById(
  connectionId: string
): Promise<CalendarConnection | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? CalendarConnectionSchema.parse(data) : null;
}

/**
 * Delete a calendar connection (cascades to subscriptions and events)
 */
export async function deleteCalendarConnection(connectionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
}

/**
 * Update calendar connection label
 */
export async function updateCalendarConnectionLabel(
  connectionId: string,
  label: string
): Promise<CalendarConnection> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_connections')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw error;

  return CalendarConnectionSchema.parse(data);
}

// ---------------------------------
// Calendar Subscriptions
// ---------------------------------

/**
 * Get all calendar subscriptions for the current user
 */
export async function getCalendarSubscriptions(
  connectionId?: string
): Promise<CalendarSubscription[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('calendar_subscriptions')
    .select('*')
    .order('calendar_name', { ascending: true });

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const result = data?.map(sub => CalendarSubscriptionSchema.parse(sub)) || [];
  return result;
}

/**
 * Get a specific calendar subscription by ID
 */
export async function getCalendarSubscriptionById(
  subscriptionId: string
): Promise<CalendarSubscription | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? CalendarSubscriptionSchema.parse(data) : null;
}

/**
 * Toggle calendar subscription visibility
 */
export async function toggleCalendarVisibility(
  subscriptionId: string,
  isVisible: boolean
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('calendar_subscriptions')
    .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) throw error;
}

/**
 * Update calendar subscription color
 */
export async function updateCalendarColor(
  subscriptionId: string,
  color: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('calendar_subscriptions')
    .update({ background_color: color, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) throw error;
}

// ---------------------------------
// Calendar Events
// ---------------------------------

export interface CalendarEventFilters {
  startDate: Date;
  endDate: Date;
  visibleOnly?: boolean;
  connectionId?: string;
  subscriptionId?: string;
}

/**
 * Get calendar events within a date range
 */
export async function getCalendarEvents(
  filters: CalendarEventFilters
): Promise<CalendarEvent[]> {
  const supabase = getSupabaseClient();

  // If we need to filter by visibility, we need to join with subscriptions
  if (filters.visibleOnly) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, calendar_subscriptions!inner(is_visible)')
      .lte('start_time', filters.endDate.toISOString())
      .gte('end_time', filters.startDate.toISOString())
      .eq('calendar_subscriptions.is_visible', true)
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Map to remove the joined subscription data
    return data?.map(row => {
      const { calendar_subscriptions: _calendar_subscriptions, ...event } = row as { calendar_subscriptions?: unknown; [key: string]: unknown };
      return CalendarEventSchema.parse(event);
    }) || [];
  }

  // Otherwise, simple query without join
  let query = supabase
    .from('calendar_events')
    .select('*')
    .lt('start_time', filters.endDate.toISOString())
    .gt('end_time', filters.startDate.toISOString())
    .order('start_time', { ascending: true });

  if (filters.connectionId) {
    query = query.eq('connection_id', filters.connectionId);
  }

  if (filters.subscriptionId) {
    query = query.eq('subscription_id', filters.subscriptionId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data?.map(event => CalendarEventSchema.parse(event)) || [];
}

/**
 * Get a specific calendar event by ID
 */
export async function getCalendarEventById(
  eventId: string
): Promise<CalendarEvent | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? CalendarEventSchema.parse(data) : null;
}

/**
 * Get events by provider event ID
 */
export async function getCalendarEventByProviderId(
  providerEventId: string,
  subscriptionId: string
): Promise<CalendarEvent | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('provider_event_id', providerEventId)
    .eq('subscription_id', subscriptionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? CalendarEventSchema.parse(data) : null;
}

// Backwards compatibility alias
export const getCalendarEventByGoogleId = getCalendarEventByProviderId;
