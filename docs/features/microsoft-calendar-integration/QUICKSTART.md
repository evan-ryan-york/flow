# Microsoft Calendar Integration - Quickstart Guide

This guide provides everything needed for a fresh LLM or developer to implement Microsoft Calendar integration from scratch.

---

## Prerequisites

### Accounts & Access
- [ ] Azure account with ability to create App Registrations
- [ ] Access to Supabase project dashboard (`sprjddkfkwrrebazjxvf`)
- [ ] Git access to this repository

### Local Environment
- [ ] Node.js 18+
- [ ] pnpm installed
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Database password set as environment variable

### Verify Environment
```bash
# Check Supabase CLI
supabase --version

# Check database connection
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" -c "SELECT 1"

# Check you can deploy functions
supabase functions list --project-ref sprjddkfkwrrebazjxvf
```

---

## Current Codebase State

### Existing Files You'll Modify

#### 1. Zod Schemas (`packages/models/index.ts`)

**Current Google-only schemas (lines 222-277):**
```typescript
// Line 223-235: GoogleCalendarConnectionSchema
export const GoogleCalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),           // Will rename to account_email
  label: z.string().min(1).max(50),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.string(),
  requires_reauth: z.boolean().default(false).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Line 240-252: CalendarSubscriptionSchema
export const CalendarSubscriptionSchema = z.object({
  // ...
  google_calendar_id: z.string(),      // Will rename to provider_calendar_id
  // ...
});

// Line 258-277: CalendarEventSchema
export const CalendarEventSchema = z.object({
  // ...
  google_calendar_event_id: z.string(), // Will rename to provider_event_id
  google_calendar_id: z.string(),       // Will rename to provider_calendar_id
  // ...
});
```

**What to add:**
- `CalendarProviderSchema = z.enum(['google', 'microsoft'])`
- `provider` field to `CalendarConnectionSchema`
- `provider_account_id` field for Microsoft OID
- Rename columns to provider-agnostic names

---

#### 2. Calendar Service (`packages/data/services/calendarService.ts`)

**Current table references (lines 21-60):**
```typescript
// Line 21-24: Uses 'google_calendar_connections' table
const { data, error } = await supabase
  .from('google_calendar_connections')  // Will become 'calendar_connections'
  .select('*')
  .order('created_at', { ascending: true });
```

**What to change:**
- Update table name from `google_calendar_connections` to `calendar_connections`
- Update column names (`email` → `account_email`, etc.)
- Add optional `provider` filter parameter

---

#### 3. Calendar Hooks (`packages/data/hooks/useCalendar.ts`)

**Current hook functions:**
- `useGoogleCalendarConnections()` (line 78) - Query connections
- `useConnectGoogleCalendar()` (line 88) - OAuth flow
- `useDisconnectGoogleCalendar()` (line 171) - Delete connection
- `useSyncCalendarList()` (line 314) - Sync calendars
- `useTriggerEventSync()` (line 406) - Sync events

**What to add:**
- `useConnectMicrosoftCalendar()` - New hook for Microsoft OAuth
- Update `useSyncCalendarList()` to accept provider parameter
- Optionally rename `useGoogleCalendarConnections()` to `useCalendarConnections()`

---

#### 4. Settings Page (`apps/web/app/app/settings/calendar-connections/page.tsx`)

**Current UI (279 lines):**
- "Connect New Account" button → Opens dialog → Initiates Google OAuth
- Lists connections with edit/sync/delete buttons
- Uses `CalendarPicker` component for visibility toggles

**What to add:**
- Provider selection dialog (Google vs Microsoft icons)
- Provider badge on each connection card
- Separate connect handlers for each provider

---

### Existing Edge Functions to Reference

| Function | Location | Purpose |
|----------|----------|---------|
| `google-calendar-oauth` | `supabase/functions/google-calendar-oauth/index.ts` | OAuth initiate & callback |
| `google-calendar-refresh-token` | `supabase/functions/google-calendar-refresh-token/index.ts` | Token refresh |
| `google-calendar-sync-calendars` | `supabase/functions/google-calendar-sync-calendars/index.ts` | Fetch calendar list |
| `google-calendar-sync-events` | `supabase/functions/google-calendar-sync-events/index.ts` | Fetch & sync events |

**Use these as templates** - the Microsoft versions follow the same patterns.

---

## Step-by-Step Implementation

### Phase 1: Azure AD Setup

#### Step 1.1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click "New registration"
3. Configure:
   - **Name:** `Flow Calendar Integration`
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI:** Web → `https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/microsoft-calendar-oauth`
4. Click "Register"

