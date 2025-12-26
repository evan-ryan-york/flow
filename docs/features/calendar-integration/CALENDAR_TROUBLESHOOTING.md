# Google Calendar Integration - Troubleshooting Guide

**Flow** | Technical Support

---

## 🔍 Quick Diagnostics

Before diving into specific issues, run these quick checks:

### System Check
- [ ] Internet connection active
- [ ] Browser/app up to date
- [ ] Logged in to Flow
- [ ] Logged in to Google Account

### Calendar Integration Check
- [ ] At least one account connected
- [ ] At least one calendar checked (visible)
- [ ] Events exist in Google Calendar for the date range

---

## 🚨 Common Issues & Solutions

## Issue 1: Can't Connect Google Account

### Symptoms
- OAuth flow fails
- "Access Denied" error
- Redirect doesn't return to app
- Connection doesn't appear after OAuth

### Possible Causes & Solutions

#### Cause A: Pop-ups Blocked
**Solution:**
1. Check if browser blocked the pop-up
2. Allow pop-ups for Flow domain
3. Try again

#### Cause B: Third-Party Cookies Disabled
**Solution:**
1. Enable third-party cookies for Flow
2. Or use Chrome/Safari (better OAuth support)

#### Cause C: Google Account Permissions
**Solution:**
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Check if Flow is listed
3. If listed but not working, remove it
4. Try connecting again

#### Cause D: Incorrect Redirect URI
**Solution (Developer):**
1. Check Google Cloud Console
2. Verify redirect URI matches: `https://your-domain.com/functions/v1/google-calendar-oauth-callback`
3. Update if incorrect

#### Cause E: OAuth Consent Screen Not Published
**Solution (Developer):**
1. Go to Google Cloud Console
2. Publish OAuth consent screen
3. Ensure all scopes are added

---

## Issue 2: Events Not Syncing

### Symptoms
- Events visible in Google Calendar
- Events not appearing in Flow
- Sync button doesn't help

### Diagnostics

**Step 1: Check Calendar Visibility**
1. Go to Settings → Calendar Connections
2. Verify the calendar is **checked** (visible)
3. If unchecked, check it

**Step 2: Check Date Range**
1. Events only sync for: 30 days past to 90 days future
2. Navigate to the date of the event
3. Trigger manual sync

**Step 3: Check Event Ownership**
1. Verify you have access to the event in Google Calendar
2. Declined events may not sync

**Step 4: Manual Sync**
1. Click refresh button (🔄) in calendar header
2. Wait 10 seconds
3. Check if events appear

**Step 5: Database Check (Developer)**
```sql
-- Check if connection exists
SELECT * FROM google_calendar_connections WHERE user_id = 'your-user-id';

-- Check if subscription exists
SELECT * FROM calendar_subscriptions WHERE connection_id = 'connection-id';

-- Check if events synced
SELECT COUNT(*) FROM calendar_events WHERE subscription_id = 'subscription-id';
```

### Solutions

#### Solution A: Trigger Calendar List Sync
1. Go to Settings → Calendar Connections
2. Click refresh icon (🔄) on the account
3. Verify calendar appears and is checked

#### Solution B: Reconnect Account
1. Disconnect the account
2. Wait 10 seconds
3. Reconnect the account
4. Check calendar visibility
5. Trigger manual sync

#### Solution C: Check Supabase Edge Function Logs (Developer)
1. Open Supabase Dashboard
2. Go to Edge Functions → Logs
3. Look for errors in `google-calendar-sync-events`
4. Fix any API errors

---

## Issue 3: "Re-authentication Required" Warning

### Symptoms
- Red warning in Settings
- "⚠️ Re-authentication required" message
- Syncs fail

### Cause
Your refresh token has expired or been revoked by Google.

### Solution

**Step 1: Disconnect Account**
1. Go to Settings → Calendar Connections
2. Find the account with the warning
3. Click trash icon (🗑️)
4. Confirm deletion

**Step 2: Reconnect Account**
1. Click "Connect New Account"
2. Use the same Google account
3. Grant permissions
4. Events will re-sync automatically

**Step 3: Verify Token in Database (Developer)**
```sql
UPDATE google_calendar_connections
SET requires_reauth = false
WHERE id = 'connection-id';
```

### Prevention
- Don't revoke app permissions in Google Account settings
- Don't change Google account password without re-authenticating
- Reconnect periodically if not used for 6+ months

---

## Issue 4: Slow Performance / App Freezing

### Symptoms
- Calendar takes long to load
- Scrolling is janky
- Browser tab unresponsive

### Diagnostics

