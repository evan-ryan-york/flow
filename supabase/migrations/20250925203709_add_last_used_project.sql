-- Add last_used_project_id to profiles table for sticky project behavior
ALTER TABLE profiles
ADD COLUMN last_used_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for performance optimization
CREATE INDEX IF NOT EXISTS idx_profiles_last_used_project
ON profiles(last_used_project_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.last_used_project_id IS 'Tracks the last project a user created a task in for sticky project behavior';