#### Step 1.2: Add API Permissions

1. Go to "API permissions" → "Add a permission"
2. Select "Microsoft Graph" → "Delegated permissions"
3. Add:
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access`
4. Click "Grant admin consent" (if you have permissions)

#### Step 1.3: Create Client Secret

1. Go to "Certificates & secrets" → "New client secret"
2. Description: `Flow Production`
3. Expiry: 24 months
4. **COPY THE VALUE IMMEDIATELY** - it won't be shown again

#### Step 1.4: Store Credentials

```bash
# Add to Supabase secrets
supabase secrets set MICROSOFT_CLIENT_ID="your-client-id" --project-ref sprjddkfkwrrebazjxvf
supabase secrets set MICROSOFT_CLIENT_SECRET="your-client-secret" --project-ref sprjddkfkwrrebazjxvf

# Verify secrets are set
supabase secrets list --project-ref sprjddkfkwrrebazjxvf
```

**Verification:** Secrets should appear in the list (values hidden).

---

### Phase 2: Database Migration

#### Step 2.1: Create Migration File

Create file: `supabase/migrations/YYYYMMDD_add_microsoft_calendar_support.sql`

Use the complete SQL from `database-migration.md`.

#### Step 2.2: Apply Migration

```bash
# Apply to production database
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -f supabase/migrations/YYYYMMDD_add_microsoft_calendar_support.sql
```

**Verification:**
```bash
# Check table was renamed
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'calendar_connections';"

# Expected output should include: provider, account_email, provider_account_id
```

---

### Phase 3: Update Zod Schemas

#### Step 3.1: Edit `packages/models/index.ts`

Add after line 219 (after TimeBlockTaskSchema):

```typescript
// ---------------------------------
// Calendar Provider (Multi-provider support)
// ---------------------------------
export const CalendarProviderSchema = z.enum(['google', 'microsoft']);
export type CalendarProvider = z.infer<typeof CalendarProviderSchema>;
```

Update `GoogleCalendarConnectionSchema` (lines 223-235):

```typescript
// ---------------------------------
// 10. Calendar Connections (renamed from Google Calendar Connections)
// ---------------------------------
export const CalendarConnectionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  account_email: z.string().email(),
  provider_account_id: z.string().nullable(),
  label: z.string().min(1).max(50),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.string(),
  requires_reauth: z.boolean().default(false).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CalendarConnection = z.infer<typeof CalendarConnectionSchema>;

// Backwards compatibility alias
export const GoogleCalendarConnectionSchema = CalendarConnectionSchema;
export type GoogleCalendarConnection = CalendarConnection;
```

Update `CalendarSubscriptionSchema` (lines 240-252):

```typescript
export const CalendarSubscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  connection_id: z.string().uuid(),
  provider_calendar_id: z.string(),  // Changed from google_calendar_id
  calendar_name: z.string(),
  calendar_color: z.string().nullable(),
  background_color: z.string().nullable(),
  is_visible: z.boolean().default(true),
  sync_enabled: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});
```

Update `CalendarEventSchema` (lines 258-277):

```typescript
export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  connection_id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  provider: CalendarProviderSchema,
  provider_event_id: z.string(),      // Changed from google_calendar_event_id
  provider_calendar_id: z.string(),   // Changed from google_calendar_id
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  is_all_day: z.boolean().default(false),
  location: z.string().nullable(),
  color: z.string().nullable(),
  last_synced_at: z.string(),
  etag: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
```

**Verification:**
```bash
pnpm build
# Should complete without TypeScript errors
```

---

### Phase 4: Create Edge Functions

#### Step 4.1: Create Microsoft OAuth Function

Create directory and file:
```bash
mkdir -p supabase/functions/microsoft-calendar-oauth
```

Create `supabase/functions/microsoft-calendar-oauth/index.ts` with code from `implementation-plan.md` Phase 2.1.

#### Step 4.2: Create Token Refresh Function

```bash
mkdir -p supabase/functions/microsoft-calendar-refresh-token
```

Create `supabase/functions/microsoft-calendar-refresh-token/index.ts` with code from `implementation-plan.md` Phase 2.2.

#### Step 4.3: Create Calendar Sync Function

```bash
mkdir -p supabase/functions/microsoft-calendar-sync-calendars
```

Create `supabase/functions/microsoft-calendar-sync-calendars/index.ts` with code from `implementation-plan.md` Phase 2.3.

#### Step 4.4: Create Event Sync Function

```bash
mkdir -p supabase/functions/microsoft-calendar-sync-events
```

Create `supabase/functions/microsoft-calendar-sync-events/index.ts` with code from `implementation-plan.md` Phase 2.4.

#### Step 4.5: Deploy Functions

```bash
# Deploy all Microsoft functions
supabase functions deploy microsoft-calendar-oauth --project-ref sprjddkfkwrrebazjxvf
supabase functions deploy microsoft-calendar-refresh-token --project-ref sprjddkfkwrrebazjxvf
supabase functions deploy microsoft-calendar-sync-calendars --project-ref sprjddkfkwrrebazjxvf
supabase functions deploy microsoft-calendar-sync-events --project-ref sprjddkfkwrrebazjxvf
```

**Verification:**
```bash
# List deployed functions
supabase functions list --project-ref sprjddkfkwrrebazjxvf

