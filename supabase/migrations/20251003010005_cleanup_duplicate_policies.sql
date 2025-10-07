-- Clean up duplicate policies on project_users table
-- Keep only the new "owners and admins" policies

DROP POLICY IF EXISTS "Project owners can add members" ON project_users;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_users;
DROP POLICY IF EXISTS "Project owners can update member roles" ON project_users;

-- Also ensure the SELECT policy allows users to see their own memberships
-- This is critical for the is_project_owner_or_admin function to work
DROP POLICY IF EXISTS "Users can view project memberships" ON project_users;
DROP POLICY IF EXISTS "Users can view project members" ON project_users;

CREATE POLICY "Users can view project memberships" ON project_users
  FOR SELECT USING (
    -- Users can see their own memberships
    user_id = auth.uid()
    OR
    -- Project owners can see all memberships
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
    OR
    -- Project admins can see all memberships
    EXISTS (
      SELECT 1 FROM project_users pu
      WHERE pu.project_id = project_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'admin'
    )
  );
