-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule calendar event sync every 5 minutes
-- This will call the sync-events edge function with service role permissions
SELECT cron.schedule(
  'sync-calendar-events-every-5-minutes',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule token refresh every hour (more frequent than the 5-min sync to ensure tokens are always fresh)
SELECT cron.schedule(
  'refresh-calendar-tokens-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-refresh-token',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule cleanup of expired OAuth state tokens every hour
SELECT cron.schedule(
  'cleanup-expired-oauth-tokens',
  '0 * * * *', -- Every hour at minute 0
  'SELECT cleanup_expired_oauth_tokens();'
);

-- View scheduled jobs (for verification)
-- SELECT * FROM cron.job;

-- To unschedule a job (if needed):
-- SELECT cron.unschedule('sync-calendar-events-every-5-minutes');
-- SELECT cron.unschedule('refresh-calendar-tokens-hourly');
-- SELECT cron.unschedule('cleanup-expired-oauth-tokens');
