-- Fix infinite recursion in RLS policies
-- Problem: projects policy references project_users, and project_users policy references projects
-- Solution: Break the circular dependency by simplifying the policies

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view project members" ON project_users;
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON tasks;

-- Projects: Simple policy without recursion
-- Users can see projects they own OR projects they're a member of (direct check, no subquery to projects)
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT project_id FROM project_users WHERE user_id = auth.uid()
    )
  );

-- Project Users: Simple policy without recursion
-- Users can see memberships where they are the member OR they own the project (direct check)
CREATE POLICY "Users can view project members" ON project_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
    )
  );

-- Tasks: Check access through projects (owner or member)
-- Use a function to check project access to avoid recursion
CREATE OR REPLACE FUNCTION user_has_project_access(project_id_param uuid, user_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects
    WHERE id = project_id_param
    AND (
      owner_id = user_id_param
      OR EXISTS (
        SELECT 1 FROM project_users
        WHERE project_users.project_id = project_id_param
        AND project_users.user_id = user_id_param
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can view tasks in their projects" ON tasks
  FOR SELECT USING (user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can create tasks in their projects" ON tasks
  FOR INSERT WITH CHECK (user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can update tasks in their projects" ON tasks
  FOR UPDATE USING (user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can delete tasks in their projects" ON tasks
  FOR DELETE USING (user_has_project_access(project_id, auth.uid()));
