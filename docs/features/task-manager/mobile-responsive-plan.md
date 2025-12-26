# Mobile Responsive Task Manager - Implementation Plan

## Overview

This document outlines the plan to make the Flow responsive for mobile devices (phones and tablets). The approach starts with responsive design principles in Chrome DevTools, then moves to iOS simulator testing, and finally real device testing.

**Target Breakpoint**: `lg` (1024px) - Below this, the app switches to mobile layout
**Rationale**: Standard Tailwind breakpoint that accommodates tall iPads in portrait and all phones

## Design Specification

### Mobile Layout Structure

```
┌─────────────────────────┐
│ 🔍  🎯  📊             │  ← Top Action Bar (search, filter, group icons)
├─────────────────────────┤
│ ⬅➡ Project Chips       │  ← Horizontal scroll of project toggles
├─────────────────────────┤
│                         │
│  [ ] Task 1             │
│  [ ] Task 2             │  ← Scrollable Task List
│  [ ] Task 3             │
│                         │
├─────────────────────────┤
│ + Add a task...         │  ← Task Quick Add Input
├─────────────────────────┤
│ Tasks Projects 📅 👤   │  ← Bottom Navigation Bar
└─────────────────────────┘
```

### Component Breakdown (Top to Bottom)

#### 1. Top Action Bar
**Layout**: Horizontal flex container with 3 icon buttons
**Contents**:
- **Search Icon** (🔍): Opens full-screen search overlay
- **Filter Icon** (🎯): Opens bottom sheet with filter controls
- **Group Icon** (📊): Opens bottom sheet with group-by options

**Styling**:
- Fixed height: 56px (standard mobile touch target)
- Background: White with bottom border
- Icons: 24x24px minimum

#### 2. Project Chips Bar
**Layout**: Horizontal scroll container with snap points
**Chip States**:
1. **Not Visible** (Outline): `border-2 border-gray-300 bg-white text-gray-700`
2. **Visible** (Filled): `bg-blue-100 text-blue-800 border-2 border-blue-100`
3. **Selected** (Active): `bg-blue-500 text-white border-4 border-blue-300`

**Interaction**:
- Single tap toggles between states: Not Visible ↔ Visible
- Long press or double tap sets as Selected (active project for new tasks)
- Horizontal scroll with momentum
- Chip dimensions: `min-h-[44px] px-4` (WCAG touch target)

**Edge Cases**:
- Show left/right gradient fade when scrollable
- Snap to center on scroll end for better UX
- Hide bar when no projects exist

#### 3. Task List Area
**Layout**: Vertical scroll container
**Behavior**:
- Same TaskList component as desktop, but:
  - No visible custom property columns (simplified view)
  - Tap task to open detail modal (future feature)
  - Swipe gestures for quick actions (future feature)

**Performance**:
- Virtualization for 100+ tasks (use existing logic)
- Pull-to-refresh for manual sync (future feature)

#### 4. Task Quick Add Input
**Layout**: Fixed position above bottom nav
**Changes from Desktop**:
- No "Advanced Options" dropdown on mobile
- Project auto-assigned to Selected chip (blue border)
- Simplified input: Just task name + Enter
- `/in` command still works for power users

**Styling**:
- Sticky positioning: `sticky bottom-[64px]` (above nav)
- Background: White with top shadow for separation
- Padding: `p-4`

#### 5. Bottom Navigation Bar
**Layout**: Fixed bottom position with 4 equal-width tabs
**Tabs**:
1. **Tasks** (📋): Current view - highlighted
2. **Projects** (📁): Project management screen (future)
3. **Calendar** (📅): Calendar view (Column 3 from desktop)
4. **Account** (👤): Settings and profile (future)

**Styling**:
- Height: 64px (iOS safe area + tab height)
- Background: White with top border
- Active tab: Primary color with icon + label
- Inactive tabs: Gray with icon only (label optional)
- Use `env(safe-area-inset-bottom)` for iOS notch

## Breakpoint Strategy

