-- Remove status column from tasks table
-- We're keeping only is_completed boolean to track task completion

ALTER TABLE tasks DROP COLUMN IF EXISTS status;
