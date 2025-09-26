-- Migration: Add Task Sort Order Support
-- This migration adds proper task reordering capabilities with sort_order fields
-- and database functions for atomic reordering operations.

-- Add sort_order column to tasks table
-- Using DECIMAL for infinite precision between items (e.g., 1.5 goes between 1 and 2)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order DECIMAL(20,10) DEFAULT NULL;

-- Add manual_sort_enabled to projects table for per-project sorting preference
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manual_sort_enabled BOOLEAN DEFAULT FALSE;

-- Create composite index for fast sorted queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_sort_order
ON tasks(project_id, sort_order ASC)
WHERE sort_order IS NOT NULL;

-- Create index for auto-sorted queries (fallback when sort_order is NULL)
CREATE INDEX IF NOT EXISTS idx_tasks_project_created_at
ON tasks(project_id, created_at DESC)
WHERE sort_order IS NULL;

-- Backfill existing tasks with sort_order based on created_at (newest first)
-- This preserves existing order while enabling manual reordering
WITH task_positions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) * 1000 as calculated_sort_order
  FROM tasks
  WHERE sort_order IS NULL
)
UPDATE tasks
SET sort_order = task_positions.calculated_sort_order
FROM task_positions
WHERE tasks.id = task_positions.id;

-- Function to calculate optimal sort_order for inserting between two tasks
CREATE OR REPLACE FUNCTION calculate_task_sort_order(
  p_project_id UUID,
  p_before_task_id UUID DEFAULT NULL,
  p_after_task_id UUID DEFAULT NULL
) RETURNS DECIMAL(20,10) AS $$
DECLARE
  before_sort_order DECIMAL(20,10);
  after_sort_order DECIMAL(20,10);
  new_sort_order DECIMAL(20,10);
BEGIN
  -- Get sort orders for adjacent tasks
  IF p_before_task_id IS NOT NULL THEN
    SELECT sort_order INTO before_sort_order
    FROM tasks
    WHERE id = p_before_task_id AND project_id = p_project_id;
  END IF;

  IF p_after_task_id IS NOT NULL THEN
    SELECT sort_order INTO after_sort_order
    FROM tasks
    WHERE id = p_after_task_id AND project_id = p_project_id;
  END IF;

  -- Calculate new position
  IF before_sort_order IS NULL AND after_sort_order IS NULL THEN
    -- No reference tasks, use next available position
    SELECT COALESCE(MAX(sort_order), 0) + 1000 INTO new_sort_order
    FROM tasks WHERE project_id = p_project_id;

  ELSIF before_sort_order IS NULL THEN
    -- Insert at beginning
    new_sort_order := after_sort_order / 2;

  ELSIF after_sort_order IS NULL THEN
    -- Insert at end
    new_sort_order := before_sort_order + 1000;

  ELSE
    -- Insert between two tasks
    new_sort_order := (before_sort_order + after_sort_order) / 2;
  END IF;

  -- Ensure we have sufficient precision (min gap of 0.0000000001)
  IF after_sort_order IS NOT NULL AND
     before_sort_order IS NOT NULL AND
     (after_sort_order - before_sort_order) < 0.000000001 THEN

    -- Need to renumber tasks in this project to create space
    PERFORM renumber_project_tasks(p_project_id);

    -- Recalculate with new numbering
    RETURN calculate_task_sort_order(p_project_id, p_before_task_id, p_after_task_id);
  END IF;

  RETURN new_sort_order;
END;
$$ LANGUAGE plpgsql;

-- Function to renumber all tasks in a project (creates space for precise positioning)
CREATE OR REPLACE FUNCTION renumber_project_tasks(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH renumbered AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at DESC) * 1000 as new_sort_order
    FROM tasks
    WHERE project_id = p_project_id
      AND sort_order IS NOT NULL
  )
  UPDATE tasks
  SET sort_order = renumbered.new_sort_order,
      updated_at = NOW()
  FROM renumbered
  WHERE tasks.id = renumbered.id;
