-- Fix project_users DELETE policy to prevent regular members from removing others
-- Only owners and admins should be able to remove members

-- Drop the too-permissive delete policy
DROP POLICY IF EXISTS "Project owners and admins can remove members" ON project_users;

-- Create stricter policy: only owners and admins can delete members
CREATE POLICY "Project owners and admins can remove members" ON project_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND (
        -- User is the project owner
        p.owner_id = auth.uid()
        OR
        -- User is an admin of this project
        EXISTS (
          SELECT 1 FROM project_users pu
          WHERE pu.project_id = p.id
          AND pu.user_id = auth.uid()
          AND pu.role = 'admin'
        )
      )
    )
  );
