-- Migration: Setup Automatic Microsoft Calendar Sync
-- Description: Schedules automatic Microsoft token refresh and event sync
-- Date: 2025-12-28

-- ============================================
-- Microsoft Token Refresh (every 30 minutes)
-- ============================================

-- Remove any existing Microsoft token refresh jobs
SELECT cron.unschedule('refresh-microsoft-tokens-every-30-min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-microsoft-tokens-every-30-min'
);

-- Schedule Microsoft token refresh every 30 minutes
-- Microsoft OAuth tokens typically expire after 1 hour
SELECT cron.schedule(
  'refresh-microsoft-tokens-every-30-min',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/microsoft-calendar-refresh-token',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================
-- Microsoft Event Sync (every 5 minutes)
-- ============================================

-- Remove any existing Microsoft event sync jobs
SELECT cron.unschedule('sync-microsoft-events-every-5-minutes') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-microsoft-events-every-5-minutes'
);

-- Schedule Microsoft calendar event sync every 5 minutes
SELECT cron.schedule(
  'sync-microsoft-events-every-5-minutes',
  '*/5 * * * *', -- Every 5 minutes (offset by 2-3 minutes from Google to avoid overlapping)
  $$
  SELECT
    net.http_post(
      url := 'https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/microsoft-calendar-sync-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================
-- Verification
-- ============================================

-- To view all scheduled jobs, run:
-- SELECT jobid, jobname, schedule, active FROM cron.job;

-- To manually unschedule (if needed):
-- SELECT cron.unschedule('refresh-microsoft-tokens-every-30-min');
-- SELECT cron.unschedule('sync-microsoft-events-every-5-minutes');
