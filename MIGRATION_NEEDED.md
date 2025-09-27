# Database Migration Required

## Migration: Add visible_project_ids to profiles table

**File:** `supabase/migrations/20250927000000_add_visible_project_ids.sql`

**What it does:**
- Adds `visible_project_ids` field to the `profiles` table as a JSONB array
- Creates an index for better performance when querying visible projects
- Stores user's selected project visibility preferences

**To apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL from the migration file:

```sql
ALTER TABLE profiles
ADD COLUMN visible_project_ids jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.visible_project_ids IS 'Array of project IDs that the user has selected to be visible in the UI. Empty array means show all projects by default.';

CREATE INDEX idx_profiles_visible_project_ids ON profiles USING gin (visible_project_ids);
```

**After applying:**
- Users' project visibility preferences will be remembered across sessions
- Empty array means "show all projects" (initial state)
- Non-empty array means "show only these specific projects"