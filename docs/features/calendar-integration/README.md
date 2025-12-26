# Google Calendar Integration

**Status:** ✅ **MOSTLY COMPLETE** (Backend 100%, Frontend 80%)
**Component Location:** `apps/web/components/CalendarPanel.tsx`
**Platforms:** Web (iOS/Android/Desktop pending mobile optimization)

## Overview

Multi-account Google Calendar integration allowing users to connect unlimited Google accounts and view events from personal, work, and business calendars in a unified view within Column 3 of the Flow.

## What's Implemented ✅

### Backend Infrastructure (100% Complete)
- ✅ **Database Schema** - 4 tables with full Row-Level Security
- ✅ **OAuth Flow** - Google Calendar authentication via Edge Functions
- ✅ **Token Management** - Automatic token refresh (hourly cron)
- ✅ **Calendar Sync** - Incremental event synchronization (5-min cron)
- ✅ **Multi-Account** - Unlimited Google accounts per user
- ✅ **Edge Functions** - 4 deployed Supabase functions
- ✅ **Security** - Complete RLS policies on all tables
- ✅ **Cron Jobs** - Automated background sync and token refresh

### Frontend Features (80% Complete)
- ✅ **Service Layer** - Complete CRUD operations with Zod validation
- ✅ **Hook Layer** - 8 TanStack Query hooks for data management
- ✅ **Calendar Panel** - 595-line component displaying events
- ✅ **Multi-Account UI** - Connect/disconnect multiple Google accounts
- ✅ **Calendar Visibility** - Toggle calendars on/off
- ✅ **Event Display** - Month view with color-coded events
- ✅ **Month Navigation** - Previous/next month controls

### Testing (Partial Coverage)
- ✅ **RLS Tests** - Row-Level Security validation
- ✅ **Hook Tests** - TanStack Query hook unit tests
- ✅ **E2E Tests** - End-to-end user journey tests
- ❌ **Component Tests** - Not implemented (manual testing only)

