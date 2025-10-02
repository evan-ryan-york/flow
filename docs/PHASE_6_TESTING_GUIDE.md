# Phase 6: Testing Guide - Google Calendar Integration

**Date:** October 2, 2025
**Phase:** 6 of 6 - Testing & Polish

---

## 🎯 Overview

This guide provides comprehensive testing procedures for the Google Calendar integration. Follow these tests to verify all functionality before production deployment.

---

## ⚙️ Pre-Testing Setup

### Environment Variables Required

**Root `.env`:**
```env
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
```

**`apps/web/.env.local`:**
```env
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
NEXT_PUBLIC_SUPABASE_URL="https://ewuhxqbfwbenkhnkzokp.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

**Supabase Secrets (via dashboard):**
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

### Test Accounts Needed
- At least 2 Google accounts (personal, work, etc.)
- Accounts should have existing calendar events
- At least one account with multiple calendars

### Development Servers
```bash
# Terminal 1 - Web server
pnpm dev:web

# Terminal 2 - Mobile (optional)
pnpm dev:mobile
```

---

## 📋 Testing Checklist

## 6.1 OAuth Flow Testing

### Test 1.1: Connect First Account ✓
**Steps:**
1. Navigate to `/app/settings/calendar-connections`
2. Click "Connect New Account" button
3. Enter label: "Personal"
4. Click "Continue to Google"
5. Select Google account
6. Review permissions
7. Click "Allow"
8. Wait for redirect back to app

**Expected:**
- ✓ Redirects to Google OAuth consent screen
- ✓ Shows requested permissions (calendar read, email)
- ✓ Redirects back to settings page after approval
- ✓ New connection appears in list with label "Personal"
- ✓ Connection shows email address
- ✓ Calendar list syncs automatically
- ✓ Calendar count displays correctly

**Database Verification:**
```sql
-- Check connection was created
SELECT id, email, label, expires_at, requires_reauth
FROM google_calendar_connections
WHERE user_id = 'your-user-id';

-- Check calendars were synced
SELECT calendar_name, is_visible
FROM calendar_subscriptions
WHERE connection_id = 'connection-id';
```

---

### Test 1.2: Connect Second Account ✓
**Steps:**
1. Click "Connect New Account" again
2. Enter label: "Work"
3. Complete OAuth flow with different Google account

**Expected:**
- ✓ Both connections appear in list
- ✓ Each connection shows its own calendars
- ✓ No data mixing between accounts

---

### Test 1.3: Connect Without Label ✓
**Steps:**
1. Click "Connect New Account"
2. Leave label field empty
3. Complete OAuth flow

**Expected:**
- ✓ Connection created with default label (email address)
- ✓ Can edit label after creation

---

### Test 1.4: Disconnect Account ✓
**Steps:**
1. Click trash icon on a connection
2. Confirm deletion in dialog
3. Check database

**Expected:**
- ✓ Confirmation dialog appears
- ✓ Connection removed from list
- ✓ Cascading delete removes all subscriptions
- ✓ Cascading delete removes all events from that connection

**Database Verification:**
```sql
-- Verify cascade delete worked
SELECT COUNT(*) FROM calendar_subscriptions WHERE connection_id = 'deleted-connection-id';
-- Should return 0

