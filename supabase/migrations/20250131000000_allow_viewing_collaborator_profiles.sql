-- Allow users to view profiles of people in their shared projects
-- This is necessary for task assignment and collaboration features

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create new policies:
-- 1. Users can always view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Users can view profiles of people in their shared projects
CREATE POLICY "Users can view collaborator profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_users pu1
      INNER JOIN project_users pu2 ON pu1.project_id = pu2.project_id
      WHERE pu1.user_id = auth.uid()
      AND pu2.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM projects p1
      INNER JOIN project_users pu ON p1.id = pu.project_id
      WHERE p1.owner_id = auth.uid()
      AND pu.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM projects p2
      WHERE p2.owner_id = profiles.id
      AND EXISTS (
        SELECT 1 FROM project_users pu
        WHERE pu.project_id = p2.id
        AND pu.user_id = auth.uid()
      )
    )
  );
