# Google Calendar Token Refresh Setup

## Overview
This document describes the automatic token refresh system implemented to prevent Google Calendar authentication issues.

## Problem Solved
Google OAuth access tokens expire after **1 hour**. Previously, if users didn't interact with the calendar for over an hour, their tokens would expire and they'd need to reauthorize. This has been fixed with a multi-layered approach.

## Solution Architecture

### 1. **Proactive Token Refresh (Edge Functions)**
Updated edge functions to check token expiry **before** making Google API calls:

**Modified Files:**
- `supabase/functions/google-calendar-sync-calendars/index.ts` (lines 107-122)
- `supabase/functions/google-calendar-sync-events/index.ts` (lines 333-349)

**Logic:**
```typescript
const expiresAt = new Date(connection.expires_at);
const now = new Date();

// Always refresh if token is expired or expiring within 5 minutes
if (expiresAt <= now || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
  await refreshTokenIfNeeded(connection.id);
}
```

### 2. **Automatic Token Refresh (pg_cron)**
Configured PostgreSQL cron jobs to automatically refresh tokens in the background:

**Cron Job 1: Token Refresh**
- **Schedule:** Every 30 minutes (`*/30 * * * *`)
- **Function:** `google-calendar-refresh-token`
- **Purpose:** Proactively refresh tokens before they expire

**Cron Job 2: Event Sync**
- **Schedule:** Every 5 minutes (`*/5 * * * *`)
- **Function:** `google-calendar-sync-events`
- **Purpose:** Keep calendar events fresh and in sync

**Migration Files:**
- `supabase/migrations/20251009000000_setup_token_refresh_cron.sql`
- `supabase/migrations/20251009000001_setup_calendar_event_sync_cron.sql`

## How It Works

### User-Initiated Sync
1. User triggers calendar sync (manual or automatic)
2. Edge function checks if token is expired/expiring
3. If yes → calls `google-calendar-refresh-token` endpoint
4. Fetches updated token from database
5. Uses fresh token for Google API call

### Background Refresh
1. pg_cron triggers every 30 minutes
2. Calls `google-calendar-refresh-token` edge function with service role key
3. Function queries all connections expiring within 5 minutes
4. Refreshes tokens using Google's refresh token
5. Updates database with new access tokens

## Monitoring & Maintenance

### View Active Cron Jobs
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobid;
```

### Check Token Expiry Status
```sql
SELECT
  id,
  email,
  label,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 AS minutes_until_expiry,
  requires_reauth
FROM google_calendar_connections
ORDER BY expires_at;
```

### Manual Token Refresh
```bash
curl -X POST \
  https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-refresh-token \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "CONNECTION_ID"}'
```

### Disable Cron Jobs (if needed)
```sql
-- Disable token refresh
SELECT cron.unschedule('refresh-calendar-tokens-every-30-min');

-- Disable event sync
SELECT cron.unschedule('sync-calendar-events-every-5-minutes');
```

## Deployment Status

✅ **Deployed:**
- Edge functions updated and deployed (Oct 9, 2025)
- pg_cron jobs created and active (Oct 9, 2025)

**Production URL:** `https://<your-supabase-project>.supabase.co`

## Testing

### Verify Token Refresh Works
1. Wait for a token to expire (or manually set `expires_at` to past time)
2. Trigger manual sync from UI
3. Check logs - should see "🔄 Token expired or expiring soon, refreshing..."
4. Verify token is refreshed without requiring reauthorization

### Verify Cron Jobs Work
1. Check cron execution logs in Supabase Dashboard
2. Monitor `google_calendar_connections` table for updated `expires_at` values
3. Verify tokens are being refreshed every 30 minutes

## Benefits

1. **No More Reauthorization:** Users never need to reauthorize if they already have a valid refresh token
2. **Seamless Experience:** Token refresh happens transparently in the background
3. **Redundant Safety:** Multiple layers ensure tokens stay fresh:
   - Cron job every 30 minutes
   - On-demand refresh before API calls
   - 5-minute buffer before expiry

## Troubleshooting

### Issue: Token still expired
**Cause:** Refresh token might be invalid/revoked
**Solution:** Check `requires_reauth` flag and prompt user to reconnect

### Issue: Cron jobs not running
**Cause:** pg_cron extension might be disabled
**Solution:** Re-run migration `20251009000000_setup_token_refresh_cron.sql`

### Issue: Service role key not found
**Cause:** Database config setting not set
**Solution:** Contact Supabase support to configure `app.settings.service_role_key`

---

**Last Updated:** October 9, 2025
**Author:** Claude Code
**Status:** ✅ Production Ready