# Test OAuth initiate (should return authUrl)
curl -X GET "https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/microsoft-calendar-oauth?action=initiate" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"
```

---

### Phase 5: Update Service Layer

#### Step 5.1: Update `packages/data/services/calendarService.ts`

Change table name (line 22):
```typescript
// Before
.from('google_calendar_connections')

// After
.from('calendar_connections')
```

Update column references throughout:
```typescript
// Before
connection.email

// After
connection.account_email
```

Add provider filter option:
```typescript
export async function getCalendarConnections(
  provider?: 'google' | 'microsoft'
): Promise<CalendarConnection[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('calendar_connections')
    .select('*')
    .order('created_at', { ascending: true });

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error } = await query;
  // ...
}
```

**Verification:**
```bash
pnpm build
pnpm test packages/data/services/calendarService
```

---

### Phase 6: Update Hooks

#### Step 6.1: Update `packages/data/hooks/useCalendar.ts`

Add Microsoft OAuth hook after `useConnectGoogleCalendar` (around line 166):

```typescript
/**
 * Mutation: Initiate OAuth flow to connect a new Microsoft Calendar account
 */
export function useConnectMicrosoftCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label?: string) => {
      const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();
      const token = await getSessionToken();
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/microsoft-calendar-oauth?action=initiate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to initiate Microsoft OAuth flow');
      }

      const { authUrl } = await response.json();

      if (label && typeof window !== 'undefined' && localStorage) {
        localStorage.setItem('pending_calendar_label', label);
      }

      // Open OAuth in a popup window
      if (typeof window !== 'undefined') {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          authUrl,
          'microsoft-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        return new Promise((resolve, reject) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'microsoft-calendar-oauth') {
              window.removeEventListener('message', handleMessage);
              if (event.data.success) {
                resolve(event.data.connectionId);
              } else {
                reject(new Error(event.data.error || 'OAuth failed'));
              }
            }
          };

          window.addEventListener('message', handleMessage);

          if (!popup || popup.closed) {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Popup was blocked'));
          }

          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              window.removeEventListener('message', handleMessage);
            }
          }, 500);
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.connections });
    },
  });
}
```

Export new hook in `packages/data/index.ts`:
```typescript
export { useConnectMicrosoftCalendar } from './hooks/useCalendar';
```

**Verification:**
```bash
pnpm build
```

---

### Phase 7: Update UI

#### Step 7.1: Update Settings Page

Edit `apps/web/app/app/settings/calendar-connections/page.tsx`:

Add imports:
```typescript
import { useConnectMicrosoftCalendar } from "@flow-app/data"
```

Add state for provider selection:
```typescript
const [providerDialogOpen, setProviderDialogOpen] = React.useState(false)
const connectMicrosoft = useConnectMicrosoftCalendar()
```

Replace the connect dialog with provider selection:
```tsx
<Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
  <DialogTrigger asChild>
    <Button className="w-full sm:w-auto">
      <Plus className="mr-2 h-4 w-4" />
      Connect New Account
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Connect Calendar</DialogTitle>
      <DialogDescription>
        Choose your calendar provider
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-2 gap-4 py-4">
      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2"
        onClick={() => {
          setProviderDialogOpen(false)
          setConnectDialogOpen(true) // Opens existing Google dialog
        }}
      >
        {/* Google icon */}
        <svg className="h-8 w-8" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>Google Calendar</span>
      </Button>

      <Button
        variant="outline"
        className="h-24 flex flex-col items-center justify-center gap-2"
        onClick={() => {
          setProviderDialogOpen(false)
          connectMicrosoft.mutate(undefined, {
            onError: (error) => alert(error.message)
          })
        }}
      >
        {/* Microsoft icon */}
        <svg className="h-8 w-8" viewBox="0 0 24 24">
          <path fill="#F25022" d="M1 1h10v10H1z"/>
          <path fill="#7FBA00" d="M13 1h10v10H13z"/>
          <path fill="#00A4EF" d="M1 13h10v10H1z"/>
          <path fill="#FFB900" d="M13 13h10v10H13z"/>
        </svg>
        <span>Microsoft 365</span>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

