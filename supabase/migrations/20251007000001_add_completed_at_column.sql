-- Add completed_at column to tasks table
-- This tracks when a task was marked as completed

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add comment to explain the column
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when the task was marked as completed. NULL if task is not completed or was uncompleted.';
