-- Add color column to projects table for project customization
ALTER TABLE projects
ADD COLUMN color TEXT CHECK (color IN ('rose', 'amber', 'mint', 'sky', 'violet', 'lime', 'teal', 'crimson')) DEFAULT 'sky';

-- Update existing projects to have default color
UPDATE projects SET color = 'sky' WHERE color IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.color IS 'Project color for visual customization. Must be one of: rose, amber, mint, sky, violet, lime, teal, crimson';