### Tailwind Breakpoint Reference
- `sm`: 640px (Large phones landscape)
- `md`: 768px (Tablets portrait)
- `lg`: 1024px (Tablets landscape / Small laptops) **← Mobile/Desktop threshold**
- `xl`: 1280px (Laptops)
- `2xl`: 1536px (Desktops)

### Implementation Approach

**Default (Mobile-First)**: Design for `< 1024px`
**Desktop**: Apply `lg:` prefix for `≥ 1024px`

```tsx
// Example: Hide on mobile, show on desktop
<div className="hidden lg:block">
  {/* Three column layout */}
</div>

// Example: Show on mobile, hide on desktop
<div className="block lg:hidden">
  {/* Mobile single column layout */}
</div>
```

## Technical Architecture

### New Components to Create

#### 1. `MobileTaskView.tsx` (Main Mobile Wrapper)
**Location**: `apps/web/components/mobile/MobileTaskView.tsx`
**Responsibilities**:
- Orchestrates mobile-specific layout
- Manages bottom nav state
- Handles route/view switching (Tasks, Calendar, Account)
- Wraps child components in mobile-optimized container

**Props**:
```tsx
interface MobileTaskViewProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (ids: string[]) => void;
}
```

#### 2. `MobileTopActionBar.tsx`
**Location**: `apps/web/components/mobile/MobileTopActionBar.tsx`
**Responsibilities**:
- Renders search, filter, group icons
- Opens bottom sheets for each action
- Manages active filter/group state indicators (badges)

**Props**:
```tsx
interface MobileTopActionBarProps {
  onSearchOpen: () => void;
  onFilterOpen: () => void;
  onGroupOpen: () => void;
  activeFilterCount: number;
  currentGroupBy: GroupByOption | null;
}
```

#### 3. `ProjectChipsBar.tsx`
**Location**: `apps/web/components/mobile/ProjectChipsBar.tsx`
**Responsibilities**:
- Horizontal scroll container of project chips
- Manages 3-state chip logic (outline, filled, selected)
- Emits selection change events
- Shows scroll indicators (fade edges)

**Props**:
```tsx
interface ProjectChipsBarProps {
  userId: string;
  projects: Project[];
  visibleProjectIds: string[]; // Filled state chips
  selectedProjectId: string | null; // Active/selected chip
  onVisibilityChange: (projectId: string, visible: boolean) => void;
  onSelectedChange: (projectId: string) => void;
}
```

**State Management**:
- `visibleProjectIds`: Array of project IDs that are "visible" (filled chips)
- `selectedProjectId`: Single project ID that is "selected" (active for new tasks)
- Clicking visible chip → toggles visibility
- Long press/double tap → sets as selected

#### 4. `MobileBottomNav.tsx`
**Location**: `apps/web/components/mobile/MobileBottomNav.tsx`
**Responsibilities**:
- Fixed bottom navigation bar
- Tab switching with active state
- Safe area handling for iOS

**Props**:
```tsx
interface MobileBottomNavProps {
  activeTab: 'tasks' | 'projects' | 'calendar' | 'account';
  onTabChange: (tab: string) => void;
}
```

#### 5. `MobileSearchOverlay.tsx`
**Location**: `apps/web/components/mobile/MobileSearchOverlay.tsx`
**Responsibilities**:
- Full-screen search experience
- Reuses existing TaskSearchInput component
- Shows recent searches (future)
- Dismissible with backdrop tap or ESC

**Props**:
```tsx
interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalTasks: number;
  filteredTasks: number;
}
```

#### 6. `MobileFilterSheet.tsx`
**Location**: `apps/web/components/mobile/MobileFilterSheet.tsx`
**Responsibilities**:
- Bottom sheet with filter controls
- Reuses existing ColumnFilterDropdown logic
- "Apply" button to dismiss
- Shows active filter count

**Props**:
```tsx
interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  availableFilters: AvailableFilters;
  selectedFilters: FilterState;
  onChange: (filters: FilterState) => void;
}
```

