-- Fix project_users INSERT policy to avoid RLS recursion
-- The issue is that checking project_users within a project_users policy causes recursion

-- Drop the recursive insert policy
DROP POLICY IF EXISTS "Project owners and admins can add members" ON project_users;

-- Create non-recursive policy: check role via a function instead
CREATE OR REPLACE FUNCTION is_project_owner_or_admin(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
    AND owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM project_users
    WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND role = 'admin'
  );
$$;

-- Use the function in the INSERT policy
CREATE POLICY "Project owners and admins can add members" ON project_users
  FOR INSERT WITH CHECK (
    is_project_owner_or_admin(project_id, auth.uid())
  );
