# Microsoft Calendar Integration - Implementation Plan

## Overview

This document provides a complete build plan for adding Microsoft 365 / Outlook calendar integration to Flow, supporting iOS, macOS Desktop, and Web platforms.

---

## Phase 1: Azure AD Setup & Database Migration

### 1.1 Azure AD App Registration

**Location:** [Azure Portal](https://portal.azure.com) > Azure Active Directory > App registrations

#### Steps:
1. Create new app registration:
   - Name: `Flow Calendar Integration`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URIs (add all three):
     - Web: `https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/microsoft-calendar-oauth`
     - iOS: `com.flowapp.app://oauth/microsoft/callback`
     - macOS: `tauri://localhost/oauth/microsoft/callback`

2. Configure API permissions:
   - `Calendars.Read` - Read user calendars
   - `Calendars.ReadWrite` - Read and write user calendars (for future two-way sync)
   - `User.Read` - Read user profile (for email)
   - `offline_access` - Refresh tokens

3. Generate client secret:
   - Certificates & secrets > New client secret
   - Description: `Flow Production`
   - Expiry: 24 months (set calendar reminder to rotate)

4. Note the following values:
   - Application (client) ID
   - Directory (tenant) ID (use `common` for multi-tenant)
   - Client secret value

#### Store Credentials:
```bash
# Add to Supabase secrets
supabase secrets set MICROSOFT_CLIENT_ID="your-client-id"
supabase secrets set MICROSOFT_CLIENT_SECRET="your-client-secret"

# Add to .env for local development
MICROSOFT_CLIENT_ID="your-client-id"
MICROSOFT_CLIENT_SECRET="your-client-secret"
```

---

### 1.2 Database Migration

**File:** `supabase/migrations/YYYYMMDD_add_microsoft_calendar_support.sql`

#### Strategy: Rename + Add Provider Column

This approach unifies Google and Microsoft connections into shared tables with a `provider` discriminator.

```sql
-- ============================================
-- Migration: Add Microsoft Calendar Support
-- Strategy: Unified tables with provider column
-- ============================================

-- Step 1: Rename google_calendar_connections to calendar_connections
ALTER TABLE google_calendar_connections
  RENAME TO calendar_connections;

-- Step 2: Add provider column with default for existing data
ALTER TABLE calendar_connections
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'google';

-- Step 3: Rename google-specific columns to be provider-agnostic
ALTER TABLE calendar_connections
  RENAME COLUMN email TO account_email;

-- Step 4: Add provider_account_id for Microsoft's unique user ID
ALTER TABLE calendar_connections
  ADD COLUMN provider_account_id TEXT;

-- Step 5: Update unique constraint to include provider
ALTER TABLE calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_user_id_email_key;

ALTER TABLE calendar_connections
  ADD CONSTRAINT calendar_connections_user_provider_email_unique
  UNIQUE (user_id, provider, account_email);

-- Step 6: Update calendar_subscriptions foreign key reference
ALTER TABLE calendar_subscriptions
  RENAME COLUMN google_calendar_id TO provider_calendar_id;

-- Step 7: Update calendar_events provider-specific columns
ALTER TABLE calendar_events
  RENAME COLUMN google_calendar_event_id TO provider_event_id;

ALTER TABLE calendar_events
  RENAME COLUMN google_calendar_id TO provider_calendar_id;

-- Step 8: Add provider column to calendar_events for easier querying
ALTER TABLE calendar_events
  ADD COLUMN provider TEXT;

-- Backfill provider column from connection
UPDATE calendar_events ce
SET provider = cc.provider
FROM calendar_connections cc
WHERE ce.connection_id = cc.id;

-- Make provider NOT NULL after backfill
ALTER TABLE calendar_events
  ALTER COLUMN provider SET NOT NULL;

-- Step 9: Update indexes for new column names
DROP INDEX IF EXISTS idx_calendar_events_google_calendar_event_id;
CREATE INDEX idx_calendar_events_provider_event_id
  ON calendar_events(connection_id, provider_event_id);

DROP INDEX IF EXISTS idx_calendar_subscriptions_google_calendar_id;
CREATE INDEX idx_calendar_subscriptions_provider_calendar_id
  ON calendar_subscriptions(connection_id, provider_calendar_id);

-- Step 10: Add index for provider queries
CREATE INDEX idx_calendar_connections_provider
  ON calendar_connections(user_id, provider);

CREATE INDEX idx_calendar_events_provider
  ON calendar_events(user_id, provider);

-- Step 11: Update RLS policies (they remain the same, just table name changed)
-- Policies automatically follow renamed table

-- Step 12: Add check constraint for valid providers
ALTER TABLE calendar_connections
  ADD CONSTRAINT valid_provider
  CHECK (provider IN ('google', 'microsoft'));

ALTER TABLE calendar_events
  ADD CONSTRAINT valid_event_provider
  CHECK (provider IN ('google', 'microsoft'));

-- Step 13: Comment for documentation
COMMENT ON TABLE calendar_connections IS 'OAuth connections for calendar providers (Google, Microsoft)';
COMMENT ON COLUMN calendar_connections.provider IS 'Calendar provider: google or microsoft';
COMMENT ON COLUMN calendar_connections.provider_account_id IS 'Provider-specific user ID (Microsoft uses OID)';
```

---

### 1.3 Update Zod Schemas

**File:** `packages/models/index.ts`

```typescript
// Update CalendarProvider enum
export const CalendarProviderSchema = z.enum(['google', 'microsoft']);
export type CalendarProvider = z.infer<typeof CalendarProviderSchema>;

// Update CalendarConnectionSchema (renamed from GoogleCalendarConnectionSchema)
export const CalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  account_email: z.string().email(),
  provider_account_id: z.string().nullable(),
  label: z.string().max(50),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.string().datetime(),
  requires_reauth: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>;

// Keep GoogleCalendarConnectionSchema as alias for backwards compatibility
export const GoogleCalendarConnectionSchema = CalendarConnectionSchema;
export type GoogleCalendarConnection = CalendarConnection;

// Update CalendarSubscriptionSchema
export const CalendarSubscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider_calendar_id: z.string(), // Renamed from google_calendar_id
  calendar_name: z.string(),
  calendar_color: z.string().nullable(),
  background_color: z.string().nullable(),
  is_visible: z.boolean().default(true),
  sync_enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Update CalendarEventSchema
export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  provider_event_id: z.string(), // Renamed from google_calendar_event_id
  provider_calendar_id: z.string(), // Renamed from google_calendar_id
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  is_all_day: z.boolean().default(false),
  location: z.string().nullable(),
  color: z.string().nullable(),
  last_synced_at: z.string().datetime().nullable(),
  etag: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

---

## Phase 2: Edge Functions

### 2.1 Microsoft OAuth Function

**File:** `supabase/functions/microsoft-calendar-oauth/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Use 'common' for multi-tenant (personal + work accounts)
const TENANT_ID = 'common'
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/microsoft-calendar-oauth`

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'User.Read',
].join(' ')

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    // INITIATE: Generate auth URL and state token
    if (action === 'initiate') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify user session
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Generate state token for CSRF protection
      const stateToken = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

      // Store state token
      const { error: stateError } = await supabase
        .from('oauth_state_tokens')
        .insert({
          state_token: stateToken,
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
        })

      if (stateError) {
        console.error('Failed to store state token:', stateError)
        return new Response(JSON.stringify({ error: 'Failed to initiate OAuth' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Build Microsoft OAuth URL
      const authUrl = new URL(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`)
      authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('state', stateToken)
      authUrl.searchParams.set('response_mode', 'query')
      authUrl.searchParams.set('prompt', 'consent') // Force consent to get refresh token

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // CALLBACK: Handle OAuth redirect from Microsoft
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error from Microsoft:', error, url.searchParams.get('error_description'))
      return new Response(getCallbackHtml(false, error), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (!code || !state) {
      return new Response(getCallbackHtml(false, 'Missing code or state'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Validate state token
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_state_tokens')
      .select('user_id, expires_at')
      .eq('state_token', state)
      .single()

    if (stateError || !stateData) {
      return new Response(getCallbackHtml(false, 'Invalid state token'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Check expiration
    if (new Date(stateData.expires_at) < new Date()) {
      return new Response(getCallbackHtml(false, 'State token expired'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Delete used state token
    await supabase.from('oauth_state_tokens').delete().eq('state_token', state)

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response(getCallbackHtml(false, 'Token exchange failed'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Fetch user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!profileResponse.ok) {
      console.error('Failed to fetch profile:', await profileResponse.text())
      return new Response(getCallbackHtml(false, 'Failed to fetch profile'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const profile = await profileResponse.json()
    const email = profile.mail || profile.userPrincipalName
    const providerId = profile.id // Microsoft's unique user ID (OID)

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Check for existing connection with same email
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', stateData.user_id)
      .eq('provider', 'microsoft')
      .eq('account_email', email)
      .single()

    let connectionId: string

    if (existing) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('calendar_connections')
        .update({
          access_token,
          refresh_token,
          expires_at: expiresAt.toISOString(),
          requires_reauth: false,
          provider_account_id: providerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) throw updateError
      connectionId = existing.id
    } else {
      // Create new connection
      const { data: newConnection, error: insertError } = await supabase
        .from('calendar_connections')
        .insert({
          user_id: stateData.user_id,
          provider: 'microsoft',
          account_email: email,
          provider_account_id: providerId,
          label: profile.displayName || 'Microsoft Account',
          access_token,
          refresh_token,
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      connectionId = newConnection.id
    }

    // Return success with connection ID
    return new Response(getCallbackHtml(true, null, connectionId), {
      headers: { 'Content-Type': 'text/html' },
    })

  } catch (err) {
    console.error('OAuth error:', err)
    return new Response(getCallbackHtml(false, 'Internal server error'), {
      headers: { 'Content-Type': 'text/html' },
    })
  }
})

function getCallbackHtml(success: boolean, error: string | null, connectionId?: string): string {
  return `
<!DOCTYPE html>
<html>
<head><title>Microsoft Calendar Connection</title></head>
<body>
<script>
  window.opener?.postMessage({
    type: 'microsoft-calendar-oauth',
    success: ${success},
    ${error ? `error: "${error}",` : ''}
    ${connectionId ? `connectionId: "${connectionId}",` : ''}
  }, '*');
  window.close();
</script>
<p>${success ? 'Connected successfully! This window will close.' : `Error: ${error}`}</p>
</body>
</html>
  `
}
```

---

### 2.2 Microsoft Token Refresh Function

**File:** `supabase/functions/microsoft-calendar-refresh-token/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TENANT_ID = 'common'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find Microsoft connections expiring within 5 minutes
    const expiryThreshold = new Date(Date.now() + 5 * 60 * 1000)

    const { data: connections, error: fetchError } = await supabase
      .from('calendar_connections')
      .select('id, refresh_token')
      .eq('provider', 'microsoft')
      .eq('requires_reauth', false)
      .lt('expires_at', expiryThreshold.toISOString())

    if (fetchError) throw fetchError

    console.log(`Found ${connections?.length || 0} Microsoft connections to refresh`)

    const results = await Promise.allSettled(
      (connections || []).map(async (conn) => {
        const tokenResponse = await fetch(
          `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: MICROSOFT_CLIENT_ID,
              client_secret: MICROSOFT_CLIENT_SECRET,
              refresh_token: conn.refresh_token,
              grant_type: 'refresh_token',
            }),
          }
        )

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json()

          // Mark as requiring reauth if refresh token is invalid
          if (errorData.error === 'invalid_grant') {
            await supabase
              .from('calendar_connections')
              .update({ requires_reauth: true })
              .eq('id', conn.id)

            throw new Error(`Connection ${conn.id} requires reauth`)
          }

          throw new Error(`Token refresh failed: ${errorData.error_description}`)
        }

        const tokens = await tokenResponse.json()
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

        // Update connection with new tokens
        // Microsoft may return a new refresh token (rotation)
        await supabase
          .from('calendar_connections')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || conn.refresh_token,
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)

        return conn.id
      })
    )

    const refreshed = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(JSON.stringify({ refreshed, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Token refresh error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

---

### 2.3 Microsoft Calendar List Sync Function

**File:** `supabase/functions/microsoft-calendar-sync-calendars/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { connectionId } = await req.json()
    if (!connectionId) {
      return new Response(JSON.stringify({ error: 'connectionId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify user owns this connection
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    const { data: connection, error: connError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user?.id)
      .eq('provider', 'microsoft')
      .single()

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch calendars from Microsoft Graph
    const calendarResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/calendars',
      {
        headers: { Authorization: `Bearer ${connection.access_token}` },
      }
    )

    if (!calendarResponse.ok) {
      const error = await calendarResponse.text()
      console.error('Microsoft Graph error:', error)

      if (calendarResponse.status === 401) {
        await supabase
          .from('calendar_connections')
          .update({ requires_reauth: true })
          .eq('id', connectionId)
      }

      return new Response(JSON.stringify({ error: 'Failed to fetch calendars' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { value: calendars } = await calendarResponse.json()

    // Get existing subscriptions
    const { data: existingSubscriptions } = await supabase
      .from('calendar_subscriptions')
      .select('id, provider_calendar_id, is_visible')
      .eq('connection_id', connectionId)

    const existingMap = new Map(
      existingSubscriptions?.map(s => [s.provider_calendar_id, s]) || []
    )

    // Upsert calendars
    const upsertPromises = calendars.map(async (cal: any) => {
      const existing = existingMap.get(cal.id)

      const subscriptionData = {
        user_id: user?.id,
        connection_id: connectionId,
        provider_calendar_id: cal.id,
        calendar_name: cal.name,
        calendar_color: cal.hexColor || cal.color,
        background_color: cal.hexColor || '#0078d4', // Default Microsoft blue
        is_visible: existing?.is_visible ?? true,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      }

      if (existing) {
        return supabase
          .from('calendar_subscriptions')
          .update(subscriptionData)
          .eq('id', existing.id)
      } else {
        return supabase
          .from('calendar_subscriptions')
          .insert(subscriptionData)
      }
    })

    await Promise.all(upsertPromises)

    // Remove subscriptions for deleted calendars
    const currentCalendarIds = new Set(calendars.map((c: any) => c.id))
    const toDelete = existingSubscriptions?.filter(
      s => !currentCalendarIds.has(s.provider_calendar_id)
    ) || []

    if (toDelete.length > 0) {
      await supabase
        .from('calendar_subscriptions')
        .delete()
        .in('id', toDelete.map(s => s.id))
    }

    // Fetch updated subscriptions
    const { data: updatedSubscriptions } = await supabase
      .from('calendar_subscriptions')
      .select('*')
      .eq('connection_id', connectionId)

    return new Response(JSON.stringify({
      calendars: updatedSubscriptions,
      synced: calendars.length,
      removed: toDelete.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Calendar sync error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

---

### 2.4 Microsoft Event Sync Function

**File:** `supabase/functions/microsoft-calendar-sync-events/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Microsoft Graph uses ISO 8601 date format
const SYNC_PAST_DAYS = 30
const SYNC_FUTURE_DAYS = 90

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json().catch(() => ({}))
    const { connectionId } = body

    // Build query for connections to sync
    let query = supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'microsoft')
      .eq('requires_reauth', false)

    if (connectionId) {
      query = query.eq('id', connectionId)
    }

    const { data: connections, error: connError } = await query
    if (connError) throw connError

    console.log(`Syncing events for ${connections?.length || 0} Microsoft connections`)

    const results = await Promise.allSettled(
      (connections || []).map(conn => syncConnectionEvents(supabase, conn))
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(JSON.stringify({
      connections: connections?.length || 0,
      successful,
      failed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Event sync error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function syncConnectionEvents(supabase: any, connection: any) {
  // Get enabled subscriptions for this connection
  const { data: subscriptions } = await supabase
    .from('calendar_subscriptions')
    .select('*')
    .eq('connection_id', connection.id)
    .eq('sync_enabled', true)

  if (!subscriptions?.length) {
    console.log(`No enabled subscriptions for connection ${connection.id}`)
    return
  }

  // Sync each calendar
  await Promise.all(
    subscriptions.map((sub: any) =>
      syncCalendarEvents(supabase, connection, sub)
    )
  )
}

async function syncCalendarEvents(supabase: any, connection: any, subscription: any) {
  // Get sync state (deltaLink)
  const { data: syncState } = await supabase
    .from('calendar_sync_state')
    .select('*')
    .eq('subscription_id', subscription.id)
    .single()

  let url: string
  let isFullSync = false

  if (syncState?.sync_token) {
    // Use deltaLink for incremental sync
    url = syncState.sync_token
  } else {
    // Full sync with date filter
    isFullSync = true
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - SYNC_PAST_DAYS)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + SYNC_FUTURE_DAYS)

    url = `https://graph.microsoft.com/v1.0/me/calendars/${subscription.provider_calendar_id}/events/delta?` +
      `$filter=start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'&` +
      `$select=id,subject,bodyPreview,start,end,isAllDay,location,categories`
  }

  let allEvents: any[] = []
  let deltaLink: string | null = null

  // Paginate through results
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Microsoft Graph error:', response.status, errorText)

      // Handle 410 Gone (invalid delta token) - need full sync
      if (response.status === 410) {
        console.log('Delta token expired, performing full sync')
        // Clear sync token and retry
        await supabase
          .from('calendar_sync_state')
          .delete()
          .eq('subscription_id', subscription.id)

        // Recursive call for full sync
        return syncCalendarEvents(supabase, connection, subscription)
      }

      // Handle 401 - mark connection for reauth
      if (response.status === 401) {
        await supabase
          .from('calendar_connections')
          .update({ requires_reauth: true })
          .eq('id', connection.id)
      }

      throw new Error(`Graph API error: ${response.status}`)
    }

    const data = await response.json()
    allEvents = allEvents.concat(data.value || [])

    // Get next page or delta link
    url = data['@odata.nextLink'] || null
    deltaLink = data['@odata.deltaLink'] || deltaLink
  }

  console.log(`Fetched ${allEvents.length} events for calendar ${subscription.calendar_name}`)

  // Process events
  let inserted = 0, updated = 0, deleted = 0

  for (const event of allEvents) {
    // Handle deleted events (have @removed property)
    if (event['@removed']) {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('connection_id', connection.id)
        .eq('provider_event_id', event.id)

      if (!error) deleted++
      continue
    }

    // Parse event data
    const eventData = {
      connection_id: connection.id,
      subscription_id: subscription.id,
      provider: 'microsoft',
      provider_event_id: event.id,
      provider_calendar_id: subscription.provider_calendar_id,
      user_id: connection.user_id,
      title: event.subject || '(No title)',
      description: event.bodyPreview || null,
      start_time: event.start.dateTime + 'Z', // Add Z for UTC
      end_time: event.end.dateTime + 'Z',
      is_all_day: event.isAllDay || false,
      location: event.location?.displayName || null,
      color: null, // Microsoft events don't have individual colors
      last_synced_at: new Date().toISOString(),
      etag: event['@odata.etag'] || null,
      updated_at: new Date().toISOString(),
    }

    // Upsert event
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('connection_id', connection.id)
      .eq('provider_event_id', event.id)
      .single()

    if (existing) {
      await supabase
        .from('calendar_events')
        .update(eventData)
        .eq('id', existing.id)
      updated++
    } else {
      await supabase
        .from('calendar_events')
        .insert(eventData)
      inserted++
    }
  }

  // Save delta link for next sync
  if (deltaLink) {
    await supabase
      .from('calendar_sync_state')
      .upsert({
        subscription_id: subscription.id,
        sync_token: deltaLink,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'subscription_id',
      })
  }

  console.log(`Calendar ${subscription.calendar_name}: ${inserted} inserted, ${updated} updated, ${deleted} deleted`)
}
```

---

## Phase 3: Service Layer Updates

### 3.1 Update calendarService.ts

**File:** `packages/data/services/calendarService.ts`

Add Microsoft-specific functions and update existing functions to handle provider:

```typescript
import { getSupabaseClient } from '../supabase'
import {
  CalendarConnectionSchema,
  CalendarSubscriptionSchema,
  CalendarEventSchema,
  CalendarProvider,
} from '@flow-app/models'

const supabase = getSupabaseClient()

// ===== Connection Functions =====

export type ConnectionFilter = {
  provider?: CalendarProvider
}

export const getCalendarConnections = async (filter?: ConnectionFilter) => {
  let query = supabase
    .from('calendar_connections')
    .select('*')
    .order('created_at', { ascending: true })

  if (filter?.provider) {
    query = query.eq('provider', filter.provider)
  }

  const { data, error } = await query
  if (error) throw new Error(`getCalendarConnections: ${error.message}`)

  return data.map(conn => CalendarConnectionSchema.parse(conn))
}

export const getCalendarConnectionById = async (id: string) => {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getCalendarConnectionById: ${error.message}`)
  return CalendarConnectionSchema.parse(data)
}

export const deleteCalendarConnection = async (id: string) => {
  const { error } = await supabase
    .from('calendar_connections')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`deleteCalendarConnection: ${error.message}`)
}

export const updateCalendarConnectionLabel = async (id: string, label: string) => {
  const { data, error } = await supabase
    .from('calendar_connections')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateCalendarConnectionLabel: ${error.message}`)
  return CalendarConnectionSchema.parse(data)
}

// ===== Event Functions with Provider Support =====

export type EventFilter = {
  startDate: Date
  endDate: Date
  visibleOnly?: boolean
  provider?: CalendarProvider
  connectionId?: string
  subscriptionId?: string
}

export const getCalendarEvents = async (filter: EventFilter) => {
  let query = supabase
    .from('calendar_events')
    .select('*, calendar_subscriptions!inner(*)')
    .gte('start_time', filter.startDate.toISOString())
    .lte('end_time', filter.endDate.toISOString())
    .order('start_time')

  if (filter.visibleOnly) {
    query = query.eq('calendar_subscriptions.is_visible', true)
  }

  if (filter.provider) {
    query = query.eq('provider', filter.provider)
  }

  if (filter.connectionId) {
    query = query.eq('connection_id', filter.connectionId)
  }

  if (filter.subscriptionId) {
    query = query.eq('subscription_id', filter.subscriptionId)
  }

  const { data, error } = await query
  if (error) throw new Error(`getCalendarEvents: ${error.message}`)

  return data.map(event => CalendarEventSchema.parse(event))
}
```

---

## Phase 4: Hook Layer Updates

### 4.1 Update useCalendar.ts

**File:** `packages/data/hooks/useCalendar.ts`

Add provider parameter support:

```typescript
import { CalendarProvider } from '@flow-app/models'

// Updated hook with provider support
export const useCalendarConnections = (provider?: CalendarProvider) => {
  return useQuery({
    queryKey: ['calendar-connections', provider],
    queryFn: () => getCalendarConnections({ provider }),
  })
}

// New hook specifically for Microsoft
export const useConnectMicrosoftCalendar = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (label?: string) => {
      const session = await getSessionToken()
      const functionsUrl = getSupabaseFunctionsUrl()

      const response = await fetch(
        `${functionsUrl}/microsoft-calendar-oauth?action=initiate`,
        {
          headers: { Authorization: `Bearer ${session}` },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to initiate Microsoft OAuth')
      }

      const { authUrl } = await response.json()

      // Store label for callback
      if (label) {
        localStorage.setItem('pending_calendar_label', label)
      }

      // Open OAuth popup
      const popup = window.open(authUrl, 'Microsoft OAuth', 'width=600,height=700')

      // Wait for callback
      return new Promise((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'microsoft-calendar-oauth') {
            window.removeEventListener('message', handleMessage)

            if (event.data.success) {
              resolve(event.data.connectionId)
            } else {
              reject(new Error(event.data.error || 'OAuth failed'))
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // Handle popup close
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup)
            window.removeEventListener('message', handleMessage)
            reject(new Error('OAuth popup closed'))
          }
        }, 500)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] })
    },
  })
}

// Unified sync hook that handles both providers
export const useSyncCalendarList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ connectionId, provider }: { connectionId: string; provider: CalendarProvider }) => {
      const session = await getSessionToken()
      const functionsUrl = getSupabaseFunctionsUrl()

      const functionName = provider === 'google'
        ? 'google-calendar-sync-calendars'
        : 'microsoft-calendar-sync-calendars'

      const response = await fetch(
        `${functionsUrl}/${functionName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      )

      if (!response.ok) {
        throw new Error('Calendar sync failed')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}
```

---

## Phase 5: UI Updates

### 5.1 Update Calendar Connections Page

**File:** `apps/web/app/app/settings/calendar-connections/page.tsx`

Add provider selector for connecting new accounts:

```tsx
// Add provider selection dialog
const [showProviderDialog, setShowProviderDialog] = useState(false)

// Provider selection UI
<Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Connect Calendar</DialogTitle>
      <DialogDescription>
        Choose your calendar provider
      </DialogDescription>
    </DialogHeader>

    <div className="grid grid-cols-2 gap-4">
      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2"
        onClick={() => {
          setShowProviderDialog(false)
          connectGoogle.mutate()
        }}
      >
        <GoogleCalendarIcon className="h-8 w-8" />
        <span>Google Calendar</span>
      </Button>

      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2"
        onClick={() => {
          setShowProviderDialog(false)
          connectMicrosoft.mutate()
        }}
      >
        <MicrosoftIcon className="h-8 w-8" />
        <span>Microsoft 365</span>
      </Button>
    </div>
  </DialogContent>
</Dialog>

// Update connection list to show provider badge
{connections?.map(connection => (
  <Card key={connection.id}>
    <CardHeader>
      <div className="flex items-center gap-2">
        {connection.provider === 'google' ? (
          <GoogleCalendarIcon className="h-5 w-5" />
        ) : (
          <MicrosoftIcon className="h-5 w-5" />
        )}
        <CardTitle>{connection.label}</CardTitle>
        <Badge variant="secondary">{connection.provider}</Badge>
      </div>
      <CardDescription>{connection.account_email}</CardDescription>
    </CardHeader>
    {/* ... rest of card content */}
  </Card>
))}
```

---

## Phase 6: Cross-Platform Testing

### 6.1 Web Testing
- [ ] OAuth popup opens correctly
- [ ] State token validation works
- [ ] Token exchange succeeds
- [ ] Connection saved to database
- [ ] Calendar list syncs after connection
- [ ] Events sync within 5 minutes
- [ ] Visibility toggles work
- [ ] Disconnect cascade deletes data

### 6.2 iOS Testing (Capacitor)
- [ ] OAuth opens in system browser
- [ ] Deep link callback returns to app
- [ ] Tokens stored correctly
- [ ] Sync works in background
- [ ] Pull-to-refresh triggers sync

### 6.3 macOS Desktop Testing (Tauri)
- [ ] OAuth opens in default browser
- [ ] Custom protocol handler works
- [ ] Window regains focus after auth
- [ ] Menu bar sync status works
- [ ] Background sync continues when minimized

---

## Phase 7: Cron Job Setup

### 7.1 Add Microsoft Event Sync Cron

**File:** `supabase/migrations/YYYYMMDD_add_microsoft_calendar_cron.sql`

```sql
-- Schedule Microsoft calendar event sync every 5 minutes
SELECT cron.schedule(
  'microsoft-calendar-sync-events',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/microsoft-calendar-sync-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule Microsoft token refresh hourly
SELECT cron.schedule(
  'microsoft-calendar-refresh-token',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/microsoft-calendar-refresh-token',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Deployment Checklist

### Azure AD
- [ ] App registration complete
- [ ] Redirect URIs added (Web, iOS, macOS)
- [ ] API permissions configured
- [ ] Client secret generated (note expiry date)
- [ ] Admin consent granted (if required)

### Supabase
- [ ] Database migration applied
- [ ] Secrets set (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET)
- [ ] Edge functions deployed
- [ ] Cron jobs scheduled

### iOS
- [ ] Deep link configured in `capacitor.config.ts`
- [ ] URL scheme added to `Info.plist`
- [ ] Associated domains configured (if using universal links)

### macOS Desktop
- [ ] Custom protocol handler registered in Tauri config
- [ ] App notarization includes URL scheme

### Testing
- [ ] All test cases in Phase 6 pass
- [ ] Error handling verified
- [ ] Token refresh tested with expired tokens
- [ ] Multi-account tested (2+ Microsoft accounts)

---

## Rollback Plan

If issues occur after deployment:

1. **Disable cron jobs** - Stop automatic sync
2. **Revert Edge Functions** - Deploy previous versions
3. **Database rollback** - If needed, revert column renames with:

```sql
-- Emergency rollback (only if critical issues)
ALTER TABLE calendar_connections RENAME TO google_calendar_connections;
ALTER TABLE calendar_connections DROP COLUMN provider;
-- etc.
```

---

## Future Enhancements

After Microsoft integration is stable:

1. **Apple Calendar** - iCloud calendar integration
2. **Two-way sync** - Create/edit events from Flow
3. **Meeting scheduling** - Find free time across providers
4. **Calendar sharing** - Share calendars with team members
5. **Smart notifications** - AI-powered meeting prep reminders
