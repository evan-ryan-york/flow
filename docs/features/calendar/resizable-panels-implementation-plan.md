# Resizable Panels Implementation Plan

**Feature:** Add drag-to-resize functionality between Task Hub and Calendar columns

**Library:** `react-resizable-panels` by Brian Vaughn

**Date:** October 3, 2025

---

## Overview

Currently, the three-column layout has fixed widths:
- **Column 1 (Projects Panel):** Fixed at `w-64` (256px)
- **Column 2 (Task Hub):** Flexible `flex-1`
- **Column 3 (Calendar Panel):** Fixed at `w-96` (384px)

We want to make the Task Hub and Calendar Panel resizable so users can drag the divider between them to adjust the balance based on their workflow needs.

---

## Implementation Steps

### Step 1: Install the Package

**Command:**
```bash
pnpm add react-resizable-panels
```

**Location:** Run from project root

**Verification:** Check that `react-resizable-panels` appears in `apps/web/package.json`

---

### Step 2: Update ThreeColumnLayout Component

**File:** `apps/web/components/ThreeColumnLayout.tsx`

**Changes Required:**

#### 2.1 Add Imports

At the top of the file, add:
```typescript
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
```

#### 2.2 Replace the Layout Structure

**Current structure:**
```tsx
<div className="flex h-screen bg-white">
  {/* Column 1: Projects/Navigation Panel */}
  <div className="w-64 border-r border-gray-200 flex-shrink-0">
    <ProjectsPanel ... />
  </div>

  {/* Column 2: Task Hub */}
  <div className="flex-1 flex flex-col min-w-0">
    <TaskHub ... />
  </div>

  {/* Column 3: Calendar Panel */}
  <div className="w-96 border-l border-gray-200 flex-shrink-0">
    <CalendarPanel ... />
  </div>
</div>
```

**New structure:**
```tsx
<div className="flex h-screen bg-white">
  {/* Column 1: Projects/Navigation Panel - Keep Fixed */}
  <div className="w-64 border-r border-gray-200 flex-shrink-0">
    <ProjectsPanel
      userId={userId}
      selectedProjectIds={selectedProjectIds}
      onProjectSelectionChange={handleProjectSelectionChange}
    />
  </div>

  {/* Columns 2 & 3: Resizable Task Hub and Calendar */}
  <PanelGroup
    direction="horizontal"
    autoSaveId="task-calendar-layout"
    className="flex-1"
  >
    {/* Column 2: Task Hub - Resizable */}
    <Panel
      defaultSize={60}
      minSize={30}
      maxSize={80}
      id="task-hub-panel"
    >
      <div className="flex flex-col h-full min-w-0">
        <TaskHub
          userId={userId}
          selectedProjectIds={selectedProjectIds}
          selectedViewId={selectedViewId}
          onViewChange={setSelectedViewId}
        />
      </div>
    </Panel>

    {/* Resize Handle */}
    <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

    {/* Column 3: Calendar Panel - Resizable */}
    <Panel
      defaultSize={40}
      minSize={20}
      maxSize={70}
      id="calendar-panel"
    >
      <div className="flex flex-col h-full border-l border-gray-200">
        <CalendarPanel userId={userId} />
      </div>
    </Panel>
  </PanelGroup>
</div>
```

---

### Step 3: Customize the Resize Handle (Optional Enhancement)

**Option A: Simple Visual Indicator**

Add a subtle line with hover state (already included in Step 2.2):
```tsx
<PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />
```

**Option B: Visual Handle with Icon**

Create a more visible handle component:

**File:** `apps/web/components/ResizeHandle.tsx` (new file)

```tsx
'use client';

import { PanelResizeHandle } from 'react-resizable-panels';

export function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-2 bg-gray-100 hover:bg-blue-50 transition-colors cursor-col-resize">
      {/* Visual indicator */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-gray-300 group-hover:bg-blue-500 transition-colors" />

      {/* Drag dots (visible on hover) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-1">
          <div className="w-1 h-1 rounded-full bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400" />
        </div>
      </div>
    </PanelResizeHandle>
  );
}
```

