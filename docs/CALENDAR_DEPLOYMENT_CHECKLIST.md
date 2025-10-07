# Google Calendar Integration - Deployment Checklist

**Perfect Task App** | Production Deployment

---

## 🎯 Pre-Deployment Overview

This checklist ensures the Google Calendar integration is production-ready. Complete all items before deploying to production.

**Current Phase:** Phase 6 Complete
**Target:** Production Deployment
**Estimated Time:** 2-4 hours

---

## ✅ Phase 1-5 Verification

Before proceeding, verify all previous phases are complete:

- [x] **Phase 1:** Database schema deployed with RLS policies
- [x] **Phase 2:** Google OAuth configured and tested
- [x] **Phase 3:** Edge Functions deployed and functional
- [x] **Phase 4:** TanStack Query hooks implemented
- [x] **Phase 5:** UI components built and tested
- [x] **Phase 6:** Testing completed and documented

---

## 🔐 Security Checklist

### Google OAuth Configuration

- [ ] OAuth consent screen published (not in testing mode)
- [ ] Client ID and Client Secret stored as Supabase secrets
- [ ] Client Secret NOT committed to git
- [ ] Redirect URIs configured correctly:
  - Production: `https://your-domain.com/functions/v1/google-calendar-oauth-callback`
  - Staging: `https://staging-domain.com/functions/v1/google-calendar-oauth-callback`
- [ ] OAuth scopes correctly specified:
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/userinfo.email`
- [ ] App verification submitted to Google (if required for public use)

### Database Security

- [ ] RLS policies enabled on all calendar tables
- [ ] Service role key secured (not exposed to client)
- [ ] Anon key safe to expose (only allows authenticated user access)
- [ ] Connection strings stored securely (not in public repos)
- [ ] Database backups configured
- [ ] Point-in-time recovery enabled

### Environment Variables

**Production `.env`:**
- [ ] `GOOGLE_OAUTH_CLIENT_ID` set
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` set
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set

**Supabase Secrets:**
- [ ] `GOOGLE_OAUTH_CLIENT_ID` set via dashboard
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` set via dashboard

**Verify:**
```bash
# Check secrets are set
supabase secrets list --project-ref YOUR_PROJECT_REF
```

---

## 🗄️ Database Checklist

### Migrations Applied

- [ ] `20251002000000_add_google_calendar_integration.sql` applied
- [ ] `20251002000001_add_oauth_state_tokens.sql` applied
- [ ] `20251002000002_add_requires_reauth_column.sql` applied
- [ ] `20251002000003_setup_calendar_sync_cron.sql` applied (optional)

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%calendar%';

-- Should return:
-- google_calendar_connections
-- calendar_subscriptions
-- calendar_events
-- calendar_sync_state
-- oauth_state_tokens
```

### Indexes Created

- [ ] All indexes from migrations created
- [ ] Indexes on frequently queried columns
- [ ] Composite indexes for complex queries

**Verify:**
```sql
SELECT tablename, indexname FROM pg_indexes
WHERE tablename LIKE '%calendar%'
ORDER BY tablename, indexname;
```

### RLS Policies Active

- [ ] Policies on `google_calendar_connections`
- [ ] Policies on `calendar_subscriptions`
- [ ] Policies on `calendar_events`
- [ ] Policies on `calendar_sync_state`
- [ ] Policies on `oauth_state_tokens`

**Verify:**
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename LIKE '%calendar%';
```

### Database Performance

- [ ] Query plans reviewed (EXPLAIN ANALYZE)
- [ ] No sequential scans on large tables
- [ ] Indexes being used correctly
- [ ] RLS policies performant

---

## ⚡ Edge Functions Checklist

### Deployment Status

- [ ] `google-calendar-oauth` deployed
- [ ] `google-calendar-refresh-token` deployed
- [ ] `google-calendar-sync-calendars` deployed
- [ ] `google-calendar-sync-events` deployed

**Verify:**
```bash
supabase functions list --project-ref YOUR_PROJECT_REF
```

### Function Configuration

- [ ] CORS headers configured in `_shared/cors.ts`
- [ ] Environment variables accessible via `Deno.env.get()`
- [ ] Error handling implemented
- [ ] Logging configured (important events)
- [ ] Timeout limits appropriate (< 60s)

### Function Testing

- [ ] OAuth initiate tested
- [ ] OAuth callback tested
- [ ] Token refresh tested
- [ ] Calendar sync tested
- [ ] Event sync tested
- [ ] Error cases tested

**Test:**
```bash
# Test OAuth initiate
curl https://your-domain.com/functions/v1/google-calendar-oauth?action=initiate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Frontend Checklist

### Build & Compilation

- [ ] `pnpm build` succeeds without errors
- [ ] TypeScript compilation passes
- [ ] No ESLint errors
- [ ] No console warnings in production

