# Phase 5 Handoff - Frontend UI Components

**Date:** October 2, 2025
**Status:** Ready to Start
**Previous Phase:** Phase 4 Complete ✅

---

## 🎯 Quick Start for Next Agent

**Your Task:** Implement Phase 5 - Frontend UI Components

**What You're Building:**
- Calendar connection management UI
- Calendar picker component
- Calendar display (day/week views)
- Event rendering components

**Estimated Time:** 2-3 hours

---

## ✅ What's Already Done (Phases 1-4)

### Phase 1: Database & Data Models ✅
- 5 database tables with RLS policies
- Zod schemas in `packages/models/index.ts`
- All migrations applied to production

### Phase 2: Google OAuth Setup ✅
- Google Calendar API enabled
- OAuth credentials configured
- Redirect URIs set up

### Phase 3: Backend (Edge Functions) ✅
- 4 Edge Functions deployed and tested
- OAuth flow backend
- Token refresh mechanism
- Calendar and event sync backends
- All functions active at: `https://ewuhxqbfwbenkhnkzokp.supabase.co/functions/v1/`

### Phase 4: Data Layer ✅ (JUST COMPLETED)
- **10 TanStack Query hooks** ready to use
- Connection management hooks
- Subscription management hooks
- Event query hooks with real-time subscriptions
- All exported from `@perfect-task-app/data`

---

## 📚 Essential Files to Read

### Start Here (5 minutes)
1. **`PHASE_4_QUICK_REFERENCE.md`** - Complete API reference for all hooks
2. **`PHASE_4_COMPLETE.md`** - Phase 4 summary and what was built
3. **`docs/calendar-integration-build-plan.md`** - Lines 367-977 (Phase 5 details)

### Project Context (10 minutes)
4. **`AI_HANDOFF_NOTES.md`** - Complete project context
5. **`docs/project-wide-context/ai-quickstart.md`** - Project structure and patterns
6. **`packages/ui/`** - Existing UI component patterns to follow

### Reference (as needed)
7. **`PHASE_3_COMPLETE.md`** - Backend capabilities
8. **`docs/phase-3-backend-complete.md`** - Detailed backend documentation

---

## 🛠️ Available Tools (Phase 4 Hooks)

All hooks are ready to import and use:

```typescript
import {
  // Connection Management
  useGoogleCalendarConnections,      // Query: List all connections
  useConnectGoogleCalendar,          // Mutation: Start OAuth flow
  useDisconnectGoogleCalendar,       // Mutation: Delete connection
  useUpdateConnectionLabel,          // Mutation: Rename connection

  // Subscription Management
  useCalendarSubscriptions,          // Query: List calendars
  useToggleCalendarVisibility,       // Mutation: Show/hide calendar
  useSyncCalendarList,               // Mutation: Sync from Google

  // Event Queries
  useCalendarEvents,                 // Query: Fetch events in date range
  useTriggerEventSync,               // Mutation: Sync events from Google
  useCalendarEventsRealtime,         // Effect: Real-time updates
} from '@perfect-task-app/data';
```

**See `PHASE_4_QUICK_REFERENCE.md` for complete usage examples!**

---

## 📋 Phase 5 Tasks

### 5.1 Connection Management UI
**Location:** `apps/mobile/app/(authenticated)/settings/calendar-connections.tsx`

**Components to Create:**
1. **CalendarConnectionsPage** - Main settings page
   - List of connected accounts (`useGoogleCalendarConnections`)
   - "Connect New Account" button (`useConnectGoogleCalendar`)
   - Each account card shows:
     - Label (editable with `useUpdateConnectionLabel`)
     - Email address
     - Number of calendars
     - Sync status
     - Actions: Rename, Sync, Disconnect

2. **ConnectAccountButton** - Modal/dialog for adding account
   - Input for account label (e.g., "Work", "Personal")
   - Triggers OAuth flow
   - Shows loading state during redirect

3. **ConnectionCard** - Individual account card
   - Expandable to show calendar list
   - Sync status indicator
   - Quick actions menu

**UI Flow:**
```
Settings → Calendar Connections → List of Accounts
                                → [+ Connect New Account]
                                → Account Card 1 (expandable)
                                   → Calendar List (with visibility toggles)
                                → Account Card 2 (expandable)
```

---

### 5.2 Calendar Picker Component
**Location:** `packages/ui/Calendar/CalendarPicker.tsx`

**Component:**
```typescript
interface CalendarPickerProps {
  onSelectionChange?: (visibleSubscriptionIds: string[]) => void;
}
```