**Check Event Count:**
```sql
SELECT COUNT(*) FROM calendar_events WHERE subscription_id IN (
  SELECT id FROM calendar_subscriptions WHERE user_id = 'your-user-id'
);
```

If count > 1000, performance may degrade.

### Solutions

#### Solution A: Hide Unused Calendars
1. Go to Settings → Calendar Connections
2. Uncheck calendars you don't actively use
3. This reduces events loaded

#### Solution B: Disconnect Unused Accounts
1. Disconnect accounts you haven't used in months
2. This frees up database space and improves queries

#### Solution C: Clear Browser Cache
1. Clear cache for Flow domain
2. Reload page
3. Data will re-sync

#### Solution D: Optimize Database (Developer)
```sql
-- Vacuum events table
VACUUM ANALYZE calendar_events;

-- Reindex
REINDEX TABLE calendar_events;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'calendar_events'
ORDER BY idx_scan ASC;
```

---

## Issue 5: Wrong Times Displayed

### Symptoms
- Event times off by 1 hour
- Events showing at wrong time
- All-day events showing as timed events

### Cause
Timezone conversion issues.

### Diagnostics

**Check Event in Database:**
```sql
SELECT title, start_time, end_time, is_all_day
FROM calendar_events
WHERE title = 'Your Event Title';
```

**Check Timezone:**
```javascript
console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);
// Should show your local timezone
```

### Solutions

#### Solution A: Verify Browser Timezone
1. Check system timezone settings
2. Reload page
3. Browser uses system timezone

#### Solution B: Check Google Calendar Timezone
1. Open Google Calendar settings
2. Verify timezone matches your location
3. Adjust if incorrect
4. Re-sync in Flow

#### Solution C: Force Re-sync
1. Disconnect account
2. Reconnect account
3. Events will sync with correct timezone

---

## Issue 6: Duplicate Events

### Symptoms
- Same event appears multiple times
- Events doubled after sync

### Cause
Sync token issue or duplicate subscriptions.

### Diagnostics

**Check Database:**
```sql
-- Find duplicate events
SELECT google_calendar_event_id, COUNT(*)
FROM calendar_events
GROUP BY google_calendar_event_id
HAVING COUNT(*) > 1;

-- Check duplicate subscriptions
SELECT google_calendar_id, COUNT(*)
FROM calendar_subscriptions
WHERE user_id = 'your-user-id'
GROUP BY google_calendar_id
HAVING COUNT(*) > 1;
```

### Solutions

#### Solution A: Clear Sync State
```sql
-- Reset sync tokens (forces full re-sync)
UPDATE calendar_sync_state
SET sync_token = NULL
WHERE subscription_id IN (
  SELECT id FROM calendar_subscriptions WHERE user_id = 'your-user-id'
);

-- Delete all events
DELETE FROM calendar_events WHERE subscription_id IN (
  SELECT id FROM calendar_subscriptions WHERE user_id = 'your-user-id'
);
```

Then trigger manual sync.

#### Solution B: Remove Duplicate Subscriptions
```sql
-- Find duplicates
SELECT * FROM calendar_subscriptions
WHERE user_id = 'your-user-id'
AND google_calendar_id IN (
  SELECT google_calendar_id FROM calendar_subscriptions
  WHERE user_id = 'your-user-id'
  GROUP BY google_calendar_id
  HAVING COUNT(*) > 1
);

-- Delete duplicates (keep one)
DELETE FROM calendar_subscriptions WHERE id = 'duplicate-subscription-id';
```

---

## Issue 7: Colors Not Matching Google Calendar

### Symptoms
- Event colors different from Google Calendar
- All events same color

### Solutions

#### Solution A: Refresh Calendar Metadata
1. Go to Settings → Calendar Connections
2. Click refresh icon (🔄) on account
3. This syncs calendar colors

#### Solution B: Check Database Values
```sql
SELECT calendar_name, calendar_color, background_color
FROM calendar_subscriptions
WHERE user_id = 'your-user-id';
```

#### Solution C: Force Color Update (Developer)
Trigger `google-calendar-sync-calendars` Edge Function to re-fetch colors.

---

## Issue 8: Cron Job Not Running

### Symptoms
- Events only sync on manual refresh
- No automatic syncing every 5 minutes

### Diagnostics

**Check Supabase Cron Jobs (Developer):**
1. Open Supabase Dashboard
2. Go to Database → Cron Jobs
3. Verify jobs are enabled and scheduled

```sql
-- Check cron job status
SELECT jobname, schedule, last_run, next_run
FROM cron.job;
```

### Solutions

