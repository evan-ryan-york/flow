-- CRITICAL SECURITY FIX: Enable RLS on all tables
-- This migration ensures Row-Level Security is enabled on all tables
-- that should have data access restrictions based on user identity.

-- Enable RLS on all main tables
ALTER TABLE IF EXISTS projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_property_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_property_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_block_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Projects Table
-- ================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Project owners can update their projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete their projects" ON projects;

CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_users
      WHERE project_users.project_id = projects.id
      AND project_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Project owners can delete their projects" ON projects
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for Tasks Table
-- ============================

DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON tasks;

CREATE POLICY "Users can view tasks in their projects" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_users.project_id = projects.id
          AND project_users.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create tasks in their projects" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_users.project_id = projects.id
          AND project_users.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update tasks in their projects" ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_users.project_id = projects.id
          AND project_users.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete tasks in their projects" ON tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_users.project_id = projects.id
          AND project_users.user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policies for Project Users (Collaboration)
-- ==============================================

DROP POLICY IF EXISTS "Users can view project members" ON project_users;
DROP POLICY IF EXISTS "Project owners can add members" ON project_users;
DROP POLICY IF EXISTS "Project owners can update member roles" ON project_users;
DROP POLICY IF EXISTS "Project owners can remove members" ON project_users;

CREATE POLICY "Users can view project members" ON project_users
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_users.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can add members" ON project_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_users.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update member roles" ON project_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_users.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can remove members" ON project_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_users.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- RLS Policies for Time Blocks
-- ============================

DROP POLICY IF EXISTS "Users can view their own time blocks" ON time_blocks;
DROP POLICY IF EXISTS "Users can create their own time blocks" ON time_blocks;
DROP POLICY IF EXISTS "Users can update their own time blocks" ON time_blocks;
DROP POLICY IF EXISTS "Users can delete their own time blocks" ON time_blocks;

CREATE POLICY "Users can view their own time blocks" ON time_blocks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own time blocks" ON time_blocks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own time blocks" ON time_blocks
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own time blocks" ON time_blocks
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for Time Block Tasks (Join Table)
-- ==============================================

DROP POLICY IF EXISTS "Users can view their time block tasks" ON time_block_tasks;
DROP POLICY IF EXISTS "Users can add tasks to their time blocks" ON time_block_tasks;
DROP POLICY IF EXISTS "Users can remove tasks from their time blocks" ON time_block_tasks;

CREATE POLICY "Users can view their time block tasks" ON time_block_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM time_blocks
      WHERE time_blocks.id = time_block_tasks.time_block_id
      AND time_blocks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add tasks to their time blocks" ON time_block_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM time_blocks
      WHERE time_blocks.id = time_block_tasks.time_block_id
      AND time_blocks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove tasks from their time blocks" ON time_block_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM time_blocks
      WHERE time_blocks.id = time_block_tasks.time_block_id
      AND time_blocks.user_id = auth.uid()
    )
  );

-- Note: Custom property policies already exist and are correct
-- Note: Profile policies already exist and are correct