### Missing Features ❌
- **Two-Way Sync** - Read-only (can't create/edit events from app)
- **Component Tests** - No automated React component tests
- **Mobile Polish** - Web-focused, mobile needs optimization
- **Task Linking** - No explicit task-to-event associations
- **Reminders** - No notification system for events
- **Other Providers** - Only Google (no Outlook/Apple Calendar)

## Quick Navigation

### Setup & Deployment
- **[OAuth Setup](./google-calendar-oauth-setup.md)** - Google Cloud Console configuration
- **[Edge Functions](./edge-functions-deployment.md)** - Supabase function deployment
- **[Cron Jobs](./calendar-cron-setup.md)** - Automated sync setup (3 methods)
- **[Deployment Checklist](./CALENDAR_DEPLOYMENT_CHECKLIST.md)** - Production readiness

### Documentation
- **[Current Status](./CURRENT-STATUS.md)** - Comprehensive implementation status
- **[Build Plan](./calendar-integration-build-plan.md)** - Original implementation plan
- **[User Guide](./CALENDAR_USER_GUIDE.md)** - End-user documentation
- **[Troubleshooting](./CALENDAR_TROUBLESHOOTING.md)** - Common issues and solutions
- **[Testing Guide](./AUTOMATED_TESTING_GUIDE.md)** - Test suite documentation

### Architecture
- **[Architecture Review](./SUPABASE_ARCHITECTURE_REVIEW.md)** - Security audit and design

## Key Features

### Multi-Account Support
- Connect unlimited Google Calendar accounts
- Label each account (e.g., "Work Gmail", "Personal")
- Each account can have multiple calendars
- Independent token management per account

### Automatic Synchronization
- **Event Sync:** Every 5 minutes via cron
- **Token Refresh:** Hourly to prevent auth failures
- **Incremental Sync:** Uses Google's syncToken for efficiency
- **Date Range:** 30 days past to 90 days future

### Calendar Management
- View all calendars from all connected accounts
- Toggle calendar visibility (show/hide events)
- Custom color per calendar
- Disconnect accounts with cascade delete

### Security & Privacy
- Row-Level Security on all database tables
- Users can only access their own calendar data
- OAuth tokens stored securely
- No cross-user data leakage

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User's Browser                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │CalendarPanel │──>│  useCalendar │──>│calendarService│   │
│  │  (UI - 595L) │   │   (Hooks)    │   │  (Services)   │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Backend                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Database Tables (with RLS)                    │  │
│  │  • google_calendar_connections  (OAuth tokens)       │  │
│  │  • calendar_subscriptions       (Calendar list)      │  │
│  │  • calendar_events              (Cached events)      │  │
│  │  • calendar_sync_state          (Sync tracking)      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Edge Functions (Deno)                         │  │
│  │  • google-calendar-oauth         (Auth flow)         │  │
│  │  • google-calendar-refresh-token (Token refresh)     │  │
│  │  • google-calendar-sync-calendars (Cal list sync)    │  │
│  │  • google-calendar-sync-events   (Event sync)        │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Cron Jobs                                     │  │
│  │  • Event Sync:    Every 5 minutes                    │  │
│  │  • Token Refresh: Hourly                             │  │
│  │  • Cleanup:       Hourly                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │   Google Calendar API    │
            │  (OAuth 2.0 + Events)    │
            └──────────────────────────┘
```

## User Workflows

### Connect Google Calendar
1. Click "Connect Google Calendar" button
2. Enter account label (e.g., "Work")
3. Redirected to Google OAuth consent screen
4. Grant calendar read permissions
5. Redirected back to app
6. Connection saved with tokens
7. Calendar list automatically synced
8. Events start syncing every 5 minutes

### View Calendar Events
1. Calendar Panel shows current month grid
2. Events from all visible calendars displayed
3. Color-coded by calendar
4. Navigate months with prev/next buttons
5. Events update automatically (5-min sync)

### Manage Calendar Visibility
1. See list of all calendars from all accounts
2. Toggle visibility checkbox per calendar
3. Events instantly show/hide in calendar grid
4. Preference saved automatically

### Disconnect Account
1. Click disconnect button on account
2. Confirm deletion
3. Connection, calendars, and events removed (cascade)
4. UI updates immediately

## File Locations

### Backend
- **Database Schema:** `supabase/migrations/20251002000000_add_google_calendar_integration.sql`
- **OAuth Tokens:** `supabase/migrations/20251002000001_add_oauth_state_tokens.sql`
- **Token Refresh:** `supabase/migrations/20251002000002_add_requires_reauth_column.sql`
- **Cron Setup:** `supabase/migrations/20251002000003_setup_calendar_sync_cron.sql`
- **Edge Functions:**
  - `supabase/functions/google-calendar-oauth/index.ts`
  - `supabase/functions/google-calendar-refresh-token/index.ts`
  - `supabase/functions/google-calendar-sync-calendars/index.ts`
  - `supabase/functions/google-calendar-sync-events/index.ts`

### Frontend
- **Models:** `packages/models/index.ts` (lines 176-224)
- **Services:** `packages/data/services/calendarService.ts`
- **Hooks:** `packages/data/hooks/useCalendar.ts`
- **UI:** `apps/web/components/CalendarPanel.tsx`

### Tests
- **Service RLS:** `packages/data/__tests__/services/calendarService.rls.test.ts`
- **Hooks:** `packages/data/hooks/__tests__/useCalendar.unit.test.tsx`
- **E2E:** `apps/web/e2e/calendar.spec.ts`

## Database Schema

### 4 Tables with Full RLS

**google_calendar_connections** - OAuth tokens
```sql
CREATE TABLE google_calendar_connections (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  label text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  requires_reauth boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
);
```

**calendar_subscriptions** - Calendar list
```sql
CREATE TABLE calendar_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  google_calendar_id text NOT NULL,
  calendar_name text NOT NULL,
  calendar_color text,
  background_color text,
  is_visible boolean DEFAULT true,
  sync_enabled boolean DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
);
```

**calendar_events** - Cached events
```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY,
  connection_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  user_id uuid NOT NULL,
  google_calendar_event_id text NOT NULL,
  google_calendar_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_all_day boolean DEFAULT false,
  location text,
  color text,
  created_at timestamptz,
  updated_at timestamptz
);
```

**calendar_sync_state** - Sync tracking
```sql
CREATE TABLE calendar_sync_state (
  id uuid PRIMARY KEY,
  subscription_id uuid NOT NULL,
  sync_token text,
  last_sync_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

## Available Hooks

```typescript
// Connection Management
useGoogleCalendarConnections()       // Query all connections
useConnectGoogleCalendar()           // OAuth flow initiation
useDisconnectGoogleCalendar()        // Delete connection
useUpdateConnectionLabel()           // Rename connection

// Subscription Management
useCalendarSubscriptions(connectionId?)  // Query calendars
useToggleCalendarVisibility()        // Show/hide calendar
useUpdateCalendarColor()             // Change color

// Event Management
useCalendarEvents(startDate, endDate, visibleOnly?)  // Query events
useRefreshCalendarSync()             // Manual sync trigger
```

## Performance Characteristics

- **Event Sync:** Every 5 minutes (configurable)
- **Token Refresh:** Hourly
- **Incremental Sync:** Uses Google's syncToken (efficient)
- **Date Range:** 30 days past to 90 days future
- **Cache Strategy:** Local database cache for fast UI rendering
- **API Quotas:** Optimized to stay within Google's limits

## Known Limitations

1. **Read-Only** - Can view events, can't create/edit from app
2. **5-Minute Delay** - Events sync every 5 min (not real-time)
3. **Date Range** - Only syncs ±30-90 days (configurable)
4. **Google Only** - No Microsoft Outlook or Apple Calendar
5. **No Reminders** - No notification system for upcoming events
6. **No Task Linking** - Events not explicitly linked to tasks

## Future Enhancements

- Two-way sync (create/edit events from app)
- Microsoft Outlook integration
- Apple Calendar integration
- Event reminders and notifications
- Task-to-event explicit linking
- Conflict detection and resolution
- Real-time push notifications from Google
- Expand date range synchronization

## Quick Start for Developers

### Run Tests
```bash
# RLS tests
pnpm test calendarService.rls

# Hook tests
pnpm test useCalendar

# E2E tests
pnpm test:e2e calendar
```

### Deploy Edge Functions
```bash
# Deploy all calendar functions
supabase functions deploy google-calendar-oauth
supabase functions deploy google-calendar-refresh-token
supabase functions deploy google-calendar-sync-calendars
supabase functions deploy google-calendar-sync-events
```

### Apply Migrations
```bash
# Apply calendar schema
psql "postgresql://[connection-string]" -f supabase/migrations/20251002000000_add_google_calendar_integration.sql
```

## Production Checklist

- ✅ Database schema with RLS policies
- ✅ Edge functions deployed
- ✅ OAuth credentials configured
- ✅ Cron jobs scheduled
- ✅ Service layer tested
- ✅ Hook layer tested
- ✅ E2E tests passing
- ⚠️ Component tests needed
- ⚠️ Mobile UI optimization needed
- ✅ Documentation complete

**Status:** Feature is production-ready for web with some polish needed for mobile. Backend infrastructure is robust and scalable. Frontend has core functionality working with room for UI enhancement.

---

*For detailed status, see [CURRENT-STATUS.md](./CURRENT-STATUS.md)*
*For troubleshooting, see [CALENDAR_TROUBLESHOOTING.md](./CALENDAR_TROUBLESHOOTING.md)*
*For user guide, see [CALENDAR_USER_GUIDE.md](./CALENDAR_USER_GUIDE.md)*
