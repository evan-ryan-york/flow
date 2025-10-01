-- Add Multi-Project Support for Custom Properties
-- =============================================

-- Create junction table for many-to-many relationship between custom properties and projects
CREATE TABLE IF NOT EXISTS custom_property_project_assignments (
  definition_id uuid NOT NULL REFERENCES custom_property_definitions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (definition_id, project_id)
);

-- Migrate existing data from custom_property_definitions to the new junction table
INSERT INTO custom_property_project_assignments (definition_id, project_id, created_at)
SELECT id, project_id, created_at
FROM custom_property_definitions
ON CONFLICT (definition_id, project_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_property_assignments_definition_id ON custom_property_project_assignments(definition_id);
CREATE INDEX IF NOT EXISTS idx_custom_property_assignments_project_id ON custom_property_project_assignments(project_id);

-- Enable Row Level Security
ALTER TABLE custom_property_project_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Custom Property Project Assignments
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
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_project_assignments.project_id
      AND projects.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM custom_property_definitions
      WHERE custom_property_definitions.id = custom_property_project_assignments.definition_id
      AND custom_property_definitions.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignments for their projects" ON custom_property_project_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = custom_property_project_assignments.project_id
      AND projects.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM custom_property_definitions
      WHERE custom_property_definitions.id = custom_property_project_assignments.definition_id
      AND custom_property_definitions.created_by = auth.uid()
    )
  );

-- Note: We keep the project_id column in custom_property_definitions for now
-- It will be removed in a future migration after verifying the new system works
-- This allows for a safe rollback if needed
