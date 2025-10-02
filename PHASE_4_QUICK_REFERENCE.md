# Phase 4 Quick Reference - Calendar Hooks API

**Location:** `packages/data/hooks/useCalendar.ts`

---

## Import Statement

```typescript
import {
  // Connection Management
  useGoogleCalendarConnections,
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useUpdateConnectionLabel,

  // Subscription Management
  useCalendarSubscriptions,
  useToggleCalendarVisibility,
  useSyncCalendarList,

  // Event Queries
  useCalendarEvents,
  useTriggerEventSync,
  useCalendarEventsRealtime,
} from '@perfect-task-app/data';
```

---

## Connection Management Hooks

### `useGoogleCalendarConnections()`
**Type:** Query
**Purpose:** Fetch all Google Calendar connections for current user

```typescript
const { data, isLoading, error } = useGoogleCalendarConnections();
// data: GoogleCalendarConnection[] | undefined
```

**Returns:**
- `id` - Connection UUID
- `user_id` - Owner UUID
- `email` - Google account email
- `label` - User-friendly name (e.g., "Work", "Personal")
- `expires_at` - Token expiration timestamp
- `requires_reauth` - Whether token refresh failed
- `created_at` / `updated_at` - Timestamps

---

### `useConnectGoogleCalendar()`
**Type:** Mutation
**Purpose:** Initiate OAuth flow to connect new Google account

```typescript
const connectCalendar = useConnectGoogleCalendar();

// With label
connectCalendar.mutate("Work Account");

// Without label (user can set later)
connectCalendar.mutate();
```

**Behavior:**
- Calls Edge Function to generate OAuth URL
- Stores optional label in localStorage
- Redirects to Google OAuth consent screen
- User will return via callback handler

---

### `useDisconnectGoogleCalendar()`
**Type:** Mutation
**Purpose:** Delete a calendar connection

```typescript
const disconnect = useDisconnectGoogleCalendar();

disconnect.mutate(connectionId, {
  onSuccess: () => {
    console.log('Connection removed');
  }
});
```

**Side Effects:**
- Deletes connection from database
- Cascading delete removes all subscriptions and events
- Invalidates: connections, subscriptions, events queries

---

### `useUpdateConnectionLabel()`
**Type:** Mutation
**Purpose:** Update the user-friendly label for a connection

```typescript
const updateLabel = useUpdateConnectionLabel();

updateLabel.mutate({
  connectionId: "uuid",
  label: "New Label"
});
```

**Side Effects:**
- Invalidates: connections queries

---

## Subscription Management Hooks

### `useCalendarSubscriptions(connectionId?)`
**Type:** Query
**Purpose:** Fetch calendar subscriptions

```typescript
// All subscriptions
const { data } = useCalendarSubscriptions();

// Subscriptions for specific connection
const { data } = useCalendarSubscriptions(connectionId);
```

**Returns:**
- `id` - Subscription UUID
- `connection_id` - Parent connection
- `google_calendar_id` - Google's calendar ID
- `calendar_name` - Display name
- `calendar_color` - Google's color hex
- `background_color` - Background color hex
- `is_visible` - Whether to show in UI
- `sync_enabled` - Whether to sync events

---

### `useToggleCalendarVisibility()`
**Type:** Mutation
**Purpose:** Toggle calendar visibility (show/hide in UI)

```typescript
const toggleVisibility = useToggleCalendarVisibility();

toggleVisibility.mutate({
  subscriptionId: "uuid",
  isVisible: true
});
```

**Features:**
- ✅ **Optimistic updates** - UI updates instantly
- ✅ **Automatic rollback** - Reverts on error
- ✅ **Cache management** - Keeps all queries in sync

**Use Case:** Calendar picker checkboxes

---

### `useSyncCalendarList()`
**Type:** Mutation
**Purpose:** Fetch calendar list from Google and update subscriptions

```typescript
const syncList = useSyncCalendarList();

syncList.mutate(connectionId, {
  onSuccess: (result) => {
    console.log(`Synced ${result.syncedCount} calendars`);
  }
});
```

**What it does:**
- Calls Edge Function to fetch calendar list from Google
- Creates new subscriptions for new calendars
- Updates metadata (name, colors) for existing calendars
- Preserves user's visibility preferences
- Removes subscriptions for deleted calendars

**Side Effects:**
- Invalidates: subscriptions queries

---

## Event Query Hooks

### `useCalendarEvents(startDate, endDate, options?)`
**Type:** Query
**Purpose:** Fetch calendar events in date range

```typescript
const startDate = new Date('2025-10-01');
const endDate = new Date('2025-10-31');

// All events
const { data, isLoading } = useCalendarEvents(startDate, endDate);

// Only visible calendars
const { data } = useCalendarEvents(startDate, endDate, {
  visibleOnly: true
});
```

