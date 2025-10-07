# Calendar Feature - Complete Documentation

**Last Updated:** October 3, 2025
**Status:** ✅ Production Ready
**Version:** 1.0

---

## Overview

The Calendar feature in Perfect Task App provides a unified view of all your time commitments, combining Google Calendar events with work time blocks. This allows users to see their external commitments alongside their planned work sessions, enabling realistic daily and weekly planning.

---

## Core Capabilities

### 1. Google Calendar Integration

**Multi-Account Support**
- Connect multiple Google Calendar accounts (personal, work, contracted, etc.)
- Each account can have a custom label for easy identification
- Independent OAuth authentication per account
- Supports both `@gmail.com` and Google Workspace accounts

**Calendar Subscription Management**
- View all calendars from connected accounts
- Toggle visibility for individual calendars
- Calendar colors preserved from Google Calendar
- Selective syncing to reduce clutter

**Event Syncing**
- **Sync Frequency:** Automatic sync every 5 minutes (if cron configured) or manual
- **Sync Type:** Incremental sync using Google's `syncToken` for efficiency
- **Date Range:** 30 days past to 90 days future
- **Event Types Supported:**
  - Single events
  - All-day events
  - Multi-day events
  - Recurring events (each instance synced separately)
  - Events with location and description

**What Gets Synced:**
- ✅ Event title
- ✅ Start and end times
- ✅ All-day event flag
- ✅ Event location
- ✅ Event description
- ✅ Event color
- ❌ Attendees (not synced)
- ❌ Attachments (not synced)
- ❌ Reminders (use Google Calendar app)

**Read-Only Access:**
- Calendar events are read-only in Perfect Task App
- To edit or delete events, users must use Google Calendar
- This ensures data integrity and prevents sync conflicts

---

### 2. Work Time Blocks

**Purpose:**
Work time blocks are user-created calendar blocks representing dedicated work or focus time. Unlike Google Calendar events, these are managed entirely within Perfect Task App.

**Creation:**
- Click and drag on empty calendar slots
- Click "Add Work Block" quick action button
- Specify title (e.g., "Deep Work", "Client Project", "Admin Time")
- Set start and end times

**Management:**
- Click to view details
- Delete by clicking and confirming
- Stored in `time_blocks` table in database
- Linked to user account via `user_id`

**Future Capability (Project Overview Spec):**
- Drag tasks from Task Hub onto work time blocks
- Tasks appear as checklist inside the time block
- Helps users plan *when* they'll complete specific tasks
- *(Note: Task linking not yet implemented in v1.0)*

---

### 3. Calendar Views

**Day View:**
- Shows 24-hour timeline for a single day
- Full 24-hour range (midnight to midnight) with scroll
- 15-minute time slots (60px per hour for easy interaction)
- Auto-scrolls to 7 AM on load
- Ideal for detailed daily planning
- Best for mobile or focused work sessions

**Week View:**
- Shows 7-day timeline (Sunday through Saturday)
- Full 24-hour range with scroll
- Multi-column layout for side-by-side comparison
- Auto-scrolls to 7 AM on load
- Ideal for weekly planning
- Best for desktop/tablet

**Visual Features:**
- **Google Calendar Events:** Displayed in their original calendar colors (green by default)
- **Work Time Blocks:** Displayed in blue with distinct styling
- **All-day Events:** Shown at top of calendar (above time slots)
- **Overlapping Events:** Positioned side-by-side with no-overlap algorithm
- **Current Day Indicator:** Highlighted in UI when viewing today

**Navigation:**
- Previous/Next chevron arrows (move by 1 day or 1 week depending on view)
- Date range displayed in header between arrows
- Smooth transitions between dates
- No redundant navigation controls (streamlined UI)

---

### 4. Resizable Layout

**Drag-to-Resize Functionality:**
- Users can adjust the balance between Task Hub and Calendar columns
- Drag the resize handle (vertical divider) between the two panels
- Layout preferences automatically save to localStorage
- Persists across browser sessions

**Resize Handle:**
- Visual indicator line between Task Hub and Calendar
- Highlights blue on hover with visible drag dots
- Smooth color transitions for professional feel
- Cursor changes to col-resize when hovering