#### 7. `MobileGroupSheet.tsx`
**Location**: `apps/web/components/mobile/MobileGroupSheet.tsx`
**Responsibilities**:
- Bottom sheet with group-by options
- Reuses existing GroupByDropdown logic
- Radio button selection
- "Done" button to dismiss

**Props**:
```tsx
interface MobileGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  value: GroupByOption | null;
  onChange: (groupBy: GroupByOption | null) => void;
  tasks: Task[];
  selectedProjectIds: string[];
  customPropertyDefinitions: CustomPropertyDefinition[];
}
```

### Modified Existing Components

#### `ThreeColumnLayout.tsx`
**Changes**:
- Add responsive wrapper:
  ```tsx
  // Desktop view (≥ 1024px)
  <div className="hidden lg:flex h-screen bg-white">
    {/* Existing three-column layout */}
  </div>

  // Mobile view (< 1024px)
  <div className="block lg:hidden h-screen bg-white">
    <MobileTaskView
      userId={userId}
      selectedProjectIds={selectedProjectIds}
      onProjectSelectionChange={handleProjectSelectionChange}
    />
  </div>
  ```

#### `TaskHub.tsx`
**Changes**:
- Add mobile-specific rendering logic:
  ```tsx
  // In mobile context, hide QuickAdd at top
  <div className="hidden lg:block p-4 border-b">
    <TaskQuickAdd ... />
  </div>

  // Hide desktop FiltersBar on mobile
  <div className="hidden lg:block">
    <TaskFiltersBar ... />
  </div>
  ```

#### `TaskQuickAdd.tsx`
**Changes**:
- Add `showAdvancedOptions` prop (default `true` for desktop, `false` for mobile)
- Conditional rendering:
  ```tsx
  {showAdvancedOptions && (
    <Button onClick={() => setShowAdvanced(!showAdvanced)}>
      ...
    </Button>
  )}
  ```

#### `TaskItem.tsx`
**Changes**:
- Hide custom property columns on mobile:
  ```tsx
  <div className="hidden lg:flex">
    {/* Custom property columns */}
  </div>
  ```

## Implementation Phases

### Phase 1: Foundation & Layout (Week 1)
**Goal**: Get basic mobile layout structure rendering in Chrome DevTools

**Tasks**:
1. Create `/components/mobile/` directory
2. Build `MobileTaskView.tsx` skeleton
3. Build `MobileBottomNav.tsx` with hardcoded tabs
4. Add responsive wrapper to `ThreeColumnLayout.tsx`
5. Test breakpoint switching (desktop ↔ mobile)

**Success Criteria**:
- Breakpoint at 1024px shows/hides correct layouts
- Bottom nav renders and highlights active tab
- No visual glitches during resize

### Phase 2: Project Chips Bar (Week 1)
**Goal**: Implement horizontal project selector with 3-state chips

**Tasks**:
1. Build `ProjectChipsBar.tsx` component
2. Implement 3-state chip logic (outline, filled, selected)
3. Add horizontal scroll with momentum
4. Add scroll fade indicators (left/right gradients)
5. Wire up to existing project visibility hooks
6. Test with 1, 5, 10+ projects

**Success Criteria**:
- All 3 chip states render correctly
- Single tap toggles visibility
- Selected state persists across renders
- Smooth horizontal scrolling
- New tasks auto-assign to selected project

### Phase 3: Top Action Bar & Search (Week 2)
**Goal**: Build top action bar with working search overlay

**Tasks**:
1. Build `MobileTopActionBar.tsx`
2. Build `MobileSearchOverlay.tsx`
3. Reuse existing `TaskSearchInput` component
4. Add full-screen modal behavior (backdrop, ESC key)
5. Wire up search query to existing TaskHub state
6. Add active filter count badge

**Success Criteria**:
- Search icon opens full-screen overlay
- Search input focuses on open
- Backdrop dismisses overlay
- Search filters tasks correctly
- Badge shows active filter count

### Phase 4: Filter & Group Bottom Sheets (Week 2)
**Goal**: Implement filter and group-by controls in bottom sheets

