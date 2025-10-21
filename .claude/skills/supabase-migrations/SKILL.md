---
name: Supabase Database Migrations
description: Deploy SQL migrations to Supabase remote databases using the Supabase CLI. Use when creating database tables, adding seed data, or deploying schema changes to Supabase. Requires Supabase CLI (installed via npx).
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Supabase Database Migrations

Deploy SQL migrations directly to your Supabase remote database using the Supabase CLI.

## Quick Start

### Deploy migrations to remote database

```bash
npx supabase db push
```

This command:
- Compares local migration files with what's applied on the remote database
- Prompts you to confirm which new migrations to apply
- Executes them in order on the remote database
- Tracks them in the `supabase_migrations` table

### Link to remote project (first time only)

```bash
npx supabase link --project-ref <project-ref>
```

The project ref is found in your Supabase project URL:
`https://supabase.com/dashboard/project/<project-ref>`

Or in your Supabase client configuration URL:
`https://<project-ref>.supabase.co`

## Creating Migrations

### Step 1: Create a migration file

Migration files must be in `supabase/migrations/` with format:
`YYYYMMDDHHMMSS_description.sql`

Example:
```
supabase/migrations/20251021000000_create_users_table.sql
```

Use timestamps to ensure correct ordering.

### Step 2: Write SQL

**Creating tables:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own data"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

**Adding seed data:**
```sql
-- Use ON CONFLICT to make it safe to run multiple times
INSERT INTO categories (id, name, description)
VALUES
    ('cat-1', 'Category 1', 'First category'),
    ('cat-2', 'Category 2', 'Second category')
ON CONFLICT (id) DO NOTHING;
```

**Altering existing tables:**
```sql
-- Add new column
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
```

### Step 3: Test locally (optional)

```bash
# Reset local database and apply all migrations
npx supabase db reset
```

### Step 4: Push to remote

```bash
npx supabase db push
```

Review the migration list and confirm when prompted.

## Common Tasks

### Add seed data after initial deployment

Create a new migration file:
```bash
# Migration: supabase/migrations/20251021120000_seed_initial_data.sql
```

```sql
-- Seed data migration
-- Safe to run multiple times due to ON CONFLICT

INSERT INTO daily_practice_activities (
    id,
    day_number,
    age_band,
    title,
    scenario,
    prompts
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    1,
    '6-9',
    'Example Activity',
    'Scenario text...',
    '[]'::jsonb
) ON CONFLICT (day_number, age_band) DO NOTHING;
```

Then deploy:
```bash
npx supabase db push
```

### Add columns to existing table

```sql
-- Migration: supabase/migrations/20251021130000_add_user_preferences.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';

-- Add index on JSONB column for performance
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);
```

### Create new Edge Function tables

```sql
-- Migration: supabase/migrations/20251021140000_create_analytics_tables.sql

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_event ON analytics_events(event_name);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
ON analytics_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
ON analytics_events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

## Deploy Edge Functions

After deploying database migrations, deploy Edge Functions:

```bash
# Deploy individual function
npx supabase functions deploy <function-name>

# Examples
npx supabase functions deploy get-daily-activity
npx supabase functions deploy complete-activity
```

All functions in `supabase/functions/` will be uploaded to your remote project.

## Best Practices

### 1. Use idempotent migrations

Always use `IF NOT EXISTS`, `IF EXISTS`, or `ON CONFLICT` to make migrations safe to run multiple times:

**Good:**
```sql
CREATE TABLE IF NOT EXISTS users (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

**Bad:**
```sql
CREATE TABLE users (...);  -- Fails if table exists
ALTER TABLE users ADD COLUMN email TEXT;  -- Fails if column exists
```

### 2. Keep migrations small and focused

One migration = one logical change:

**Good:**
- `20251021000000_create_users_table.sql`
- `20251021000001_add_user_preferences.sql`
- `20251021000002_create_analytics_tables.sql`

**Bad:**
- `20251021000000_all_database_changes.sql` (too broad)

### 3. Test migrations locally first

```bash
# Reset local database and test migrations
npx supabase db reset

# Verify tables were created correctly
# Then push to remote
npx supabase db push
```

### 4. Use transactions for complex migrations

```sql
BEGIN;

-- Multiple related changes
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
UPDATE users SET status = 'active' WHERE status IS NULL;
ALTER TABLE users ALTER COLUMN status SET NOT NULL;

COMMIT;
```

If any step fails, the entire migration rolls back.

### 5. Document breaking changes

Add comments to migrations that change APIs:

```sql
-- BREAKING CHANGE: Renamed 'name' column to 'full_name'
-- Edge functions and app code must be updated before deploying this migration

ALTER TABLE users RENAME COLUMN name TO full_name;
```

## Troubleshooting

### "Cannot connect to remote database"

**Solution:** Link to your project first:
```bash
npx supabase link --project-ref <project-ref>
```

### "Migration already exists"

**Cause:** The migration was already applied to the remote database.

**Solution:** This is normal. The migration is tracked and won't be applied again.

### "Migration failed: relation already exists"

**Cause:** Migration isn't idempotent (missing `IF NOT EXISTS`).

**Solution:** Update the migration to use `IF NOT EXISTS`:
```sql
CREATE TABLE IF NOT EXISTS users (...);
```

### "Permission denied"

**Cause:** Not authenticated with Supabase.

**Solution:** Login to Supabase:
```bash
npx supabase login
```

### Check migration status

See which migrations are applied:

```bash
# View remote database migrations
npx supabase db remote --linked
```

## Project Configuration

Migrations are stored in:
```
supabase/
├── migrations/
│   ├── 20251020000000_create_daily_practice_tables.sql
│   ├── 20251021000000_seed_daily_practice_day1.sql
│   └── ... (more migrations)
├── functions/
│   ├── get-daily-activity/
│   ├── complete-activity/
│   └── ... (Edge Functions)
└── config.toml (Supabase configuration)
```

## Dependencies

**Required:**
- Supabase CLI (automatically used via `npx supabase`)
- Node.js/npm (for npx)

**No manual installation needed** - `npx` will automatically download the Supabase CLI when first used.

## Examples

### Migration for new feature

```sql
-- supabase/migrations/20251021150000_add_streak_tracking.sql

-- Add streak tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Create indexes for streak queries
CREATE INDEX IF NOT EXISTS idx_users_current_streak ON users(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_date);

-- Update existing users to have streak of 0
UPDATE users
SET current_streak = 0, longest_streak = 0
WHERE current_streak IS NULL;
```

Deploy:
```bash
npx supabase db push
```

### Data migration

```sql
-- supabase/migrations/20251021160000_migrate_user_data.sql

-- Migrate old format to new format
UPDATE users
SET preferences = jsonb_build_object(
    'theme', COALESCE(theme, 'light'),
    'notifications', COALESCE(notifications_enabled, true)
)
WHERE preferences IS NULL OR preferences = '{}'::jsonb;

-- Add validation constraint
ALTER TABLE users ADD CONSTRAINT valid_preferences
CHECK (jsonb_typeof(preferences) = 'object');
```

## See Also

- [Supabase CLI docs](https://supabase.com/docs/guides/cli)
- [SQL best practices](https://supabase.com/docs/guides/database/sql-best-practices)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
