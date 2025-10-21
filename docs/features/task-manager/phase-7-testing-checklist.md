# Phase 7: Chrome DevTools Testing Checklist

**Date**: 2025-10-20
**Tester**: [Your Name]
**Status**: In Progress

---

## Setup Instructions

1. Start the dev server:
   ```bash
   pnpm dev:web
   ```

2. Open http://localhost:3000 in Chrome

3. Open Chrome DevTools (F12 or Cmd+Option+I)

4. Toggle device toolbar (Cmd/Ctrl + Shift + M)

5. Select device from dropdown or enter custom dimensions

---

## Test Matrix

### Device Size Tests

#### 📱 iPhone SE (375px × 667px) - Smallest Modern Phone
- [ ] **Layout**: All content fits without horizontal scroll
- [ ] **Project chips**: Horizontal scroll works smoothly
- [ ] **Task list**: Tasks display without overflow
- [ ] **Bottom nav**: All 4 tabs visible and tappable
- [ ] **Quick-add**: Input visible above bottom nav
- [ ] **Touch targets**: All buttons ≥ 44px
- [ ] **Text**: Readable without zooming (16px+ base)
- [ ] **Project chip bar**: Shows fade indicators when scrollable
- [ ] **Top action bar**: All 3 icons visible

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📱 iPhone 14 Pro (393px × 852px) - Standard Phone
- [ ] **Layout**: All content fits without horizontal scroll
- [ ] **Project chips**: Smooth horizontal scrolling
- [ ] **Task list**: Comfortable spacing between tasks
- [ ] **Search overlay**: Full-screen overlay displays correctly
- [ ] **Filter sheet**: Slides up from bottom without issues
- [ ] **Group sheet**: All grouping options visible
- [ ] **Quick-add**: Input accessible and functional
- [ ] **Breakpoint switch**: Desktop ↔ mobile switch works at 1024px

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📱 iPhone 14 Pro Max (430px × 932px) - Large Phone
- [ ] **Layout**: Extra space utilized well
- [ ] **Project chips**: More chips visible before scrolling
- [ ] **Task list**: More tasks visible in viewport
- [ ] **Bottom sheets**: Height appropriate for device
- [ ] **Touch targets**: Comfortable spacing maintained
- [ ] **Text**: Not too small despite larger screen

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📱 iPad Mini (768px × 1024px Portrait) - Small Tablet
- [ ] **Layout**: Mobile layout active (< 1024px)
- [ ] **Project chips**: Even more chips visible
- [ ] **Task list**: Optimal number of visible tasks
- [ ] **Built-in columns**: ALL HIDDEN on mobile (only checkbox + task name visible)
- [ ] **Custom columns**: Hidden (not shown on mobile)
- [ ] **Bottom sheets**: Appropriate height for tablet
- [ ] **Portrait mode**: All features accessible

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📱 iPad Pro 11" (834px × 1194px Portrait) - Medium Tablet
- [ ] **Layout**: Mobile layout active (< 1024px)
- [ ] **Project chips**: Generous horizontal space
- [ ] **Task list**: Comfortable reading experience
- [ ] **Landscape mode**: Test rotation (1194px × 834px)
- [ ] **Landscape**: Desktop layout appears (≥ 1024px)
- [ ] **Three columns**: Desktop view shows all columns in landscape

**Notes**:
```
[Add any issues or observations here]
```

---

#### 🔄 Breakpoint Test (1024px) - Edge Case
- [ ] **1023px**: Mobile layout shows
- [ ] **1024px**: Desktop layout shows
- [ ] **1025px**: Desktop layout shows
- [ ] **No visual glitches**: Smooth transition between layouts
- [ ] **State preserved**: Filters/grouping maintained across breakpoint
- [ ] **Project selection**: Selected project preserved

**Notes**:
```
[Add any issues or observations here]
```

---

### Feature Tests

#### 🏷️ Project Chip Scenarios

**1 Project**:
- [ ] Single chip displays correctly
- [ ] No horizontal scroll
- [ ] Fade indicators hidden
- [ ] Chip states work (outline → filled → selected)

**5 Projects**:
- [ ] All chips visible or scrollable
- [ ] Horizontal scroll smooth
- [ ] Fade indicators show when scrollable
- [ ] Selected chip persists on refresh (localStorage)

**10+ Projects**:
- [ ] Horizontal scroll with momentum
- [ ] Fade indicators on left/right
- [ ] Snap-to-center scrolling works
- [ ] Long-press sets chip as selected
- [ ] All 3 states visually distinct

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📋 Task List Scenarios

**0 Tasks (Empty State)**:
- [ ] Empty state message displays
- [ ] "No tasks yet" guidance shown
- [ ] Quick-add input still accessible
- [ ] No console errors

**10 Tasks**:
- [ ] All tasks visible without excessive scrolling
- [ ] Task rows have 44px+ height
- [ ] Checkbox circles tappable
- [ ] Task names don't overflow
- [ ] Only completion checkbox and task name visible on mobile
- [ ] No built-in columns shown (Assigned To, Due Date, Project, Created hidden)

**100 Tasks** (if available):
- [ ] Smooth scrolling performance
- [ ] No lag or stuttering
- [ ] Virtualization working (if implemented)
- [ ] Task loading smooth

**Notes**:
```
[Add any issues or observations here]
```

---

#### 🔍 Search Functionality

- [ ] **Open search**: Tap search icon → overlay appears
- [ ] **Auto-focus**: Input focuses immediately
- [ ] **Type query**: Search filters tasks in real-time
- [ ] **Result count**: Shows "X of Y tasks" correctly
- [ ] **Close search**: Tap backdrop → overlay dismisses
- [ ] **ESC key**: Closes overlay
- [ ] **Clear search**: Tasks return to full list
- [ ] **Search tips**: Show when query is empty

