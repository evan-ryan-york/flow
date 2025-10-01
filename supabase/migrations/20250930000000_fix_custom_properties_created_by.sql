-- Fix custom properties created_by field to use auth.uid() automatically
-- This ensures RLS policies work correctly

-- Create a function to automatically set created_by to auth.uid()
CREATE OR REPLACE FUNCTION set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set created_by on insert
DROP TRIGGER IF EXISTS set_created_by_trigger ON custom_property_definitions;
CREATE TRIGGER set_created_by_trigger
  BEFORE INSERT ON custom_property_definitions
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by();

-- Update any existing records where created_by might not match the actual creator
-- This is safe because users can only see/update their own definitions due to RLS
UPDATE custom_property_definitions
SET created_by = auth.uid()
WHERE created_by IS NULL OR created_by != auth.uid();