Then use it in ThreeColumnLayout:
```tsx
import { ResizeHandle } from './ResizeHandle';

// In the layout:
<ResizeHandle />
```

---

### Step 4: Configuration Details

#### Panel Size Props Explained

**`defaultSize`** (number, percentage)
- Initial size when user first loads the app
- Task Hub: `60` (60% of the resizable area)
- Calendar: `40` (40% of the resizable area)
- Total must equal 100

**`minSize`** (number, percentage)
- Minimum size the panel can be resized to
- Prevents panels from becoming unusably small
- Task Hub: `30` (minimum 30% to show task list properly)
- Calendar: `20` (minimum 20% to see calendar)

**`maxSize`** (number, percentage)
- Maximum size the panel can be resized to
- Task Hub: `80` (maximum 80% so calendar still visible)
- Calendar: `70` (maximum 70% so tasks still visible)

**`id`** (string)
- Unique identifier for the panel
- Required when using `autoSaveId` on PanelGroup
- Used for persistence

#### PanelGroup Props Explained

**`direction`** ("horizontal" | "vertical")
- `"horizontal"` for side-by-side panels
- `"vertical"` for stacked panels

**`autoSaveId`** (string)
- When set, automatically saves panel sizes to localStorage
- Key: `"react-resizable-panels:task-calendar-layout"`
- User's resize preferences persist across sessions
- Unique per user (handled automatically by localStorage per browser)

**`className`**
- Standard React className prop
- Use `"flex-1"` to fill remaining space after fixed Projects panel

---

### Step 5: Testing Checklist

**Functional Tests:**
- [ ] Can drag the resize handle between Task Hub and Calendar
- [ ] Resize handle shows visual feedback on hover (color change)
- [ ] Cannot resize Task Hub below 30% width
- [ ] Cannot resize Task Hub above 80% width
- [ ] Cannot resize Calendar below 20% width
- [ ] Cannot resize Calendar above 70% width
- [ ] Layout saves when user resizes (check localStorage)
- [ ] Layout restores on page refresh
- [ ] Layout restores on browser restart

**Visual Tests:**
- [ ] Resize handle is visible and easy to find
- [ ] Cursor changes to col-resize when hovering over handle
- [ ] Task Hub content doesn't break at minimum width
- [ ] Calendar content doesn't break at minimum width
- [ ] Smooth transition during resize (no flickering)
- [ ] Projects panel remains fixed width (not affected by resize)

**Edge Cases:**
- [ ] What happens if localStorage is disabled?
- [ ] What happens if localStorage is cleared?
- [ ] Does it work on mobile/tablet? (Consider disabling resize on small screens)
- [ ] Does it work with browser zoom?

---

### Step 6: Mobile/Responsive Considerations

**Current implementation:** Desktop only

**Future enhancement:** On mobile, the three-column layout should probably switch to a tab-based or accordion interface rather than resizable panels.

**Recommendation:** Add a media query check and only enable resizable panels on screens > 1024px width:

```tsx
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 1024);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// In the render:
{isMobile ? (
  // Original fixed layout for mobile
  <div className="flex-1 flex flex-col min-w-0">
    <TaskHub ... />
  </div>
  <div className="w-96 border-l border-gray-200 flex-shrink-0">
    <CalendarPanel ... />
  </div>
) : (
  // Resizable panels for desktop
  <PanelGroup ...>
    ...
  </PanelGroup>
)}
```

---

## Rollback Plan

If issues arise, rollback is simple:

1. Remove the import: `import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";`
2. Restore the original layout structure (see Step 2.2 "Current structure")
3. Run: `pnpm remove react-resizable-panels`
4. Commit the revert

---

## Accessibility Considerations

**`react-resizable-panels` provides:**
- Keyboard support (Tab to focus handle, Arrow keys to resize)
- ARIA attributes automatically applied
- Screen reader announcements for resize actions

**No additional work required** - library handles accessibility out of the box.

---

## Performance Considerations

**Impact:** Minimal
- Library is lightweight (~10kb gzipped)
- Uses CSS transforms for smooth resizing
- localStorage writes are debounced
- No re-renders of child components during resize

