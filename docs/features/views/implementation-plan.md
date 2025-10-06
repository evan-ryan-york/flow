# Views Feature Implementation Plan

## Overview

This document provides a detailed, step-by-step plan for implementing the complete Views feature in Perfect Task App. The implementation follows the Golden Path architecture and builds upon the existing backend infrastructure (database schema, services, and hooks already completed).

**Current Status**: ✅ Backend Complete (Database, Services, Hooks, Tests)
**Remaining Work**: Frontend UI Components and Integration

---

## Phase 1: Core Views UI Components

### 1.1 SavedViews Component (Bottom Row of Task Hub)

**Location**: `apps/web/components/SavedViews.tsx`

**Purpose**: Display tabs for saved views and handle view selection

**Features**:
- Horizontal tab bar showing all user views
- "All Tasks" default view (always present, non-deletable)
- Active view highlighting
- "+" button to create new views
- Context menu on tabs (rename, duplicate, delete)
- Drag-to-reorder tabs

**Props Interface**:
```typescript
interface SavedViewsProps {
  userId: string;
  activeViewId: string | null;
  onViewChange: (viewId: string) => void;
  onCreateView: () => void;
}
```

**Dependencies**:
- `useViews(userId)` hook from `@perfect-task-app/data`
- `Button`, `Badge`, `Popover` from `@perfect-task-app/ui`
- `lucide-react` icons (Plus, MoreVertical, Trash, Edit, Copy)

**Implementation Steps**:
1. Create component file with TypeScript interface
2. Fetch views using `useViews` hook
3. Render tab bar with map over views array
4. Implement active state styling with Tailwind
5. Add "Create View" button with `onCreateView` handler
6. Implement context menu with Popover component
7. Add keyboard navigation (arrow keys, Enter, Delete)

**Acceptance Criteria**:
- [ ] Tabs render horizontally with proper spacing
- [ ] Active view has distinct visual styling
- [ ] Context menu appears on right-click or click of menu icon
- [ ] "All Tasks" view cannot be deleted
- [ ] Component is fully keyboard accessible
- [ ] Loading state shows skeleton tabs
- [ ] Error state shows fallback UI

---

### 1.2 CreateViewDialog Component ✅ COMPLETED

**Location**: `apps/web/components/CreateViewDialog.tsx`

**Purpose**: Simple modal dialog for naming and saving current workspace as a view

**Features**:
- Text input for view name only
- Informational message explaining the snapshot concept
- Cancel/Create action buttons
- Automatically captures current workspace state (projects, grouping, sorting, view type)

**Props Interface**:
```typescript
interface CreateViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentProjectIds: string[];      // Auto-captured
  currentGroupBy?: string | null;   // Auto-captured
  currentSortBy?: string;           // Auto-captured
  currentViewType?: 'list' | 'kanban'; // Auto-captured
  onViewCreated?: (viewId: string) => void;
}
```

**Dependencies**:
- `useCreateView()` mutation hook
- `Dialog`, `Input`, `Label`, `Button` from `@perfect-task-app/ui`

**Key Design Decision**: The dialog does NOT allow users to configure settings. It simply asks for a name and takes a "snapshot" of the current workspace. This makes view creation extremely simple and intuitive.

**Acceptance Criteria**:
- [x] Dialog opens/closes with smooth animation
- [x] Form validation prevents empty view names
- [x] Automatically captures current projects from props
- [x] Automatically captures current groupBy from props
- [x] Automatically captures current sortBy from props
- [x] Automatically captures current view type (list/kanban) from props
- [x] Successfully creates view in database
- [x] UI switches to newly created view automatically
- [x] Error messages are user-friendly
- [x] Pressing Escape closes dialog

---

### 1.3 UpdateViewDialog Component

**Location**: `apps/web/components/UpdateViewDialog.tsx`

**Purpose**: Modal dialog for editing existing views

**Features**:
- Pre-populated form with current view settings
- Same fields as CreateViewDialog
- "Save" and "Cancel" buttons
- Cannot edit "All Tasks" default view (disabled state)

**Props Interface**:
```typescript
interface UpdateViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  view: View;
  currentProjectIds: string[];
}
```

**Dependencies**:
- `useUpdateView()` mutation hook
- Same UI components as CreateViewDialog

**Implementation Steps**:
1. Create dialog component (can reuse CreateViewDialog structure)
2. Pre-populate form with `view.config` values
3. Wire up `useUpdateView` mutation
4. Implement optimistic updates for instant UI feedback
5. Add "read-only" mode for "All Tasks" view
6. Handle concurrent edit conflicts gracefully

**Acceptance Criteria**:
- [ ] Form pre-populates with current view configuration
- [ ] Updates save successfully to database
- [ ] UI updates optimistically before server response
- [ ] "All Tasks" view shows disabled state with explanation
- [ ] Validation prevents invalid configurations
- [ ] Success feedback via toast notification

---

## Phase 2: Task Hub Integration

### 2.1 Enhanced TaskHub Component

**Location**: `apps/web/components/TaskHub.tsx` (existing, needs updates)

**Current State**: Basic task list rendering

**Required Enhancements**:
1. **View Configuration Application**:
   - Filter tasks by `config.projectIds`
   - Apply grouping based on `config.groupBy`
   - Sort tasks according to `config.sortBy` and `config.sortOrder`
   - Show/hide columns based on `config.visibleProperties`

2. **SavedViews Integration**:
   - Add SavedViews component to bottom row
   - Manage `activeViewId` in component state
   - Pass view config to TaskList component

3. **Project Selection Sync**:
   - When projects are selected in Column 1, update current view filter
   - Option to "Save as new view" or "Update current view"
   - Visual indicator when current state differs from saved view

**New Props**:
```typescript
interface TaskHubProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
}
```

**State Management**:
```typescript
const [activeViewId, setActiveViewId] = useState<string | null>(null);
const [pendingConfig, setPendingConfig] = useState<ViewConfig | null>(null);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
```

**Implementation Steps**:
1. Add state for active view and pending configuration
2. Fetch active view data using `useView(activeViewId)`
3. Apply view configuration to task filtering logic
4. Detect when current UI state differs from saved view
5. Show "Save changes" banner when unsaved changes exist
6. Integrate SavedViews component with view switching
7. Handle view switching (apply config to UI state)

