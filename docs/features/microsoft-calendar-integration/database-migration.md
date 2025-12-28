# Database Migration for Multi-Provider Calendar Support

This document details the database schema changes required to support both Google and Microsoft calendar integrations in a unified architecture.

## Migration Strategy

**Approach: Rename + Extend**

Rather than creating separate tables for each provider, we'll:
1. Rename `google_calendar_connections` to `calendar_connections`
2. Add a `provider` column to distinguish between Google and Microsoft
3. Rename Google-specific column names to provider-agnostic names
4. Update foreign key references and indexes

This approach provides:
- Unified queries across providers
- Simpler service layer (one set of functions)
- Easier UI implementation (single connection list)
- Future extensibility (Apple Calendar, etc.)

---

## Current Schema (Google-only)

```sql
-- Table: google_calendar_connections
CREATE TABLE google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text NOT NULL CHECK (char_length(label) <= 50),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  requires_reauth boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Table: calendar_subscriptions
CREATE TABLE calendar_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  calendar_name text NOT NULL,
  calendar_color text,
  background_color text,
  is_visible boolean DEFAULT true,
  sync_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, google_calendar_id)
);

-- Table: calendar_events
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_calendar_event_id text NOT NULL,
  google_calendar_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_all_day boolean DEFAULT false,
  location text,
  color text,
  last_synced_at timestamptz,
  etag text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, google_calendar_event_id)
);

-- Table: calendar_sync_state
CREATE TABLE calendar_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  sync_token text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subscription_id)
);
```

---

## Target Schema (Multi-Provider)

```sql
-- Table: calendar_connections (renamed from google_calendar_connections)
CREATE TABLE calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  account_email text NOT NULL,
  provider_account_id text, -- Microsoft OID, Google sub
  label text NOT NULL CHECK (char_length(label) <= 50),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  requires_reauth boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider, account_email)
);

-- Table: calendar_subscriptions (updated columns)
CREATE TABLE calendar_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  provider_calendar_id text NOT NULL,  -- Renamed from google_calendar_id
  calendar_name text NOT NULL,
  calendar_color text,
  background_color text,
  is_visible boolean DEFAULT true,
  sync_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, provider_calendar_id)
);

-- Table: calendar_events (updated columns)
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_event_id text NOT NULL,     -- Renamed from google_calendar_event_id
  provider_calendar_id text NOT NULL,  -- Renamed from google_calendar_id
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_all_day boolean DEFAULT false,
  location text,
  color text,
  last_synced_at timestamptz,
  etag text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, provider_event_id)
);

-- Table: calendar_sync_state (unchanged)
CREATE TABLE calendar_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES calendar_subscriptions(id) ON DELETE CASCADE,
  sync_token text,  -- Google syncToken or Microsoft deltaLink
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subscription_id)
);
```

---

## Migration SQL

**File:** `supabase/migrations/YYYYMMDD_add_microsoft_calendar_support.sql`

```sql
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
-- Drop old indexes
DROP INDEX IF EXISTS idx_google_calendar_connections_user_id;
DROP INDEX IF EXISTS idx_google_calendar_connections_expires_at;
DROP INDEX IF EXISTS idx_calendar_subscriptions_google_calendar_id;
DROP INDEX IF EXISTS idx_calendar_events_google_calendar_event_id;

-- Create new indexes
CREATE INDEX idx_calendar_connections_user_id
  ON calendar_connections(user_id);

CREATE INDEX idx_calendar_connections_provider
  ON calendar_connections(user_id, provider);

CREATE INDEX idx_calendar_connections_expires_at
  ON calendar_connections(expires_at);

CREATE INDEX idx_calendar_subscriptions_provider_calendar_id
  ON calendar_subscriptions(connection_id, provider_calendar_id);

CREATE INDEX idx_calendar_events_provider_event_id
  ON calendar_events(connection_id, provider_event_id);

CREATE INDEX idx_calendar_events_provider
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
```

---

## Rollback Migration

If issues occur, this migration can be rolled back:

**File:** `supabase/migrations/YYYYMMDD_rollback_microsoft_calendar_support.sql`