**Potential optimization:** If performance issues occur with complex TaskHub or Calendar during resize, consider:
```tsx
<Panel defaultSize={60} minSize={30} maxSize={80}>
  <div style={{ willChange: 'width' }}>
    <TaskHub ... />
  </div>
</Panel>
```

---

## Future Enhancements

1. **Keyboard shortcuts** for common layouts:
   - `Cmd+1`: Focus on Tasks (80/20 split)
   - `Cmd+2`: Balanced (50/50 split)
   - `Cmd+3`: Focus on Calendar (20/80 split)

2. **Layout presets** in user settings:
   - "Task-focused"
   - "Balanced"
   - "Calendar-focused"

3. **Collapse/expand buttons:**
   - Double-click handle to collapse calendar
   - Button to quickly show/hide calendar

4. **Visual width indicators:**
   - Show percentage or pixel width during resize
   - Tooltip on handle showing current split

---

## File Changes Summary

**New files:**
- None (if using simple handle)
- `apps/web/components/ResizeHandle.tsx` (if using Option B handle)

**Modified files:**
- `apps/web/components/ThreeColumnLayout.tsx` (main changes)
- `apps/web/package.json` (dependency added)
- `pnpm-lock.yaml` (auto-updated)

**No changes needed:**
- `apps/web/components/TaskHub.tsx`
- `apps/web/components/CalendarPanel.tsx`
- `packages/ui/custom/ProjectsPanel.tsx`

---

## Expected User Experience

**Before:** Fixed layout with Task Hub taking most space, Calendar at 384px

**After:**
1. User sees resize handle (subtle line) between Task Hub and Calendar
2. User hovers over handle → cursor changes to col-resize icon, handle highlights
3. User clicks and drags → panels resize smoothly in real-time
4. User releases → new layout is saved automatically
5. User refreshes page → layout is restored exactly as they left it
6. User can resize between 30-80% for tasks, 20-70% for calendar

**Benefit:** Users with different workflows can optimize their workspace:
- **Heavy task users:** Expand Task Hub to 80%, shrink Calendar to 20%
- **Planning-focused users:** Expand Calendar to 70%, shrink Task Hub to 30%
- **Balanced users:** Keep default 60/40 split

---

## Estimated Implementation Time

- **Step 1 (Install):** 1 minute
- **Step 2 (Update layout):** 10 minutes
- **Step 3 (Custom handle - optional):** 15 minutes
- **Step 4 (Documentation):** Already done
- **Step 5 (Testing):** 20 minutes
- **Step 6 (Responsive - optional):** 20 minutes

**Total:** ~30-45 minutes for basic implementation, ~1 hour with all enhancements

---

## Questions to Resolve Before Implementation

1. **Should the Projects panel also be resizable?**
   - Current plan: Keep it fixed at 256px
   - Alternative: Make all three columns resizable
   - Recommendation: Start with just Task/Calendar resizable

2. **Should we implement the enhanced resize handle (Option B) or keep it simple (Option A)?**
   - Recommendation: Start with simple (Option A), can enhance later

3. **Should we add responsive handling for mobile in this iteration?**
   - Recommendation: Desktop-first, mobile enhancement in future PR

4. **What should the default sizes be?**
   - Current recommendation: 60/40 (Task Hub / Calendar)
   - Alternative: 50/50 for balanced start
   - User feedback will determine best default

---

## Success Criteria

✅ Users can drag to resize Task Hub and Calendar panels
✅ Resize is smooth and responsive
✅ Layout persists across page refreshes
✅ Minimum and maximum constraints work properly
✅ Visual feedback on resize handle is clear
✅ No breaking changes to existing functionality
✅ Accessibility requirements met (keyboard support)

---

## Next Steps

1. **Review this plan** with team/stakeholder
2. **Get approval** on approach and default sizes
3. **Install package** (Step 1)
4. **Implement changes** (Steps 2-3)
5. **Test thoroughly** (Step 5)
6. **Deploy to staging** for user feedback
7. **Iterate** based on feedback
8. **Deploy to production**

---

**Document Version:** 1.0
**Last Updated:** October 3, 2025
**Author:** AI Assistant
**Status:** Ready for Review
