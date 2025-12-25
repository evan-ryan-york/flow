# Google Calendar Multi-Account Integration - Complete Build Plan

## Project Overview
Build a complete Google Calendar integration supporting multiple Google accounts per user, allowing users to view and sync events from personal, work, contracted, and business calendars in a unified view.

---

## ✅ COMPLETED PHASES

### Phase 1: Database & Data Models ✅ COMPLETE

#### 1.1 Database Schema ✅
- Created 4 tables with full RLS policies:
  - `google_calendar_connections` - OAuth tokens for each Google account
  - `calendar_subscriptions` - Which calendars to sync from each account
  - `calendar_events` - Cached events for performance/offline access
  - `calendar_sync_state` - Tracks sync tokens for incremental syncing
- Migration file: `supabase/migrations/20251002000000_add_google_calendar_integration.sql`
- Successfully applied to remote Supabase database

#### 1.2 Zod Schemas ✅
- Added to `packages/models/index.ts`:
  - `GoogleCalendarConnectionSchema`
  - `CalendarSubscriptionSchema`
  - `CalendarEventSchema`
- TypeScript compilation verified

#### 1.3 Verification ✅
- All tables exist with proper structure
- 14 RLS policies in place
- 7 foreign key constraints for referential integrity
- 20 indexes for query optimization
- 4 triggers for automatic `updated_at` timestamps

### Phase 2: Google Cloud & OAuth Setup ✅ COMPLETE

#### 2.1 Documentation Created ✅
- Complete setup guide: `docs/google-calendar-oauth-setup.md`

#### 2.2 Google Cloud Console Configuration ✅
- Google Calendar API enabled
- OAuth consent screen configured with scopes:
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/userinfo.email`
- OAuth 2.0 Client ID created
- Redirect URI added: `https://<your-supabase-project>.supabase.co/functions/v1/google-calendar-oauth-callback`

#### 2.3 Credentials Stored ✅
- Client ID and Client Secret stored as Supabase secrets
- Environment variables configured locally

### Phase 3: Backend Services (Supabase Edge Functions) ✅ COMPLETE

#### 3.1 OAuth Flow Function ✅
- Created `supabase/functions/google-calendar-oauth/index.ts`
- Endpoints: initiate & callback
- State token management with `oauth_state_tokens` table
- Automatic calendar list sync trigger after connection
- Migration: `20251002000001_add_oauth_state_tokens.sql` applied ✅

#### 3.2 Token Refresh Function ✅
- Created `supabase/functions/google-calendar-refresh-token/index.ts`
- Automatic token refresh for expiring tokens
- Handles refresh token rotation
- Marks invalid connections as `requires_reauth`
- Migration: `20251002000002_add_requires_reauth_column.sql` applied ✅

#### 3.3 Calendar List Sync Function ✅
- Created `supabase/functions/google-calendar-sync-calendars/index.ts`
- Fetches calendar list from Google
- Upserts subscriptions with color/metadata
- Preserves user visibility preferences
- Removes deleted calendars

#### 3.4 Event Sync Function ✅
- Created `supabase/functions/google-calendar-sync-events/index.ts`
- Incremental sync with Google's syncToken
- Full sync fallback on 410 errors
- Handles creates, updates, deletes
- Parallel subscription syncing
- Date range: 30 days past to 90 days future

#### 3.5 Cron Job Setup ✅
- Created `20251002000003_setup_calendar_sync_cron.sql`
- Documentation: `docs/calendar-cron-setup.md` (3 setup options)
- Scheduled jobs: Event sync (5 min), Token refresh (hourly), Cleanup (hourly)
- Ready for deployment

#### 3.6 Supporting Files ✅
- `supabase/functions/deno.json` - Deno configuration
- `supabase/functions/_shared/cors.ts` - CORS utilities
- `supabase/functions/_shared/supabase.ts` - Client helpers
- `docs/edge-functions-deployment.md` - Complete deployment guide
- `docs/phase-3-backend-complete.md` - Phase 3 summary

---

---

## 🚧 REMAINING PHASES

### Phase 4: Data Layer (TanStack Query Hooks)

**Status:** NOT STARTED

**Location:** `packages/data/calendar.ts`

