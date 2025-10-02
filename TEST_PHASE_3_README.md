# How to Test Phase 3 Backend

## Quick Start

Phase 3 (Backend Services) is complete. Here's how to test it:

### 🚀 Fast Track (5 minutes)

1. **Deploy Edge Functions**:
   ```bash
   supabase login
   supabase link --project-ref ewuhxqbfwbenkhnkzokp
   supabase functions deploy google-calendar-oauth
   supabase functions deploy google-calendar-refresh-token
   supabase functions deploy google-calendar-sync-calendars
   supabase functions deploy google-calendar-sync-events
   ```

2. **Get Your Credentials**:
   - **User JWT**: Login to your app → Browser console → Run:
     ```javascript
     const session = await supabase.auth.getSession();
     console.log(session.data.session.access_token);
     ```
   - **Service Role Key**: Supabase Dashboard → Settings → API

3. **Run Automated Tests**:
   ```bash
   export USER_JWT="your_jwt_here"
   export SERVICE_KEY="your_service_role_key_here"
   ./test-phase-3.sh
   ```

4. **Verify in Database**:
   - Copy contents of `test-phase-3.sql`
   - Paste in Supabase SQL Editor
   - Run to verify all tables, policies, and indexes

---

## 📚 Testing Resources

### 1. **Automated Test Script**: `test-phase-3.sh`
   - Tests all 5 Edge Functions
   - Interactive prompts
   - Color-coded output
   - **Best for**: Quick validation

### 2. **Comprehensive Guide**: `docs/phase-3-testing-guide.md`
   - 9 detailed test scenarios
   - Step-by-step instructions
   - Expected responses
   - Troubleshooting section
   - **Best for**: Thorough testing

### 3. **SQL Verification**: `test-phase-3.sql`
   - Verifies database structure
   - Checks RLS policies
   - Validates indexes
   - Tests foreign keys
   - **Best for**: Database validation

---

## ✅ Test Checklist

### Core Functionality
- [ ] **OAuth Initiate** - Generates auth URL
- [ ] **OAuth Callback** - Exchanges code for tokens
- [ ] **Calendar Sync** - Fetches calendar list
- [ ] **Event Sync** - Syncs events from Google
- [ ] **Token Refresh** - Auto-refreshes expiring tokens

### Data Verification
- [ ] Connection created in `google_calendar_connections`
- [ ] Calendar subscriptions in `calendar_subscriptions`
- [ ] Events populated in `calendar_events`
- [ ] Sync tokens in `calendar_sync_state`

### Security & Performance
- [ ] RLS policies prevent unauthorized access
- [ ] Incremental sync uses syncToken
- [ ] Error handling works correctly
- [ ] No sensitive data in logs

---

## 🔍 What Each Test Validates

### Test 1: OAuth Initiate
**Tests**: Edge function deployment, state token generation, OAuth URL formatting

**Expected**: Returns Google OAuth URL with state parameter

**Verifies**:
- Function is accessible
- State token stored in database
- OAuth URL includes `access_type=offline` and `prompt=consent`

### Test 2: OAuth Callback
**Tests**: Authorization code exchange, token storage, email extraction

**Expected**: Browser shows success message, connection created in DB

**Verifies**:
- Tokens exchanged successfully
- Connection stored with access_token and refresh_token
- State token deleted after use
- Calendar sync triggered automatically

### Test 3: Calendar List Sync
**Tests**: Google Calendar API integration, subscription creation

**Expected**: Calendar list synced and stored in database

**Verifies**:
- Fetches all calendars from Google
- Creates subscriptions with colors/metadata
- Preserves user's visibility preferences
- Removes deleted calendars

### Test 4: Event Sync
**Tests**: Event fetching, incremental sync, all-day event handling

**Expected**: Events synced and stored, sync token saved

**Verifies**:
- Events fetched from Google Calendar
- Incremental sync uses syncToken
- All-day events marked correctly
- Events updated/deleted when changed in Google

### Test 5: Token Refresh
**Tests**: Automatic token refresh, expiry handling

**Expected**: Expired tokens refreshed automatically

**Verifies**:
- Tokens expiring < 5 min are refreshed
- Database updated with new tokens
- Invalid refresh tokens flagged for re-auth

---

## 🐛 Common Issues & Solutions

### "401 Unauthorized"
**Cause**: JWT token expired or invalid
**Solution**: Get a fresh JWT from your app session

### "Secrets not found"
**Cause**: Google OAuth credentials not set
**Solution**:
```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="your_client_id"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="your_client_secret"
```

### "Connection not found"
**Cause**: RLS blocking access or wrong connection ID
**Solution**: Verify connection ID belongs to your user

### "No events syncing"
**Cause**: Subscriptions have `sync_enabled=false`
**Solution**: Update subscriptions to enable sync

### "Incremental sync not working"
**Cause**: No sync token stored
**Solution**: Run full sync first, then incremental will work

---

## 📊 Expected Test Results

### After OAuth Flow:
```sql
SELECT * FROM google_calendar_connections;
-- Should show 1 row with your email, tokens, and expires_at ~1 hour from now
```

### After Calendar Sync:
```sql
SELECT * FROM calendar_subscriptions;
-- Should show your Google calendars with colors and default visibility=true
```

### After Event Sync:
```sql
SELECT COUNT(*) FROM calendar_events;
-- Should show events from your calendars (30 days past to 90 days future)

SELECT * FROM calendar_sync_state;
-- Should show sync tokens for incremental updates
```

---

## 🎯 Success Criteria

Phase 3 is **fully tested and working** when:

✅ All Edge Functions return 200 status codes
✅ OAuth flow completes without errors
✅ Connections stored with valid tokens
✅ Calendar subscriptions created
✅ Events synced and queryable
✅ Sync tokens enable incremental updates
✅ RLS policies enforce security
✅ Error handling works as expected

---

## 🚦 Next Steps After Testing

Once all tests pass:

1. ✅ Mark Phase 3 as complete and tested
2. 📝 Document any issues found
3. ⚡ Set up cron jobs (see `docs/calendar-cron-setup.md`)
4. 🚀 Proceed to **Phase 4: Data Layer** (TanStack Query hooks)

---

## 📖 Documentation Links

- **Deployment Guide**: `docs/edge-functions-deployment.md`
- **Testing Guide**: `docs/phase-3-testing-guide.md`
- **Cron Setup**: `docs/calendar-cron-setup.md`
- **Phase 3 Summary**: `docs/phase-3-backend-complete.md`
- **Build Plan**: `docs/calendar-integration-build-plan.md`

---

## 💡 Pro Tips

1. **Use jq for better output**: `brew install jq` (macOS)
2. **Keep JWT tokens fresh**: They expire after ~1 hour
3. **Monitor function logs**: `supabase functions logs <name> --tail`
4. **Test with real Google account**: Use your actual calendar data
5. **Verify RLS**: Try accessing other users' data (should fail)

---

**Happy Testing! 🎉**

For questions or issues, check the troubleshooting section in `docs/phase-3-testing-guide.md`
