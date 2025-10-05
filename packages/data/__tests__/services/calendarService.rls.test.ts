/**
 * Row-Level Security (RLS) Tests for Calendar Service
 *
 * These tests verify that RLS policies correctly prevent unauthorized access
 * to calendar data (connections, subscriptions, events) across different users.
 */

import {
  GoogleCalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
} from '@perfect-task-app/models';
import {
  createTestUsers,
  globalCleanup,
} from '../helpers/supabaseTestClient';

// Test users
let userA: any;
let userB: any;

// Test data
let connectionA: any;
let connectionB: any;
let subscriptionA: any;
let subscriptionB: any;
let eventA: any;
let eventB: any;

describe('Calendar Service RLS Security Tests', () => {
  beforeAll(async () => {
    // Create test users with separate auth clients
    const users = await createTestUsers(2);
    userA = users[0];
    userB = users[1];
  }, 30000);

  beforeEach(async () => {
    // Create connection for User A using their authenticated client
    const { data: connA, error: connAError } = await userA.client
      .from('google_calendar_connections')
      .insert({
        email: 'usera@gmail.com',
        label: 'User A Personal',
        access_token: 'token-a',
        refresh_token: 'refresh-a',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select()
      .single();

    if (connAError) throw new Error(`Failed to create connection A: ${connAError.message}`);
    connectionA = connA;

    // Create subscription for User A
    const { data: subA } = await userA.client
      .from('calendar_subscriptions')
      .insert({
        connection_id: connectionA.id,
        google_calendar_id: 'calendar-a@group.calendar.google.com',
        calendar_name: 'User A Calendar',
        calendar_color: '#4285f4',
        background_color: '#4285f4',
        is_visible: true,
        sync_enabled: true,
      })
      .select()
      .single();
    subscriptionA = subA;

    // Create event for User A
    const { data: evtA } = await userA.client
      .from('calendar_events')
      .insert({
        connection_id: connectionA.id,
        subscription_id: subscriptionA.id,
        google_calendar_event_id: 'google-event-a-123',
        google_calendar_id: 'calendar-a@group.calendar.google.com',
        title: 'User A Meeting',
        description: 'Important meeting',
        start_time: new Date('2025-10-15T10:00:00Z').toISOString(),
        end_time: new Date('2025-10-15T11:00:00Z').toISOString(),
        is_all_day: false,
        location: 'Office A',
        color: null,
        last_synced_at: new Date().toISOString(),
        etag: 'etag-a',
      })
      .select()
      .single();
    eventA = evtA;

    // Create connection for User B
    const { data: connB } = await userB.client
      .from('google_calendar_connections')
      .insert({
        email: 'userb@gmail.com',
        label: 'User B Work',
        access_token: 'token-b',
        refresh_token: 'refresh-b',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select()
      .single();
    connectionB = connB;

    // Create subscription for User B
    const { data: subB } = await userB.client
      .from('calendar_subscriptions')
      .insert({
        connection_id: connectionB.id,
        google_calendar_id: 'calendar-b@group.calendar.google.com',
        calendar_name: 'User B Calendar',
        calendar_color: '#d50000',
        background_color: '#d50000',
        is_visible: true,
        sync_enabled: true,
      })
      .select()
      .single();
    subscriptionB = subB;

    // Create event for User B
    const { data: evtB } = await userB.client
      .from('calendar_events')
      .insert({
        connection_id: connectionB.id,
        subscription_id: subscriptionB.id,
        google_calendar_event_id: 'google-event-b-456',
        google_calendar_id: 'calendar-b@group.calendar.google.com',
        title: 'User B Meeting',
        description: 'Team standup',
        start_time: new Date('2025-10-15T14:00:00Z').toISOString(),
        end_time: new Date('2025-10-15T15:00:00Z').toISOString(),
        is_all_day: false,
        location: 'Office B',
        color: null,
        last_synced_at: new Date().toISOString(),
        etag: 'etag-b',
      })
      .select()
      .single();
    eventB = evtB;
  });

  afterEach(async () => {
    // Clean up test data
    if (connectionA) {
      await userA.client
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionA.id);
    }

    if (connectionB) {
      await userB.client
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionB.id);
    }
  });

  afterAll(async () => {
    // Global cleanup
    await globalCleanup();
  }, 30000);

  // ---------------------------------
  // Calendar Connections RLS Tests
  // ---------------------------------

  describe('Calendar Connections RLS', () => {
    it('should only return connections for the authenticated user', async () => {
      // User A queries their connections
      const { data: connections, error } = await userA.client
        .from('google_calendar_connections')
        .select('*')
        .order('created_at', { ascending: true });

      expect(error).toBeNull();
      expect(connections).toHaveLength(1);
      expect(connections[0].id).toBe(connectionA.id);
      expect(connections[0].email).toBe('usera@gmail.com');
      expect(connections[0].user_id).toBe(userA.user.id);

      // Verify Zod validation
      connections.forEach(conn => {
        expect(() => GoogleCalendarConnectionSchema.parse(conn)).not.toThrow();
      });
    });

    it('should not allow User A to see User B connections', async () => {
      // User A queries - should NOT see User B's connection
      const { data: connections } = await userA.client
        .from('google_calendar_connections')
        .select('*');

      const userBConnection = connections?.find(conn => conn.id === connectionB.id);
      expect(userBConnection).toBeUndefined();
    });

    it('should not allow User A to fetch User B connection by ID', async () => {
      // User A tries to fetch User B's connection by ID
      const { data: connection, error } = await userA.client
        .from('google_calendar_connections')
        .select('*')
        .eq('id', connectionB.id)
        .single();

      // Should return error or no data due to RLS
      expect(connection).toBeNull();
    });

    it('should not allow User A to update User B connection label', async () => {
      // User A tries to update User B's connection
      const { error } = await userA.client
        .from('google_calendar_connections')
        .update({ label: 'Hacked Label' })
        .eq('id', connectionB.id);

      expect(error).not.toBeNull(); // RLS should prevent this

      // Verify User B's connection label is unchanged
      const { data: connection } = await userB.client
        .from('google_calendar_connections')
        .select('*')
        .eq('id', connectionB.id)
        .single();

      expect(connection?.label).toBe('User B Work');
    });

    it('should not allow User A to delete User B connection', async () => {
      // User A tries to delete User B's connection
      const { error } = await userB.client
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionB.id);

      // Verify User B's connection still exists
      const { data: connection } = await userB.client
        .from('google_calendar_connections')
        .select('*')
        .eq('id', connectionB.id)
        .single();

      expect(connection).not.toBeNull();
      expect(connection?.id).toBe(connectionB.id);
    });

    it('should allow user to update their own connection label', async () => {
      const { data: updated, error } = await userA.client
        .from('google_calendar_connections')
        .update({ label: 'Updated Personal' })
        .eq('id', connectionA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated.label).toBe('Updated Personal');
      expect(updated.id).toBe(connectionA.id);
    });

    it('should allow user to delete their own connection', async () => {
      const { error: deleteError } = await userA.client
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionA.id);

      expect(deleteError).toBeNull();

      const { data: connection } = await userA.client
        .from('google_calendar_connections')
        .select('*')
        .eq('id', connectionA.id)
        .single();

      expect(connection).toBeNull();

      // Mark as deleted to prevent cleanup errors
      connectionA = null;
    });
  });

  // ---------------------------------
  // Calendar Subscriptions RLS Tests
  // ---------------------------------

  describe('Calendar Subscriptions RLS', () => {
    it('should only return subscriptions for user-owned connections', async () => {
      const { data: subscriptions, error } = await userA.client
        .from('calendar_subscriptions')
        .select('*')
        .order('calendar_name', { ascending: true });

      expect(error).toBeNull();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].id).toBe(subscriptionA.id);
      expect(subscriptions[0].connection_id).toBe(connectionA.id);
      expect(subscriptions[0].user_id).toBe(userA.user.id);

      // Verify Zod validation
      subscriptions.forEach(sub => {
        expect(() => CalendarSubscriptionSchema.parse(sub)).not.toThrow();
      });
    });

    it('should not allow User A to see User B subscriptions', async () => {
      const { data: subscriptions } = await userA.client
        .from('calendar_subscriptions')
        .select('*');

      const userBSub = subscriptions?.find(sub => sub.id === subscriptionB.id);
      expect(userBSub).toBeUndefined();
    });

    it('should not allow User A to fetch User B subscription by ID', async () => {
      const { data: subscription } = await userA.client
        .from('calendar_subscriptions')
        .select('*')
        .eq('id', subscriptionB.id)
        .single();

      expect(subscription).toBeNull();
    });

    it('should not allow User A to toggle visibility of User B subscription', async () => {
      const { error } = await userA.client
        .from('calendar_subscriptions')
        .update({ is_visible: false })
        .eq('id', subscriptionB.id);

      expect(error).not.toBeNull(); // RLS should prevent this

      // Verify User B's subscription is still visible
      const { data: subscription } = await userB.client
        .from('calendar_subscriptions')
        .select('*')
        .eq('id', subscriptionB.id)
        .single();

      expect(subscription?.is_visible).toBe(true);
    });

    it('should allow user to toggle their own subscription visibility', async () => {
      const { data: updated, error } = await userA.client
        .from('calendar_subscriptions')
        .update({ is_visible: false })
        .eq('id', subscriptionA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated?.is_visible).toBe(false);
    });
  });

  // ---------------------------------
  // Calendar Events RLS Tests
  // ---------------------------------

  describe('Calendar Events RLS', () => {
    it('should only return events from user-owned subscriptions', async () => {
      const { data: events, error } = await userA.client
        .from('calendar_events')
        .select('*')
        .gte('start_time', new Date('2025-10-01T00:00:00Z').toISOString())
        .lte('end_time', new Date('2025-10-31T23:59:59Z').toISOString())
        .order('start_time', { ascending: true });

      expect(error).toBeNull();
      expect(events.length).toBeGreaterThanOrEqual(1);

      const userAEvent = events.find(evt => evt.id === eventA.id);
      expect(userAEvent).toBeDefined();
      expect(userAEvent?.user_id).toBe(userA.user.id);

      // Verify Zod validation
      events.forEach(evt => {
        expect(() => CalendarEventSchema.parse(evt)).not.toThrow();
      });
    });

    it('should not allow User A to see User B events', async () => {
      const { data: events } = await userA.client
        .from('calendar_events')
        .select('*')
        .gte('start_time', new Date('2025-10-01T00:00:00Z').toISOString())
        .lte('end_time', new Date('2025-10-31T23:59:59Z').toISOString());

      const userBEvent = events?.find(evt => evt.id === eventB.id);
      expect(userBEvent).toBeUndefined();
    });

    it('should filter events by date range', async () => {
      // Query for events outside the date range
      const { data: events } = await userA.client
        .from('calendar_events')
        .select('*')
        .gte('start_time', new Date('2025-11-01T00:00:00Z').toISOString())
        .lte('end_time', new Date('2025-11-30T23:59:59Z').toISOString());

      // User A's event (Oct 15) should NOT be in November results
      const userAEvent = events?.find(evt => evt.id === eventA.id);
      expect(userAEvent).toBeUndefined();
    });

    it('should not allow User A to fetch User B event by ID', async () => {
      const { data: event } = await userA.client
        .from('calendar_events')
        .select('*')
        .eq('id', eventB.id)
        .single();

      expect(event).toBeNull();
    });

    it('should allow user to fetch their own event by ID', async () => {
      const { data: event, error } = await userA.client
        .from('calendar_events')
        .select('*')
        .eq('id', eventA.id)
        .single();

      expect(error).toBeNull();
      expect(event).not.toBeNull();
      expect(event?.id).toBe(eventA.id);
      expect(event?.title).toBe('User A Meeting');
    });

    it('should allow user to fetch their own event by Google ID', async () => {
      const { data: event, error } = await userA.client
        .from('calendar_events')
        .select('*')
        .eq('google_calendar_event_id', 'google-event-a-123')
        .eq('subscription_id', subscriptionA.id)
        .single();

      expect(error).toBeNull();
      expect(event).not.toBeNull();
      expect(event?.google_calendar_event_id).toBe('google-event-a-123');
      expect(event?.title).toBe('User A Meeting');
    });
  });
});
