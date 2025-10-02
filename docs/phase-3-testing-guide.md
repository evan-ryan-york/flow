# Phase 3 Testing Guide

This guide walks through testing all Edge Functions to ensure Phase 3 is working correctly before proceeding to Phase 4.

---

## Prerequisites

1. **Deploy Edge Functions** (if not already done):
   ```bash
   supabase login
   supabase link --project-ref ewuhxqbfwbenkhnkzokp
   supabase functions deploy google-calendar-oauth
   supabase functions deploy google-calendar-refresh-token
   supabase functions deploy google-calendar-sync-calendars
   supabase functions deploy google-calendar-sync-events
   ```

2. **Get Required Credentials**:
   - User JWT token (get from authenticated session in your app)
   - Service Role Key (from Supabase dashboard → Settings → API)

3. **Verify Secrets Are Set**:
   ```bash
   supabase secrets list
   ```
   Should show: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`

---

## Testing Strategy

We'll test in order of dependencies:

1. OAuth Flow (foundation)
2. Token Refresh (depends on connection existing)
3. Calendar List Sync (depends on valid token)
4. Event Sync (depends on calendar subscriptions)

---

## Test 1: OAuth Flow (Initiate)

### What We're Testing
- Edge Function is deployed and accessible
- State token is generated and stored
- OAuth URL is correctly formatted

### Steps

1. **Get a user JWT token** from your app's authenticated session:
   ```javascript
   // In browser console on authenticated page:
   const session = await supabase.auth.getSession();
   console.log(session.data.session.access_token);
   ```

2. **Call the OAuth initiate endpoint**:
   ```bash
   curl "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-oauth?action=initiate" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"
   ```

3. **Expected Response**:
   ```json
   {
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=...&state=...&access_type=offline&prompt=consent"
   }
   ```

4. **Verify**:
   - Response contains a valid Google OAuth URL
   - URL includes `state=` parameter (should be a UUID)
   - URL includes `access_type=offline` and `prompt=consent`

5. **Check Database**:
   ```sql
   -- Verify state token was created
   SELECT * FROM oauth_state_tokens ORDER BY created_at DESC LIMIT 1;
   ```
   Should show a recent token with your user_id and 5-minute expiry.

### ✅ Success Criteria
- [ ] Edge function returns 200 status
- [ ] Response contains valid `authUrl`
- [ ] State token exists in database
- [ ] State token expires in ~5 minutes

### ❌ Troubleshooting
- **401 Unauthorized**: JWT token is invalid or expired
- **500 Error**: Check function logs: `supabase functions logs google-calendar-oauth`
- **Missing secrets**: Run `supabase secrets list` to verify

---

## Test 2: OAuth Flow (Callback)

### What We're Testing
- OAuth callback processes authorization code
- Tokens are exchanged and stored
- Calendar list sync is triggered

### Steps

1. **Complete OAuth Flow Manually**:
   - Copy the `authUrl` from Test 1
   - Open it in a browser (while logged into Google)
   - Click "Allow" to authorize
   - **You'll be redirected to the callback URL**

2. **Expected Behavior**:
   - Browser shows: "Authorization successful! You can close this window."
   - Or shows an error message if something went wrong

3. **Check Database for Connection**:
   ```sql
   -- Verify connection was created
   SELECT
     id,
     email,
     label,
     expires_at,
     requires_reauth,
     created_at
   FROM google_calendar_connections
   ORDER BY created_at DESC
   LIMIT 1;
   ```

4. **Verify State Token Was Deleted**:
   ```sql
   -- Should be empty or only show other users' tokens
   SELECT * FROM oauth_state_tokens WHERE user_id = 'YOUR_USER_ID';
   ```

5. **Check Function Logs**:
   ```bash
   supabase functions logs google-calendar-oauth --tail
   ```
   Look for any errors during token exchange or database insert.

### ✅ Success Criteria
- [ ] Browser shows success message
- [ ] Connection exists in `google_calendar_connections`
- [ ] Connection has valid `access_token` and `refresh_token`
- [ ] `expires_at` is ~1 hour in the future
- [ ] State token was deleted
- [ ] `requires_reauth` is `false`

### ❌ Troubleshooting
- **"Invalid state parameter"**: State token expired (retry quickly)
- **Token exchange failed**: Check Google OAuth credentials are correct
- **No connection in DB**: Check RLS policies, view function logs

---

## Test 3: Calendar List Sync

### What We're Testing
- Function fetches calendar list from Google
- Calendar subscriptions are created
- User preferences are preserved

### Steps

1. **Get Your Connection ID**:
   ```sql
   SELECT id, email FROM google_calendar_connections WHERE user_id = 'YOUR_USER_ID';
   ```

2. **Trigger Calendar List Sync**:
   ```bash
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-calendars" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"YOUR_CONNECTION_ID"}'
   ```

3. **Expected Response**:
   ```json
   {
     "message": "Synced 3 calendars",
     "calendars": [
       {
         "id": "...",
         "connection_id": "...",
         "google_calendar_id": "primary",
         "calendar_name": "Your Name",
         "is_visible": true,
         "sync_enabled": true,
         "background_color": "#4285f4"
       }
     ],
     "deleted": 0
   }
   ```

4. **Check Database**:
   ```sql
   -- Verify calendar subscriptions were created
   SELECT
     cs.calendar_name,
     cs.is_visible,
     cs.sync_enabled,
     cs.background_color,
     gcc.email as account_email
   FROM calendar_subscriptions cs
   JOIN google_calendar_connections gcc ON cs.connection_id = gcc.id
   WHERE gcc.user_id = 'YOUR_USER_ID'
   ORDER BY cs.calendar_name;
   ```

5. **Test Preference Preservation**:
   ```sql
   -- Toggle a calendar to invisible
   UPDATE calendar_subscriptions
   SET is_visible = false
   WHERE id = 'SOME_SUBSCRIPTION_ID';
   ```

   Then re-run the sync curl command. The `is_visible` should remain `false`.

### ✅ Success Criteria
- [ ] Function returns 200 status
- [ ] Response lists all your Google calendars
- [ ] Calendar subscriptions exist in database
- [ ] Default values: `is_visible=true`, `sync_enabled=true`
- [ ] Re-syncing preserves user's `is_visible` setting
- [ ] Colors match Google Calendar

### ❌ Troubleshooting
- **401 Unauthorized**: JWT token invalid
- **404 Connection not found**: Wrong connection ID or user doesn't own it
- **Google API error**: Check token is valid, may need refresh

---

## Test 4: Token Refresh

### What We're Testing
- Function identifies expiring tokens
- Tokens are refreshed via Google API
- Database is updated with new tokens

### Steps

1. **Manually Expire a Token** (for testing):
   ```sql
   -- Set token to expire in 2 minutes (less than 5-minute threshold)
   UPDATE google_calendar_connections
   SET expires_at = NOW() + INTERVAL '2 minutes'
   WHERE id = 'YOUR_CONNECTION_ID';
   ```

2. **Trigger Token Refresh** (with service role key):
   ```bash
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-refresh-token" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"YOUR_CONNECTION_ID"}'
   ```

3. **Expected Response**:
   ```json
   {
     "message": "Refreshed 1 connection(s), 0 failure(s)",
     "results": [
       {
         "connectionId": "...",
         "success": true
       }
     ]
   }
   ```

4. **Verify Token Was Updated**:
   ```sql
   SELECT
     id,
     email,
     expires_at,
     requires_reauth
   FROM google_calendar_connections
   WHERE id = 'YOUR_CONNECTION_ID';
   ```
   The `expires_at` should now be ~1 hour in the future.

5. **Test Auto-Refresh** (called by other functions):
   ```bash
   # This should auto-refresh before syncing
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-calendars" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"YOUR_CONNECTION_ID"}'
   ```

### ✅ Success Criteria
- [ ] Function returns 200 status
- [ ] Token `expires_at` is extended to ~1 hour
- [ ] `requires_reauth` remains `false`
- [ ] New `access_token` is different from old one
- [ ] Other functions auto-trigger refresh

### ❌ Troubleshooting
- **Refresh failed**: Check Google OAuth credentials
- **"requires re-auth"**: Refresh token was revoked, need to reconnect account
- **No tokens to refresh**: Ensure expires_at is < 5 minutes from now

---

## Test 5: Event Sync

### What We're Testing
- Function fetches events from Google Calendar
- Events are stored in database
- Incremental sync works with syncToken
- All-day events are handled correctly

### Steps

1. **Create Test Events in Google Calendar**:
   - Go to Google Calendar
   - Create 2-3 events (mix of regular and all-day)
   - Note the event titles for verification

2. **Trigger Event Sync**:
   ```bash
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-events" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"YOUR_CONNECTION_ID"}'
   ```

3. **Expected Response**:
   ```json
   {
     "message": "Synced 3 calendar(s), 0 failure(s)",
     "summary": {
       "inserted": 15,
       "updated": 0,
       "deleted": 0
     },
     "results": [
       {
         "subscriptionId": "...",
         "calendarName": "Your Calendar",
         "success": true,
         "inserted": 15,
         "updated": 0,
         "deleted": 0
       }
     ]
   }
   ```

4. **Verify Events in Database**:
   ```sql
   -- Check synced events
   SELECT
     ce.title,
     ce.start_time,
     ce.end_time,
     ce.is_all_day,
     ce.location,
     cs.calendar_name
   FROM calendar_events ce
   JOIN calendar_subscriptions cs ON ce.subscription_id = cs.id
   WHERE ce.user_id = 'YOUR_USER_ID'
   ORDER BY ce.start_time DESC
   LIMIT 10;
   ```

5. **Verify Sync State (Incremental Sync)**:
   ```sql
   -- Check sync tokens are stored
   SELECT
     cs.calendar_name,
     css.last_sync_at,
     css.sync_token IS NOT NULL as has_incremental_sync
   FROM calendar_sync_state css
   JOIN calendar_subscriptions cs ON css.subscription_id = cs.id
   JOIN google_calendar_connections gcc ON cs.connection_id = gcc.id
   WHERE gcc.user_id = 'YOUR_USER_ID';
   ```

6. **Test Incremental Sync**:
   - Update an event in Google Calendar (change title or time)
   - Re-run the sync curl command
   - Check that `updated` count increases and event is updated in DB

7. **Test Event Deletion**:
   - Delete an event in Google Calendar
   - Re-run the sync curl command
   - Check that `deleted` count increases and event is removed from DB

### ✅ Success Criteria
- [ ] Function returns 200 status
- [ ] Events appear in `calendar_events` table
- [ ] Event titles match Google Calendar
- [ ] All-day events have `is_all_day=true`
- [ ] Sync tokens are stored in `calendar_sync_state`
- [ ] Incremental sync works (only fetches changes)
- [ ] Updated events are reflected in DB
- [ ] Deleted events are removed from DB

### ❌ Troubleshooting
- **No events synced**: Check `sync_enabled=true` for subscriptions
- **410 error in logs**: Sync token expired (expected), full sync should retry
- **Missing events**: Check date range (30 days past to 90 days future)
- **All-day events wrong**: Check `is_all_day` logic in function

---

## Test 6: End-to-End Flow

### What We're Testing
- Complete user journey from OAuth to viewing events
- All functions work together seamlessly

### Steps

1. **Start Fresh** (optional - use a test Google account):
   ```sql
   -- Delete existing test data for YOUR_USER_ID only
   DELETE FROM calendar_events WHERE user_id = 'YOUR_USER_ID';
   DELETE FROM calendar_sync_state WHERE subscription_id IN (
     SELECT id FROM calendar_subscriptions WHERE connection_id IN (
       SELECT id FROM google_calendar_connections WHERE user_id = 'YOUR_USER_ID'
     )
   );
   DELETE FROM calendar_subscriptions WHERE connection_id IN (
     SELECT id FROM google_calendar_connections WHERE user_id = 'YOUR_USER_ID'
   );
   DELETE FROM google_calendar_connections WHERE user_id = 'YOUR_USER_ID';
   ```

2. **Complete OAuth Flow**:
   - Call initiate endpoint → get authUrl
   - Visit authUrl in browser → authorize
   - Verify connection created

3. **Sync Calendar List**:
   - Call sync-calendars endpoint
   - Verify subscriptions created

4. **Sync Events**:
   - Call sync-events endpoint
   - Verify events populated

5. **Verify Complete Data**:
   ```sql
   -- See everything together
   SELECT
     gcc.email as account,
     cs.calendar_name,
     ce.title as event_title,
     ce.start_time,
     ce.is_all_day
   FROM google_calendar_connections gcc
   JOIN calendar_subscriptions cs ON cs.connection_id = gcc.id
   JOIN calendar_events ce ON ce.subscription_id = cs.id
   WHERE gcc.user_id = 'YOUR_USER_ID'
   ORDER BY ce.start_time DESC
   LIMIT 20;
   ```

### ✅ Success Criteria
- [ ] OAuth flow completes without errors
- [ ] Calendar list syncs automatically after OAuth
- [ ] Events sync successfully
- [ ] All data is queryable and related correctly
- [ ] No orphaned records

---

## Test 7: Error Handling

### What We're Testing
- Functions handle errors gracefully
- Invalid requests return proper error messages

### Tests

1. **Invalid JWT Token**:
   ```bash
   curl "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-oauth?action=initiate" \
     -H "Authorization: Bearer INVALID_TOKEN"
   ```
   **Expected**: 401 Unauthorized

2. **Missing Connection ID**:
   ```bash
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-calendars" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   **Expected**: 400 Bad Request - "connectionId is required"