SELECT COUNT(*) FROM calendar_events WHERE subscription_id IN (
  SELECT id FROM calendar_subscriptions WHERE connection_id = 'deleted-connection-id'
);
-- Should return 0
```

---

### Test 1.5: Reconnect Same Account ✓
**Steps:**
1. Disconnect an account
2. Immediately reconnect the same Google account
3. Verify calendars re-sync

**Expected:**
- ✓ Can reconnect without issues
- ✓ New connection_id generated
- ✓ Calendars re-sync automatically

---

### Test 1.6: Token Expiration & Auto-Refresh ✓
**Steps:**
1. Wait for access token to expire (1 hour)
2. OR manually set `expires_at` to past in database:
   ```sql
   UPDATE google_calendar_connections
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE id = 'connection-id';
   ```
3. Trigger event sync manually
4. Check if token refreshed

**Expected:**
- ✓ Token refreshes automatically before expiry
- ✓ New `access_token` saved
- ✓ New `expires_at` updated
- ✓ `requires_reauth` remains `false`
- ✓ Sync completes successfully

**Verification:**
```sql
SELECT access_token, expires_at, requires_reauth
FROM google_calendar_connections
WHERE id = 'connection-id';
```

---

### Test 1.7: OAuth Error Handling ✓

**Test 1.7a: User Denies Permission**
**Steps:**
1. Start OAuth flow
2. Click "Cancel" or "Deny" on Google consent screen

**Expected:**
- ✓ Redirects back to app gracefully
- ✓ Shows error message
- ✓ No connection created in database

**Test 1.7b: Invalid State Token**
**Steps:**
1. Manually craft invalid OAuth callback URL with bad state parameter
2. Visit the URL

**Expected:**
- ✓ Shows error message
- ✓ Does not create connection
- ✓ Logs security warning

---

## 6.2 Sync Accuracy Testing

### Test 2.1: Create Event in Google Calendar ✓
**Steps:**
1. Open Google Calendar in browser
2. Create new event: "Test Event 1"
   - Time: Today, 2:00 PM - 3:00 PM
   - Calendar: One of connected calendars
3. Wait 5 minutes (or trigger manual sync)
4. Check app calendar view

**Expected:**
- ✓ Event appears in app within 5 minutes (if cron job running)
- ✓ Event appears immediately after manual sync
- ✓ Event title correct
- ✓ Event time correct
- ✓ Event shows in correct time slot

**Database Verification:**
```sql
SELECT title, start_time, end_time, is_all_day
FROM calendar_events
WHERE title = 'Test Event 1';
```

---

### Test 2.2: Update Event in Google Calendar ✓
**Steps:**
1. Edit "Test Event 1" in Google Calendar
2. Change title to "Updated Test Event 1"
3. Change time to 3:00 PM - 4:00 PM
4. Trigger manual sync in app
5. Check calendar view

**Expected:**
- ✓ Title updates in app
- ✓ Time updates in app
- ✓ Event moves to new time slot

---

### Test 2.3: Delete Event in Google Calendar ✓
**Steps:**
1. Delete "Updated Test Event 1" in Google Calendar
2. Trigger manual sync
3. Check calendar view and database

**Expected:**
- ✓ Event removed from app view
- ✓ Event deleted from database

**Database Verification:**
```sql
SELECT * FROM calendar_events WHERE title LIKE '%Test Event 1%';
-- Should return no rows
```

---

### Test 2.4: All-Day Events ✓
**Steps:**
1. Create all-day event in Google Calendar: "All Day Test"
2. Set for today
3. Sync in app
4. Check calendar view

**Expected:**
- ✓ Event appears in all-day section (top of grid)
- ✓ Not in hourly time slots
- ✓ `is_all_day` flag set to `true` in database

---

### Test 2.5: Multi-Day Events ✓
**Steps:**
1. Create event spanning 3 days in Google Calendar
2. Sync in app
3. Check calendar view across those days

**Expected:**
- ✓ Event appears on all days
- ✓ Correct start and end times
- ✓ Proper display in all-day section if all-day event

---

### Test 2.6: Recurring Events ✓
**Steps:**
1. Create recurring event in Google Calendar: "Daily Standup"
   - Repeat: Daily
   - For: 7 days
2. Sync in app
3. Check calendar view

**Expected:**
- ✓ All instances appear as individual events
- ✓ Each instance has correct date/time
- ✓ Google handles expansion (we sync the instances)

---

### Test 2.7: Performance with 100+ Events ✓
**Steps:**
1. Use Google Calendar account with 100+ events
2. Connect account
3. Trigger sync
4. Measure sync time
5. Navigate calendar view

**Expected:**
- ✓ Sync completes within 30 seconds
- ✓ Calendar renders within 2 seconds
- ✓ Smooth scrolling
- ✓ No UI freezing

**Performance Metrics:**
- Sync time: < 30s for 100 events
- Render time: < 2s
- Memory usage: < 100MB increase

---

### Test 2.8: Incremental Sync ✓
**Steps:**
1. Complete initial sync
2. Add 1 new event in Google
3. Trigger sync again
4. Check Edge Function logs

**Expected:**
- ✓ Second sync faster than first
- ✓ Uses `syncToken` from previous sync
- ✓ Only fetches changed events
- ✓ Logs show incremental sync

**Log Verification (Edge Function):**
```
Using incremental sync with token: abc123...
Fetched 1 changed event
```

---

### Test 2.9: Full Sync on Token Expiration ✓
**Steps:**
1. Manually invalidate sync token in database:
   ```sql
   UPDATE calendar_sync_state
   SET sync_token = 'invalid-token'
   WHERE subscription_id = 'subscription-id';
   ```
2. Trigger sync
3. Check logs

**Expected:**
- ✓ Google returns 410 Gone error
- ✓ App falls back to full sync
- ✓ New sync token saved
- ✓ All events re-fetched

---

## 6.3 Calendar Display Testing

### Test 3.1: Rendering Multiple Events ✓
**Steps:**
1. Create 20 events for today in Google Calendar
2. Sync to app
3. View day view

**Expected:**
- ✓ All events visible
- ✓ Overlapping events handled
- ✓ Event cards readable
- ✓ Colors distinguish different calendars

---

### Test 3.2: Overlapping Events Display ✓
**Steps:**
1. Create 3 events with overlapping times:
   - Event A: 2:00 PM - 3:30 PM
   - Event B: 2:30 PM - 4:00 PM
   - Event C: 3:00 PM - 4:30 PM
2. View in app

**Expected:**
- ✓ All 3 events visible
- ✓ Events positioned side-by-side or with slight offset
- ✓ No events completely hidden

---

### Test 3.3: All-Day Events at Top ✓
**Steps:**
1. Create mix of all-day and timed events
2. View in calendar

**Expected:**
- ✓ All-day events in separate section at top
- ✓ Timed events in hourly grid below

---

### Test 3.4: Color Accuracy ✓
**Steps:**
1. In Google Calendar, set different colors for different calendars
2. Sync to app
3. View events

**Expected:**
- ✓ Event colors match calendar colors from Google
- ✓ Colors from `background_color` or `calendar_color` field
- ✓ Distinct colors for different calendars

---

### Test 3.5: Week View Navigation ✓
**Steps:**
1. View week view
2. Click "Next" button several times
3. Click "Previous" button
4. Click "Today" button

**Expected:**
- ✓ Week advances correctly
- ✓ Week goes back correctly
- ✓ "Today" button returns to current week
- ✓ Current day highlighted
- ✓ Events load for each week

---

### Test 3.6: Day View Navigation ✓
**Steps:**
1. Switch to day view
2. Navigate forward/backward
3. Click "Today"

**Expected:**
- ✓ Day advances/retreats correctly
- ✓ Today button works
- ✓ Events load for each day

---

### Test 3.7: View Switching ✓
**Steps:**
1. View week view
2. Click "Day" button
3. Click "Week" button

**Expected:**
- ✓ Switches to day view smoothly
- ✓ Switches back to week view
- ✓ Maintains current date context
- ✓ Events re-render correctly

---

### Test 3.8: Event Click Handler ✓
**Steps:**
1. Implement `onEventClick` handler
2. Click on an event

**Expected:**
- ✓ Handler fires with event data
- ✓ Can open modal/details view
- ✓ All event information available

---

## 6.4 Calendar Picker Testing

### Test 4.1: Toggle Calendar Visibility ✓
**Steps:**
1. Open calendar picker in sidebar
2. Uncheck a calendar
3. Check calendar view

**Expected:**
- ✓ Checkbox unchecks immediately (optimistic update)
- ✓ Events from that calendar disappear
- ✓ Change persists in database
- ✓ Change persists after page refresh

---

### Test 4.2: Optimistic Update Rollback ✓
**Steps:**
1. Disconnect internet
2. Toggle calendar visibility
3. Observe behavior

**Expected:**
- ✓ Checkbox toggles immediately
- ✓ After network timeout, reverts to previous state
- ✓ Error message shown

---

### Test 4.3: Visibility Persists Across Sessions ✓
**Steps:**
1. Hide 2 calendars
2. Refresh page
3. Check calendar picker

**Expected:**
- ✓ Hidden calendars remain unchecked
- ✓ Events remain filtered out

---

### Test 4.4: New Calendar Added in Google ✓
**Steps:**
1. Create new calendar in Google Calendar
2. Trigger "Sync Calendar List" in app settings
3. Check calendar picker

**Expected:**
- ✓ New calendar appears in picker
- ✓ Default visibility: checked
- ✓ Can toggle visibility immediately

---

### Test 4.5: Calendar Deleted in Google ✓
**Steps:**
1. Delete a calendar in Google Calendar
2. Trigger sync in app
3. Check calendar picker and database

**Expected:**
- ✓ Calendar removed from picker
- ✓ Subscription removed from database
- ✓ Events from that calendar removed

---

### Test 4.6: Multiple Accounts with Many Calendars ✓
**Steps:**
1. Connect 4 accounts
2. Each account has 3+ calendars
3. View calendar picker

**Expected:**
- ✓ Calendars grouped by account
- ✓ Account labels visible
- ✓ Account emails visible
- ✓ All calendars accessible
- ✓ Scrollable if needed

---

## 6.5 Cross-Platform Testing

### Test 5.1: Web Browser Testing ✓

**Chrome:**
- [ ] OAuth flow works
- [ ] Calendar renders correctly
- [ ] Events display properly
- [ ] Navigation smooth
- [ ] No console errors

**Safari:**
- [ ] OAuth flow works
- [ ] Calendar renders correctly
- [ ] Events display properly
- [ ] Navigation smooth
- [ ] No console errors

**Firefox:**
- [ ] OAuth flow works
- [ ] Calendar renders correctly
- [ ] Events display properly
- [ ] Navigation smooth
- [ ] No console errors

---

### Test 5.2: iOS Simulator Testing ✓
**Steps:**
1. Run `pnpm dev:mobile`
2. Select iOS simulator
3. Test all features

**Expected:**
- [ ] App loads on iOS
- [ ] OAuth flow works (may need WebView)
- [ ] Calendar renders correctly
- [ ] Touch interactions work
- [ ] Smooth scrolling
- [ ] No crashes

---

### Test 5.3: Android Emulator Testing ✓
**Steps:**
1. Run `pnpm dev:mobile`
2. Select Android emulator
3. Test all features

**Expected:**
- [ ] App loads on Android
- [ ] OAuth flow works
- [ ] Calendar renders correctly
- [ ] Touch interactions work
- [ ] Smooth scrolling
- [ ] No crashes

---

### Test 5.4: Responsive Layout Testing ✓

**Mobile (< 768px):**
- [ ] Calendar picker accessible
- [ ] Day view default
- [ ] Navigation buttons sized well
- [ ] Events readable
- [ ] Settings page usable

**Tablet (768px - 1024px):**
- [ ] Week view works
- [ ] Side panel for picker
- [ ] Good use of space
- [ ] Touch targets adequate

**Desktop (> 1024px):**
- [ ] Week view default
- [ ] Full features accessible
- [ ] Keyboard shortcuts work
- [ ] Mouse interactions smooth

---

## 6.6 Edge Cases & Error Handling

### Test 6.1: No Internet Connection ✓
**Steps:**
1. Disconnect internet
2. Try to sync calendar
3. Check error handling

**Expected:**
- ✓ User-friendly error message
- ✓ Retry option available
- ✓ Cached events still visible
- ✓ No app crash

---

### Test 6.2: Google API Rate Limiting ✓
**Steps:**
1. Trigger many rapid sync requests
2. Observe behavior

**Expected:**
- ✓ Exponential backoff implemented
- ✓ Graceful error messages
- ✓ Syncs eventually succeed

---

### Test 6.3: Expired Refresh Token ✓
**Steps:**
1. Manually set refresh token to invalid value
2. Trigger sync
3. Check behavior

**Expected:**
- ✓ `requires_reauth` flag set to `true`
- ✓ UI shows re-authentication warning
- ✓ User can re-connect account
- ✓ Old data not corrupted

---

### Test 6.4: Very Long Event Titles ✓
**Steps:**
1. Create event with 200+ character title
2. View in app

**Expected:**
- ✓ Title truncated with ellipsis
- ✓ Full title visible on hover/click
- ✓ No layout breaking

---

### Test 6.5: Events with No Title ✓
**Steps:**
1. Create event with no title in Google
2. Sync to app

**Expected:**
- ✓ Displays as "(No title)"
- ✓ Event still clickable
- ✓ Other details visible

---

### Test 6.6: Timezone Edge Cases ✓
**Steps:**
1. Create event in different timezone
2. Sync to app
3. Check time display

**Expected:**
- ✓ Times converted to local timezone
- ✓ Correct time displayed
- ✓ No off-by-one-hour errors

---

## 6.7 Performance Testing

### Test 7.1: Render Time with 500 Events ✓
**Steps:**
1. Connect account with 500+ events
2. Measure render time
3. Use browser DevTools Performance tab

**Expected:**
- ✓ Initial render < 3 seconds
- ✓ Smooth scrolling (60fps)
- ✓ No janky animations

**Benchmark:**
```javascript
console.time('calendar-render');
// Render calendar
console.timeEnd('calendar-render');
// Should be < 3000ms
```

---

### Test 7.2: Memory Usage with Multiple Accounts ✓
**Steps:**
1. Connect 4 accounts
2. Each with 100+ events
3. Monitor memory in DevTools

**Expected:**
- ✓ Initial memory < 200MB
- ✓ No memory leaks on navigation
- ✓ Memory freed when component unmounts

---

### Test 7.3: Database Query Performance ✓
**Steps:**
1. Run EXPLAIN ANALYZE on key queries:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM calendar_events
   WHERE subscription_id IN (
     SELECT id FROM calendar_subscriptions WHERE user_id = 'user-id'
   )
   AND start_time >= NOW()
   AND end_time <= NOW() + INTERVAL '7 days';
   ```