#### Solution A: Enable Cron Extension
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Solution B: Re-create Cron Jobs
Run the cron setup migration:
```bash
psql "postgresql://..." -f supabase/migrations/20251002000003_setup_calendar_sync_cron.sql
```

#### Solution C: Use External Cron Service
Set up GitHub Actions, Vercel Cron, or similar to call Edge Functions on schedule.

---

## Issue 9: OAuth Callback 500 Error

### Symptoms
- OAuth flow redirects back
- Shows "Error 500" or "Internal Server Error"
- Connection not created

### Diagnostics

**Check Edge Function Logs:**
1. Supabase Dashboard → Edge Functions → Logs
2. Look for errors in `google-calendar-oauth`

**Common Errors:**
- Missing environment variables
- Invalid client secret
- Database connection failed

### Solutions

#### Solution A: Verify Environment Variables
```bash
# Check Supabase secrets
supabase secrets list

# Should show:
# GOOGLE_OAUTH_CLIENT_ID
# GOOGLE_OAUTH_CLIENT_SECRET
```

#### Solution B: Re-deploy Edge Function
```bash
supabase functions deploy google-calendar-oauth
```

#### Solution C: Check RLS Policies
```sql
-- Verify user can insert connections
SELECT * FROM google_calendar_connections
WHERE user_id = 'test-user-id';
-- Should not fail with permission error
```

---

## Issue 10: High Memory Usage

### Symptoms
- Browser tab using > 500MB RAM
- Page becomes slow over time

### Solutions

#### Solution A: Limit Visible Date Range
- Only load 1 week at a time
- Don't navigate too far forward/backward

#### Solution B: Reduce Connected Calendars
- Hide calendars you don't actively use
- Disconnect unused accounts

#### Solution C: Restart Browser/App
- Close and reopen tab
- Data will reload fresh

---

## 🛠️ Developer Tools

### Useful Database Queries

**Check Connection Health:**
```sql
SELECT
  id,
  email,
  label,
  expires_at,
  requires_reauth,
  (expires_at < NOW()) as token_expired
FROM google_calendar_connections
WHERE user_id = 'your-user-id';
```

**Check Subscription Status:**
```sql
SELECT
  cs.calendar_name,
  cs.is_visible,
  cs.sync_enabled,
  COUNT(ce.id) as event_count
FROM calendar_subscriptions cs
LEFT JOIN calendar_events ce ON ce.subscription_id = cs.id
WHERE cs.user_id = 'your-user-id'
GROUP BY cs.id, cs.calendar_name, cs.is_visible, cs.sync_enabled;
```

**Check Sync State:**
```sql
SELECT
  cs.calendar_name,
  css.last_sync,
  css.sync_token IS NOT NULL as has_sync_token
FROM calendar_sync_state css
JOIN calendar_subscriptions cs ON cs.id = css.subscription_id
WHERE cs.user_id = 'your-user-id';
```

**Find Events in Date Range:**
```sql
SELECT title, start_time, end_time, cs.calendar_name
FROM calendar_events ce
JOIN calendar_subscriptions cs ON cs.id = ce.subscription_id
WHERE cs.user_id = 'your-user-id'
AND ce.start_time >= '2025-10-01'
AND ce.end_time <= '2025-10-31'
ORDER BY ce.start_time;
```

### Edge Function Testing

**Test OAuth Initiate:**
```bash
curl -X GET \
  'https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-oauth?action=initiate' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**Test Token Refresh:**
```bash
curl -X POST \
  'https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-refresh-token' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"connectionId": "connection-uuid"}'
```

**Test Event Sync:**
```bash
curl -X POST \
  'https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-sync-events' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"connectionId": "connection-uuid"}'
```

---

## 📞 Getting Help

### Still Having Issues?

**Option 1: Check Documentation**
- [User Guide](./CALENDAR_USER_GUIDE.md)
- [Testing Guide](./PHASE_6_TESTING_GUIDE.md)
- [Build Plan](./calendar-integration-build-plan.md)

**Option 2: Contact Support**
- Email: support@flowapp.com
- Include:
  - Description of issue
  - Steps to reproduce
  - Screenshots
  - Browser/device info
  - Account email (for investigation)

**Option 3: File a Bug Report**
- GitHub Issues: [github.com/your-repo/issues](https://github.com)
- Include error logs and stack traces

---

## 🔒 Security Issues

**Found a security vulnerability?**

**DO NOT** post publicly.

Email: security@flowapp.com

Include:
- Detailed description
- Steps to reproduce
- Potential impact
- Suggested fix (if known)

We take security seriously and will respond within 24 hours.

---

**Last Updated:** October 2, 2025
**Version:** 1.0