**Acceptance Criteria**:
- [ ] Switching views instantly updates task list
- [ ] Task grouping reflects view configuration
- [ ] Sorting order matches view settings
- [ ] Unsaved changes are clearly indicated
- [ ] User can save or discard changes
- [ ] View configuration persists across sessions

---

### 2.2 TaskList Component Enhancements

**Location**: `apps/web/components/TaskList.tsx` (existing, needs updates)

**Current State**: Basic task rendering with drag-and-drop

**Required Enhancements**:
1. **Grouping Support**:
   - Group tasks by project, due date, status, assignee, or custom properties
   - Collapsible group headers with task counts
   - Empty state for groups with no tasks

2. **Dynamic Columns**:
   - Show columns based on view's `visibleProperties`
   - Handle projects with different custom property schemas
   - Empty cells for properties not applicable to task's project

3. **Sorting**:
   - Apply primary and secondary sort criteria
   - Visual indicator of active sort column
   - Click column headers to change sort (optional enhancement)

**New Props**:
```typescript
interface TaskListProps {
  tasks: Task[];
  groupBy: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  visibleProperties: string[];
  onTaskClick: (taskId: string) => void;
  onTaskDragStart: (taskId: string) => void;
}
```

**Helper Functions**:
```typescript
// Group tasks by specified field
function groupTasks(tasks: Task[], groupBy: string | null): GroupedTasks

// Sort tasks by field and order
function sortTasks(tasks: Task[], sortBy: string, order: 'asc' | 'desc'): Task[]

// Get visible columns for current view
function getVisibleColumns(tasks: Task[], propertyIds: string[]): Column[]
```

**Implementation Steps**:
1. Implement task grouping logic with group headers
2. Create collapsible sections for each group
3. Build dynamic column rendering system
4. Add sorting utilities for different field types
5. Handle empty states for empty groups
6. Optimize rendering for large task lists (virtualization if needed)

**Acceptance Criteria**:
- [ ] Tasks group correctly by all supported fields
- [ ] Group headers show accurate task counts
- [ ] Groups can be collapsed/expanded
- [ ] Sorting works for dates, strings, and numbers
- [ ] Dynamic columns display custom properties correctly
- [ ] Empty cells show for non-applicable properties
- [ ] Performance is acceptable with 1000+ tasks

---

## Phase 3: Projects Panel Integration

### 3.1 Enhanced ProjectsPanel Component

**Location**: `apps/web/components/ProjectsPanel.tsx` (existing, needs updates)

**Current State**: Basic project list with selection

**Required Enhancements**:
1. **View-Aware Selection**:
   - Sync selection state with active view's `config.projectIds`
   - Visual feedback when selection differs from view
   - "Update view" quick action button

2. **Multi-Select Improvements**:
   - Show count of selected projects when multiple selected
   - "Select all" / "Clear selection" quick actions
   - Keyboard shortcuts (Cmd+A for all, Esc to clear)

3. **View Context Menu**:
   - Right-click project → "Create view from selection"
   - "Add to current view" / "Remove from current view" options

**Implementation Steps**:
1. Add view context awareness to selection logic
2. Implement two-way sync between panel and active view
3. Add visual indicator for view-synced vs. manual selection
4. Create context menu with view-related actions
5. Add quick action buttons for common operations
6. Implement keyboard shortcuts

**Acceptance Criteria**:
- [ ] Project selection syncs with active view
- [ ] User can manually change selection (marks view as modified)
- [ ] Context menu provides view-related actions
- [ ] Keyboard shortcuts work as documented
- [ ] Visual feedback clearly shows sync status

---

## Phase 4: View Types Implementation

### 4.1 List View (Default)

**Location**: `apps/web/components/ListView.tsx`

**Purpose**: Traditional table/list layout for tasks

**Features**:
- Table headers with sortable columns
- Row selection with checkboxes
- Inline editing of task properties
- Drag handles for reordering within groups
- Context menu on right-click

**Props Interface**:
```typescript
interface ListViewProps {
  tasks: Task[];
  groupBy: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  visibleColumns: Column[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}
```

**Implementation Steps**:
1. Create table structure with dynamic columns
2. Implement column header sorting
3. Add row selection functionality
4. Build inline editing for editable cells
5. Integrate drag-and-drop for reordering
6. Add context menu for task actions

**Acceptance Criteria**:
- [ ] Table renders with correct columns
- [ ] Column headers show sort indicators
- [ ] Clicking headers changes sort order
- [ ] Inline editing saves changes to database
- [ ] Drag-and-drop reorders tasks within groups
- [ ] Context menu provides task actions (delete, duplicate, etc.)
- [ ] Responsive design works on smaller screens

---

### 4.2 Kanban View

**Location**: `apps/web/components/KanbanView.tsx`

**Purpose**: Card-based board layout with status columns

**Features**:
- Vertical columns for each status value
- Draggable task cards between columns
- Column headers with task counts
- Card compact view (title + key metadata)
- Lazy loading for columns with many tasks

**Props Interface**:
```typescript
interface KanbanViewProps {
  tasks: Task[];
  statusProperty: CustomPropertyDefinition; // The property used for columns
  groupBy?: string | null; // Further grouping within columns
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}
```

**Dependencies**:
- `@dnd-kit/core` for drag-and-drop (already in project)
- `TaskCard` component for individual cards
- `useCustomPropertyDefinitions` hook for status options

**Implementation Steps**:
1. Fetch status property definition from project
2. Create column structure from property options
3. Distribute tasks into columns based on status value
4. Implement drag-and-drop between columns
5. Update task status on drop using mutation hook
6. Add column headers with counts and actions
7. Build compact task card component
8. Implement swimlanes for secondary grouping (optional Phase 2)

**Acceptance Criteria**:
- [ ] Columns render for all status property options
- [ ] Tasks appear in correct columns based on status
- [ ] Drag-and-drop moves tasks between columns
- [ ] Task status updates in database on drop
- [ ] Column headers show accurate task counts
- [ ] Cards display key task information compactly
- [ ] Empty columns show "Drop tasks here" state
- [ ] Performance is acceptable with 500+ tasks

