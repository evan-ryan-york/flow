-- Fix project_users DELETE policy to use the helper function and avoid recursion

-- Drop the potentially recursive delete policy
DROP POLICY IF EXISTS "Project owners and admins can remove members" ON project_users;

-- Use the same helper function for DELETE policy
CREATE POLICY "Project owners and admins can remove members" ON project_users
  FOR DELETE USING (
    is_project_owner_or_admin(project_id, auth.uid())
  );