**Tasks**:
1. Build `MobileFilterSheet.tsx`
2. Build `MobileGroupSheet.tsx`
3. Reuse existing filter/group logic from desktop
4. Add bottom sheet animation (slide up)
5. Wire up to existing TaskHub state
6. Test filter combinations

**Success Criteria**:
- Filter sheet shows all available filters
- Group sheet shows all group-by options
- Sheets slide up smoothly from bottom
- Apply/Done buttons dismiss sheets
- Filters and grouping work identically to desktop

### Phase 5: Mobile Task List (Week 3)
**Goal**: Optimize task list for mobile display

**Tasks**:
1. Hide custom property columns on mobile
2. Adjust task row height for touch (min 44px)
3. Test grouped task display
4. Optimize performance (virtualization)
5. Add empty states for no tasks
6. Test with 100+ tasks

**Success Criteria**:
- Tasks render without horizontal scroll
- Touch targets are 44px minimum
- Grouping works identically to desktop
- No performance lag with many tasks
- Empty states guide user to create tasks

### Phase 6: Mobile Quick Add (Week 3)
**Goal**: Integrate quick-add input at bottom of screen

**Tasks**:
1. Position TaskQuickAdd above bottom nav
2. Hide advanced options dropdown
3. Wire up to selected project chip
4. Test `/in` command on mobile
5. Add keyboard handling (show/hide nav)
6. Test with iOS keyboard behavior

**Success Criteria**:
- Input sticks above bottom nav
- New tasks assign to selected project
- `/in` command works for power users
- No advanced options shown
- Keyboard doesn't obscure input

### Phase 7: Chrome DevTools Testing (Week 4)
**Goal**: Comprehensive testing across simulated devices

**Test Matrix**:
- **iPhone SE (375px)**: Smallest modern phone
- **iPhone 14 Pro (393px)**: Standard phone
- **iPhone 14 Pro Max (430px)**: Large phone
- **iPad Mini (768px)**: Small tablet
- **iPad Pro 11" (834px)**: Medium tablet
- **iPad Pro 12.9" (1024px)**: Breakpoint edge case

**Test Scenarios**:
1. Project chip bar with 1, 5, 10, 20 projects
2. Task list with 0, 10, 100, 500 tasks
3. Search with 0 results, partial matches, exact matches
4. All filter combinations
5. All group-by options
6. Keyboard show/hide behavior
7. Orientation changes (portrait ↔ landscape)

**Success Criteria**:
- No horizontal scroll on any device
- All touch targets ≥ 44px
- Text readable without zoom (16px+ base)
- No visual glitches during interactions
- Smooth scrolling and animations

### Phase 8: iOS Simulator Testing (Week 5)
**Goal**: Test on actual iOS simulator to catch platform quirks

**Setup**:
1. Run `pnpm dev:mobile` to launch Capacitor
2. Test on iPhone 14 Pro simulator
3. Test on iPad Pro 11" simulator

**iOS-Specific Tests**:
1. Safe area insets (notch, home indicator)
2. Keyboard behavior (input scroll, nav hide)
3. Touch gestures (swipe, long press)
4. Pull-to-refresh (future feature)
5. Haptic feedback (future feature)
6. Status bar styling

**Known iOS Quirks to Address**:
- Add `viewport-fit=cover` meta tag
- Use `env(safe-area-inset-*)` CSS variables
- Handle keyboard `visualViewport` API
- Prevent bounce scrolling on body
- Fix fixed positioning with keyboard

### Phase 9: Real Device Testing (Week 6)
**Goal**: Final validation on physical devices

**Test Devices** (minimum):
- iPhone (any model from last 3 years)
- iPad (any model from last 3 years)

**Real Device Tests**:
1. Touch accuracy and responsiveness
2. Scroll performance
3. Keyboard interactions
4. Network latency behavior
5. Real-world usage patterns
6. Battery impact (future concern)

**Bug Triage**:
- P0 (Blocker): Layout breaks, data loss, crashes
- P1 (Critical): Poor UX, confusing interactions
- P2 (Important): Visual glitches, performance issues
- P3 (Nice to have): Polish, animations

