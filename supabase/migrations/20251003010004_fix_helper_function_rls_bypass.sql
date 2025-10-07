-- Fix the helper function to properly bypass RLS
-- The function needs to SET LOCAL to bypass RLS when checking permissions

DROP FUNCTION IF EXISTS is_project_owner_or_admin(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION is_project_owner_or_admin(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_project_owner_or_admin(uuid, uuid) TO authenticated;

-- Recreate the policies that depend on this function
CREATE POLICY "Project owners and admins can add members" ON project_users
  FOR INSERT WITH CHECK (
    is_project_owner_or_admin(project_id, auth.uid())
  );

CREATE POLICY "Project owners and admins can remove members" ON project_users
  FOR DELETE USING (
    is_project_owner_or_admin(project_id, auth.uid())
  );