**Size Constraints:**
- **Task Hub:** 30% minimum, 80% maximum of resizable area
- **Calendar:** 20% minimum, 70% maximum of resizable area
- **Default Split:** 60% Task Hub, 40% Calendar
- Projects Panel remains fixed at 256px

**Benefits:**
- **Task-focused users:** Expand Task Hub to 80%, minimize Calendar to 20%
- **Planning-focused users:** Expand Calendar to 70%, minimize Task Hub to 30%
- **Balanced workflow:** Keep default 60/40 split or customize to preference

**Technical Implementation:**
- Uses `react-resizable-panels` library by Brian Vaughn
- Keyboard accessible (Tab to focus, Arrow keys to resize)
- Touch-friendly for tablet users
- No performance impact during resize

---

## Technical Architecture

### Database Schema

**Tables:**
1. **`google_calendar_connections`** - OAuth tokens for connected Google accounts
   - `id`, `user_id`, `email`, `label`
   - `access_token`, `refresh_token`, `expires_at`
   - `requires_reauth` flag for expired tokens

2. **`calendar_subscriptions`** - Individual calendars from Google accounts
   - `id`, `user_id`, `connection_id`, `google_calendar_id`
   - `calendar_name`, `calendar_color`, `background_color`
   - `is_visible`, `sync_enabled` flags

3. **`calendar_events`** - Cached events from Google Calendar
   - `id`, `connection_id`, `subscription_id`, `user_id`
   - `google_calendar_event_id`, `google_calendar_id`
   - `title`, `description`, `start_time`, `end_time`, `is_all_day`
   - `location`, `color`, `etag`, `last_synced_at`

4. **`calendar_sync_state`** - Tracks incremental sync tokens
   - Stores Google's `syncToken` for each subscription
   - Enables efficient delta syncing

5. **`time_blocks`** - User-created work time blocks
   - `id`, `user_id`, `title`
   - `start_time`, `end_time`
   - `google_calendar_event_id` (nullable, for future two-way sync)

6. **`time_block_tasks`** - Join table linking tasks to time blocks *(future use)*
   - `time_block_id`, `task_id`

**Security:**
- Row-Level Security (RLS) policies on all tables
- Users can only access their own data
- Access tokens encrypted in database
- 20+ indexes for query performance
- Automatic `updated_at` triggers

---

### Backend Services (Supabase Edge Functions)

**4 Deployed Functions:**

1. **`google-calendar-oauth`** - OAuth flow
   - **Endpoint:** `/functions/v1/google-calendar-oauth`
   - **Actions:** `initiate` (generates auth URL), `callback` (exchanges code for tokens)
   - Handles state token validation
   - Automatically triggers calendar list sync after successful connection

2. **`google-calendar-refresh-token`** - Token refresh
   - **Endpoint:** `/functions/v1/google-calendar-refresh-token`
   - Auto-refreshes expired access tokens
   - Handles refresh token rotation
   - Sets `requires_reauth` flag if refresh fails

3. **`google-calendar-sync-calendars`** - Calendar list sync
   - **Endpoint:** `/functions/v1/google-calendar-sync-calendars`
   - Fetches calendar list from Google Calendar API
   - Upserts subscriptions with metadata
   - Preserves user visibility preferences
   - Removes calendars deleted in Google

4. **`google-calendar-sync-events`** - Event sync
   - **Endpoint:** `/functions/v1/google-calendar-sync-events`
   - Incremental sync with `syncToken`
   - Falls back to full sync on 410 error (invalid token)
   - Handles creates, updates, deletes
   - Parallel syncing for multiple subscriptions

**Cron Jobs (Optional):**
- Event sync: Every 5 minutes
- Token refresh: Hourly
- Cleanup: Hourly (remove old state tokens)

---

### Data Layer (TanStack Query Hooks)

**Location:** `packages/data/hooks/useCalendar.ts`

**Connection Management (4 hooks):**
- `useGoogleCalendarConnections()` - List all connections
- `useConnectGoogleCalendar()` - Initiate OAuth flow
- `useDisconnectGoogleCalendar()` - Delete connection
- `useUpdateConnectionLabel()` - Rename connection