```sql
-- ============================================================
-- ROLLBACK Migration: Revert Microsoft Calendar Support
-- WARNING: This will remove Microsoft connections!
-- ============================================================

BEGIN;

-- Delete Microsoft connections (cascade to subscriptions/events)
DELETE FROM calendar_connections WHERE provider = 'microsoft';

-- Revert calendar_events
ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_provider_check;

ALTER TABLE calendar_events
  DROP COLUMN IF EXISTS provider;

ALTER TABLE calendar_events
  RENAME COLUMN provider_event_id TO google_calendar_event_id;

ALTER TABLE calendar_events
  RENAME COLUMN provider_calendar_id TO google_calendar_id;

-- Revert calendar_subscriptions
ALTER TABLE calendar_subscriptions
  RENAME COLUMN provider_calendar_id TO google_calendar_id;

-- Revert calendar_connections
ALTER TABLE calendar_connections
  DROP CONSTRAINT IF EXISTS calendar_connections_provider_check;

ALTER TABLE calendar_connections
  DROP COLUMN IF EXISTS provider_account_id;

ALTER TABLE calendar_connections
  DROP COLUMN IF EXISTS provider;

ALTER TABLE calendar_connections
  RENAME COLUMN account_email TO email;

ALTER TABLE calendar_connections
  RENAME TO google_calendar_connections;

-- Recreate original constraints
ALTER TABLE google_calendar_connections
  ADD CONSTRAINT google_calendar_connections_user_id_email_key
  UNIQUE (user_id, email);

COMMIT;
```

---

## Zod Schema Updates

**File:** `packages/models/index.ts`

```typescript
import { z } from 'zod'

// ===== Calendar Provider =====
export const CalendarProviderSchema = z.enum(['google', 'microsoft'])
export type CalendarProvider = z.infer<typeof CalendarProviderSchema>

// ===== Calendar Connection =====
export const CalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  account_email: z.string().email(),
  provider_account_id: z.string().nullable(),
  label: z.string().max(50),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.string().datetime(),
  requires_reauth: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>

// Backwards compatibility alias
export const GoogleCalendarConnectionSchema = CalendarConnectionSchema
export type GoogleCalendarConnection = CalendarConnection

// ===== Calendar Subscription =====
export const CalendarSubscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider_calendar_id: z.string(),
  calendar_name: z.string(),
  calendar_color: z.string().nullable(),
  background_color: z.string().nullable(),
  is_visible: z.boolean().default(true),
  sync_enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type CalendarSubscription = z.infer<typeof CalendarSubscriptionSchema>

// ===== Calendar Event =====
export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  provider_event_id: z.string(),
  provider_calendar_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  is_all_day: z.boolean().default(false),
  location: z.string().nullable(),
  color: z.string().nullable(),
  last_synced_at: z.string().datetime().nullable(),
  etag: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type CalendarEvent = z.infer<typeof CalendarEventSchema>

// ===== Calendar Sync State =====
export const CalendarSyncStateSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  sync_token: z.string().nullable(), // Google syncToken or Microsoft deltaLink
  last_sync_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type CalendarSyncState = z.infer<typeof CalendarSyncStateSchema>
```

---

## Service Layer Updates

Update `packages/data/services/calendarService.ts` to use new column names:

```typescript
// Before (Google-specific)
.eq('google_calendar_id', calendarId)

// After (provider-agnostic)
.eq('provider_calendar_id', calendarId)
```

---

## Testing Checklist

After applying migration:

- [ ] Existing Google connections still work
- [ ] Google events still display correctly
- [ ] `provider` column shows 'google' for all existing data
- [ ] New Microsoft connections save with 'microsoft' provider
- [ ] Both providers appear in unified connection list
- [ ] Visibility toggles work for both providers
- [ ] Events from both providers show in calendar view
- [ ] Cascade delete works (deleting connection removes events)
- [ ] RLS policies prevent cross-user access

---

## Performance Considerations

### Indexes
- `(user_id, provider)` for filtering by provider
- `(connection_id, provider_event_id)` for event upserts
- `(user_id, start_time, end_time)` for date range queries

### Query Patterns
```sql
-- Get all connections for user (both providers)
SELECT * FROM calendar_connections WHERE user_id = $1;

-- Get Google-only connections
SELECT * FROM calendar_connections WHERE user_id = $1 AND provider = 'google';

-- Get events for date range (all providers)
SELECT ce.*, cs.calendar_name, cs.background_color
FROM calendar_events ce
JOIN calendar_subscriptions cs ON ce.subscription_id = cs.id
WHERE ce.user_id = $1
  AND cs.is_visible = true
  AND ce.start_time >= $2
  AND ce.end_time <= $3
ORDER BY ce.start_time;
```
