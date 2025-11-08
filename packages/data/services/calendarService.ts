import { getSupabaseClient } from '../supabase';
import {
  GoogleCalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
  type GoogleCalendarConnection,
  type CalendarSubscription,
  type CalendarEvent,
} from '@perfect-task-app/models';

// ---------------------------------
// Calendar Connections
// ---------------------------------

/**
 * Get all calendar connections for the current user
 */
export async function getCalendarConnections(): Promise<GoogleCalendarConnection[]> {
  console.log('🔍 [CalendarService] getCalendarConnections called');
  const supabase = getSupabaseClient();
  console.log('📊 [CalendarService] About to query google_calendar_connections');

  const { data, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .order('created_at', { ascending: true });

  console.log('📊 [CalendarService] Calendar connections query result:', {
    count: data?.length || 0,
    error: error?.message,
    errorCode: error?.code,
    data: data,
  });

  if (error) throw error;

  const result = data?.map(conn => GoogleCalendarConnectionSchema.parse(conn)) || [];
  console.log('✅ [CalendarService] Returning calendar connections:', { count: result.length });
  return result;
}

/**
 * Get a specific calendar connection by ID
 */
export async function getCalendarConnectionById(
  connectionId: string
): Promise<GoogleCalendarConnection | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? GoogleCalendarConnectionSchema.parse(data) : null;
}

/**
 * Delete a calendar connection (cascades to subscriptions and events)
 */
export async function deleteCalendarConnection(connectionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('google_calendar_connections')
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
): Promise<GoogleCalendarConnection> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('google_calendar_connections')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw error;

  return GoogleCalendarConnectionSchema.parse(data);
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
  console.log('🔍 [CalendarService] getCalendarSubscriptions called', { connectionId });
  const supabase = getSupabaseClient();
  console.log('📊 [CalendarService] About to query calendar_subscriptions');

  let query = supabase
    .from('calendar_subscriptions')
    .select('*')
    .order('calendar_name', { ascending: true });

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query;

  console.log('📊 [CalendarService] Calendar subscriptions query result:', {
    count: data?.length || 0,
    error: error?.message,
    errorCode: error?.code,
    data: data,
  });

  if (error) throw error;

  const result = data?.map(sub => CalendarSubscriptionSchema.parse(sub)) || [];
  console.log('✅ [CalendarService] Returning calendar subscriptions:', { count: result.length });
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

  console.log('🔍 getCalendarEvents called with filters:', {
    startDate: filters.startDate.toISOString(),
    endDate: filters.endDate.toISOString(),
    visibleOnly: filters.visibleOnly,
  });

  // If we need to filter by visibility, we need to join with subscriptions
  if (filters.visibleOnly) {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, calendar_subscriptions!inner(is_visible)')
      .lte('start_time', filters.endDate.toISOString())
      .gte('end_time', filters.startDate.toISOString())
      .eq('calendar_subscriptions.is_visible', true)
      .order('start_time', { ascending: true });

    console.log('🔍 Query result (visibleOnly):', {
      count: data?.length || 0,
      error: error?.message,
      sampleEvent: data?.[0]
    });

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

  console.log('🔍 Query result (all):', {
    count: data?.length || 0,
    error: error?.message,
    sampleEvent: data?.[0]
  });

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
 * Get events by Google Calendar event ID
 */
export async function getCalendarEventByGoogleId(
  googleEventId: string,
  subscriptionId: string
): Promise<CalendarEvent | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('google_calendar_event_id', googleEventId)
    .eq('subscription_id', subscriptionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data ? CalendarEventSchema.parse(data) : null;
}