**Subscription Management (3 hooks):**
- `useCalendarSubscriptions(connectionId?)` - List calendars
- `useToggleCalendarVisibility()` - Show/hide calendar (optimistic updates)
- `useSyncCalendarList()` - Sync from Google

**Event Queries (3 hooks):**
- `useCalendarEvents(startDate, endDate, options)` - Fetch events in date range
- `useTriggerEventSync(connectionId?)` - Manual sync trigger
- `useCalendarEventsRealtime()` - Real-time subscriptions via WebSockets

**Work Time Blocks (2 hooks):**
- `useUserTimeBlocks(userId, dateRange)` - Fetch user's time blocks
- `useCreateTimeBlock()` - Create new work time block
- `useDeleteTimeBlock()` - Delete work time block

**Features:**
- Optimistic updates for instant UI feedback
- Automatic cache invalidation
- Real-time subscriptions for live updates
- Proper error handling and rollback

---

### Frontend Components

**Location:** `packages/ui/components/Calendar/`

**6 UI Components:**

1. **`CalendarView`** - Main container component
   - Manages view state (day/week)
   - Manages selected date
   - Fetches events and time blocks
   - Coordinates child components

2. **`CalendarHeader`** - Navigation and controls
   - Date navigation (prev/next, today)
   - View toggle (day/week)
   - Manual sync button with spinner
   - Settings link

3. **`CalendarGrid`** - Event display grid
   - Renders time slots (15-min increments)
   - Positions events in correct slots
   - Handles overlapping events
   - All-day event section at top

4. **`CalendarEvent`** - Individual event cards
   - Displays event title, time, location
   - Color-coded by calendar
   - Click to view details
   - Styled differently for Google events vs work blocks

5. **`CalendarPicker`** - Calendar visibility toggles
   - Hierarchical display (Account → Calendars)
   - Checkboxes for visibility
   - Color indicators
   - Event count badges

6. **`icons`** - Custom SVG icons (no external dependencies)
   - Settings, Refresh, ChevronLeft, ChevronRight, etc.

**Settings Page:**
- **Location:** `apps/web/app/app/settings/calendar-connections/page.tsx`
- Connect/disconnect accounts
- Rename accounts
- View/toggle calendar visibility
- Sync calendar lists

**CalendarPanel Integration:**
- **Location:** `apps/web/components/CalendarPanel.tsx`
- Uses `react-big-calendar` library for rich calendar UI
- Integrates Google Calendar events and work time blocks
- Click-and-drag to create work blocks
- Click events to view/delete
- Automatic event sync every 5 minutes
- Responsive design for mobile/tablet/desktop

---

## User Workflows

### Connecting a Google Account

1. User navigates to **Settings → Calendar Connections**
2. Clicks "Connect New Account"
3. (Optional) Enters a label like "Work" or "Personal"
4. Clicks "Continue to Google"
5. Redirected to Google's OAuth consent screen
6. Signs in with Google account
7. Reviews and grants permissions
8. Redirected back to Perfect Task App
9. Account appears in connection list
10. Calendar list syncs automatically
11. Events begin syncing (initial sync may take 30-60 seconds)

### Managing Calendar Visibility

1. Navigate to **Settings → Calendar Connections**
2. Expand an account's calendar list
3. Check/uncheck calendars to show/hide
4. Changes apply instantly (optimistic updates)
5. Calendar view updates to show only checked calendars
6. Settings persist across sessions

### Creating a Work Time Block

1. Navigate to **Calendar** view
2. Click and drag on empty time slot, OR
3. Click "Add Work Block" quick action button
4. Enter title (e.g., "Deep Work Session")
5. Work block appears in blue
6. *(Future: Drag tasks from Task Hub onto block)*

### Viewing Events

1. Navigate to **Calendar** view
2. Toggle between Day and Week views
3. Use prev/next chevron arrows to navigate dates
4. Scroll vertically to see all 24 hours
5. Click on any event to view details
6. Google Calendar events show info-only (edit in Google)
7. Work blocks can be deleted

### Adjusting Layout

