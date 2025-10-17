-- Add is_default column to views table
-- This allows marking one view per user as the default view that should be auto-selected
ALTER TABLE views ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE NOT NULL;

-- Create an index for faster default view lookups
CREATE INDEX IF NOT EXISTS idx_views_user_id_is_default ON views(user_id, is_default) WHERE is_default = TRUE;

-- Create a function to create a default view for new users
CREATE OR REPLACE FUNCTION create_default_view_for_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create a "Default" view for the new user
  -- Shows all projects (empty projectIds array = all projects)
  -- Shows all standard columns as a flat list (no grouping)
  INSERT INTO views (user_id, name, type, config, is_default)
  VALUES (
    NEW.id,
    'Default',
    'list',
    jsonb_build_object(
      'projectIds', '[]'::jsonb,
      'sortBy', 'due_date',
      'visibleBuiltInColumns', '["assigned_to", "due_date", "project", "created_at"]'::jsonb
    ),
    TRUE
  );

  RETURN NEW;
END;
$$;

-- Create trigger to auto-create default view on profile creation
DROP TRIGGER IF EXISTS trigger_create_default_view ON profiles;
CREATE TRIGGER trigger_create_default_view
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_view_for_user();

-- Add constraint to ensure only one default view per user
-- This is a unique partial index that ensures is_default=TRUE appears only once per user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_views_one_default_per_user
  ON views(user_id)
  WHERE is_default = TRUE;

-- Backfill existing users: Create default view for users who don't have any views
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT p.id
    FROM profiles p
    LEFT JOIN views v ON p.id = v.user_id
    WHERE v.id IS NULL
  LOOP
    INSERT INTO views (user_id, name, type, config, is_default)
    VALUES (
      user_record.id,
      'Default',
      'list',
      jsonb_build_object(
        'projectIds', '[]'::jsonb,
        'sortBy', 'due_date',
        'visibleBuiltInColumns', '["assigned_to", "due_date", "project", "created_at"]'::jsonb
      ),
      TRUE
    );
  END LOOP;
END $$;

-- For users who have views but no default, mark their first view as default
DO $$
DECLARE
  user_record RECORD;
  first_view_id UUID;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id
    FROM views
    WHERE user_id NOT IN (
      SELECT user_id FROM views WHERE is_default = TRUE
    )
  LOOP
    -- Get the first view (oldest) for this user
    SELECT id INTO first_view_id
    FROM views
    WHERE user_id = user_record.user_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- Mark it as default
    UPDATE views
    SET is_default = TRUE
    WHERE id = first_view_id;
  END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN views.is_default IS 'Indicates if this is the default view for the user. Only one view per user can be default.';
