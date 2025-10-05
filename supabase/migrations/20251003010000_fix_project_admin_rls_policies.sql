-- Fix RLS policies to allow admin members to update projects and manage members
-- This addresses test failures where admins should have elevated permissions

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Project owners can update their projects" ON projects;
DROP POLICY IF EXISTS "Project owners can manage project users" ON project_users;

-- Create new policies that allow both owners AND admins to update projects
CREATE POLICY "Project owners and admins can update projects" ON projects
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_users
      WHERE project_id = projects.id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create separate policies for project_users management
-- Owners and admins can add members
CREATE POLICY "Project owners and admins can add members" ON project_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users pu
          WHERE pu.project_id = projects.id
          AND pu.user_id = auth.uid()
          AND pu.role = 'admin'
        )
      )
    )
  );

-- Owners and admins can update member roles
CREATE POLICY "Project owners and admins can update members" ON project_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users pu
          WHERE pu.project_id = projects.id
          AND pu.user_id = auth.uid()
          AND pu.role = 'admin'
        )
      )
    )
  );

-- Owners and admins can remove members
CREATE POLICY "Project owners and admins can remove members" ON project_users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users pu
          WHERE pu.project_id = projects.id
          AND pu.user_id = auth.uid()
          AND pu.role = 'admin'
        )
      )
    )
  );