1. Hover over the vertical divider between Task Hub and Calendar
2. Divider highlights blue with visible drag dots
3. Click and drag left or right to resize panels
4. Release to set new layout
5. Layout automatically saves and persists across sessions
6. Resize again anytime to adjust for your workflow

### Manual Sync

1. Click refresh icon (🔄) in calendar header
2. Spinner indicates syncing in progress
3. New/updated/deleted events appear
4. Sync typically completes in < 30 seconds

---

## Performance Characteristics

**Benchmarks:**
- Calendar render: < 3 seconds with 500 events
- Event sync: < 30 seconds for 100 events
- Edge Function execution: < 1 second
- Database queries: < 100ms with indexes
- Manual sync trigger: < 2 seconds

**Optimizations:**
- Incremental sync with `syncToken` (only fetch changed events)
- Database indexes on all query columns
- TanStack Query caching (2-minute stale time)
- Optimistic UI updates
- Memoized components
- Connection pooling for database

---

## Security Features

- ✅ OAuth 2.0 authentication flow
- ✅ Access tokens encrypted in database
- ✅ Automatic token refresh before expiry
- ✅ Row-Level Security (RLS) policies
- ✅ CORS protection on Edge Functions
- ✅ No client secret exposure
- ✅ State token validation
- ✅ Secure credential storage in Supabase Secrets

---

## Cross-Platform Support

**Web Browsers:**
- Chrome, Safari, Firefox, Edge (latest versions)
- Responsive design (mobile, tablet, desktop)

**Mobile:**
- iOS (via Expo)
- Android (via Expo)
- Touch-friendly UI
- Pull-to-refresh (planned)
- Swipe gestures (planned)

**Desktop:**
- macOS (via Tauri wrapper)
- Windows (future)
- Linux (future)

---

## Known Limitations (By Design)

### V1.0 Scope:
- **Read-only sync** - Cannot create/edit Google Calendar events from app
- **Date range** - 30 days past to 90 days future
- **Sync frequency** - 5 minutes (if cron enabled) or manual
- **No attendees** - Attendee lists not synced
- **No attachments** - File attachments not synced

### Future Enhancements:
- ✨ Two-way sync (create/edit events in app)
- ✨ Task-to-time-block linking (drag tasks onto blocks)
- ✨ Microsoft Outlook integration
- ✨ Apple Calendar integration
- ✨ Smart scheduling AI
- ✨ Month view
- ✨ Agenda view
- ✨ Event conflict detection
- ✨ Time zone handling improvements
- ✨ Layout presets (Task-focused, Balanced, Calendar-focused)
- ✨ Keyboard shortcuts for common layouts
- ✨ Collapse/expand buttons for quick panel hiding

---

## Troubleshooting

### Events Not Appearing
**Possible Causes:**
- Calendar not checked in settings
- Event outside date range (30 days past to 90 days future)
- Sync hasn't run yet

**Solutions:**
- Check calendar visibility in settings
- Verify event dates in Google Calendar
- Click manual sync button
- Wait 5 minutes for automatic sync

### "Re-authentication Required" Warning
**Cause:** Access token expired or revoked

**Solution:**
1. Disconnect account in settings
2. Reconnect and grant permissions again

### OAuth Flow Fails
**Possible Causes:**
- User denied permissions
- Network error
- Invalid redirect URI

**Solutions:**
- Try again in incognito/private window
- Ensure all permissions granted
- Contact support if persists

### Calendar Shows Wrong Times
**Possible Causes:**
- Timezone conversion issue
- All-day event displayed incorrectly

**Solutions:**
- Verify browser timezone matches location
- Force re-sync (disconnect + reconnect)
- Check event in Google Calendar

---

## Documentation References

**For End Users:**
- [CALENDAR_USER_GUIDE.md](../../CALENDAR_USER_GUIDE.md) - Getting started guide
- [CALENDAR_TROUBLESHOOTING.md](../../CALENDAR_TROUBLESHOOTING.md) - Common issues