3. **Access Other User's Connection**:
   ```bash
   # Try to use another user's connection ID
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-sync-calendars" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"SOMEONE_ELSES_CONNECTION_ID"}'
   ```
   **Expected**: 404 Not Found - "Connection not found or access denied" (RLS blocks it)

4. **Revoked Refresh Token**:
   ```sql
   -- Simulate revoked token by corrupting it
   UPDATE google_calendar_connections
   SET refresh_token = 'INVALID_TOKEN'
   WHERE id = 'YOUR_CONNECTION_ID';
   ```

   Then call token refresh:
   ```bash
   curl -X POST "https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/google-calendar-refresh-token" \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"connectionId":"YOUR_CONNECTION_ID"}'
   ```

   **Expected**: `requires_reauth` is set to `true` in database

### ✅ Success Criteria
- [ ] Invalid auth returns 401
- [ ] Missing params return 400
- [ ] RLS prevents unauthorized access
- [ ] Revoked tokens are flagged for re-auth

---

## Test 8: Performance & Optimization

### What We're Testing
- Incremental sync reduces API calls
- Database queries are efficient
- No N+1 query problems

### Tests

1. **Verify Incremental Sync is Used**:
   ```sql
   -- Check sync tokens exist
   SELECT COUNT(*) FROM calendar_sync_state;
   ```
   Should be > 0 after first sync.

