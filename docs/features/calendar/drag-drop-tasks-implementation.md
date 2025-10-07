# Drag and Drop Tasks to Calendar - Implementation Complete

**Date:** October 3, 2025
**Status:** ✅ Ready for Testing
**Feature:** Drag tasks from Task Hub onto calendar work time blocks

---

## Overview

Users can now drag tasks from the Task Hub and drop them onto work time blocks in the calendar. When dropped, tasks appear as chips inside the time block, showing the first 100 characters of the task name. Completed tasks display with strikethrough styling.

---

## Requirements Implemented

✅ Tasks can be assigned to multiple time blocks
✅ Deleting time block cascades to remove task assignments (database constraint)
✅ Deleting task removes it from all calendar blocks (database constraint)
✅ Dropping task on empty calendar slot does nothing (no auto-create)
✅ Completed tasks show with strikethrough in calendar
✅ Cannot drop tasks on Google Calendar events (read-only)
✅ Tasks display as chips with first 100 characters
✅ X button to remove task from time block

---

## Architecture

### Database Layer (Already Existed)

**Tables:**
- `time_blocks` - User-created work time blocks
- `time_block_tasks` - Join table with `ON DELETE CASCADE` for both time_blocks and tasks

**RLS Policies:**
- Users can only view/manage their own time block task assignments
- Located in: `supabase/migrations/20250930140000_enable_rls_on_all_tables.sql`

### Service Layer

**File:** `packages/data/services/timeBlockTaskService.ts`

**Functions:**
- `getTimeBlockTasks(timeBlockId)` - Fetch all tasks for a time block
- `assignTaskToTimeBlock(taskId, timeBlockId)` - Assign task (handles duplicates)
- `unassignTaskFromTimeBlock(taskId, timeBlockId)` - Remove task assignment
- `getTaskTimeBlocks(taskId)` - Get all blocks a task is assigned to

### Data Layer (TanStack Query)

**File:** `packages/data/hooks/useTimeBlockTasks.ts`

**Hooks:**
- `useTimeBlockTasks(timeBlockId)` - Query for time block's tasks
- `useAssignTaskToTimeBlock()` - Mutation to assign task
- `useUnassignTaskFromTimeBlock()` - Mutation to remove task
- `useTaskTimeBlocks(taskId)` - Query for task's time blocks

**Features:**
- Automatic cache invalidation on mutations
- 2-minute stale time for queries
- Optimistic updates for instant UI feedback

### UI Components

#### 1. TimeBlockEvent Component
**File:** `packages/ui/components/Calendar/TimeBlockEvent.tsx`

**Features:**
- Custom event renderer for work time blocks
- Displays time block title
- Lists assigned tasks as chips
- Completed tasks show with checkmark and strikethrough
- X button to remove task (with hover effect)
- "Drop tasks here" placeholder when empty

#### 2. CalendarPanel Updates
**File:** `apps/web/components/CalendarPanel.tsx`

**Changes:**
- Replaced `Calendar` with `DnDCalendar` (react-big-calendar drag-and-drop HOC)
- Added `draggedTask` state to track what's being dragged
- Listens for `task-drag-start` and `task-drag-end` window events
- Implements `handleDropFromOutside` - only allows drops on existing work blocks
- Uses custom `TimeBlockEvent` component for work block rendering
- Imports drag-and-drop styles

#### 3. TaskItem Updates
**File:** `apps/web/components/TaskItem.tsx`

**Changes:**
- Made task row `draggable`
- Added `onDragStart` handler to dispatch custom event
- Added `onDragEnd` handler to clean up drag state
- Sets `application/json` data for drop compatibility
- Changed cursor to `cursor-move` to indicate draggability

---

## How It Works

### 1. User Starts Dragging a Task

```typescript
// TaskItem.tsx
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(task));
  window.dispatchEvent(new CustomEvent('task-drag-start', { detail: task }));
};
```

### 2. CalendarPanel Listens for Drag

```typescript
// CalendarPanel.tsx
React.useEffect(() => {
  const handleTaskDragStart = (e: Event) => {
    const customEvent = e as CustomEvent<Task>;
    setDraggedTask(customEvent.detail);
  };
  window.addEventListener('task-drag-start', handleTaskDragStart);
  // ...cleanup
}, []);
```

### 3. User Drops on Calendar

```typescript
// CalendarPanel.tsx - handleDropFromOutside
const handleDropFromOutside = ({ start, end }) => {
  // Find existing work block at drop location
  const existingBlock = timeBlocks.find(block => {
    return dropStart >= blockStart && dropStart < blockEnd;
  });

  if (existingBlock) {
    // Assign task to block
    assignTaskMutation.mutate({ taskId, timeBlockId: existingBlock.id });
  } else {
    // Show alert - no auto-create
    alert('Please drop the task on an existing work block.');
  }
};
```

### 4. Task Appears in Time Block

```typescript
// TimeBlockEvent.tsx
const { data: tasks = [] } = useTimeBlockTasks(event.id);

// Render task chips
{tasks.map(task => (
  <TaskChip
    key={task.id}
    task={task}
    onRemove={() => unassignMutation.mutate({ taskId, timeBlockId })}
  />
))}
```

---

## User Workflow

1. **User sees a task in Task Hub**
2. **User drags the task** (entire row is draggable, cursor changes to move)
3. **User drags over calendar** (visual feedback as cursor changes)
4. **User drops on work time block**
   - If dropped on existing block → Task assigned ✅
   - If dropped on empty slot → Alert shown, no action ❌
   - If dropped on Google event → Ignored ❌
