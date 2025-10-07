-- Migration: Fix calendar_events UNIQUE constraint
-- Description: Changes UNIQUE constraint from (connection_id, google_calendar_event_id)
--              to (subscription_id, google_calendar_event_id) to properly support
--              the same calendar event appearing across multiple accounts
-- Date: 2025-10-06
--
-- Background: The original constraint prevented the same Google Calendar event
-- from being stored multiple times per connection. However, the sync logic
-- operates at the subscription level, and the same event can legitimately
-- appear in multiple subscriptions (e.g., when the same calendar is accessed
-- from different Google accounts).

-- =====================================================
-- 1. Drop the incorrect UNIQUE constraint
-- =====================================================
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_connection_id_google_calendar_event_id_key;

-- =====================================================
-- 2. Clean up duplicate events
-- =====================================================
-- Remove duplicate events for the same (subscription_id, google_calendar_event_id) pair
-- Keep the most recently synced version
DELETE FROM calendar_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY subscription_id, google_calendar_event_id
             ORDER BY last_synced_at DESC, created_at DESC
           ) as rn
    FROM calendar_events
  ) t
  WHERE rn > 1
);

-- =====================================================
-- 3. Add the correct UNIQUE constraint
-- =====================================================
-- This ensures each Google Calendar event appears exactly once per subscription
-- The same physical event can exist multiple times across different subscriptions
ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_subscription_id_google_calendar_event_id_key
  UNIQUE(subscription_id, google_calendar_event_id);

-- =====================================================
-- 4. Reset sync tokens to force full resync
-- =====================================================
-- Clear sync tokens to ensure all calendars do a full resync after this migration
-- This will populate any missing events that were previously blocked by the wrong constraint
DELETE FROM calendar_sync_state;

-- =====================================================
-- 5. Add comment explaining the constraint
-- =====================================================
COMMENT ON CONSTRAINT calendar_events_subscription_id_google_calendar_event_id_key
  ON calendar_events IS 'Ensures each Google Calendar event appears exactly once per subscription. The same event can exist in multiple subscriptions when the same calendar is accessed from different Google accounts.';