Add provider badge to connection cards:
```tsx
<CardTitle className="flex items-center gap-2">
  {connection.provider === 'microsoft' ? (
    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Microsoft</span>
  ) : (
    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Google</span>
  )}
  {connection.label}
</CardTitle>
```

**Verification:**
```bash
pnpm dev:web
# Navigate to /app/settings/calendar-connections
# Should see provider selection dialog
```

---

## Testing Checklist

### OAuth Flow
- [ ] Click "Connect New Account" → Provider selection appears
- [ ] Click Microsoft → Popup opens with Microsoft login
- [ ] After login → Consent screen shows calendar permissions
- [ ] After consent → Popup closes, connection appears in list
- [ ] Connection shows "Microsoft" badge and email

### Calendar Sync
- [ ] Click refresh icon on Microsoft connection → Calendars load
- [ ] Toggle calendar visibility → Updates persist
- [ ] Events appear in calendar view after sync

### Cross-Platform (if applicable)
- [ ] OAuth works on iOS (deep link callback)
- [ ] OAuth works on macOS Desktop (protocol handler)

---

## Common Issues & Solutions

### "Failed to initiate OAuth flow"
- Check `MICROSOFT_CLIENT_ID` secret is set in Supabase
- Verify redirect URI in Azure matches Edge Function URL

### "Token exchange failed"
- Check `MICROSOFT_CLIENT_SECRET` secret is set
- Verify client secret hasn't expired

### "Calendar sync failed"
- Check access token hasn't expired (should auto-refresh)
- Verify `Calendars.Read` permission was granted

### Database column errors
- Migration may not have applied - check column names
- Run verification queries from Phase 2

### TypeScript errors after schema changes
- Run `pnpm build` to check for mismatched types
- Update service layer to use new column names

---

## Notes for Next AI Agent

### Critical Context
1. **Database is renamed** - `google_calendar_connections` → `calendar_connections`
2. **Columns are renamed** - `email` → `account_email`, `google_calendar_id` → `provider_calendar_id`, etc.
3. **Provider column** - All connections have `provider: 'google' | 'microsoft'`
4. **Existing patterns** - Follow Google Calendar Edge Functions as templates

### Important Files
- **Models:** `packages/models/index.ts` (lines 220-280)
- **Service:** `packages/data/services/calendarService.ts` (273 lines)
- **Hooks:** `packages/data/hooks/useCalendar.ts` (491 lines)
- **UI:** `apps/web/app/app/settings/calendar-connections/page.tsx` (279 lines)
- **Edge Functions:** `supabase/functions/google-calendar-*/index.ts`

### Deployment Commands
```bash
# Deploy Edge Function
supabase functions deploy FUNCTION_NAME --project-ref sprjddkfkwrrebazjxvf

# Apply migration
psql "postgresql://postgres:$DATABASE_PASSWORD@db.sprjddkfkwrrebazjxvf.supabase.co:5432/postgres" -f PATH_TO_MIGRATION.sql

# Set secrets
supabase secrets set KEY="value" --project-ref sprjddkfkwrrebazjxvf
```

### Testing Approach
1. Apply database migration first
2. Update Zod schemas and verify build passes
3. Deploy Edge Functions one at a time, test each
4. Update service layer, run existing tests
5. Add new hooks, test in UI
6. Update settings page, manual test

### Rollback
If something breaks badly:
1. Revert to `google_calendar_connections` table name
2. Remove `provider` column requirements
3. Restore original column names

See `database-migration.md` for full rollback SQL.

---

## Success Criteria

When complete, the following should work:

1. **Multiple providers** - User can connect both Google and Microsoft accounts
2. **Unified UI** - Single settings page manages all connections
3. **Provider badges** - Clear visual indication of which provider each connection uses
4. **Independent sync** - Each provider syncs independently
5. **Cross-platform** - OAuth works on Web, iOS, and macOS Desktop
6. **Visibility toggles** - Per-calendar visibility works for both providers
7. **Cascade delete** - Disconnecting removes all related data

---

*Last updated: Auto-generated*
*Related docs: [implementation-plan.md](./implementation-plan.md), [database-migration.md](./database-migration.md), [cross-platform-oauth.md](./cross-platform-oauth.md)*