5. **Task chip appears in time block** with task name (truncated to 100 chars)
6. **User can remove task** by clicking X button on chip
7. **Completed tasks** show with ✓ and strikethrough

---

## Visual Design

### Task Chip Styling
```css
bg-white/20 backdrop-blur-sm rounded px-2 py-1 text-xs
hover:bg-white/30 transition-colors
```

### Completed Task Styling
```css
line-through opacity-70
```

### Empty State
```
"Drop tasks here" (italic, opacity-50)
```

---

## Testing Checklist

### Basic Functionality
- [ ] Drag task from Task Hub to work block → Task appears
- [ ] Task name displays correctly (truncated at 100 chars if long)
- [ ] Click X on task chip → Task removed from block
- [ ] Completed task shows with strikethrough and checkmark
- [ ] Drop on empty calendar slot → Alert shown, no action
- [ ] Drop on Google Calendar event → Ignored

### Multiple Assignments
- [ ] Drag same task to different work block → Task appears in both
- [ ] Task can exist in multiple blocks simultaneously
- [ ] Removing from one block doesn't affect other blocks

### Edge Cases
- [ ] Delete work block → All task assignments removed
- [ ] Delete task → Task removed from all calendar blocks
- [ ] Very long task name → Truncates to 100 chars with "..."
- [ ] Work block with many tasks → Scrollable, no overflow
- [ ] Mark task complete → Calendar updates with strikethrough
- [ ] Mark task incomplete → Strikethrough removed

### Visual & UX
- [ ] Drag cursor shows "move" icon
- [ ] Hover over task chip → X button appears
- [ ] X button hover → Color changes to white
- [ ] Empty work block → "Drop tasks here" placeholder visible
- [ ] Task chip has subtle hover effect (bg-white/30)

### Performance
- [ ] Dragging is smooth (no lag)
- [ ] Drop response is instant (optimistic updates)
- [ ] Multiple tasks in block → No performance degradation

---

## Known Limitations (By Design)

1. **No auto-create:** Dropping on empty calendar slot does nothing
2. **Work blocks only:** Cannot drop on Google Calendar events
3. **No drag-to-reorder:** Tasks cannot be reordered within a block (V2 feature)
4. **No time slot assignment:** Tasks assigned to entire block, not specific time

---

## Future Enhancements (Post-V1)

- [ ] Drag-to-reorder tasks within a time block
- [ ] Click task chip to open task edit panel
- [ ] Show task project color indicator on chip
- [ ] Progress bar showing % of tasks completed in block
- [ ] Keyboard shortcuts (e.g., press Delete to remove task)
- [ ] Bulk assign multiple tasks at once
- [ ] Time estimate tracking (e.g., "2 hours of work scheduled")
- [ ] Visual indicator when dragging over valid drop zone

---

## Technical Notes

### Why HTML5 Drag & Drop instead of @dnd-kit?

- react-big-calendar uses native HTML5 drag-and-drop for `withDragAndDrop` HOC
- Mixing @dnd-kit with HTML5 DnD causes conflicts
- Solution: Use @dnd-kit for task reordering, HTML5 for calendar drops
- Communication: Custom window events bridge the two systems

### Why Custom Events?

Tasks are in `apps/web/components/TaskItem.tsx`
Calendar is in `apps/web/components/CalendarPanel.tsx`

No shared parent component to pass callbacks, so we use:
```typescript
window.dispatchEvent(new CustomEvent('task-drag-start', { detail: task }));
```

This is a valid pattern for cross-component communication in React.

### Database Cascade Deletes

Both constraints exist in the database schema:
```sql
-- time_block_tasks table
time_block_id REFERENCES time_blocks(id) ON DELETE CASCADE
task_id REFERENCES tasks(id) ON DELETE CASCADE
```

This ensures data integrity without manual cleanup in the application layer.

---

## Files Modified

### New Files (3)
1. `packages/data/services/timeBlockTaskService.ts` - Service functions
2. `packages/data/hooks/useTimeBlockTasks.ts` - TanStack Query hooks
3. `packages/ui/components/Calendar/TimeBlockEvent.tsx` - Custom event component

### Modified Files (3)
1. `packages/data/index.ts` - Export new hooks
2. `apps/web/components/CalendarPanel.tsx` - Drag-and-drop integration
3. `apps/web/components/TaskItem.tsx` - Make tasks draggable

### Total Lines Added: ~450 lines
### Total Lines Modified: ~50 lines

---

## Dependencies

**No new dependencies required!** ✅

All required packages already exist:
- `react-big-calendar` with `withDragAndDrop` HOC
- `@dnd-kit/core` (for task list reordering)
- `@tanstack/react-query` (for data layer)
- `zod` (for validation)

---

## Deployment Checklist

- [x] Database schema verified (tables and RLS policies exist)
- [x] Service functions created and tested
- [x] TanStack Query hooks created
- [x] UI components created
- [x] CalendarPanel updated with drag-and-drop
- [x] TaskItem made draggable
- [ ] Manual testing completed
- [ ] User acceptance testing
- [ ] Documentation updated
- [ ] Ready for production

---

## Success Metrics

**Adoption:**
- % of users who drag tasks to calendar
- Average tasks per time block
- Daily active users using feature

**Usability:**
- Time to first successful drag-and-drop
- Error rate (drops on wrong locations)
- Feature discoverability (do users find it?)

**Performance:**
- Drag-and-drop latency (should be < 100ms)
- Calendar render time with many tasks
- Database query performance

---

**Last Updated:** October 3, 2025
**Implementation By:** AI Assistant
**Status:** ✅ Ready for Testing
