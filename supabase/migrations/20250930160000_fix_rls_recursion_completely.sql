-- Complete fix for infinite recursion in RLS policies
-- The issue: Even with IN subqueries, there's still recursion because:
-- - projects policy checks project_users
-- - project_users policy checks projects
--
-- Solution: Use SECURITY DEFINER functions that bypass RLS entirely

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view project members" ON project_users;

-- Create helper function to check if user is a project member (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_member(project_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_users
    WHERE project_id = project_id_param
    AND user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to check if user is project owner (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_owner(project_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_id_param
    AND owner_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Projects policy: Use SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR is_project_member(id, auth.uid())
  );

-- Project Users policy: Use SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can view project members" ON project_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_project_owner(project_id, auth.uid())
  );
