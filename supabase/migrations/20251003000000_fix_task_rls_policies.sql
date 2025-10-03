-- Fix Task RLS Policies Based on Test Results
-- Issues found:
-- 1. Assigned users can't read/update tasks assigned to them
-- 2. Viewers can update/delete (should be read-only)
-- 3. Regular members can delete other members' tasks (should only delete their own)

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON tasks;

-- Helper function to get user's role in a project
CREATE OR REPLACE FUNCTION get_user_project_role(project_id_param uuid, user_id_param uuid)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if user is project owner
  IF EXISTS (SELECT 1 FROM projects WHERE id = project_id_param AND owner_id = user_id_param) THEN
    RETURN 'owner';
  END IF;

  -- Check project_users table for role
  SELECT role INTO user_role
  FROM project_users
  WHERE project_id = project_id_param AND user_id = user_id_param;

  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- SELECT Policy: Users can view tasks if they:
-- 1. Own the project
-- 2. Are a member of the project (any role)
-- 3. Are assigned to the task
CREATE POLICY "Users can view tasks in their projects" ON tasks
  FOR SELECT USING (
    -- Project owner
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
    OR
    -- Project member (any role)
    EXISTS (
      SELECT 1 FROM project_users
      WHERE project_id = tasks.project_id AND user_id = auth.uid()
    )
    OR
    -- Assigned to the task
    assigned_to = auth.uid()
  );

-- INSERT Policy: Users can create tasks if they:
-- 1. Own the project
-- 2. Are a member or admin of the project (not viewer)
CREATE POLICY "Users can create tasks in their projects" ON tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (
      -- Project owner
      EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND owner_id = auth.uid()
      )
      OR
      -- Project member or admin (not viewer)
      EXISTS (
        SELECT 1 FROM project_users
        WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('member', 'admin')
      )
    )
  );

-- UPDATE Policy: Users can update tasks if they:
-- 1. Own the project
-- 2. Are an admin of the project
-- 3. Are a regular member of the project
-- 4. Are assigned to the task
-- BUT NOT if they are only a viewer
CREATE POLICY "Users can update tasks in their projects" ON tasks
  FOR UPDATE USING (
    -- Project owner
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
    OR
    -- Project admin or member (not viewer)
    EXISTS (
      SELECT 1 FROM project_users
      WHERE project_id = tasks.project_id
      AND user_id = auth.uid()
      AND role IN ('member', 'admin')
    )
    OR
    -- Assigned to the task (can update status, etc.)
    assigned_to = auth.uid()
  );

-- DELETE Policy: Users can delete tasks if they:
-- 1. Own the project
-- 2. Are an admin of the project
-- 3. Created the task themselves (and are a member)
CREATE POLICY "Users can delete tasks in their projects" ON tasks
  FOR DELETE USING (
    -- Project owner
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id AND owner_id = auth.uid()
    )
    OR
    -- Project admin
    EXISTS (
      SELECT 1 FROM project_users
      WHERE project_id = tasks.project_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- Task creator (only if they're still a member)
    (
      created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM project_users
        WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
      )
    )
  );