## Technical Considerations

### State Management

**Existing Hooks to Reuse**:
- `useProjectsForUser(userId)` - Get all projects
- `useVisibleProjectIds(userId)` - Get visible projects (filled chips)
- `useUpdateVisibleProjectIds()` - Update visibility
- `useProjectsTasks(userId, projectIds)` - Get tasks for selected projects
- `useCreateTask()` - Create new task

**New State Needed**:
```tsx
// In MobileTaskView
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<'tasks' | 'projects' | 'calendar' | 'account'>('tasks');
const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
const [filterSheetOpen, setFilterSheetOpen] = useState(false);
const [groupSheetOpen, setGroupSheetOpen] = useState(false);
```

**Persistence**:
- Save `selectedProjectId` to localStorage: `localStorage.setItem('selectedProjectId', id)`
- Restore on mount: `const saved = localStorage.getItem('selectedProjectId')`

### Performance Optimization

**Scroll Performance**:
- Use `will-change: transform` on scrollable containers
- Implement virtual scrolling for 100+ tasks (existing)
- Debounce search input (existing, 300ms)
- Use `useCallback` for chip tap handlers

**Animation Performance**:
- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `height`, `width`, `top`, `left`
- Use Framer Motion or Radix UI for bottom sheets (built-in optimization)

**Bundle Size**:
- Code-split mobile components: `lazy(() => import('./mobile/MobileTaskView'))`
- Don't bundle mobile components in desktop build
- Use dynamic imports for bottom sheets (only load when opened)

### Accessibility (WCAG 2.1 AA)

**Touch Targets**:
- Minimum 44x44px for all interactive elements
- Chips: `min-h-[44px] px-4`
- Bottom nav icons: `w-6 h-6` within `min-h-[64px]` container

**Keyboard Navigation**:
- Bottom sheets dismissible with ESC key
- Search overlay focuses input on open
- Tab order follows visual order (top to bottom)

**Screen Readers**:
- Add ARIA labels to icon-only buttons:
  ```tsx
  <button aria-label="Search tasks">
    <SearchIcon />
  </button>
  ```
- Announce filter changes: `aria-live="polite"`
- Group chip states: `aria-pressed={isVisible}`

**Color Contrast**:
- Outline chips: Gray-700 on White (7.0:1 ✅)
- Filled chips: Blue-800 on Blue-100 (4.6:1 ✅)
- Selected chips: White on Blue-500 (4.5:1 ✅)

### Testing Strategy

**Unit Tests** (Jest + React Testing Library):
```typescript
// Example: ProjectChipsBar.test.tsx
test('toggles chip visibility on tap', () => {
  const onVisibilityChange = jest.fn();
  render(<ProjectChipsBar onVisibilityChange={onVisibilityChange} ... />);

  const chip = screen.getByText('Marketing');
  fireEvent.click(chip);

  expect(onVisibilityChange).toHaveBeenCalledWith('project-1', true);
});

test('sets chip as selected on long press', async () => {
  const onSelectedChange = jest.fn();
  render(<ProjectChipsBar onSelectedChange={onSelectedChange} ... />);

  const chip = screen.getByText('Marketing');
  fireEvent.pointerDown(chip);
  await waitFor(() => expect(onSelectedChange).toHaveBeenCalled(), { timeout: 600 });
});
```

**Integration Tests** (Playwright):
```typescript
// Example: mobile-task-flow.spec.ts
test('mobile task creation flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro

  // Select project chip
  await page.click('[data-testid="project-chip-marketing"]');
  expect(await page.getAttribute('[data-testid="project-chip-marketing"]', 'data-selected')).toBe('true');

  // Create task
  await page.fill('[data-testid="task-input"]', 'New mobile task');
  await page.press('[data-testid="task-input"]', 'Enter');

  // Verify task appears
  await expect(page.locator('text=New mobile task')).toBeVisible();
});
```

**Visual Regression Tests** (Percy or Chromatic):
- Screenshot key states: empty, with tasks, filters active, sheets open
- Compare across breakpoints: 375px, 768px, 1024px

