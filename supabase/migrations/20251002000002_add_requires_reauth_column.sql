-- Add requires_reauth column to google_calendar_connections
ALTER TABLE google_calendar_connections
ADD COLUMN IF NOT EXISTS requires_reauth BOOLEAN DEFAULT false;

-- Create index for filtering connections that need reauth
CREATE INDEX IF NOT EXISTS idx_google_calendar_connections_requires_reauth
ON google_calendar_connections(requires_reauth) WHERE requires_reauth = true;
