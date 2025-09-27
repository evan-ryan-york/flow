-- Add visible_project_ids to profiles table for storing user's selected project visibility
-- This will remember which projects a user has selected/visible in the UI

ALTER TABLE profiles
ADD COLUMN visible_project_ids jsonb DEFAULT '[]'::jsonb;

-- Add a comment explaining the field
COMMENT ON COLUMN profiles.visible_project_ids IS 'Array of project IDs that the user has selected to be visible in the UI. Empty array means show all projects by default.';

-- Create an index for better performance when querying visible projects
CREATE INDEX idx_profiles_visible_project_ids ON profiles USING gin (visible_project_ids);