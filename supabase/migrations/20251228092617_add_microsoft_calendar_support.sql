-- ============================================================
-- Migration: Add Microsoft Calendar Support
-- Description: Unify calendar tables for multi-provider support
-- ============================================================

BEGIN;

-- ============================================
-- Step 1: Rename main table
-- ============================================
ALTER TABLE google_calendar_connections
  RENAME TO calendar_connections;

-- ============================================
-- Step 2: Add provider column with default
-- ============================================
ALTER TABLE calendar_connections
  ADD COLUMN provider text NOT NULL DEFAULT 'google';

-- Add check constraint for valid providers
ALTER TABLE calendar_connections
  ADD CONSTRAINT calendar_connections_provider_check
  CHECK (provider IN ('google', 'microsoft'));

-- ============================================
-- Step 3: Rename email column to be generic
-- ============================================
ALTER TABLE calendar_connections
  RENAME COLUMN email TO account_email;

-- ============================================
-- Step 4: Add provider-specific account ID
-- ============================================
-- Microsoft uses OID (Object ID), Google uses 'sub' claim
ALTER TABLE calendar_connections
  ADD COLUMN provider_account_id text;

-- ============================================
-- Step 5: Update unique constraint
-- ============================================
-- Drop old constraint
ALTER TABLE calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_user_id_email_key;

-- Add new constraint including provider
ALTER TABLE calendar_connections
  ADD CONSTRAINT calendar_connections_user_provider_email_unique
  UNIQUE (user_id, provider, account_email);

-- ============================================
-- Step 6: Update calendar_subscriptions
-- ============================================
-- Rename Google-specific column
ALTER TABLE calendar_subscriptions
  RENAME COLUMN google_calendar_id TO provider_calendar_id;

-- Update unique constraint
ALTER TABLE calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_connection_id_google_calendar_id_key;

ALTER TABLE calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_connection_provider_calendar_unique
  UNIQUE (connection_id, provider_calendar_id);

-- Update foreign key to renamed table
ALTER TABLE calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_connection_id_fkey;

ALTER TABLE calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES calendar_connections(id)
  ON DELETE CASCADE;

-- ============================================
-- Step 7: Update calendar_events
-- ============================================
-- Rename Google-specific columns
ALTER TABLE calendar_events
  RENAME COLUMN google_calendar_event_id TO provider_event_id;

ALTER TABLE calendar_events
  RENAME COLUMN google_calendar_id TO provider_calendar_id;

-- Add provider column
ALTER TABLE calendar_events
  ADD COLUMN provider text;

-- Backfill provider from connection
UPDATE calendar_events ce
SET provider = cc.provider
FROM calendar_connections cc
WHERE ce.connection_id = cc.id;

-- Set default for any orphaned events (shouldn't happen but just in case)
UPDATE calendar_events
SET provider = 'google'
WHERE provider IS NULL;

-- Make provider NOT NULL after backfill
ALTER TABLE calendar_events
  ALTER COLUMN provider SET NOT NULL;

-- Add check constraint
ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_provider_check
  CHECK (provider IN ('google', 'microsoft'));

-- Update unique constraint
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_connection_id_google_calendar_event_id_key;

-- Delete duplicate events, keeping only the most recently updated one
DELETE FROM calendar_events ce1
USING calendar_events ce2
WHERE ce1.connection_id = ce2.connection_id
  AND ce1.provider_event_id = ce2.provider_event_id
  AND ce1.id < ce2.id;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_connection_provider_event_unique
  UNIQUE (connection_id, provider_event_id);

-- Update foreign key
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_connection_id_fkey;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES calendar_connections(id)
  ON DELETE CASCADE;

-- ============================================
-- Step 8: Update indexes
-- ============================================
-- Drop old indexes (use IF EXISTS to handle cases where they might not exist)
DROP INDEX IF EXISTS idx_google_calendar_connections_user_id;
DROP INDEX IF EXISTS idx_google_calendar_connections_expires_at;
DROP INDEX IF EXISTS idx_calendar_subscriptions_google_calendar_id;
DROP INDEX IF EXISTS idx_calendar_events_google_calendar_event_id;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id
  ON calendar_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider
  ON calendar_connections(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_expires_at
  ON calendar_connections(expires_at);

CREATE INDEX IF NOT EXISTS idx_calendar_subscriptions_provider_calendar_id
  ON calendar_subscriptions(connection_id, provider_calendar_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_provider_event_id
  ON calendar_events(connection_id, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_provider
  ON calendar_events(user_id, provider);

-- ============================================
-- Step 9: Update RLS policies
-- ============================================
-- RLS policies follow the table, but update names for clarity

-- Drop old policies (if any reference old table name)
DROP POLICY IF EXISTS "Users can view own calendar connections" ON calendar_connections;
DROP POLICY IF EXISTS "Users can insert own calendar connections" ON calendar_connections;
DROP POLICY IF EXISTS "Users can update own calendar connections" ON calendar_connections;
DROP POLICY IF EXISTS "Users can delete own calendar connections" ON calendar_connections;
DROP POLICY IF EXISTS "google_calendar_connections_select_own" ON calendar_connections;
DROP POLICY IF EXISTS "google_calendar_connections_insert_own" ON calendar_connections;
DROP POLICY IF EXISTS "google_calendar_connections_update_own" ON calendar_connections;
DROP POLICY IF EXISTS "google_calendar_connections_delete_own" ON calendar_connections;

-- Recreate policies with consistent naming
CREATE POLICY "calendar_connections_select_own"
  ON calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_insert_own"
  ON calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "calendar_connections_update_own"
  ON calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "calendar_connections_delete_own"
  ON calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Step 10: Add comments for documentation
-- ============================================
COMMENT ON TABLE calendar_connections IS
  'OAuth connections for calendar providers (Google, Microsoft)';

COMMENT ON COLUMN calendar_connections.provider IS
  'Calendar provider identifier: google or microsoft';

COMMENT ON COLUMN calendar_connections.account_email IS
  'Email address of the connected account';

COMMENT ON COLUMN calendar_connections.provider_account_id IS
  'Provider-specific unique user ID (Microsoft OID, Google sub)';

COMMENT ON COLUMN calendar_subscriptions.provider_calendar_id IS
  'Provider-specific calendar ID';

COMMENT ON COLUMN calendar_events.provider_event_id IS
  'Provider-specific event ID';

COMMENT ON COLUMN calendar_events.provider IS
  'Calendar provider for this event (denormalized for query performance)';

COMMIT;
