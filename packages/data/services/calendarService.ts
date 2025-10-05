import { supabase as supabaseClient } from '../supabase';
import {
  GoogleCalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
  type GoogleCalendarConnection,
  type CalendarSubscription,
  type CalendarEvent,
} from '@perfect-task-app/models';

// Ensure supabase client is initialized
if (!supabaseClient) {
  throw new Error('Supabase client not initialized');
}
const supabase = supabaseClient;

// ---------------------------------
// Calendar Connections
// ---------------------------------

/**
 * Get all calendar connections for the current user
 */
export async function getCalendarConnections(): Promise<GoogleCalendarConnection[]> {
  const { data, error } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data?.map(conn => GoogleCalendarConnectionSchema.parse(conn)) || [];
}

/**
 * Get a specific calendar connection by ID
 */
export async function getCalendarConnectionById(
  connectionId: string
): Promise<GoogleCalendarConnection | null> {
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
  let query = supabase
    .from('calendar_subscriptions')
    .select('*')
    .order('calendar_name', { ascending: true });

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data?.map(sub => CalendarSubscriptionSchema.parse(sub)) || [];
}

/**
 * Get a specific calendar subscription by ID
 */
export async function getCalendarSubscriptionById(
  subscriptionId: string
): Promise<CalendarSubscription | null> {
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
  let query = supabase
    .from('calendar_events')
    .select('*')
    .gte('start_time', filters.startDate.toISOString())
    .lte('end_time', filters.endDate.toISOString())
    .order('start_time', { ascending: true });

  if (filters.visibleOnly) {
    query = query.eq('calendar_subscriptions.is_visible', true);
  }

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
