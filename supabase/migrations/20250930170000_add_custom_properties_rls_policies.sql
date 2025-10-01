-- Add missing RLS policies for custom_property_definitions and custom_property_values
-- These tables had RLS enabled but no policies, causing all queries to fail

-- ============================================
-- Custom Property Definitions Policies
-- ============================================

-- Users can view custom property definitions for projects they own or are members of
CREATE POLICY "Users can view custom properties for their projects" ON custom_property_definitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_definitions.project_id
      AND (
        projects.owner_id = auth.uid()
        OR is_project_member(projects.id, auth.uid())
      )
    )
  );

-- Users can create custom property definitions for projects they own
CREATE POLICY "Project owners can create custom properties" ON custom_property_definitions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_definitions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project owners can update custom property definitions
CREATE POLICY "Project owners can update custom properties" ON custom_property_definitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_definitions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project owners can delete custom property definitions
CREATE POLICY "Project owners can delete custom properties" ON custom_property_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_definitions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- ============================================
-- Custom Property Values Policies
-- ============================================

-- Users can view custom property values for tasks in their projects
CREATE POLICY "Users can view custom property values for their tasks" ON custom_property_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_property_values.task_id
      AND user_has_project_access(tasks.project_id, auth.uid())
    )
  );

-- Users can create custom property values for tasks in their projects
CREATE POLICY "Users can create custom property values for their tasks" ON custom_property_values
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_property_values.task_id
      AND user_has_project_access(tasks.project_id, auth.uid())
    )
  );

-- Users can update custom property values for tasks in their projects
CREATE POLICY "Users can update custom property values for their tasks" ON custom_property_values
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_property_values.task_id
      AND user_has_project_access(tasks.project_id, auth.uid())
    )
  );

-- Users can delete custom property values for tasks in their projects
CREATE POLICY "Users can delete custom property values for their tasks" ON custom_property_values
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = custom_property_values.task_id
      AND user_has_project_access(tasks.project_id, auth.uid())
    )
  );
