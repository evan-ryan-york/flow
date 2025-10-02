-- Migration: Add Google Calendar Integration Tables
-- Description: Creates tables for multi-account Google Calendar integration
-- Date: 2025-10-02

-- =====================================================
-- 1. Google Calendar Connections Table
-- =====================================================
-- Stores OAuth tokens and metadata for each connected Google account
CREATE TABLE google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  label TEXT NOT NULL CHECK (char_length(label) >= 1 AND char_length(label) <= 50),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure a user doesn't connect the same email twice
  UNIQUE(user_id, email)
);

-- Index for efficient queries by user
CREATE INDEX idx_google_calendar_connections_user_id
  ON google_calendar_connections(user_id);

-- Index for finding expired tokens that need refresh
CREATE INDEX idx_google_calendar_connections_expires_at
  ON google_calendar_connections(expires_at);

-- RLS Policies for google_calendar_connections
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar connections"
  ON google_calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
  ON google_calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
  ON google_calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
  ON google_calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. Calendar Subscriptions Table
-- =====================================================
-- Stores which calendars from each connection the user wants to sync
CREATE TABLE calendar_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  google_calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_color TEXT,
  background_color TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure a calendar from a connection is not subscribed twice
  UNIQUE(connection_id, google_calendar_id)
);

-- Index for efficient queries by user
CREATE INDEX idx_calendar_subscriptions_user_id
  ON calendar_subscriptions(user_id);

-- Index for efficient queries by connection
CREATE INDEX idx_calendar_subscriptions_connection_id
  ON calendar_subscriptions(connection_id);

-- Index for finding visible calendars
CREATE INDEX idx_calendar_subscriptions_visible
  ON calendar_subscriptions(user_id, is_visible)
  WHERE is_visible = true;

-- Index for finding calendars that need syncing
CREATE INDEX idx_calendar_subscriptions_sync_enabled
  ON calendar_subscriptions(connection_id, sync_enabled)
  WHERE sync_enabled = true;

-- RLS Policies for calendar_subscriptions
ALTER TABLE calendar_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar subscriptions"
  ON calendar_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar subscriptions"
  ON calendar_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar subscriptions"
  ON calendar_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar subscriptions"
  ON calendar_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. Calendar Events Table
-- =====================================================
-- Caches calendar events locally for performance and offline access
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  google_calendar_event_id TEXT NOT NULL,
  google_calendar_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT,
  color TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  etag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure we don't duplicate events from the same Google Calendar
  UNIQUE(connection_id, google_calendar_event_id)
);

-- Index for efficient queries by user and time range (most common query)
CREATE INDEX idx_calendar_events_user_time
  ON calendar_events(user_id, start_time, end_time);

-- Index for efficient queries by connection
CREATE INDEX idx_calendar_events_connection_id
  ON calendar_events(connection_id);

-- Index for efficient queries by subscription
CREATE INDEX idx_calendar_events_subscription_id
  ON calendar_events(subscription_id);

-- Index for finding events in a specific time range (calendar view)
CREATE INDEX idx_calendar_events_time_range
  ON calendar_events(start_time, end_time);

-- Index for finding events that need re-syncing
CREATE INDEX idx_calendar_events_last_synced
  ON calendar_events(last_synced_at);

-- RLS Policies for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events"
  ON calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events"
  ON calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Triggers for updated_at
-- =====================================================
-- Automatically update the updated_at timestamp on row updates

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_subscriptions_updated_at
  BEFORE UPDATE ON calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. Calendar Sync State Table (for tracking sync tokens)
-- =====================================================
-- Stores Google Calendar sync tokens for incremental syncing
CREATE TABLE calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One sync state per subscription
  UNIQUE(subscription_id)
);

-- Index for finding sync states that need updating
CREATE INDEX idx_calendar_sync_state_subscription_id
  ON calendar_sync_state(subscription_id);

-- RLS Policies for calendar_sync_state
ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync state for their subscriptions"
  ON calendar_sync_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_subscriptions
      WHERE calendar_subscriptions.id = calendar_sync_state.subscription_id
      AND calendar_subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage sync state"
  ON calendar_sync_state FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_calendar_sync_state_updated_at
  BEFORE UPDATE ON calendar_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Comments
-- =====================================================
COMMENT ON TABLE google_calendar_connections IS 'Stores OAuth tokens and metadata for connected Google accounts';
COMMENT ON TABLE calendar_subscriptions IS 'Tracks which calendars from each Google account the user wants to sync';
COMMENT ON TABLE calendar_events IS 'Cached calendar events from Google Calendar for performance and offline access';
COMMENT ON TABLE calendar_sync_state IS 'Stores Google Calendar sync tokens for incremental syncing';
