-- Fix RLS policies for custom_property_project_assignments
-- The issue: The INSERT policy's subquery to check custom_property_definitions
-- is itself subject to RLS, which can block the check from succeeding.
--
-- Solution: Use a SECURITY DEFINER function to bypass RLS when checking
-- if the user owns the custom property definition.

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assignments for their projects" ON custom_property_project_assignments;
DROP POLICY IF EXISTS "Users can create assignments for their projects" ON custom_property_project_assignments;
DROP POLICY IF EXISTS "Users can delete assignments for their projects" ON custom_property_project_assignments;

-- Create a helper function to check if user owns a definition (bypasses RLS)
CREATE OR REPLACE FUNCTION user_owns_custom_property_definition(definition_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM custom_property_definitions
    WHERE id = definition_id
    AND created_by = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using the helper function
CREATE POLICY "Users can view assignments for their projects" ON custom_property_project_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_project_assignments.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create assignments for their projects" ON custom_property_project_assignments
  FOR INSERT WITH CHECK (
    -- User must own the project
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_project_assignments.project_id
      AND projects.owner_id = auth.uid()
    )
    -- User must own the custom property definition (using SECURITY DEFINER function)
    AND user_owns_custom_property_definition(custom_property_project_assignments.definition_id, auth.uid())
  );

CREATE POLICY "Users can delete assignments for their projects" ON custom_property_project_assignments
  FOR DELETE USING (
    -- User must own the project
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_project_assignments.project_id
      AND projects.owner_id = auth.uid()
    )
    -- User must own the custom property definition (using SECURITY DEFINER function)
    AND user_owns_custom_property_definition(custom_property_project_assignments.definition_id, auth.uid())
  );