**Features:**
- Hierarchical display: Account → Calendars
- Checkboxes for visibility (`useToggleCalendarVisibility`)
- Color indicators (from `subscription.background_color`)
- Event count badges (optional)
- Optimistic updates for instant feedback

**Example from build plan (lines 424-468):**
```typescript
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
          <h3>{connection.label} ({connection.email})</h3>
          <div>
            {subscriptionsByConnection[connection.id]?.map(subscription => (
              <label key={subscription.id}>
                <input
                  type="checkbox"
                  checked={subscription.is_visible}
                  onChange={(e) => toggleVisibility.mutate({
                    subscriptionId: subscription.id,
                    isVisible: e.target.checked,
                  })}
                />
                <span style={{ backgroundColor: subscription.background_color }}>
                  {subscription.calendar_name}
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

---

### 5.3 Calendar Display Components
**Location:** `packages/ui/Calendar/`

**Components to Create:**

1. **CalendarView.tsx** - Main container
   - Manages current date and view type (day/week)
   - Uses `useCalendarEvents()` to fetch events
   - Uses `useCalendarEventsRealtime()` for live updates

2. **CalendarHeader.tsx** - Navigation and controls
   - Date navigation (prev/next/today)
   - View type toggle (day/week)
   - Refresh button (`useTriggerEventSync`)
   - Date display

3. **CalendarGrid.tsx** - Event grid display
   - Time slots (24 hours)
   - Day columns (1 for day view, 7 for week view)
   - Event positioning based on time
   - Renders `CalendarEvent` components

4. **CalendarEvent.tsx** - Individual event card
   - Event title, time, location
   - Color from subscription or event color
   - Click handler for details

**Example from build plan (lines 487-639):**
- CalendarView manages state and queries
- CalendarHeader provides navigation
- CalendarGrid renders time slots and events
- Responsive layout for mobile

---

## 🎨 UI/UX Considerations

### Mobile-First Design
- This is an Expo app (iOS, Android, Web)
- Use React Native components from `packages/ui/`
- Follow existing component patterns in the project
- Ensure touch-friendly targets (44x44 minimum)

### Real-time Updates
- Use `useCalendarEventsRealtime()` in calendar view
- Events update automatically without manual refresh
- Show sync status indicator when syncing

### Optimistic Updates
- `useToggleCalendarVisibility()` already handles optimistic updates
- Checkboxes respond instantly
- Automatic rollback on error

### Error Handling
- Show user-friendly error messages
- Handle OAuth failures gracefully
- Display token expiration warnings
- Retry mechanisms for sync failures

### Loading States
- Show skeletons/spinners during initial load
- Disable buttons during mutations
- Indicate sync progress

---

## 📁 Project Structure Reference

```
perfect-task-app/
├── apps/
│   └── mobile/
│       └── app/(authenticated)/
│           └── settings/
│               └── calendar-connections.tsx  ← Create this
├── packages/
│   ├── models/              ← Phase 1 ✅
│   ├── data/                ← Phase 4 ✅
│   │   └── hooks/
│   │       └── useCalendar.ts
│   └── ui/                  ← Phase 5 (you are here)
│       └── Calendar/        ← Create this directory
│           ├── CalendarPicker.tsx
│           ├── CalendarView.tsx
│           ├── CalendarHeader.tsx
│           ├── CalendarGrid.tsx
│           └── CalendarEvent.tsx
└── supabase/                ← Phase 3 ✅
```

---

## 🔑 Important Rules

### Critical (from ai-quickstart.md)

1. **Never modify `packages/models/index.ts`** without explicit permission
   - Schemas are the single source of truth
   - Types derive FROM schemas

2. **Never run dev servers**
   - User runs `pnpm dev:web` and `pnpm dev:mobile` themselves
   - Claude should NEVER execute these commands

3. **Use shared packages**
   - Put reusable code in `packages/ui/Calendar/`
   - Use `@perfect-task-app/` imports
   - Follow existing patterns from `packages/ui/`

4. **Follow React Native patterns**
   - This is an Expo app, not a web app
   - Use React Native components
   - Check existing UI components for patterns

---

## ✅ Success Criteria for Phase 5

Phase 5 is complete when:

1. ✅ Calendar connections settings page exists and works
   - Can view all connected accounts
   - Can connect new accounts (OAuth flow)
   - Can rename accounts
   - Can disconnect accounts
   - Can manually trigger syncs

2. ✅ Calendar picker component exists and works
   - Displays accounts → calendars hierarchy
   - Visibility toggles work with optimistic updates
   - Shows calendar colors
   - Groups calendars by account

3. ✅ Calendar view component exists and works
   - Day and week views
   - Events display correctly
   - Navigation works (prev/next/today)
   - Real-time updates work
   - Manual sync works

4. ✅ TypeScript compiles without errors
5. ✅ Components follow project UI patterns
6. ✅ Mobile-responsive design
7. ✅ Error handling is robust
8. ✅ Loading states are user-friendly

---

## 🧪 Testing Phase 5

After implementation, test:

1. **Connection Management**
   - Click "Connect New Account"
   - Go through OAuth flow
   - Verify connection appears in list
   - Rename a connection
   - Disconnect a connection
   - Verify cascading delete works

2. **Calendar Picker**
   - Toggle calendar visibility
   - Verify optimistic update (instant feedback)
   - Verify calendar colors display
   - Check grouping by account

3. **Calendar View**
   - Switch between day/week views
   - Navigate dates (prev/next/today)
   - Verify events display correctly
   - Test real-time updates (trigger sync from another device)
   - Click refresh button
   - Verify all-day events display correctly

4. **Edge Cases**
   - No connections yet (empty state)
   - No calendars in account
   - No events in date range
   - OAuth failure
   - Network errors
   - Token expiration

---

## 🔧 Development Commands

**From root directory:**

```bash
# Start web dev server (required for mobile)
pnpm dev:web

