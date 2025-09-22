-- Phase 3 & Phase 4: Custom Properties, Views, and Time Blocks
-- This migration adds the missing tables that exist in the remote database

-- Phase 3: Custom Property Tables
-- ================================

-- Create custom_property_definitions table
CREATE TABLE IF NOT EXISTS custom_property_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'select', 'date', 'number')),
  options jsonb,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create custom_property_values table
CREATE TABLE IF NOT EXISTS custom_property_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES custom_property_definitions(id) ON DELETE CASCADE,
  value text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(task_id, definition_id)
);

-- Phase 4: Views and Time Blocks Tables
-- =====================================

-- Create views table
CREATE TABLE IF NOT EXISTS views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('list', 'kanban')),
  config jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create time_blocks table
CREATE TABLE IF NOT EXISTS time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_calendar_event_id text,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create time_block_tasks join table
CREATE TABLE IF NOT EXISTS time_block_tasks (
  time_block_id uuid NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (time_block_id, task_id)
);

-- Enable Row Level Security
-- =========================

ALTER TABLE custom_property_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_property_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE views ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_block_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Custom Property Definitions
-- ============================================

CREATE POLICY "Users can view definitions for their projects" ON custom_property_definitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create definitions for their projects" ON custom_property_definitions
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update definitions in their projects" ON custom_property_definitions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete definitions in their projects" ON custom_property_definitions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_id
      AND (
        owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policies for Custom Property Values
-- =======================================

CREATE POLICY "Users can view values for tasks in their projects" ON custom_property_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create values for tasks in their projects" ON custom_property_values
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks
      JOIN projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update values for tasks in their projects" ON custom_property_values
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete values for tasks in their projects" ON custom_property_values
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks
      JOIN projects ON tasks.project_id = projects.id
      WHERE tasks.id = task_id
      AND (
        projects.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_users
          WHERE project_id = projects.id AND user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policies for Views
-- ======================

CREATE POLICY "Users can manage their own views" ON views
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for Time Blocks
-- ============================

CREATE POLICY "Users can manage their own time blocks" ON time_blocks
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for Time Block Tasks
-- =================================

CREATE POLICY "Users can manage time block tasks for their blocks" ON time_block_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM time_blocks
      WHERE id = time_block_id AND user_id = auth.uid()
    )
  );

-- Create indexes for performance
-- ==============================

CREATE INDEX IF NOT EXISTS idx_custom_property_definitions_project_id ON custom_property_definitions(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_property_definitions_display_order ON custom_property_definitions(project_id, display_order);
CREATE INDEX IF NOT EXISTS idx_custom_property_values_task_id ON custom_property_values(task_id);
CREATE INDEX IF NOT EXISTS idx_custom_property_values_definition_id ON custom_property_values(definition_id);
CREATE INDEX IF NOT EXISTS idx_views_user_id ON views(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_time_block_tasks_time_block_id ON time_block_tasks(time_block_id);
CREATE INDEX IF NOT EXISTS idx_time_block_tasks_task_id ON time_block_tasks(task_id);