2. **Check Function Performance**:
   ```bash
   # View execution time in logs
   supabase functions logs google-calendar-sync-events --tail
   ```
   Look for response times. Event sync should be < 5 seconds for incremental.

3. **Database Query Analysis**:
   ```sql
   -- Analyze calendar event query performance
   EXPLAIN ANALYZE
   SELECT * FROM calendar_events
   WHERE user_id = 'YOUR_USER_ID'
   AND start_time >= NOW()
   AND start_time <= NOW() + INTERVAL '7 days';
   ```
   Should use indexes (look for "Index Scan" not "Seq Scan").

4. **Test with Multiple Accounts**:
   - Connect 2-3 different Google accounts
   - Run sync-events without connectionId (syncs all)
   - Should process in parallel

### ✅ Success Criteria
- [ ] Sync tokens are stored and used
- [ ] Incremental sync is faster than full sync
- [ ] Database queries use indexes
- [ ] Multiple accounts sync efficiently

---

## Test 9: Cron Jobs (Optional - if set up)

### What We're Testing
- Scheduled jobs run automatically
- Jobs can call functions with service role auth

### Steps

1. **Set Up Cron** (choose one method from `docs/calendar-cron-setup.md`)

2. **Verify Cron Jobs Are Scheduled**:
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Check Cron Execution History**:
   ```sql
   SELECT * FROM cron.job_run_details
   ORDER BY start_time DESC
   LIMIT 10;
   ```