---

## Phase 5: Advanced Features

### 5.1 View Configuration Panel

**Location**: `apps/web/components/ViewConfigPanel.tsx`

**Purpose**: Inline configuration panel for quick view adjustments

**Features**:
- Slide-out panel (triggered by gear icon in SavedViews)
- Live configuration preview
- Quick toggles for grouping, sorting, column visibility
- "Save" and "Save as new view" options

**Props Interface**:
```typescript
interface ViewConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: ViewConfig;
  onConfigChange: (config: ViewConfig) => void;
  onSave: (saveAsNew: boolean) => void;
}
```

**Implementation Steps**:
1. Create slide-out panel component with animation
2. Build configuration form with current settings
3. Implement live preview (apply changes without saving)
4. Add "Save" and "Save as new" action buttons
5. Handle validation and error states
6. Add keyboard shortcut (Cmd+K) to open panel

**Acceptance Criteria**:
- [ ] Panel slides in smoothly from right
- [ ] Configuration changes update preview instantly
- [ ] "Save" updates current view
- [ ] "Save as new" opens create dialog with current config
- [ ] Panel closes on Escape key
- [ ] Changes persist to database on save

---

### 5.2 Default View Creation on User Registration

**Location**: `packages/data/services/authService.ts` (enhancement)

**Purpose**: Automatically create "All Tasks" view for new users

**Implementation**:
```typescript
// In authService.ts, after profile creation
export const createUserProfile = async (userId: string, email: string): Promise<Profile> => {
  // ... existing profile creation code ...

  // Create default "All Tasks" view
  await createView({
    userId: userId,
    viewName: "All Tasks",
    viewType: "list",
    config: {
      projectIds: [], // Empty = all projects
      groupBy: null,
      sortBy: "dueDate",
      sortOrder: "asc",
      visibleProperties: [],
      filters: { status: "incomplete" },
      defaultProjectId: null
    }
  });

  return profile;
};
```

**Testing**:
- Integration test: Create user → verify default view exists
- E2E test: New user signup → "All Tasks" tab visible

**Acceptance Criteria**:
- [ ] Default view created automatically on registration
- [ ] View is named "All Tasks"
- [ ] View shows all incomplete tasks by default
- [ ] View is set as active view on first login
- [ ] System prevents deletion of this view

---

### 5.3 View Switching State Management

**Location**: `apps/web/lib/viewState.ts` (new utility)

**Purpose**: Centralized state management for view switching

**Features**:
- Store active view ID in local storage
- Restore last active view on app load
- Handle view switching transitions smoothly
- Detect and warn about unsaved changes

**Implementation**:
```typescript
// Custom hook for view state management
export function useViewState(userId: string) {
  const [activeViewId, setActiveViewId] = useLocalStorage<string>(
    `active-view-${userId}`,
    null
  );

  const [pendingChanges, setPendingChanges] = useState(false);

  const switchView = (newViewId: string) => {
    if (pendingChanges) {
      // Show confirmation dialog
      confirmSwitch(() => {
        setActiveViewId(newViewId);
        setPendingChanges(false);
      });
    } else {
      setActiveViewId(newViewId);
    }
  };

  return { activeViewId, switchView, pendingChanges, setPendingChanges };
}
```

**Acceptance Criteria**:
- [ ] Active view persists across browser sessions
- [ ] View switching prevents data loss from unsaved changes
- [ ] Confirmation dialog appears when switching with unsaved changes
- [ ] State syncs correctly across browser tabs (optional)

---

## Phase 6: Performance Optimization

### 6.1 Task List Virtualization

**Library**: `@tanstack/react-virtual`

**Purpose**: Efficiently render large task lists (1000+ tasks)

