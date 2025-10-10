-- Migration: Setup Automatic Google Calendar Token Refresh
-- Description: Enables pg_cron and schedules automatic token refresh every 30 minutes
-- Date: 2025-10-09

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- First, unschedule any existing token refresh jobs to avoid duplicates
SELECT cron.unschedule('refresh-calendar-tokens-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-calendar-tokens-hourly'
);

SELECT cron.unschedule('refresh-calendar-tokens-every-30-min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-calendar-tokens-every-30-min'
);

-- Schedule token refresh every 30 minutes (more frequent than hourly to prevent expiration)
-- Google OAuth tokens expire after 1 hour, so 30-min refresh ensures we always have valid tokens
SELECT cron.schedule(
  'refresh-calendar-tokens-every-30-min',
  '*/30 * * * *', -- Every 30 minutes
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

-- View scheduled jobs for verification
COMMENT ON EXTENSION pg_cron IS 'Scheduled token refresh runs every 30 minutes to prevent Google OAuth token expiration';

-- To view scheduled jobs, run:
-- SELECT jobid, jobname, schedule, command FROM cron.job;

-- To manually unschedule (if needed):
-- SELECT cron.unschedule('refresh-calendar-tokens-every-30-min');