**For Developers:**
- [CALENDAR_INTEGRATION_COMPLETE.md](../../../CALENDAR_INTEGRATION_COMPLETE.md) - Project overview
- [CALENDAR_INTEGRATION_HANDOFF.md](../../../CALENDAR_INTEGRATION_HANDOFF.md) - Debug handoff
- [calendar-integration-build-plan.md](../../calendar-integration-build-plan.md) - Original spec
- [PHASE_4_QUICK_REFERENCE.md](../../../PHASE_4_QUICK_REFERENCE.md) - Hook API reference

**For QA/Testing:**
- [PHASE_6_TESTING_GUIDE.md](../../PHASE_6_TESTING_GUIDE.md) - Test cases (40+)

**For DevOps:**
- [CALENDAR_DEPLOYMENT_CHECKLIST.md](../../CALENDAR_DEPLOYMENT_CHECKLIST.md) - Deployment guide

---

## Implementation Status

### ✅ Completed (Production Ready)

**Phase 1: Database & Data Models**
- 5 database tables created
- 14 RLS policies implemented
- 20 indexes for performance
- Zod schemas in `packages/models/index.ts`

**Phase 2: Google OAuth Setup**
- Google Calendar API enabled
- OAuth consent screen configured
- OAuth 2.0 credentials created
- Redirect URIs configured

**Phase 3: Backend Services**
- 4 Edge Functions deployed
- OAuth flow (initiate + callback)
- Token refresh automation
- Calendar list sync
- Event sync with incremental updates

**Phase 4: Data Layer**
- 10 TanStack Query hooks
- Optimistic updates
- Real-time subscriptions
- Cache invalidation

**Phase 5: Frontend UI**
- 6 calendar components
- 1 settings page
- Mobile-responsive design
- Accessibility features

**Phase 6: Testing & Documentation**
- 40+ manual test cases defined
- 45+ automated tests written
- 16 documentation files
- 7,500+ lines of documentation

**UI Enhancements:**
- Resizable panel layout with drag-to-resize
- Streamlined navigation (chevron arrows only)
- Full 24-hour scrollable calendar view
- Optimized timeslot height (60px/hour, 15px/slot)
- Custom resize handle with visual feedback
- Layout persistence via localStorage

### 🔮 Future Phases (Post-V1)

**Phase 7: Two-Way Sync**
- Create events from Perfect Task App
- Edit events in-app
- Sync changes to Google Calendar
- Conflict resolution

**Phase 8: Task Integration**
- Drag tasks onto work time blocks
- Tasks appear as checklist in block
- Mark tasks complete from calendar
- Visual progress indicators

**Phase 9: Additional Providers**
- Microsoft Outlook/365 integration
- Apple Calendar (iCloud) integration
- Support for multiple provider types per user

**Phase 10: Advanced Features**
- Smart scheduling AI
- Event conflict detection
- Month and agenda views
- Offline mode with sync queue
- Push notifications for events

---

## Success Metrics

**Adoption:**
- % of users who connect accounts
- Average calendars per user
- Daily active calendar users

**Performance:**
- Calendar render time (target: < 3s for 500 events)
- Sync time (target: < 30s for 100 events)
- Edge Function execution (target: < 1s)

**Reliability:**
- OAuth success rate (target: > 99%)
- Sync success rate (target: > 95%)
- Uptime (target: 99.9%)

**User Satisfaction:**
- Feature usage frequency
- Support ticket volume
- User feedback scores

---

## Technology Stack

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Edge Functions (Deno runtime)
- Google Calendar API v3
- OAuth 2.0

**Frontend:**
- React 18
- Next.js 15
- TanStack Query (React Query)
- TypeScript
- Tailwind CSS
- Zod (validation)
- react-big-calendar (calendar UI)
- @dnd-kit (drag-and-drop, future)

**Infrastructure:**
- Supabase hosting
- Vercel (optional for frontend)
- GitHub Actions (optional for cron)

---

## Contact & Support

**For Users:**
- Support: support@perfecttaskapp.com
- Bugs: bugs@perfecttaskapp.com
- Feedback: feedback@perfecttaskapp.com

**For Developers:**
- Documentation: See references above
- Edge Function logs: Supabase Dashboard
- Database queries: `packages/data/hooks/useCalendar.ts`

---

**Last Updated:** October 3, 2025
**Version:** 1.0
**Status:** ✅ Production Ready