4. **Monitor Logs**:
   ```bash
   # Watch for cron-triggered function calls
   supabase functions logs google-calendar-sync-events --tail
   ```

### ✅ Success Criteria
- [ ] Cron jobs are scheduled
- [ ] Jobs execute on schedule (check every 5 min for events)
- [ ] Function logs show cron-triggered calls
- [ ] No errors in cron execution history

---

## Testing Checklist Summary

### Core Functionality
- [ ] Test 1: OAuth Initiate ✅
- [ ] Test 2: OAuth Callback ✅
- [ ] Test 3: Calendar List Sync ✅
- [ ] Test 4: Token Refresh ✅
- [ ] Test 5: Event Sync ✅

### Integration
- [ ] Test 6: End-to-End Flow ✅
- [ ] Test 7: Error Handling ✅

### Performance
- [ ] Test 8: Performance & Optimization ✅

### Automation (Optional)
- [ ] Test 9: Cron Jobs ✅

---

## Common Issues & Solutions

### Issue: "CORS error" in browser
**Solution**: CORS headers are in functions. If testing from browser, ensure proper Authorization header.

### Issue: "Secrets not found"
**Solution**:
```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="YOUR_ID"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="YOUR_SECRET"
```

### Issue: RLS blocking queries
**Solution**: Use user JWT (not anon key) for user-scoped queries. Use service role for cron jobs.