**Implementation**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedTaskList({ tasks, ...props }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 5 // Render extra rows for smooth scrolling
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <TaskRow
            key={tasks[virtualRow.index].task_id}
            task={tasks[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- [ ] List renders smoothly with 5000+ tasks
- [ ] Scrolling maintains 60fps
- [ ] Memory usage remains acceptable
- [ ] Drag-and-drop still works with virtualization

---

### 6.2 View Configuration Caching

**Purpose**: Minimize re-computation of derived view data

**Implementation**:
```typescript
// Memoize expensive grouping/sorting operations
const groupedAndSortedTasks = useMemo(() => {
  let processed = [...tasks];

  // Apply filters
  if (viewConfig.filters) {
    processed = applyFilters(processed, viewConfig.filters);
  }

  // Apply sorting
  processed = sortTasks(processed, viewConfig.sortBy, viewConfig.sortOrder);

  // Apply grouping
  if (viewConfig.groupBy) {
    return groupTasks(processed, viewConfig.groupBy);
  }

  return { ungrouped: processed };
}, [tasks, viewConfig]);
```

**Acceptance Criteria**:
- [ ] View operations don't re-run on unrelated state changes
- [ ] Configuration changes trigger single re-computation
- [ ] Performance metrics show improvement in React DevTools

---

## Phase 7: Testing

**Testing Pyramid Overview** (Following `docs/project-wide-context/testing-strategy.md`):
- **Base**: Service Layer Integration Tests (many, fast)
- **Middle**: Hook Unit Tests (moderate, mocked)
- **Upper-Middle**: Component/Screen Tests (moderate, hook-mocked)
- **Top**: E2E Tests (few, comprehensive)

---

### 7.0 Service Layer Integration Tests (CRITICAL - Test Against Live Supabase)

**Purpose**: Validate that view service functions correctly interact with the database and enforce Row-Level Security (RLS) policies.

**Technology**: Jest + Live Local Supabase Instance

**Test File Location**: `packages/data/services/__tests__/viewService.test.ts`

**Important Note**: ✅ **These tests already exist and pass**. The view service layer was completed in Phase 1 with comprehensive test coverage. This section documents what has already been implemented.

**Existing Test Coverage**:

```typescript
import { createView, getViewsForUser, getViewById, updateView, deleteView } from '../viewService';
import { supabase } from '../../supabase';

describe('viewService Integration Tests', () => {
  let testUserA, testUserB;

  beforeEach(async () => {
    // Reset local Supabase database to clean state
    await supabase.db.reset();

    // Create test users and authenticate as User A
    testUserA = await createTestUser('usera@test.com');
    testUserB = await createTestUser('userb@test.com');
    await authenticateAs(testUserA);
  });

  // 1. CRUD Operations Testing
  describe('CRUD Operations', () => {
    it('should create a view and return it with valid ID', async () => {
      const viewData = {
        userId: testUserA.id,
        viewName: 'My Test View',
        viewType: 'list',
        config: { projectIds: [], groupBy: null, sortBy: 'dueDate' }
      };

      const createdView = await createView(viewData);

      expect(createdView.view_id).toBeDefined();
      expect(createdView.view_name).toBe('My Test View');
      expect(createdView.user_id).toBe(testUserA.id);
    });

    it('should retrieve all views for a user', async () => {
      await createView({ userId: testUserA.id, viewName: 'View 1', ... });
      await createView({ userId: testUserA.id, viewName: 'View 2', ... });

      const views = await getViewsForUser(testUserA.id);

      expect(views).toHaveLength(2);
      expect(views.map(v => v.view_name)).toContain('View 1');
      expect(views.map(v => v.view_name)).toContain('View 2');
    });

    it('should update a view successfully', async () => {
      const view = await createView({ userId: testUserA.id, viewName: 'Original', ... });

      const updated = await updateView(view.view_id, {
        viewName: 'Updated Name',
        config: { projectIds: ['proj-1'], groupBy: 'project' }
      });

      expect(updated.view_name).toBe('Updated Name');
      expect(updated.config.groupBy).toBe('project');
    });

    it('should delete a view successfully', async () => {
      const view = await createView({ userId: testUserA.id, viewName: 'To Delete', ... });

      await deleteView(view.view_id);

      const views = await getViewsForUser(testUserA.id);
      expect(views.find(v => v.view_id === view.view_id)).toBeUndefined();
    });
  });

  // 2. Data Shape Validation (Zod Schema Testing)
  describe('Zod Validation', () => {
    it('should successfully parse valid view data from database', async () => {
      const view = await createView({ userId: testUserA.id, viewName: 'Valid View', ... });

      // If this doesn't throw, Zod validation passed
      expect(view.view_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(view.config).toHaveProperty('projectIds');
    });

    it('should throw descriptive error if database returns invalid data', async () => {
      // Manually insert malformed data to database
      await supabase.from('views').insert({
        user_id: testUserA.id,
        view_name: 'Bad View',
        view_type: 'invalid_type', // Not 'list' or 'kanban'
        config: {}
      });

      await expect(getViewsForUser(testUserA.id)).rejects.toThrow(/validation/i);
    });
  });

  // 3. RLS Security Testing (CRITICAL)
  describe('Row-Level Security Policies', () => {
    it('should only return views owned by authenticated user', async () => {
      // Create views for both users
      await createView({ userId: testUserA.id, viewName: 'User A View', ... });

      await authenticateAs(testUserB);
      await createView({ userId: testUserB.id, viewName: 'User B View', ... });

      // Re-authenticate as User A
      await authenticateAs(testUserA);
      const viewsForA = await getViewsForUser(testUserA.id);

      // User A should ONLY see their own view
      expect(viewsForA).toHaveLength(1);
      expect(viewsForA[0].view_name).toBe('User A View');
      expect(viewsForA[0].user_id).toBe(testUserA.id);
    });

    it('should NOT allow user to read another user\'s view by ID', async () => {
      // User B creates a view
      await authenticateAs(testUserB);
      const userBView = await createView({ userId: testUserB.id, viewName: 'Secret', ... });

      // User A tries to read it
      await authenticateAs(testUserA);
      const result = await getViewById(userBView.view_id);

      expect(result).toBeNull(); // RLS blocks access
    });

    it('should NOT allow user to update another user\'s view', async () => {
      await authenticateAs(testUserB);
      const userBView = await createView({ userId: testUserB.id, viewName: 'Original', ... });

      await authenticateAs(testUserA);

      await expect(
        updateView(userBView.view_id, { viewName: 'Hacked!' })
      ).rejects.toThrow(/permission denied|not found/i);
    });

    it('should NOT allow user to delete another user\'s view', async () => {
      await authenticateAs(testUserB);
      const userBView = await createView({ userId: testUserB.id, viewName: 'To Keep', ... });

      await authenticateAs(testUserA);

      await expect(deleteView(userBView.view_id)).rejects.toThrow(/permission denied|not found/i);
    });
  });

  // 4. Edge Cases
  describe('Edge Cases', () => {
    it('should return null when getViewById receives non-existent ID', async () => {
      const result = await getViewById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('should throw error when creating view with invalid config', async () => {
      await expect(
        createView({
          userId: testUserA.id,
          viewName: 'Bad Config',
          viewType: 'list',
          config: { invalid: 'structure' } // Missing required fields
        })
      ).rejects.toThrow(/validation/i);
    });

    it('should handle empty projectIds array correctly', async () => {
      const view = await createView({
        userId: testUserA.id,
        viewName: 'All Projects',
        viewType: 'list',
        config: { projectIds: [], groupBy: null, sortBy: 'dueDate' }
      });

      expect(view.config.projectIds).toEqual([]);
    });
  });
});
```

**Acceptance Criteria**:
- [x] ✅ All view service functions have integration tests (COMPLETE)
- [x] ✅ RLS policies validated with cross-user test scenarios (COMPLETE)
- [x] ✅ Zod validation errors tested and caught (COMPLETE)
- [x] ✅ Tests run against local Supabase instance (COMPLETE)
- [x] ✅ Test database resets between test runs (COMPLETE)
- [x] ✅ Edge cases covered (null IDs, invalid configs, empty arrays) (COMPLETE)

---

### 7.1 Hook Unit Tests (Mock Service Layer - NOT Database)

**Purpose**: Test React hooks' state management logic in isolation by mocking the service layer.

**Technology**: Jest + React Testing Library + **Service Layer Mocks**

**Test File Locations**:
- `packages/data/hooks/__tests__/useView.test.ts`

**Critical Pattern**: ✅ **MUST mock the service layer**. We are NOT testing the database again; we are testing the hook's behavior (loading states, error handling, cache management).

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useViews, useView, useCreateView, useUpdateView, useDeleteView } from '../useView';
import * as viewService from '../../services/viewService';

// ✅ CRITICAL: Mock the entire service layer
jest.mock('../../services/viewService');

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useViews Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return isLoading: true on initial render', () => {
    viewService.getViewsForUser.mockResolvedValue([]);

    const { result } = renderHook(() => useViews('user-123'), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return data when service resolves successfully', async () => {
    const mockViews = [
      { view_id: '1', view_name: 'All Tasks', user_id: 'user-123', view_type: 'list', config: {} },
      { view_id: '2', view_name: 'Work', user_id: 'user-123', view_type: 'kanban', config: {} }
    ];
    viewService.getViewsForUser.mockResolvedValue(mockViews);

    const { result } = renderHook(() => useViews('user-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockViews);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return isError: true when service throws error', async () => {
    viewService.getViewsForUser.mockRejectedValue(new Error('Database connection failed'));

    const { result } = renderHook(() => useViews('user-123'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error.message).toContain('Database connection failed');
  });

  it('should not run query when userId is null/undefined (enabled: false)', () => {
    const { result } = renderHook(() => useViews(null), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(viewService.getViewsForUser).not.toHaveBeenCalled();
  });
});

describe('useCreateView Mutation Hook', () => {
  it('should call service function with correct data on mutate', async () => {
    const mockCreatedView = { view_id: 'new-id', view_name: 'New View', ... };
    viewService.createView.mockResolvedValue(mockCreatedView);

    const { result } = renderHook(() => useCreateView(), { wrapper: createWrapper() });

    const viewData = {
      userId: 'user-123',
      viewName: 'New View',
      viewType: 'list',
      config: { projectIds: [], groupBy: null }
    };

    result.current.mutate(viewData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(viewService.createView).toHaveBeenCalledWith(viewData);
    expect(result.current.data).toEqual(mockCreatedView);
  });

  it('should invalidate views cache on successful creation', async () => {
    viewService.createView.mockResolvedValue({ view_id: 'new-id', ... });

    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateView(), { wrapper });

    result.current.mutate({ userId: 'user-123', viewName: 'Test', ... });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['views'] });
  });

  it('should handle errors from service layer', async () => {
    viewService.createView.mockRejectedValue(new Error('View name already exists'));

    const { result } = renderHook(() => useCreateView(), { wrapper: createWrapper() });

    result.current.mutate({ userId: 'user-123', viewName: 'Duplicate', ... });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error.message).toContain('View name already exists');
  });
});

describe('useUpdateView Mutation Hook', () => {
  it('should update view and invalidate cache', async () => {
    const mockUpdatedView = { view_id: 'view-1', view_name: 'Updated', ... };
    viewService.updateView.mockResolvedValue(mockUpdatedView);

    const { result } = renderHook(() => useUpdateView(), { wrapper: createWrapper() });

    result.current.mutate({ viewId: 'view-1', updates: { viewName: 'Updated' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(viewService.updateView).toHaveBeenCalledWith('view-1', { viewName: 'Updated' });
  });
});

describe('useDeleteView Mutation Hook', () => {
  it('should delete view and invalidate cache', async () => {
    viewService.deleteView.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteView(), { wrapper: createWrapper() });

    result.current.mutate('view-to-delete');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(viewService.deleteView).toHaveBeenCalledWith('view-to-delete');
  });
});
```

**Acceptance Criteria**:
- [ ] All custom hooks have unit tests with mocked service layer
- [ ] Loading, success, and error states tested for query hooks
- [ ] Cache invalidation verified for mutation hooks
- [ ] Optimistic updates tested (if implemented)
- [ ] No actual database calls made during hook tests
- [ ] `enabled` flag behavior tested (hooks don't run when disabled)

---

### 7.2 Component/Screen Tests (Mock Hook Layer - NOT Services)

**Purpose**: Test how UI components render in various states (loading, success, error) by mocking the custom hooks.

**Technology**: React Testing Library + **Hook Mocks**

**Test File Locations**:
- `apps/web/components/__tests__/SavedViews.test.tsx`
- `apps/web/components/__tests__/CreateViewDialog.test.tsx`
- `apps/web/components/__tests__/UpdateViewDialog.test.tsx`
- `apps/web/components/__tests__/ListView.test.tsx`
- `apps/web/components/__tests__/KanbanView.test.tsx`

**Critical Pattern**: ✅ **Mock the hooks, NOT the services**. Components should only interact with hooks, never directly with services.

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SavedViews } from '../SavedViews';
import * as useView from '@perfect-task-app/data/hooks/useView';

// ✅ CRITICAL: Mock the hooks, not the services
jest.mock('@perfect-task-app/data/hooks/useView');

describe('SavedViews Component', () => {
  const mockOnViewChange = jest.fn();
  const mockOnCreateView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state when views are being fetched', () => {
    useView.useViews.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId={null}
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should render view tabs when data loads successfully', () => {
    useView.useViews.mockReturnValue({
      data: [
        { view_id: '1', view_name: 'All Tasks', view_type: 'list', config: {} },
        { view_id: '2', view_name: 'Work Projects', view_type: 'kanban', config: {} }
      ],
      isLoading: false,
      isError: false,
      isSuccess: true
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId="1"
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    expect(screen.getByText('All Tasks')).toBeInTheDocument();
    expect(screen.getByText('Work Projects')).toBeInTheDocument();
  });

  it('should highlight active view tab', () => {
    useView.useViews.mockReturnValue({
      data: [
        { view_id: '1', view_name: 'All Tasks', view_type: 'list', config: {} },
        { view_id: '2', view_name: 'Work Projects', view_type: 'kanban', config: {} }
      ],
      isLoading: false,
      isSuccess: true
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId="1"
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    const activeTab = screen.getByText('All Tasks').closest('button');
    expect(activeTab).toHaveClass('active'); // or check for specific styling
  });

  it('should show error message when fetching views fails', () => {
    useView.useViews.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load views')
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId={null}
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    expect(screen.getByText(/failed to load views/i)).toBeInTheDocument();
  });

  it('should call onViewChange when clicking a view tab', () => {
    useView.useViews.mockReturnValue({
      data: [
        { view_id: '1', view_name: 'All Tasks', view_type: 'list', config: {} },
        { view_id: '2', view_name: 'Work Projects', view_type: 'kanban', config: {} }
      ],
      isLoading: false,
      isSuccess: true
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId="1"
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    fireEvent.click(screen.getByText('Work Projects'));

    expect(mockOnViewChange).toHaveBeenCalledWith('2');
  });

  it('should call onCreateView when clicking create button', () => {
    useView.useViews.mockReturnValue({
      data: [{ view_id: '1', view_name: 'All Tasks', view_type: 'list', config: {} }],
      isLoading: false,
      isSuccess: true
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId="1"
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    fireEvent.click(screen.getByLabelText(/create new view/i));

    expect(mockOnCreateView).toHaveBeenCalled();
  });

  it('should show empty state when user has no views', () => {
    useView.useViews.mockReturnValue({
      data: [],
      isLoading: false,
      isSuccess: true
    });

    render(
      <SavedViews
        userId="user-123"
        activeViewId={null}
        onViewChange={mockOnViewChange}
        onCreateView={mockOnCreateView}
      />
    );

    expect(screen.getByText(/no views yet/i)).toBeInTheDocument();
  });
});

describe('CreateViewDialog Component', () => {
  const mockOnClose = jest.fn();
  const mockCreateView = { mutate: jest.fn(), isLoading: false, isError: false, isSuccess: false };

  beforeEach(() => {
    jest.clearAllMocks();
    useView.useCreateView.mockReturnValue(mockCreateView);
  });

  it('should render form fields when dialog is open', () => {
    render(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={[]}
      />
    );

    expect(screen.getByLabelText(/view name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/view type/i)).toBeInTheDocument();
  });

  it('should validate required fields before submission', async () => {
    render(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={[]}
      />
    );

    // Try to submit without filling in required fields
    fireEvent.click(screen.getByText(/create/i));

    await waitFor(() => {
      expect(screen.getByText(/view name is required/i)).toBeInTheDocument();
    });

    expect(mockCreateView.mutate).not.toHaveBeenCalled();
  });

  it('should call createView mutation with form data on submit', async () => {
    render(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={['proj-1', 'proj-2']}
      />
    );

    fireEvent.change(screen.getByLabelText(/view name/i), { target: { value: 'My New View' } });
    fireEvent.click(screen.getByLabelText(/list/i)); // Select list view type
    fireEvent.click(screen.getByText(/create/i));

    await waitFor(() => {
      expect(mockCreateView.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          viewName: 'My New View',
          viewType: 'list',
          config: expect.objectContaining({
            projectIds: ['proj-1', 'proj-2']
          })
        })
      );
    });
  });

  it('should show loading state during view creation', () => {
    useView.useCreateView.mockReturnValue({
      ...mockCreateView,
      isLoading: true
    });

    render(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={[]}
      />
    );

    expect(screen.getByText(/creating/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('should close dialog and reset form on successful creation', async () => {
    const { rerender } = render(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={[]}
      />
    );

    // Simulate successful creation
    useView.useCreateView.mockReturnValue({
      ...mockCreateView,
      isSuccess: true
    });

    rerender(
      <CreateViewDialog
        isOpen={true}
        onClose={mockOnClose}
        userId="user-123"
        currentProjectIds={[]}
      />
    );

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
```

**Testing Utilities**:
```typescript
// apps/web/lib/test-utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

**Key Test Scenarios for All Components**:
- Loading states (skeleton UI, spinners, disabled buttons)
- Success states (data rendering, proper layout)
- Error states (error messages, retry buttons)
- Empty states (no data, helpful messaging)
- User interactions (clicks, form submissions, keyboard navigation)
- Form validation (required fields, invalid input)
- Accessibility (ARIA labels, keyboard navigation, focus management)

**Acceptance Criteria**:
- [ ] All UI components have tests with mocked hooks
- [ ] Loading, success, error, and empty states tested
- [ ] User interactions trigger correct callbacks
- [ ] Form validation prevents invalid submissions
- [ ] No actual service calls made during component tests
- [ ] Accessibility features verified (ARIA, keyboard nav)

---

### 7.3 Integration Tests (Full Component Workflows)

**Purpose**: Test complete user workflows across multiple components working together.

**Technology**: React Testing Library + **Mocked Hooks** (not full E2E)

**Test File Locations**:
- `apps/web/__tests__/integration/viewWorkflow.test.tsx`
- `apps/web/__tests__/integration/taskHubWithViews.test.tsx`

**What to Test**: Multi-component interactions simulating user journeys

```typescript
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { TaskHub } from '../components/TaskHub';
import * as useView from '@perfect-task-app/data/hooks/useView';
import * as useTask from '@perfect-task-app/data/hooks/useTask';
import * as useProject from '@perfect-task-app/data/hooks/useProject';

jest.mock('@perfect-task-app/data/hooks/useView');
jest.mock('@perfect-task-app/data/hooks/useTask');
jest.mock('@perfect-task-app/data/hooks/useProject');

describe('View Workflow Integration', () => {
  it('should create view, switch to it, and apply configuration to task list', async () => {
    // Setup: Mock initial state
    const mockCreateView = jest.fn();
    useView.useViews.mockReturnValue({
      data: [{ view_id: '1', view_name: 'All Tasks', view_type: 'list', config: { projectIds: [] } }],
      isLoading: false,
      isSuccess: true
    });
    useView.useCreateView.mockReturnValue({ mutate: mockCreateView, isLoading: false });
    useTask.useTasks.mockReturnValue({
      data: [
        { task_id: 't1', task_name: 'Task 1', project_id: 'proj-1' },
        { task_id: 't2', task_name: 'Task 2', project_id: 'proj-2' }
      ],
      isLoading: false,
      isSuccess: true
    });

    // 1. Render TaskHub
    render(<TaskHub userId="user-123" selectedProjectIds={[]} onProjectSelectionChange={jest.fn()} />);

    // 2. Click "Create View" button
    fireEvent.click(screen.getByLabelText(/create new view/i));

    // 3. Fill in view form
    fireEvent.change(screen.getByLabelText(/view name/i), { target: { value: 'Work Only' } });

    // 4. Submit form
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    // 5. Verify mutation was called
    await waitFor(() => {
      expect(mockCreateView).toHaveBeenCalledWith(
        expect.objectContaining({ viewName: 'Work Only' })
      );
    });

    // 6. Simulate successful creation and view switch
    useView.useViews.mockReturnValue({
      data: [
        { view_id: '1', view_name: 'All Tasks', view_type: 'list', config: { projectIds: [] } },
        { view_id: '2', view_name: 'Work Only', view_type: 'list', config: { projectIds: ['proj-1'] } }
      ],
      isLoading: false,
      isSuccess: true
    });

    // Re-render to reflect new view
    render(<TaskHub userId="user-123" selectedProjectIds={['proj-1']} onProjectSelectionChange={jest.fn()} />);

    // 7. Verify new tab appears and task list updates
    expect(screen.getByText('Work Only')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.queryByText('Task 2')).not.toBeInTheDocument(); // Filtered out
  });

  it('should warn when switching views with unsaved changes', async () => {
    // Similar structure testing the confirmation dialog flow
    // ...
  });
});
```

**Acceptance Criteria**:
- [ ] Multi-component workflows tested end-to-end
- [ ] State changes propagate correctly between components
- [ ] User confirmations work (unsaved changes dialog)
- [ ] View switching updates multiple UI elements
- [ ] Project selection syncs with active view

---

### 7.4 E2E Tests (Real Browser, Real Database)

**Purpose**: Validate complete user journeys through the entire application with real browser interactions and database operations.

**Technology**: Playwright (for Web)

**Test File Location**: `apps/web/e2e/views.spec.ts`

**Environment**: Tests run against local Supabase instance (same as service integration tests)

**Critical User Journeys to Automate**:

#### Journey 1: View Creation Flow
```typescript
import { test, expect } from '@playwright/test';

test.describe('View Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reset database and create test user
    await resetDatabase();
    await signInTestUser(page, 'testuser@example.com');
  });

  test('user creates new view with custom configuration', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');

    // Wait for app to load
    await expect(page.locator('[data-testid="task-hub"]')).toBeVisible();

    // 1. Click "Create View" button
    await page.click('[aria-label="Create new view"]');

    // 2. Fill in view form
    await page.fill('[name="viewName"]', 'My Work Projects');
    await page.click('[value="list"]'); // Select list type
    await page.check('[data-project-id="work-project"]'); // Select work project
    await page.selectOption('[name="groupBy"]', 'project');

    // 3. Submit form
    await page.click('button:has-text("Create")');

    // 4. Verify view appears in tabs
    await expect(page.locator('text=My Work Projects')).toBeVisible();

    // 5. Verify view is active
    await expect(page.locator('[data-view-id] >> text=My Work Projects')).toHaveClass(/active/);

    // 6. Verify task list updates with grouping
    await expect(page.locator('[data-testid="task-group-header"]')).toBeVisible();

    // 7. Reload page and verify view persists
    await page.reload();
    await expect(page.locator('text=My Work Projects')).toBeVisible();
  });

  test('switches between views and sees correct tasks', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Create two views with different project filters
    // ... (view creation steps)

    // Switch to first view
    await page.click('text=Work Projects');
    await expect(page.locator('[data-project="work"]')).toBeVisible();
    await expect(page.locator('[data-project="personal"]')).not.toBeVisible();

    // Switch to second view
    await page.click('text=Personal');
    await expect(page.locator('[data-project="personal"]')).toBeVisible();
    await expect(page.locator('[data-project="work"]')).not.toBeVisible();
  });
});
```

#### Journey 2: Kanban Workflow
```typescript
test.describe('Kanban View Workflow', () => {
  test('drags task to different status column and persists change', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Switch to Kanban view
    await page.click('text=Bug Tracker'); // Assume this is a Kanban view

    // Verify Kanban columns render
    await expect(page.locator('[data-column="To Do"]')).toBeVisible();
    await expect(page.locator('[data-column="In Progress"]')).toBeVisible();
    await expect(page.locator('[data-column="Done"]')).toBeVisible();

    // Find task in "To Do" column
    const task = page.locator('[data-task-id="task-1"]');
    await expect(task).toBeVisible();

    // Drag task to "In Progress" column
    const inProgressColumn = page.locator('[data-column="In Progress"]');
    await task.dragTo(inProgressColumn);

    // Verify task moved
    await expect(inProgressColumn.locator('[data-task-id="task-1"]')).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(inProgressColumn.locator('[data-task-id="task-1"]')).toBeVisible();
  });
});
```

#### Journey 3: Multi-Project View
```typescript
test.describe('Multi-Project View', () => {
  test('creates view from multi-project selection', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Select multiple projects (Cmd+click)
    await page.click('[data-project-id="proj-1"]', { modifiers: ['Meta'] });
    await page.click('[data-project-id="proj-2"]', { modifiers: ['Meta'] });

    // Verify both projects selected
    await expect(page.locator('[data-project-id="proj-1"][aria-selected="true"]')).toBeVisible();
    await expect(page.locator('[data-project-id="proj-2"][aria-selected="true"]')).toBeVisible();

    // Create view from selection
    await page.click('[aria-label="Create new view"]');
    await page.fill('[name="viewName"]', 'Combined Work');
    await page.click('button:has-text("Create")');

    // Verify view tab appears
    await expect(page.locator('text=Combined Work')).toBeVisible();

    // Switch to different projects
    await page.click('[data-project-id="proj-3"]');
    await expect(page.locator('[data-project-id="proj-1"][aria-selected="true"]')).not.toBeVisible();

    // Return to saved view
    await page.click('text=Combined Work');

    // Verify projects re-selected
    await expect(page.locator('[data-project-id="proj-1"][aria-selected="true"]')).toBeVisible();
    await expect(page.locator('[data-project-id="proj-2"][aria-selected="true"]')).toBeVisible();
  });
});
```

**Acceptance Criteria**:
- [ ] E2E tests run in real browser (Chromium, Firefox, WebKit)
- [ ] Tests use real Supabase database (reset before each test)
- [ ] Critical user journeys pass consistently
- [ ] Tests verify persistence across page reloads
- [ ] Tests run in CI/CD pipeline before deployment
- [ ] Screenshots/videos captured on test failures

---

## Testing Summary (Pyramid Structure)

```
        ┌──────────────────┐
        │  E2E Tests (3)   │  ← Few, comprehensive, slow
        │  Playwright      │
        ├──────────────────┤
        │  Integration (5) │  ← Moderate, workflow-focused
        │  Multi-component │
        ├──────────────────┤
        │  Component (10+) │  ← More tests, UI-focused
        │  Mocked Hooks    │
        ├──────────────────┤
        │  Hook Tests (5)  │  ← More tests, state-focused
        │  Mocked Services │
        ├──────────────────┤
        │  Service (20+)   │  ← Many, fast, database-focused
        │  Live Supabase   │  ← ALREADY COMPLETE ✅
        └──────────────────┘