#### 4.1 Connection Management Hooks

```typescript
// Query: Fetch all connections for current user
export function useGoogleCalendarConnections() {
  return useQuery({
    queryKey: ['calendar-connections'],
    queryFn: async () => {
      const { data } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .order('created_at', { ascending: true });
      return data?.map(conn => GoogleCalendarConnectionSchema.parse(conn)) || [];
    },
  });
}

// Mutation: Initiate OAuth flow
export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async (label?: string) => {
      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-oauth?action=initiate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const { authUrl } = await response.json();

      // Store label in localStorage for callback
      if (label) localStorage.setItem('pending_calendar_label', label);

      // Redirect to Google OAuth
      window.location.href = authUrl;
    },
  });
}

// Mutation: Disconnect (delete) a connection
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('google_calendar_connections')
        .delete()
        .eq('id', connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

// Mutation: Update connection label
export function useUpdateConnectionLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ connectionId, label }: { connectionId: string; label: string }) => {
      const { error } = await supabase
        .from('google_calendar_connections')
        .update({ label })
        .eq('id', connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });
}
```

---

#### 4.2 Subscription Management Hooks

```typescript
// Query: Fetch calendar subscriptions (optionally filtered by connection)
export function useCalendarSubscriptions(connectionId?: string) {
  return useQuery({
    queryKey: ['calendar-subscriptions', connectionId],
    queryFn: async () => {
      let query = supabase
        .from('calendar_subscriptions')
        .select('*')
        .order('calendar_name');

      if (connectionId) {
        query = query.eq('connection_id', connectionId);
      }

      const { data } = await query;
      return data?.map(sub => CalendarSubscriptionSchema.parse(sub)) || [];
    },
  });
}

// Mutation: Toggle calendar visibility
export function useToggleCalendarVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, isVisible }: { subscriptionId: string; isVisible: boolean }) => {
      const { error } = await supabase
        .from('calendar_subscriptions')
        .update({ is_visible: isVisible })
        .eq('id', subscriptionId);
      if (error) throw error;
    },
    onMutate: async ({ subscriptionId, isVisible }) => {
      // Optimistic update for instant UI feedback
      await queryClient.cancelQueries({ queryKey: ['calendar-subscriptions'] });

      const previousData = queryClient.getQueryData(['calendar-subscriptions']);

      queryClient.setQueryData(['calendar-subscriptions'], (old: any[]) =>
        old.map(sub =>
          sub.id === subscriptionId ? { ...sub, is_visible: isVisible } : sub
        )
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['calendar-subscriptions'], context?.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
    },
  });
}

// Mutation: Trigger calendar list sync
export function useSyncCalendarList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-calendars`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      );
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
    },
  });
}
```

---

#### 4.3 Event Query Hooks

```typescript
// Query: Fetch calendar events in date range
export function useCalendarEvents(
  startDate: Date,
  endDate: Date,
  options?: { visibleOnly?: boolean }
) {
  return useQuery({
    queryKey: ['calendar-events', startDate.toISOString(), endDate.toISOString(), options?.visibleOnly],
    queryFn: async () => {
      let query = supabase
        .from('calendar_events')
        .select('*, calendar_subscriptions!inner(*)')
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .order('start_time');

      // Filter to only visible calendars
      if (options?.visibleOnly) {
        query = query.eq('calendar_subscriptions.is_visible', true);
      }

      const { data } = await query;
      return data?.map(event => CalendarEventSchema.parse(event)) || [];
    },
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
  });
}

// Mutation: Manually trigger event sync
export function useTriggerEventSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId?: string) => {
      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/google-calendar-sync-events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ connectionId }),
        }
      );
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

// Real-time subscription to calendar events
export function useCalendarEventsRealtime(startDate: Date, endDate: Date) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const subscription = supabase
      .channel('calendar_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `start_time=gte.${startDate.toISOString()},end_time=lte.${endDate.toISOString()}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [startDate, endDate, queryClient]);
}
```

---

### Phase 5: Frontend UI Components

**Status:** NOT STARTED

#### 5.1 Connection Management UI

**Location:** `apps/mobile/app/(authenticated)/settings/calendar-connections.tsx`

**Components to create:**

```typescript
// CalendarConnectionsPage
- Page header: "Connected Calendar Accounts"
- List of connected accounts (useGoogleCalendarConnections)
- "Connect New Account" button
- Each account shows:
  - Label (editable)
  - Email
  - Number of calendars
  - Last synced timestamp
  - Actions: Rename, Sync Now, Disconnect

