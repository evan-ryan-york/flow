-- Create oauth_state_tokens table for temporary state storage during OAuth flow
CREATE TABLE IF NOT EXISTS oauth_state_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_oauth_state_tokens_state ON oauth_state_tokens(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_state_tokens_expires ON oauth_state_tokens(expires_at);

-- RLS policies
ALTER TABLE oauth_state_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only access their own state tokens
CREATE POLICY "Users can insert their own state tokens"
  ON oauth_state_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own state tokens"
  ON oauth_state_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own state tokens"
  ON oauth_state_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically clean up expired state tokens
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_state_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Schedule cleanup every hour (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-oauth-tokens', '0 * * * *', 'SELECT cleanup_expired_oauth_tokens()');