## Edge Cases & Fallbacks

### No Projects
**Scenario**: User has no projects (new account)
**Behavior**:
- Show "Get Started" empty state
- CTA button: "Create Your First Project"
- Bottom nav still renders (Projects tab highlighted)

### No Tasks
**Scenario**: User has projects but no tasks
**Behavior**:
- Show "No Tasks Yet" empty state
- Highlight quick-add input with pulsing animation
- Suggest: "Tap here to add your first task"

### No Selected Project
**Scenario**: User hasn't tapped any project chip
**Behavior**:
- Show all tasks from all visible projects (default behavior)
- Quick-add assigns to most recently used project (existing logic)

### Network Offline
**Scenario**: User loses connection
**Behavior**:
- Show cached tasks (TanStack Query stale data)
- Disable create/update actions with toast: "You're offline"
- Queue mutations for retry when back online (future feature)

### iOS Keyboard Covering Input
**Scenario**: iOS keyboard hides quick-add input
**Solution**:
```tsx
useEffect(() => {
  if (typeof window !== 'undefined' && window.visualViewport) {
    const handleResize = () => {
      const viewport = window.visualViewport;
      const offsetBottom = window.innerHeight - (viewport.height + viewport.offsetTop);
      document.documentElement.style.setProperty('--keyboard-offset', `${offsetBottom}px`);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }
}, []);

// In CSS:
.quick-add-container {
  bottom: calc(64px + var(--keyboard-offset, 0px));
}
```

## Future Enhancements (Out of Scope)

### Gesture Support
- Swipe task right to complete
- Swipe task left to delete
- Pull-to-refresh on task list
- Long press task for quick actions menu

### Offline Mode
- IndexedDB cache for tasks
- Queue mutations when offline
- Sync on reconnect
- Conflict resolution

### Progressive Web App (PWA)
- Add to home screen prompt
- Offline service worker
- Push notifications (task reminders)
- Badge count on app icon

### Advanced Mobile Features
- Haptic feedback on interactions
- Face ID / Touch ID for sensitive projects
- Siri shortcuts for task creation
- iOS widget for quick task view
- Share extension (create task from other apps)

## Success Metrics

### Performance Benchmarks
- **Time to Interactive (TTI)**: < 3 seconds on 3G
- **First Contentful Paint (FCP)**: < 1.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Lighthouse Mobile Score**: ≥ 90

### User Experience Metrics
- **Task Creation Time**: < 10 seconds from thought to saved
- **Project Switch Time**: < 2 seconds (tap chip → tasks reload)
- **Search Response Time**: < 300ms (debounced)
- **Touch Target Hit Rate**: ≥ 95% (users hit intended targets)

### Browser Support
- **iOS Safari**: Last 2 major versions (17.x, 18.x)
- **Chrome Mobile**: Last 2 major versions
- **Samsung Internet**: Latest version

## Open Questions

1. **Project Chip Long Press**: Should long press set as selected, or open project settings?
   - **Decision needed**: Long press = selected (faster) vs. long press = settings (safer)

2. **Bottom Nav Account Tab**: What goes in Account section?
   - Profile settings
   - App preferences
   - Logout
   - **Decision needed**: Scope of Account screen

3. **Swipe Gestures**: Enable swipe-to-complete now or defer to Phase 2?
   - **Recommendation**: Defer - test basic interactions first

4. **Calendar on Mobile**: Show same desktop calendar or create mobile-optimized view?
   - **Recommendation**: Start with desktop calendar (Column 3), optimize in Phase 2

5. **Pull-to-Refresh**: Standard mobile pattern - include in Phase 1?
   - **Recommendation**: Defer - real-time sync already exists

## References

- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [iOS Safe Area](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Mobile Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Bottom Sheets Best Practices](https://m3.material.io/components/bottom-sheets/overview)

---

**Document Status**: Ready for Implementation
**Last Updated**: 2025-10-20
**Owner**: Engineering Team
**Reviewers**: Product, Design