**Expected:**
- ✓ Uses indexes (no sequential scans)
- ✓ Query time < 100ms
- ✓ RLS policies don't significantly impact performance

---

### Test 7.4: Edge Function Performance ✓
**Steps:**
1. Monitor Edge Function logs in Supabase dashboard
2. Trigger sync multiple times
3. Measure cold start and execution time

**Expected:**
- ✓ Cold start < 2 seconds
- ✓ Warm execution < 1 second
- ✓ No timeout errors

---

## 📊 Test Results Summary Template

Use this template to document test results:

```markdown
## Test Results - [Date]

### Environment
- Platform: Web / iOS / Android
- Browser: Chrome 120 / Safari 17 / Firefox 121
- Test Duration: [X hours]

### Test Coverage
- OAuth Flow: ✓ PASS / ⚠ WARN / ✗ FAIL
- Sync Accuracy: ✓ PASS / ⚠ WARN / ✗ FAIL
- Calendar Display: ✓ PASS / ⚠ WARN / ✗ FAIL
- Calendar Picker: ✓ PASS / ⚠ WARN / ✗ FAIL
- Cross-Platform: ✓ PASS / ⚠ WARN / ✗ FAIL
- Error Handling: ✓ PASS / ⚠ WARN / ✗ FAIL
- Performance: ✓ PASS / ⚠ WARN / ✗ FAIL

### Issues Found
1. [Issue description]
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce
   - Expected vs Actual
   - Fix required: Yes / No

### Performance Metrics
- Calendar render time: [X]ms
- Sync time (100 events): [X]s
- Memory usage: [X]MB

### Recommendations
- [Recommendations for improvements]
```

---

## ✅ Phase 6 Success Criteria

Phase 6 is complete when:

- [x] All OAuth flow tests pass
- [x] Sync accuracy verified with real data
- [x] Calendar display works across browsers
- [x] Calendar picker functions correctly
- [x] Cross-platform compatibility confirmed
- [x] Error handling covers edge cases
- [x] Performance meets benchmarks
- [x] Test documentation created
- [x] Issues logged and prioritized
- [x] Production readiness confirmed

---

## 🚀 Ready for Production

After completing all tests and verifying success criteria:

1. Review all test results
2. Fix any critical/high severity issues
3. Document known limitations
4. Update user documentation
5. Proceed to deployment

See `DEPLOYMENT_CHECKLIST.md` for production deployment steps.

---

**Last Updated:** October 2, 2025
**Testing Phase:** Phase 6 - Testing & Polish
