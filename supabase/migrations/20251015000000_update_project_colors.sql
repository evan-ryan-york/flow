-- Update project color constraint with new color palette
-- This migration updates the projects.color column to support the new 20-color palette

-- Drop existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_color_check;

-- Add new constraint with expanded color palette (24 colors in 6×4 grid)
ALTER TABLE projects
ADD CONSTRAINT projects_color_check CHECK (
  color IN (
    'red', 'orange-red', 'orange', 'amber', 'yellow', 'lime',
    'green', 'emerald', 'teal', 'cyan', 'light-blue', 'blue',
    'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
    'magenta', 'hot-pink', 'plum', 'gray', 'dark-gray', 'charcoal'
  )
);

-- Update default value for new projects
ALTER TABLE projects ALTER COLUMN color SET DEFAULT 'blue';

-- Migrate existing colors to closest new color equivalents
-- Old color -> New color mappings:
-- 'sky' -> 'blue'
-- 'mint' -> 'emerald'
-- 'crimson' -> 'red'
-- 'rose', 'amber', 'lime', 'teal', 'violet' -> remain the same

UPDATE projects SET color = 'blue' WHERE color = 'sky';
UPDATE projects SET color = 'emerald' WHERE color = 'mint';
UPDATE projects SET color = 'red' WHERE color = 'crimson';

-- Update comment for documentation
COMMENT ON COLUMN projects.color IS 'Project color for visual customization. Supports 24 colors in 6×4 grid: red, orange-red, orange, amber, yellow, lime, green, emerald, teal, cyan, light-blue, blue, indigo, violet, purple, fuchsia, pink, rose, magenta, hot-pink, plum, gray, dark-gray, charcoal';
