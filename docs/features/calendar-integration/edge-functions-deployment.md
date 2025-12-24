# Edge Functions Deployment Guide

## Prerequisites

1. **Supabase CLI installed**:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

## Environment Variables Setup

The Edge Functions need the following secrets to be set in Supabase:

```bash
# Set Google OAuth credentials
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET"

# Verify secrets are set
supabase secrets list
```

**Note**: These should already be set from Phase 2 of the build plan.

## Deploy Edge Functions

Deploy all functions at once:

```bash
# From the project root directory
supabase functions deploy google-calendar-oauth
supabase functions deploy google-calendar-refresh-token
supabase functions deploy google-calendar-sync-calendars
supabase functions deploy google-calendar-sync-events
```

Or deploy them individually:

```bash
supabase functions deploy google-calendar-oauth
supabase functions deploy google-calendar-refresh-token
supabase functions deploy google-calendar-sync-calendars
supabase functions deploy google-calendar-sync-events
```

## Verify Deployment

1. **Check function status**:
   ```bash
   supabase functions list
   ```

2. **View logs**:
   ```bash
   supabase functions logs google-calendar-oauth
   ```

3. **Test OAuth initiate endpoint**:
   ```bash
   curl "https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-oauth?action=initiate" \
     -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"
   ```

## Local Development

### Serve functions locally:

```bash
# Serve all functions
supabase functions serve

# Or serve a specific function
supabase functions serve google-calendar-oauth --env-file .env
```

### Create .env file for local development:

Create `supabase/.env`:

```env
SUPABASE_URL=https://<your-supabase-project>.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

### Test locally:

```bash
# OAuth initiate
curl "http://localhost:54321/functions/v1/google-calendar-oauth?action=initiate" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"

# Token refresh
curl -X POST "http://localhost:54321/functions/v1/google-calendar-refresh-token" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"CONNECTION_UUID"}'

# Sync calendars
curl -X POST "http://localhost:54321/functions/v1/google-calendar-sync-calendars" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"CONNECTION_UUID"}'

# Sync events
curl -X POST "http://localhost:54321/functions/v1/google-calendar-sync-events" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"CONNECTION_UUID"}'
```

## Edge Function URLs (Production)

After deployment, the functions are available at:

- **OAuth**: `https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-oauth`
- **Token Refresh**: `https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-refresh-token`
- **Sync Calendars**: `https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-sync-calendars`
- **Sync Events**: `https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-sync-events`

## Troubleshooting

### Function not working

1. Check logs:
   ```bash
   supabase functions logs <function-name> --tail
   ```

2. Verify secrets are set:
   ```bash
   supabase secrets list
   ```

3. Check CORS configuration (already included in functions)

### OAuth callback not working

1. Verify redirect URI in Google Cloud Console matches:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-oauth
   ```

2. Check that OAuth consent screen is configured correctly

3. Ensure user is clicking "Allow" in OAuth flow

### Token refresh failing

1. Verify `access_type=offline` and `prompt=consent` are in OAuth URL
2. Check that refresh_token is being stored in database
3. Verify Google OAuth credentials are correct

### Sync not working

1. Check that connection has valid tokens
2. Verify calendar subscriptions exist and `sync_enabled=true`
3. Check Google Calendar API is enabled in Google Cloud Console

## Monitoring

### View function metrics in Supabase Dashboard:
- Edge Functions → Select function → Metrics tab

### Set up error alerting:
1. Supabase Dashboard → Settings → Integrations
2. Connect to Slack, Discord, or email for error notifications

### Monitor sync performance:
```sql
-- Check recent sync activity
SELECT
  cs.calendar_name,
  css.last_sync_at,
  css.sync_token IS NOT NULL as has_sync_token,
  COUNT(ce.id) as event_count
FROM calendar_subscriptions cs
LEFT JOIN calendar_sync_state css ON cs.id = css.subscription_id
LEFT JOIN calendar_events ce ON cs.id = ce.subscription_id
GROUP BY cs.id, cs.calendar_name, css.last_sync_at, css.sync_token
ORDER BY css.last_sync_at DESC;
```

## Performance Optimization

1. **Enable Edge Function caching** (if available in Supabase)
2. **Use incremental sync** (already implemented with syncToken)
3. **Batch database operations** (already implemented)
4. **Monitor and adjust cron frequency** based on usage patterns

## Security Considerations

1. **Never log tokens or secrets** (already avoided in functions)
2. **Use RLS policies** (already configured in database)
3. **Rotate service role key** periodically
4. **Monitor for suspicious API usage** in Supabase dashboard
5. **Set up rate limiting** if needed (via Supabase dashboard)