**Verify:**
```bash
pnpm build
# Should complete successfully
```

### Component Verification

- [ ] CalendarView renders correctly
- [ ] CalendarHeader functional
- [ ] CalendarGrid displays events
- [ ] CalendarEvent components styled
- [ ] CalendarPicker toggles work
- [ ] Settings page accessible

### Cross-Browser Testing

- [ ] Chrome (latest) tested
- [ ] Safari (latest) tested
- [ ] Firefox (latest) tested
- [ ] Edge (latest) tested
- [ ] Mobile browsers tested

### Cross-Platform Testing

- [ ] Web (desktop) tested
- [ ] Web (mobile) tested
- [ ] iOS app tested (if applicable)
- [ ] Android app tested (if applicable)

---

## 🔄 Cron Jobs Checklist (Optional)

If using automated syncing:

### Setup Method

Choose one:
- [ ] **Method A:** Supabase pg_cron (recommended for simplicity)
- [ ] **Method B:** GitHub Actions (recommended for reliability)
- [ ] **Method C:** External cron service (Vercel Cron, etc.)

### Cron Jobs Configured

- [ ] Event sync job: Every 5 minutes
- [ ] Token refresh job: Every hour
- [ ] Cleanup job: Daily

### Verification

**For pg_cron:**
```sql
SELECT jobname, schedule, last_run, next_run
FROM cron.job
ORDER BY jobname;
```

**For GitHub Actions:**
- [ ] Workflow file created: `.github/workflows/calendar-sync.yml`
- [ ] Secrets configured in GitHub repo
- [ ] Manual trigger works
- [ ] Scheduled runs successful

---

## 📊 Monitoring & Observability

### Error Tracking

- [ ] Sentry (or similar) configured
- [ ] Edge Function errors tracked
- [ ] Frontend errors tracked
- [ ] Alert thresholds set

### Logging

- [ ] Supabase Edge Function logs enabled
- [ ] Database logs retained (7+ days)
- [ ] Log aggregation configured (optional)

### Performance Monitoring

- [ ] Database query performance tracked
- [ ] Edge Function execution time monitored
- [ ] Frontend performance metrics collected
- [ ] User experience tracking (optional)

### Alerts

- [ ] Alert on OAuth failures
- [ ] Alert on sync failures (> 10% fail rate)
- [ ] Alert on database errors
- [ ] Alert on high latency (> 5s)

