-- Fix the SELECT policy to be non-recursive and simpler

DROP POLICY IF EXISTS "Users can view project memberships" ON project_users;

CREATE POLICY "Users can view project memberships" ON project_users
  FOR SELECT USING (
    -- Users can always see their own memberships
    user_id = auth.uid()
    OR
    -- Project owners can see all memberships
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
  );