# Start mobile simulator (in separate terminal)
pnpm dev:mobile

# Build/typecheck
pnpm build
pnpm typecheck
```

**Note:** The user will run these commands. Claude should NOT execute them.

---

## 📞 Support Resources

**Documentation:**
- Build plan: `docs/calendar-integration-build-plan.md` (lines 367-977)
- Hook API: `PHASE_4_QUICK_REFERENCE.md`
- Project guide: `docs/project-wide-context/ai-quickstart.md`
- Technical guide: `docs/project-wide-context/technical-guide.md`

**Examples:**
- Existing UI components in `packages/ui/`
- Existing pages in `apps/mobile/app/(authenticated)/`
- Existing hooks in `packages/data/hooks/`

**Backend:**
- Edge Functions: `docs/edge-functions-deployment.md`
- Testing: `docs/phase-3-testing-guide.md`

---

## 💡 Implementation Tips

### Recommended Order

1. **Start simple** - Create connection management page first
   - Basic list of connections
   - Connect button (OAuth flow)
   - Test OAuth works end-to-end

2. **Add calendar picker** - Reusable component
   - Display subscriptions
   - Visibility toggles
   - Test optimistic updates

3. **Build calendar view** - Most complex
   - Start with day view only
   - Add event rendering
   - Then add week view
   - Add navigation
   - Add real-time updates

4. **Polish** - Final touches
   - Loading states
   - Error handling
   - Empty states
   - Mobile responsiveness

### Common Patterns

**Loading State:**
```typescript
const { data, isLoading } = useGoogleCalendarConnections();
if (isLoading) return <Spinner />;
```

**Error Handling:**
```typescript
const { data, error, isError } = useGoogleCalendarConnections();
if (isError) return <ErrorMessage error={error} />;
```

**Mutation with Feedback:**
```typescript
const disconnect = useDisconnectGoogleCalendar();

disconnect.mutate(connectionId, {
  onSuccess: () => toast.success('Disconnected!'),
  onError: (err) => toast.error(`Failed: ${err.message}`)
});
```

---

## 🚦 Current Project Status

**Working:**
- ✅ Database schema with RLS policies (Phase 1)
- ✅ Google OAuth configured (Phase 2)
- ✅ 4 Edge Functions deployed and tested (Phase 3)
- ✅ 10 TanStack Query hooks ready (Phase 4)

**Ready For:**
- ✅ UI component implementation (Phase 5)
- ✅ End-to-end testing with real users

**Not Started:**
- ❌ UI components (Phase 5 - your task)
- ❌ Automated cron jobs (optional - see `docs/calendar-cron-setup.md`)
- ❌ Phase 6: Testing & polish

---

## 🎯 Your Mission

Build the UI components that bring the calendar integration to life! The backend is solid, the hooks are ready, and the foundation is strong. Time to create a beautiful, intuitive interface for managing multiple Google Calendar accounts.

**Good luck!** 🚀

---

**Last Updated:** October 2, 2025
**Phase 4 Completed By:** Claude (Data Layer Agent)
**Next Agent Task:** Implement Phase 5 - Frontend UI Components