**Notes**:
```
[Add any issues or observations here]
```

---

#### 🎯 Filter Functionality

- [ ] **Open filters**: Tap filter icon → sheet slides up
- [ ] **Backdrop**: Prevents body scroll
- [ ] **Assignee filter**: All users listed with checkboxes
- [ ] **Due date filter**: All options (Overdue, Today, This Week, etc.)
- [ ] **Project filter**: All projects with correct names
- [ ] **Completion filter**: Incomplete/Completed/All options
- [ ] **Nested timeframe**: Last week/month appear when "Completed" selected
- [ ] **Active count**: Badge updates in top bar
- [ ] **Apply filters**: Tasks filter correctly
- [ ] **Clear all**: Removes all filters
- [ ] **Close sheet**: Backdrop/ESC/Apply button all work

**Notes**:
```
[Add any issues or observations here]
```

---

#### 📊 Grouping Functionality

- [ ] **Open grouping**: Tap group icon → sheet slides up
- [ ] **None option**: Ungrouped view
- [ ] **Project grouping**: Groups by project with headers
- [ ] **Due date grouping**: Groups by overdue/today/tomorrow/etc.
- [ ] **Assignee grouping**: Groups by user
- [ ] **Completion grouping**: Incomplete/Completed groups
- [ ] **Custom property**: Groups by custom property (if available)
- [ ] **Group indicator**: Blue highlight in top bar when active
- [ ] **Group headers**: Collapsible/expandable
- [ ] **Task counts**: Correct count per group

**Notes**:
```
[Add any issues or observations here]
```

---

#### ➕ Task Creation

- [ ] **Select project chip**: Long-press to select (blue border)
- [ ] **Type task name**: Input accepts text
- [ ] **Press Enter**: Task creates successfully
- [ ] **Tap "Add" button**: Task creates successfully
- [ ] **Project assignment**: Task assigned to selected project
- [ ] **Task appears**: New task shows in list immediately
- [ ] **Input clears**: Input clears after creation
- [ ] **Loading state**: "Adding..." shows during creation
- [ ] **Error handling**: Errors displayed gracefully
- [ ] **Empty input**: "Add" button disabled when empty

**`/in` Command**:
- [ ] **Type "/in "**: Autocomplete appears
- [ ] **Show all projects**: Lists all projects when query empty
- [ ] **Filter projects**: Filters as you type
- [ ] **Arrow keys**: Up/down navigate options
- [ ] **Tab/Enter**: Selects highlighted project
- [ ] **ESC**: Closes autocomplete
- [ ] **Task name cleaned**: "/in project" removed from final task name
- [ ] **Project chip**: Shows selected project in input

**Notes**:
```
[Add any issues or observations here]
```

---

#### 🎨 Visual & UX Tests

**Touch Targets**:
- [ ] Bottom nav tabs: ≥ 44px height
- [ ] Project chips: ≥ 44px height
- [ ] Top action bar icons: ≥ 44px tap area
- [ ] Task checkboxes: ≥ 44px tap area
- [ ] Quick-add buttons: ≥ 44px height

**No Horizontal Scroll**:
- [ ] iPhone SE (375px): No horizontal scroll
- [ ] All devices: No overflow-x
- [ ] Long task names: Truncate with ellipsis
- [ ] Long project names: Don't break layout

**Text Readability**:
- [ ] Base font: ≥ 16px
- [ ] Labels: ≥ 14px
- [ ] All text readable without zoom
- [ ] Good contrast ratios

**Animations**:
- [ ] Bottom sheets: Smooth slide-up
- [ ] Search overlay: Smooth fade-in
- [ ] Chip scrolling: Smooth momentum
- [ ] Task completion: Green flash animation
- [ ] No jank or stuttering

**Notes**:
```
[Add any issues or observations here]
```

---

#### 🔄 Orientation Change

**Portrait → Landscape**:
- [ ] Layout adjusts correctly
- [ ] No content cutoff
- [ ] Bottom nav remains accessible
- [ ] Tasks still scrollable

**Landscape → Portrait**:
- [ ] Returns to portrait layout
- [ ] State preserved
- [ ] No visual glitches

**Notes**:
```
[Add any issues or observations here]
```

---

## Critical Issues Found

**P0 (Blocker) - Layout breaks, data loss, crashes**:
```
[List any P0 issues here]
```

**P1 (Critical) - Poor UX, confusing interactions**:
```
[List any P1 issues here]
```

**P2 (Important) - Visual glitches, performance issues**:
```
[List any P2 issues here]
```

**P3 (Nice to have) - Polish, animations**:
```
[List any P3 issues here]
```

---

## Success Criteria

- [ ] No horizontal scroll on any device size
- [ ] All touch targets ≥ 44px
- [ ] Text readable without zoom (16px+ base)
- [ ] No visual glitches during interactions
- [ ] Smooth scrolling and animations
- [ ] Search, filter, grouping all work correctly
- [ ] Task creation assigns to selected project
- [ ] `/in` command works for power users
- [ ] Breakpoint switching smooth (1024px)
- [ ] All empty states appropriate

---

## Overall Assessment

**Pass/Fail**: [PASS / FAIL / PASS WITH MINOR ISSUES]

**Summary**:
```
[Provide overall assessment of mobile responsiveness]
```

**Recommended Next Steps**:
```
[List any fixes needed before proceeding to Phase 8]
```

---

**Completed By**: ___________________
**Date**: ___________________
**Sign-off**: ___________________