**Options:**
- `visibleOnly?: boolean` - Filter to only visible calendars

**Returns:**
- `id` - Event UUID
- `google_calendar_event_id` - Google's event ID
- `subscription_id` - Parent subscription
- `title` - Event title
- `description` - Event description
- `start_time` - Start timestamp
- `end_time` - End timestamp
- `is_all_day` - All-day event flag
- `location` - Event location
- `color` - Event color override

**Query Behavior:**
- Refetches on window focus
- Stale time: 2 minutes
- Joins with `calendar_subscriptions` for filtering

---

### `useTriggerEventSync()`
**Type:** Mutation
**Purpose:** Manually trigger event sync from Google

```typescript
const syncEvents = useTriggerEventSync();

// Sync all connections
syncEvents.mutate();

// Sync specific connection
syncEvents.mutate(connectionId);
```

**What it does:**
- Calls Edge Function to sync events from Google
- Uses incremental sync (only fetches changes since last sync)
- Date range: 30 days past to 90 days future
- Handles creates, updates, deletions

**Side Effects:**
- Invalidates: events queries

**Use Case:** "Refresh" button in calendar UI

---

### `useCalendarEventsRealtime(startDate, endDate)`
**Type:** Effect Hook
**Purpose:** Listen to real-time event changes

```typescript
useCalendarEventsRealtime(startDate, endDate);
```

**Behavior:**
- Subscribes to Postgres changes on `calendar_events` table
- Automatically invalidates event queries when changes occur
- Proper cleanup on unmount (prevents memory leaks)

**Use Case:** Keep calendar view up-to-date without manual refresh

---

## Usage Examples

### Calendar Connection Manager
```typescript
function CalendarConnectionsList() {
  const { data: connections, isLoading } = useGoogleCalendarConnections();
  const disconnect = useDisconnectGoogleCalendar();
  const updateLabel = useUpdateConnectionLabel();

  if (isLoading) return <Spinner />;

  return (
    <div>
      {connections?.map(conn => (
        <div key={conn.id}>
          <input
            value={conn.label}
            onChange={(e) => updateLabel.mutate({
              connectionId: conn.id,
              label: e.target.value
            })}
          />
          <span>{conn.email}</span>
          <button onClick={() => disconnect.mutate(conn.id)}>
            Disconnect
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Calendar Picker with Visibility Toggle
```typescript
function CalendarPicker() {
  const { data: subscriptions } = useCalendarSubscriptions();
  const toggleVisibility = useToggleCalendarVisibility();

  return (
    <div>
      {subscriptions?.map(sub => (
        <label key={sub.id}>
          <input
            type="checkbox"
            checked={sub.is_visible}
            onChange={(e) => toggleVisibility.mutate({
              subscriptionId: sub.id,
              isVisible: e.target.checked
            })}
          />
          <span style={{ color: sub.calendar_color }}>
            {sub.calendar_name}
          </span>
        </label>
      ))}
    </div>
  );
}
```

### Calendar View with Real-time Updates
```typescript
function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const startDate = startOfWeek(currentDate);
  const endDate = endOfWeek(currentDate);

  const { data: events, isLoading } = useCalendarEvents(
    startDate,
    endDate,
    { visibleOnly: true }
  );

  const syncEvents = useTriggerEventSync();

  // Enable real-time updates
  useCalendarEventsRealtime(startDate, endDate);

  return (
    <div>
      <button
        onClick={() => syncEvents.mutate()}
        disabled={syncEvents.isPending}
      >
        {syncEvents.isPending ? 'Syncing...' : 'Refresh'}
      </button>

      <CalendarGrid events={events || []} />
    </div>
  );
}
```

---

## Error Handling

All hooks throw errors that can be caught by TanStack Query's error boundaries:

```typescript
const { data, error, isError } = useGoogleCalendarConnections();

if (isError) {
  console.error('Failed to fetch connections:', error);
  return <ErrorMessage error={error} />;
}
```

For mutations:
```typescript
const disconnect = useDisconnectGoogleCalendar();

disconnect.mutate(connectionId, {
  onError: (error) => {
    alert(`Failed to disconnect: ${error.message}`);
  },
  onSuccess: () => {
    alert('Successfully disconnected!');
  }
});
```

---

## Query Keys (for advanced usage)

```typescript
// Manually invalidate specific queries
queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] });
queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions', connectionId] });
queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
```

---

## Type Imports

```typescript
import type {
  GoogleCalendarConnection,
  CalendarSubscription,
  CalendarEvent,
} from '@perfect-task-app/models';
```

---

**Ready for Phase 5: UI Components** 🚀