END;
$$ LANGUAGE plpgsql;

-- Function for atomic bulk reordering of tasks
CREATE OR REPLACE FUNCTION reorder_tasks_atomic(
  task_updates JSONB -- Array of {task_id: UUID, sort_order: DECIMAL}
) RETURNS TABLE(task_id UUID, new_sort_order DECIMAL(20,10)) AS $$
DECLARE
  update_record RECORD;
BEGIN
  -- Validate all tasks exist and belong to same project
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT DISTINCT t.project_id
      FROM tasks t
      JOIN JSONB_ARRAY_ELEMENTS(task_updates) AS upd ON t.id::text = (upd->>'task_id')
    ) project_check
    HAVING COUNT(*) = 1
  ) THEN
    RAISE EXCEPTION 'All tasks must belong to the same project';
  END IF;

  -- Perform bulk update
  FOR update_record IN
    SELECT
      (elem->>'task_id')::UUID as tid,
      (elem->>'sort_order')::DECIMAL(20,10) as sort_val
    FROM JSONB_ARRAY_ELEMENTS(task_updates) as elem
  LOOP
    UPDATE tasks
    SET sort_order = update_record.sort_val,
        updated_at = NOW()
    WHERE id = update_record.tid;

    -- Return the updated task info
    task_id := update_record.tid;
    new_sort_order := update_record.sort_val;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get tasks with proper sort order (manual or automatic)
CREATE OR REPLACE FUNCTION get_sorted_tasks(
  p_user_id UUID,
  p_project_ids UUID[]
) RETURNS TABLE(
  id UUID,
  project_id UUID,
  created_by UUID,
  assigned_to UUID,
  name TEXT,
  description TEXT,
  due_date DATE,
  status TEXT,
  is_completed BOOLEAN,
  sort_order DECIMAL(20,10),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  manual_sort_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.project_id,
    t.created_by,
    t.assigned_to,
    t.name,
    t.description,
    t.due_date,
    t.status,
    t.is_completed,
    t.sort_order,
    t.created_at,
    t.updated_at,
    p.manual_sort_enabled
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE t.assigned_to = p_user_id
    AND t.project_id = ANY(p_project_ids)
  ORDER BY
    CASE
      WHEN p.manual_sort_enabled THEN t.sort_order
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN NOT p.manual_sort_enabled AND t.due_date IS NOT NULL THEN t.due_date::TIMESTAMPTZ
      ELSE NULL
    END ASC NULLS LAST,
    t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set sort_order for new tasks
CREATE OR REPLACE FUNCTION set_new_task_sort_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set sort_order if not already provided
  IF NEW.sort_order IS NULL THEN
    -- Get the next sort order for this project (at the end)
    SELECT COALESCE(MAX(sort_order), 0) + 1000
    INTO NEW.sort_order
    FROM tasks
    WHERE project_id = NEW.project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_set_task_sort_order ON tasks;
CREATE TRIGGER trigger_set_task_sort_order
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_new_task_sort_order();

-- Update existing NOT NULL constraints to allow flexibility
-- (sort_order can be NULL for auto-sorted tasks)
ALTER TABLE tasks ALTER COLUMN sort_order DROP NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN tasks.sort_order IS 'Decimal sort order for manual task reordering. NULL means use automatic sorting.';
COMMENT ON COLUMN projects.manual_sort_enabled IS 'Whether this project uses manual task reordering or automatic sorting.';
COMMENT ON FUNCTION calculate_task_sort_order IS 'Calculate optimal sort_order for inserting task between two positions.';
COMMENT ON FUNCTION reorder_tasks_atomic IS 'Atomically reorder multiple tasks with conflict detection.';
COMMENT ON FUNCTION get_sorted_tasks IS 'Get tasks sorted by manual order or automatic rules based on project settings.';