**Setup Example (Email alerts):**
```sql
-- Create function to send alert email
CREATE OR REPLACE FUNCTION notify_sync_failure()
RETURNS trigger AS $$
BEGIN
  -- Send email or log to monitoring service
  RAISE WARNING 'Calendar sync failed for user %', NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📚 Documentation Checklist

### User Documentation

- [x] User guide created (`CALENDAR_USER_GUIDE.md`)
- [x] Troubleshooting guide created (`CALENDAR_TROUBLESHOOTING.md`)
- [ ] FAQ added to help center
- [ ] Video tutorials recorded (optional)

### Developer Documentation

- [x] Technical documentation complete
- [x] API documentation for hooks
- [x] Edge Function documentation
- [x] Database schema documented
- [x] Testing guide created

### Deployment Documentation

- [ ] Deployment steps documented
- [ ] Rollback procedure documented
- [ ] Environment setup guide
- [ ] Troubleshooting for common deployment issues

---

## 🧪 Final Testing

### End-to-End Testing

- [ ] Complete OAuth flow (connect account)
- [ ] Create event in Google → syncs to app
- [ ] Update event in Google → updates in app
- [ ] Delete event in Google → removes from app
- [ ] Toggle calendar visibility → events show/hide
- [ ] Disconnect account → data removed
- [ ] Reconnect account → data restored

### Performance Testing

- [ ] Test with 500+ events
- [ ] Test with 4+ connected accounts
- [ ] Test with 10+ calendars per account
- [ ] Measure page load time (< 3s)
- [ ] Measure sync time (< 30s for 100 events)
- [ ] Check memory usage (< 200MB increase)

### Stress Testing

- [ ] Concurrent syncs (10+ users)
- [ ] Rapid OAuth requests
- [ ] Large event loads (1000+ events)
- [ ] Edge Function under load

---

## 🚀 Deployment Steps

### Pre-Deployment

1. **Code Review**
   - [ ] All code reviewed by team
   - [ ] Security review passed
   - [ ] Performance review passed

2. **Testing Sign-off**
   - [ ] QA testing complete
   - [ ] Stakeholder approval
   - [ ] User acceptance testing (optional)

3. **Backup**
   - [ ] Database backed up
   - [ ] Current production code tagged in git
   - [ ] Rollback plan ready

### Deployment

1. **Deploy Database Migrations**
   ```bash
   # Apply migrations to production
   psql "postgresql://prod-connection-string" -f supabase/migrations/20251002000000_add_google_calendar_integration.sql
   psql "postgresql://prod-connection-string" -f supabase/migrations/20251002000001_add_oauth_state_tokens.sql
   psql "postgresql://prod-connection-string" -f supabase/migrations/20251002000002_add_requires_reauth_column.sql
   ```
   - [ ] Migrations applied successfully
   - [ ] Tables created
   - [ ] RLS policies active

2. **Deploy Edge Functions**
   ```bash
   # Deploy to production
   supabase functions deploy google-calendar-oauth --project-ref PROD_REF
   supabase functions deploy google-calendar-refresh-token --project-ref PROD_REF
   supabase functions deploy google-calendar-sync-calendars --project-ref PROD_REF
   supabase functions deploy google-calendar-sync-events --project-ref PROD_REF
   ```
   - [ ] Functions deployed
   - [ ] Functions accessible
   - [ ] Test endpoints respond

3. **Deploy Frontend**
   ```bash
   # Build and deploy
   pnpm build
   # Deploy to Vercel/Netlify/etc
   vercel --prod
   ```
   - [ ] Build successful
   - [ ] Deployed to production
   - [ ] DNS updated (if needed)

4. **Configure Cron Jobs** (if using)
   ```bash
   # Apply cron migration
   psql "postgresql://prod-connection-string" -f supabase/migrations/20251002000003_setup_calendar_sync_cron.sql
   ```
   - [ ] Cron jobs created
   - [ ] Jobs running on schedule

### Post-Deployment

1. **Smoke Testing**
   - [ ] Homepage loads
   - [ ] Login works
   - [ ] Calendar settings page accessible
   - [ ] Can initiate OAuth flow
   - [ ] Complete one full sync

2. **Monitor**
   - [ ] Check error logs (next 24 hours)
   - [ ] Monitor Edge Function performance
   - [ ] Monitor database load
   - [ ] Watch user reports

3. **Announce**
   - [ ] Announce feature to users (email, blog post, etc.)
   - [ ] Update changelog
   - [ ] Social media posts (optional)

---

## 🔄 Rollback Plan

If issues arise:

### Step 1: Stop the Bleeding
- [ ] Disable cron jobs (stop automatic syncs)
- [ ] Pause new connections (feature flag)

### Step 2: Assess Impact
- [ ] How many users affected?
- [ ] What's the error rate?
- [ ] Is data corrupted?

### Step 3: Rollback (if needed)

**Option A: Rollback Frontend Only**
```bash
# Revert to previous deployment
vercel rollback
```

**Option B: Rollback Edge Functions**
```bash
# Redeploy previous version
git checkout previous-tag
supabase functions deploy google-calendar-oauth
```

**Option C: Rollback Database** (last resort)
- Restore from backup
- Re-apply migrations up to last stable state

### Step 4: Communicate
- [ ] Notify users of issue
- [ ] Provide ETA for fix
- [ ] Update status page

---

## 📊 Success Metrics

After deployment, track these metrics:

### Adoption Metrics
- Number of accounts connected
- Number of calendars synced
- Number of events synced
- Daily active users of calendar feature

### Performance Metrics
- Average sync time
- Edge Function execution time
- Database query time
- Page load time

### Error Metrics
- OAuth failure rate (target: < 1%)
- Sync failure rate (target: < 5%)
- Edge Function error rate (target: < 0.1%)
- Database error rate (target: < 0.01%)

### User Satisfaction
- Feature usage rate
- User feedback (surveys)
- Support tickets (target: < 5/week)
- App store ratings impact

---

## ✅ Final Sign-off

**Deployment Approved By:**

- [ ] Technical Lead: __________________ Date: __________
- [ ] Product Manager: ________________ Date: __________
- [ ] Security Review: ________________ Date: __________
- [ ] QA Sign-off: ____________________ Date: __________

**Deployment Date:** __________
**Deployed By:** __________
**Deployment Notes:**
_________________________________________
_________________________________________

---

## 🎉 Post-Launch Tasks

After successful deployment:

### Week 1
- [ ] Monitor error logs daily
- [ ] Review user feedback
- [ ] Address critical bugs
- [ ] Adjust cron frequency if needed

### Week 2-4
- [ ] Analyze usage metrics
- [ ] Gather user testimonials
- [ ] Plan feature enhancements
- [ ] Document lessons learned

### Month 2+
- [ ] Performance optimization based on data
- [ ] Feature requests prioritization
- [ ] Plan two-way sync (Phase 7)
- [ ] Additional calendar providers (Outlook, Apple)

---

**Last Updated:** October 2, 2025
**Version:** 1.0
**Status:** Ready for Production Deployment
