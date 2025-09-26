# Database Migration Guide - Task Reordering

## Status: Migration Pending ⏳

The task reordering system is **ready** but requires a database migration to be applied. The app is currently running in **fallback mode** with basic drag & drop functionality.

## Quick Fix: Apply Migration

You need to apply the migration file to your Supabase database:

**File to apply:** `supabase/migrations/20250926000000_add_task_sort_order.sql`

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire content of `supabase/migrations/20250926000000_add_task_sort_order.sql`
4. Click **Run**

### Option 2: Via Supabase CLI (If Available)

```bash
# Install Supabase CLI if not available
npm install -g supabase

# Link to your project (one time setup)
supabase link --project-ref ewuhxqbfwbenkhnkzokp

# Apply the migration
supabase db push
```

## After Migration is Applied

Once the migration is successfully applied, you need to **enable the full functionality**:

### 1. Enable the new task fetching hook

In `apps/web/components/TaskHub.tsx`, line 39:

```typescript
// Change FROM:
const { data: tasks = [], isLoading, error } = useProjectsTasks(userId, selectedProjectIds);

// Change TO:
const { data: tasks = [], isLoading, error } = useTasksWithSortOrder(userId, selectedProjectIds);
```

### 2. Enable sort mode controls

In `apps/web/components/TaskHub.tsx`, line 146:

```typescript
// Change FROM:
{false && selectedProjectIds.length === 1 && (

// Change TO:
{selectedProjectIds.length === 1 && (
```

### 3. Enable task reordering persistence

In `apps/web/components/TaskHub.tsx`, line 104-106:

```typescript
// Change FROM:
// TODO: Re-enable after migration is applied
// moveTask(movedTask.id, beforeTaskId, afterTaskId);
console.log('🔄 Task reorder would move:', movedTask.name, 'between', beforeTaskId, 'and', afterTaskId);

// Change TO:
// Make the server call to persist the new order
moveTask(movedTask.id, beforeTaskId, afterTaskId);
```

### 4. Update imports

In `apps/web/components/TaskHub.tsx`, line 16:

```typescript
// Change FROM:
import {
  useProjectsTasks,
  // ...
} from '@perfect-task-app/data';

// Change TO:
import {
  useTasksWithSortOrder,
  // ...
} from '@perfect-task-app/data';
```

### 5. Remove fallback sorting

In `apps/web/components/TaskList.tsx`, line 31-48:

```typescript
// Replace the entire fallback sorting block WITH:
// Tasks are already sorted by the database function - no client-side sorting needed!
const displayedTasks = tasks;
```

## What the Migration Does

✅ **Adds `sort_order` column** to tasks table
✅ **Adds `manual_sort_enabled`** to projects table
✅ **Creates database functions** for atomic reordering
✅ **Backfills existing tasks** with sort_order values
✅ **Adds indexes** for performance
✅ **Creates triggers** for automatic sort_order assignment

## Features Available After Migration

🎯 **Drag & Drop Reordering** - Move tasks precisely between any positions
⚡ **Instant UI Updates** - Optimistic updates with server persistence
🔄 **Real-time Sync** - Live updates across multiple users
🔧 **Per-project Settings** - Toggle between manual and automatic sorting
📊 **Database Performance** - Optimized queries with proper indexes

## Current Functionality (Before Migration)

✅ Basic drag & drop visual feedback
✅ Temporary local reordering
❌ No persistence (resets on page refresh)
❌ No real-time sync
❌ No sort mode controls

Apply the migration to unlock the full power of the task reordering system! 🚀