### Issue: Events not syncing
**Solution**:
1. Check `sync_enabled=true` on subscriptions
2. Verify token is not expired
3. Check Google Calendar API is enabled

### Issue: Incremental sync not working
**Solution**:
1. Verify sync_token exists in `calendar_sync_state`
2. If 410 error, sync token expired (expected), full sync will retry

---

## Next Steps After Testing

Once all tests pass:

1. ✅ **Mark Phase 3 as fully tested**
2. ✅ **Document any issues found and resolutions**
3. ✅ **Proceed to Phase 4: Data Layer (TanStack Query Hooks)**

---

## Quick Test Script

Save this as `test-phase-3.sh` for quick testing:

```bash
#!/bin/bash

# Configuration
USER_JWT="YOUR_USER_JWT_TOKEN"
SERVICE_KEY="YOUR_SERVICE_ROLE_KEY"
BASE_URL="https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1"

echo "🧪 Testing Phase 3 Edge Functions..."

echo "\n1️⃣ Testing OAuth Initiate..."
curl -s "$BASE_URL/google-calendar-oauth?action=initiate" \
  -H "Authorization: Bearer $USER_JWT" | jq

echo "\n2️⃣ Testing Token Refresh..."
curl -s -X POST "$BASE_URL/google-calendar-refresh-token" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" | jq

echo "\n✅ Manual steps required:"
echo "   - Complete OAuth flow in browser"
echo "   - Run calendar sync with your connection ID"
echo "   - Run event sync with your connection ID"
```

Make executable: `chmod +x test-phase-3.sh`

---

## Success Criteria for Phase 3

Phase 3 is considered **fully tested and complete** when:

- ✅ All 5 core function tests pass
- ✅ End-to-end flow works without errors
- ✅ Error handling behaves as expected
- ✅ Database contains properly synced data
- ✅ Incremental sync is working (sync tokens stored)
- ✅ RLS policies prevent unauthorized access
- ✅ Function logs show no errors

**Ready to proceed to Phase 4!** 🚀