// ConnectAccountButton
- Opens modal/dialog for label input
- "What should we call this account?" → "Work", "Personal", etc.
- Calls useConnectGoogleCalendar() mutation
- Shows loading state during OAuth redirect

// ConnectionCard
- Visual card component for each account
- Show sync status indicator (syncing, success, error)
- Expandable section showing nested calendar list
- Click to expand/collapse calendars for this account
```

**UI Flow:**
1. User clicks "Connect New Account"
2. Modal asks: "What should we call this account?" (e.g., "Work", "Personal")
3. User clicks "Continue" → Redirects to Google OAuth
4. User authorizes in Google
5. Redirects back to app
6. Show success message + automatically fetch calendar list
7. New account appears in list with calendars

---

#### 5.2 Calendar Picker UI

**Location:** `packages/ui/CalendarPicker.tsx`

**Component structure:**

```typescript
interface CalendarPickerProps {
  onSelectionChange?: (visibleSubscriptionIds: string[]) => void;
}

export function CalendarPicker({ onSelectionChange }: CalendarPickerProps) {
  const { data: connections } = useGoogleCalendarConnections();
  const { data: subscriptions } = useCalendarSubscriptions();
  const toggleVisibility = useToggleCalendarVisibility();

  // Group subscriptions by connection
  const subscriptionsByConnection = groupBy(subscriptions, 'connection_id');

  return (
    <div className="space-y-4">
      {connections?.map(connection => (
        <div key={connection.id}>
          <h3 className="font-semibold">
            {connection.label} ({connection.email})
          </h3>

          <div className="ml-4 space-y-2">
            {subscriptionsByConnection[connection.id]?.map(subscription => (
              <label key={subscription.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subscription.is_visible}
                  onChange={(e) => {
                    toggleVisibility.mutate({
                      subscriptionId: subscription.id,
                      isVisible: e.target.checked,
                    });
                  }}
                />
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: subscription.background_color || '#4285f4' }}
                />
                <span>{subscription.calendar_name}</span>
                <span className="text-sm text-gray-500">
                  ({eventCounts[subscription.id] || 0} events)
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Features:**
- Hierarchical display: Account → Calendars
- Checkboxes for visibility toggle
- Color indicators from Google Calendar
- Event count badges (optional)
- Optimistic updates for instant feedback

---

#### 5.3 Calendar Display (Column 3)

**Location:** `packages/ui/Calendar/`

**Component files to create:**

**CalendarView.tsx** (main container)
```typescript
interface CalendarViewProps {
  currentDate: Date;
  viewType: 'day' | 'week';
  onDateChange: (date: Date) => void;
  onViewTypeChange: (type: 'day' | 'week') => void;
}

export function CalendarView({ currentDate, viewType, onDateChange, onViewTypeChange }: CalendarViewProps) {
  const startDate = viewType === 'day'
    ? startOfDay(currentDate)
    : startOfWeek(currentDate);
  const endDate = viewType === 'day'
    ? endOfDay(currentDate)
    : endOfWeek(currentDate);

  const { data: events, isLoading } = useCalendarEvents(startDate, endDate, { visibleOnly: true });

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        currentDate={currentDate}
        viewType={viewType}
        onDateChange={onDateChange}
        onViewTypeChange={onViewTypeChange}
      />

      <CalendarGrid
        viewType={viewType}
        currentDate={currentDate}
        events={events || []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

**CalendarHeader.tsx**
```typescript
export function CalendarHeader({ currentDate, viewType, onDateChange, onViewTypeChange }) {
  const syncEvents = useTriggerEventSync();

  return (
    <div className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <button onClick={() => onDateChange(subDays(currentDate, viewType === 'day' ? 1 : 7))}>
          <ChevronLeft />
        </button>

        <h2 className="text-xl font-semibold">
          {viewType === 'day'
            ? format(currentDate, 'MMMM d, yyyy')
            : `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
          }
        </h2>

        <button onClick={() => onDateChange(addDays(currentDate, viewType === 'day' ? 1 : 7))}>
          <ChevronRight />
        </button>

        <button
          onClick={() => onDateChange(new Date())}
          className="ml-2 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Today
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => syncEvents.mutate()}
          disabled={syncEvents.isPending}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <RefreshIcon className={syncEvents.isPending ? 'animate-spin' : ''} />
        </button>

        <div className="flex border rounded">
          <button
            onClick={() => onViewTypeChange('day')}
            className={viewType === 'day' ? 'bg-blue-500 text-white px-3 py-1' : 'px-3 py-1'}
          >
            Day
          </button>
          <button
            onClick={() => onViewTypeChange('week')}
            className={viewType === 'week' ? 'bg-blue-500 text-white px-3 py-1' : 'px-3 py-1'}
          >
            Week
          </button>
        </div>
      </div>
    </div>
  );
}
```

**CalendarGrid.tsx**
```typescript
export function CalendarGrid({ viewType, currentDate, events, isLoading }) {
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23
  const days = viewType === 'day'
    ? [currentDate]
    : eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
        {/* Header row with day names */}
        <div className="sticky top-0 bg-white border-b" />
        {days.map(day => (
          <div key={day.toISOString()} className="sticky top-0 bg-white border-b p-2 text-center">
            <div className="text-sm text-gray-500">{format(day, 'EEE')}</div>
            <div className={isToday(day) ? 'text-blue-600 font-bold' : ''}>
              {format(day, 'd')}
            </div>
          </div>
        ))}

        {/* Time slots */}
        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="border-r border-b p-2 text-sm text-gray-500 text-right">
              {format(new Date().setHours(hour, 0), 'ha')}
            </div>

            {days.map(day => {
              const slotStart = new Date(day).setHours(hour, 0, 0, 0);
              const slotEnd = new Date(day).setHours(hour, 59, 59, 999);

              // Find events in this time slot
              const slotEvents = events.filter(event => {
                const eventStart = new Date(event.start_time).getTime();
                const eventEnd = new Date(event.end_time).getTime();
                return eventStart < slotEnd && eventEnd > slotStart;
              });

              return (
                <div key={`${day}-${hour}`} className="border-r border-b p-1 relative min-h-[60px]">
                  {slotEvents.map(event => (
                    <CalendarEvent key={event.id} event={event} />
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

**CalendarEvent.tsx**
```typescript
interface CalendarEventProps {
  event: CalendarEvent;
}

export function CalendarEvent({ event }: CalendarEventProps) {
  const { data: subscription } = useCalendarSubscriptions();
  const calendarColor = subscription?.find(s => s.id === event.subscription_id)?.background_color || '#4285f4';

  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes

  return (
    <div
      className="absolute left-0 right-0 rounded px-2 py-1 text-sm overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      style={{
        backgroundColor: event.color || calendarColor,
        top: `${(startTime.getMinutes() / 60) * 100}%`,
        height: `${Math.max((duration / 60) * 100, 20)}%`,
        opacity: 0.9,
      }}
      onClick={() => {
        // TODO: Open event details modal
      }}
    >
      <div className="font-semibold text-white truncate">{event.title}</div>
      {!event.is_all_day && (
        <div className="text-xs text-white opacity-90">
          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </div>
      )}
      {event.location && (
        <div className="text-xs text-white opacity-75 truncate">{event.location}</div>
      )}
    </div>
  );
}
```

---

#### 5.4 Mobile Adaptations

**Platform-specific considerations:**

**iOS/Android:**
- Use React Native WebView for OAuth flow (alternative to browser redirect)
- Or use `@react-native-google-signin/google-signin` for native OAuth
- Swipe gestures for day navigation
- Pull-to-refresh for manual sync
- Optimized grid rendering for performance

**Responsive calendar:**
- **Mobile (width < 768px)**: Default to day view, full-screen modal for calendar picker
- **Tablet (768px - 1024px)**: Week view, side panel for calendar picker
- **Desktop (> 1024px)**: Week view, persistent column layout

---

### Phase 6: Testing & Polish

**Status:** NOT STARTED

#### 6.1 OAuth Flow Testing
- [ ] Test connecting first account (personal Gmail)
- [ ] Test connecting 2nd account (work email)
- [ ] Test connecting 3rd and 4th accounts
- [ ] Test disconnecting an account (verify cascade delete)
- [ ] Test reconnecting same account after disconnect
- [ ] Test token expiration and auto-refresh
- [ ] Test OAuth error handling:
  - User denies permission
  - Invalid state parameter
  - Network failure during token exchange

#### 6.2 Sync Accuracy Testing
- [ ] Create event in Google Calendar → verify appears in app within 5 min
- [ ] Update event title/time in Google → verify changes sync
- [ ] Delete event in Google → verify removal syncs
- [ ] Test with 100+ events (performance check)
- [ ] Test incremental sync (verify syncToken usage)
- [ ] Test full sync when syncToken expires
- [ ] Verify all-day events display correctly
- [ ] Verify multi-day events span correctly
- [ ] Test recurring events (ensure expanded to single events)

#### 6.3 Calendar Display Testing
- [ ] Test rendering 20+ events in one day (overlap handling)
- [ ] Test overlapping events display side-by-side
- [ ] Test all-day events appear at top
- [ ] Test color accuracy from multiple accounts
- [ ] Test week view with heavy schedule
- [ ] Test navigation (prev/next day, prev/next week, today button)
- [ ] Test view switching (day ↔ week)
- [ ] Test event click → details modal

#### 6.4 Calendar Picker Testing
- [ ] Test toggling calendar visibility (optimistic update)
- [ ] Test visibility persists across page refresh
- [ ] Test calendar list updates when new calendar added in Google
- [ ] Test calendar list updates when calendar deleted in Google
- [ ] Test with 10+ calendars across 4 accounts

#### 6.5 Cross-Platform Testing
- [ ] Test OAuth flow on iOS simulator
- [ ] Test OAuth flow on Android emulator
- [ ] Test OAuth flow in web browser (Chrome, Safari, Firefox)
- [ ] Test calendar rendering on iOS (performance)
- [ ] Test calendar rendering on Android (performance)
- [ ] Test calendar rendering on web (Chrome, Safari, Firefox)
- [ ] Test responsive layouts (mobile, tablet, desktop)
- [ ] Test swipe gestures on mobile
- [ ] Test pull-to-refresh on mobile

#### 6.6 Edge Cases & Error Handling
- [ ] No internet connection during sync → graceful error message
- [ ] Google API rate limiting → exponential backoff
- [ ] Expired refresh token → prompt re-authentication
- [ ] User deletes calendar in Google → remove from subscriptions
- [ ] Concurrent syncs from multiple devices → handle race conditions
- [ ] Very long event titles → truncate with ellipsis
- [ ] Events with no title → display "(No title)"
- [ ] Timezone edge cases → verify correct local time display

#### 6.7 Performance Testing
- [ ] Measure calendar render time with 500 events
- [ ] Verify smooth scrolling in calendar grid
- [ ] Test memory usage with 4 accounts connected
- [ ] Test database query performance (use EXPLAIN ANALYZE)
- [ ] Verify indexes are being used (check query plans)
- [ ] Test Supabase RLS policy performance
- [ ] Profile Edge Function cold start time
- [ ] Profile Edge Function execution time

---

## Environment Variables Needed

Add to `.env` (root):
```env
GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
GOOGLE_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

Add to `apps/web/.env.local`:
```env
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
NEXT_PUBLIC_SUPABASE_URL="https://<your-supabase-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

Add to Supabase Secrets (via dashboard or CLI):
```bash
GOOGLE_OAUTH_CLIENT_ID="YOUR_CLIENT_ID"
GOOGLE_OAUTH_CLIENT_SECRET="YOUR_CLIENT_SECRET"
```

---

## Success Criteria

### Phase 3 Complete When:
✅ User can initiate OAuth flow from app
✅ User can authorize Google account
✅ OAuth callback stores connection in database
✅ Access tokens refresh automatically before expiry
✅ Calendar list syncs from Google
✅ Events sync from all enabled calendars
✅ Cron job runs every 5 minutes
✅ All Edge Functions have proper error handling

### Phase 4 Complete When:
✅ All TanStack Query hooks implemented
✅ Hooks properly invalidate cache on mutations
✅ Optimistic updates work for visibility toggles
✅ Real-time subscriptions work for event updates
✅ TypeScript types are correct

### Phase 5 Complete When:
✅ User can connect multiple Google accounts via UI
✅ User can toggle calendar visibility
✅ Calendar displays events color-coded by calendar
✅ Day and week views render correctly
✅ Navigation works (prev/next, today)
✅ Manual sync trigger works
✅ Mobile UI is touch-friendly
✅ Responsive layouts work on all screen sizes

### Phase 6 Complete When:
✅ All test cases pass
✅ Performance benchmarks meet targets
✅ Error handling covers all edge cases
✅ Works on iOS, Android, and Web
✅ Ready for production deployment

---

## Deployment Checklist

Before going live:
- [ ] Publish OAuth consent screen in Google Cloud Console
- [ ] Submit app for Google verification (if required)
- [ ] Set up monitoring for Edge Functions
- [ ] Configure error alerting (e.g., Sentry)
- [ ] Set up analytics for usage tracking
- [ ] Document known limitations for users
- [ ] Create user guide for connecting accounts
- [ ] Test with real users (beta group)
- [ ] Monitor sync performance in production
- [ ] Set up backup/disaster recovery plan

---

## Future Enhancements (Post-V1)

- **Two-way sync**: Create/edit events from Perfect Task App → sync to Google
- **Conflict resolution**: Handle conflicting edits from multiple devices
- **Offline mode**: Queue changes when offline, sync when back online
- **Calendar sharing**: Share specific calendars with team members
- **Event reminders**: Push notifications for upcoming events
- **Smart scheduling**: AI-powered suggestions for meeting times
- **Integration with tasks**: Link tasks to calendar time blocks
- **Outlook integration**: Support Microsoft 365 calendars
- **Apple Calendar integration**: Support iCloud calendars
- **Calendar templates**: Pre-configured setups for common use cases

---

## Notes for Next AI Agent

### Critical Context:
1. **Database is ready**: All tables, RLS policies, and indexes are in place
2. **OAuth is configured**: Google Cloud Console setup is complete, credentials stored
3. **Models are defined**: Zod schemas in `packages/models/index.ts`
4. **Supabase connection**: Use existing client from `packages/data/supabase.ts`

### Start with Phase 3:
- Begin with OAuth flow Edge Function (easiest to test)
- Use `Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')` to access secrets
- Test locally with `supabase functions serve`
- Deploy with `supabase functions deploy <function-name>`

### Key Files to Reference:
- Database schema: `supabase/migrations/20251002000000_add_google_calendar_integration.sql`
- Models: `packages/models/index.ts`
- OAuth setup: `docs/google-calendar-oauth-setup.md`
- Supabase client: `packages/data/supabase.ts`

### Testing Strategy:
- Use your own Google accounts (personal, work, etc.) for testing
- Test OAuth flow first before building calendar sync
- Verify RLS policies by attempting cross-user access
- Monitor Supabase logs during development

### Common Pitfalls to Avoid:
- Don't forget `access_type=offline` and `prompt=consent` in OAuth URL (to get refresh token)
- Always refresh token before making Google API calls if expires_at is close
- Use incremental sync (syncToken) to avoid rate limits
- Handle 410 Gone response (invalid syncToken) by doing full sync
- Batch database operations to avoid hitting Supabase rate limits
- Use RLS policies - never bypass with service role key unless necessary

### Recommended Development Order:
1. OAuth initiate endpoint (return auth URL)
2. OAuth callback endpoint (exchange code, store tokens)
3. Token refresh function (test with expired token)
4. Calendar list sync (test with one account)
5. Event sync (test with one calendar)
6. Cron job setup (test with manual trigger first)
7. TanStack Query hooks (one at a time, test in UI)
8. UI components (connection management first, then calendar display)

Good luck! The foundation is solid, now it's time to build the features. 🚀