```

**Definition of Done for Views Feature**:
- [x] ✅ Service layer integration tests passing (COMPLETE)
- [ ] Hook unit tests passing with >90% coverage
- [ ] Component tests passing with >85% coverage
- [ ] Integration tests covering critical workflows
- [ ] E2E tests passing for all user journeys
- [ ] All tests run in CI/CD pipeline
- [ ] Zero test warnings or flaky tests

---

## Phase 8: Documentation & Polish

### 8.1 User-Facing Documentation

**Location**: `docs/user-guide/views.md` (new file)

**Contents**:
- What are views and why use them
- How to create a view
- Understanding view types (List vs. Kanban)
- Tips for organizing views effectively
- Keyboard shortcuts reference

---

### 8.2 Component Documentation

**Add JSDoc comments to all components**:
```typescript
/**
 * SavedViews component displays a horizontal tab bar of user-created views.
 * Allows switching between views, creating new views, and managing existing views.
 *
 * @example
 * ```tsx
 * <SavedViews
 *   userId={currentUser.id}
 *   activeViewId={activeView?.view_id}
 *   onViewChange={handleViewChange}
 *   onCreateView={openCreateDialog}
 * />
 * ```
 */
```

---

### 8.3 Accessibility Audit

**WCAG 2.1 AA Compliance Checklist**:
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible and clear
- [ ] Screen reader announcements for view switching
- [ ] Color contrast meets 4.5:1 ratio
- [ ] ARIA labels on icon-only buttons
- [ ] Tab order is logical and intuitive
- [ ] Dialogs trap focus appropriately
- [ ] Error messages associated with form fields

---

### 8.4 Visual Polish

**Design Review Checklist**:
- [ ] Tab styling matches design system
- [ ] Active state is visually distinct
- [ ] Hover states provide feedback
- [ ] Loading states use skeleton UI
- [ ] Empty states have helpful messaging
- [ ] Animations are smooth (60fps)
- [ ] Mobile responsive design implemented
- [ ] Dark mode fully supported

---

## Implementation Timeline

### Week 1: Core Components
- Day 1-2: SavedViews component
- Day 3-4: CreateViewDialog and UpdateViewDialog
- Day 5: TaskHub integration

### Week 2: List View & Integration
- Day 1-3: TaskList grouping and sorting
- Day 4-5: ProjectsPanel integration and testing

### Week 3: Kanban View
- Day 1-3: KanbanView component with drag-and-drop
- Day 4-5: Kanban testing and refinement

### Week 4: Advanced Features & Polish
- Day 1-2: View configuration panel
- Day 3: Performance optimization
- Day 4-5: Testing, documentation, accessibility

---

## Success Metrics

**Technical Metrics**:
- All view operations complete in <100ms
- Task list renders 1000 tasks in <500ms
- 100% test coverage for view-related code
- Zero accessibility violations in audit

**User Experience Metrics**:
- View switching feels instant (<100ms perceived)
- Users can create view in <30 seconds
- Keyboard navigation fully functional
- Mobile experience is touch-optimized

---

## Risk Mitigation

### Technical Risks

**Risk**: Complex state management between views and UI
**Mitigation**: Use controlled components with clear data flow; extensive integration testing

**Risk**: Performance degradation with large task lists
**Mitigation**: Implement virtualization early; benchmark with 5000+ task dataset

**Risk**: Drag-and-drop conflicts with view switching
**Mitigation**: Clear DND state on view change; test edge cases thoroughly

### UX Risks

**Risk**: Users confused by difference between views and projects
**Mitigation**: Clear onboarding tooltips; user guide documentation

**Risk**: Unsaved changes lead to data loss
**Mitigation**: Prominent visual indicators; confirmation dialogs before destructive actions

**Risk**: Too many views create clutter
**Mitigation**: View organization features (folders, favorites) in Phase 2

---

## Future Enhancements (Post-V1)

1. **View Templates**: Pre-built views for common workflows (GTD, Eisenhower Matrix)
2. **View Sharing**: Share view configurations with team members
3. **Advanced Filters**: Complex filtering with AND/OR logic, saved filter sets
4. **View Folders**: Organize views into collapsible folders
5. **View Permissions**: Role-based access for shared project views
6. **View Analytics**: Track most-used views, suggest optimizations
7. **Quick Filters**: Temporary filters that don't modify saved view
8. **View Presets**: Industry-specific view templates (software dev, marketing, etc.)

---

## Related Documentation

- **Views Feature Details**: `docs/features/views/views-details.md`
- **Project Overview**: `docs/project-wide-context/project-overview.md`
- **Technical Guide**: `docs/project-wide-context/technical-guide.md`
- **Golden Path Architecture**: `docs/project-wide-context/golden-path.md`
- **Testing Strategy**: `docs/project-wide-context/testing-strategy.md`

---

## Sign-off Checklist

Before marking Views feature as complete:

- [ ] All Phase 1-4 components implemented
- [ ] Unit tests written and passing (>90% coverage)
- [ ] Integration tests cover critical workflows
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Performance benchmarks met
- [ ] User documentation written
- [ ] Code review completed
- [ ] Design review approved
- [ ] QA testing completed
- [ ] Feature demo presented to stakeholders
