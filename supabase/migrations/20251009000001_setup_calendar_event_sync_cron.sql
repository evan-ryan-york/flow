-- Migration: Setup Automatic Calendar Event Sync
-- Description: Schedules automatic calendar event sync every 5 minutes
-- Date: 2025-10-09

-- Remove any existing event sync jobs
SELECT cron.unschedule('sync-calendar-events-every-5-minutes') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-calendar-events-every-5-minutes'
);

-- Schedule calendar event sync every 5 minutes
-- This keeps calendar events fresh and in sync with Google Calendar
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

-- To view scheduled jobs, run:
-- SELECT jobid, jobname, schedule, active FROM cron.job;

-- To manually unschedule (if needed):
-- SELECT cron.unschedule('sync-calendar-events-every-5-minutes');
