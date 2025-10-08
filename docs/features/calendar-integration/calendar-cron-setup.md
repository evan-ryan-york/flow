# Calendar Sync Cron Job Setup

## Option 1: Using pg_cron (Recommended for Production)

### Prerequisites
1. Enable pg_cron extension in Supabase dashboard
2. Store service role key in Postgres settings

### Setup Steps

1. **Enable pg_cron extension** (via Supabase SQL Editor):
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

2. **Store service role key** (one-time setup):
```sql
-- Replace YOUR_SERVICE_ROLE_KEY with actual key from Supabase dashboard
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

3. **Apply the cron migration**:
```bash
psql "postgresql://postgres.ewuhxqbfwbenkhnkzokp:bVK*uKBtLv\$pnL8@aws-1-us-east-2.pooler.supabase.com:6543/postgres" -f supabase/migrations/20251002000003_setup_calendar_sync_cron.sql
```

4. **Verify cron jobs are scheduled**:
```sql
SELECT * FROM cron.job;
```

### Scheduled Jobs

- **sync-calendar-events-every-5-minutes**: Runs every 5 minutes to sync events from Google Calendar
- **refresh-calendar-tokens-hourly**: Runs every hour to refresh expiring OAuth tokens
- **cleanup-expired-oauth-tokens**: Runs every hour to clean up expired OAuth state tokens

### Managing Cron Jobs

**List all jobs**:
```sql
SELECT * FROM cron.job;
```

**Unschedule a job**:
```sql
SELECT cron.unschedule('sync-calendar-events-every-5-minutes');
```

**View job run history**:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Option 2: Using Supabase Edge Functions Cron (Simpler)

Supabase now supports native cron triggers for Edge Functions via their dashboard.

### Setup Steps

1. Go to Supabase Dashboard → Edge Functions
2. For `google-calendar-sync-events` function:
   - Click "Create Trigger"
   - Select "Cron"
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Save

3. For `google-calendar-refresh-token` function:
   - Click "Create Trigger"
   - Select "Cron"
   - Schedule: `0 * * * *` (every hour)
   - Save

This is simpler but requires Edge Functions to be deployed first.

---

## Option 3: External Cron Service (Development/Testing)

For local development or testing, you can use an external service like:
- **Cron-job.org** (free)
- **EasyCron**
- **GitHub Actions scheduled workflow**

Example GitHub Actions workflow (`.github/workflows/calendar-sync.yml`):

```yaml
name: Calendar Sync Cron

on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Event Sync
        run: |
          curl -X POST \
            https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-events \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

---

## Testing Cron Jobs

### Manual Trigger (for testing):

**Sync Events**:
```bash
curl -X POST \
  https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-events \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Refresh Tokens**:
```bash
curl -X POST \
  https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-refresh-token \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Check Logs

Monitor Edge Function logs in Supabase Dashboard → Edge Functions → Logs

---

## Recommended Approach

**For Production**: Use Option 1 (pg_cron) or Option 2 (Supabase native cron)
**For Development**: Use Option 3 (manual triggers or external service)

The pg_cron approach (Option 1) is most reliable and doesn't require Edge Functions to be deployed, but requires one-time setup.

Supabase native cron (Option 2) is simpler but requires Edge Functions to be deployed first.
