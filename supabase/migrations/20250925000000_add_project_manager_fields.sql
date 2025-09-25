-- Add Project Manager fields to projects table
-- This migration adds the missing fields for the Project Manager feature

-- Add new columns to existing projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_color VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Rename existing columns to match the spec
ALTER TABLE projects RENAME COLUMN name TO project_name;
ALTER TABLE projects RENAME COLUMN is_general TO is_default;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_display_order
ON projects(owner_id, display_order);

-- Add constraint to prevent deletion of default projects
ALTER TABLE projects ADD CONSTRAINT check_default_project_not_deletable
CHECK (is_default = FALSE OR id NOT IN (
  SELECT id FROM projects WHERE is_default = TRUE AND owner_id != auth.uid()
));

-- Update the create_initial_user_data trigger function to use new column names
CREATE OR REPLACE FUNCTION create_initial_user_data()
RETURNS trigger AS $$
BEGIN
  -- Insert profile
  INSERT INTO profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());

  -- Insert "General" project for the new user with proper fields
  INSERT INTO projects (owner_id, project_name, is_default, project_color, display_order, created_at, updated_at)
  VALUES (NEW.id, 'General', true, '#6B7280', 0, now(), now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;