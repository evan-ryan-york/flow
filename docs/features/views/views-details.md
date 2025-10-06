# Views

## Overview

A **view** is a saved snapshot of your current workspace configuration. Think of it as taking a picture of your app setup that you can return to at any time. Views enable users to save and switch between different task list configurations instantly.

Each view captures the current UI state including:

- **Selected Projects**: Which projects are currently visible in the Task Hub
- **Task Grouping**: How tasks are grouped (e.g., by project, due date, status, assignee, or none)
- **Sort Order**: How tasks are sorted (by due date, created date, name, or status)
- **View Type**: Whether the view displays as a List or Kanban board

**Key Concept**: When creating a view, you simply give it a name. The view automatically captures whatever is currently on screen - the selected projects, grouping, sorting, and layout type. There are no additional settings to configure.

## Core Philosophy

Views embody the project's **"Projects as Filters, Not Silos"** philosophy by allowing users to create multiple filtered perspectives of their tasks. Rather than forcing users to navigate into isolated project containers, views enable flexible, multi-project contexts that reflect the fluid nature of modern work.

## Purpose & Use Cases

Views allow users to quickly switch between different workspace configurations without manually adjusting settings each time. Common use cases include:

### Workflow-Based Views
- **"Planning View"**: All tasks grouped by due date, showing only incomplete tasks
- **"Execution View"**: Today's tasks across all projects, ungrouped for rapid completion
- **"Review View"**: Completed tasks from the past week, grouped by project

### Context-Based Views
- **"Work Projects"**: Combined view of "Marketing" and "Product Development" projects
- **"Personal Life"**: Groceries, home maintenance, and personal projects in one view
- **"Team Sprint"**: Shared project view with tasks grouped by assignee

### Specialized Views
- **"Bugs Kanban"**: Bug tracking project displayed as a Kanban board
- **"High Priority Only"**: Filtered view showing only critical tasks across all projects
- **"This Week"**: Tasks due within 7 days, sorted by due date

## View Properties (Database Schema)

Based on the implemented database schema in `supabase/migrations/20250922000000_phase3_and_phase4_tables.sql`:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `view_id` | UUID | Yes | Unique identifier (Primary Key) |
| `user_id` | UUID | Yes | Owner of the view (Foreign Key to profiles) |
| `view_name` | TEXT | Yes | User-defined name for the view |
| `view_type` | TEXT | Yes | Display mode: `'list'` or `'kanban'` |
| `config` | JSONB | Yes | Flexible configuration object storing all view settings |
| `created_at` | TIMESTAMPTZ | Auto | Timestamp of view creation |
| `updated_at` | TIMESTAMPTZ | Auto | Timestamp of last modification |

### Config Object Structure

The `config` JSONB field stores the view configuration as a snapshot:

```json
{
  "projectIds": ["uuid-1", "uuid-2"],
  "groupBy": "project" | "due_date" | "status" | "assigned_to" | undefined,
  "sortBy": "due_date" | "created_at" | "name" | "status",
  "visibleProperties": []
}
```

**Current Implementation**: The config captures the workspace state at the moment of view creation. Users cannot configure these settings manually - they are automatically captured from the current UI state.

## Technical Implementation

### Data Models (Zod Schema)

From `packages/models/view.ts`:

```typescript
export const ViewSchema = z.object({
  view_id: z.string().uuid(),
  user_id: z.string().uuid(),
  view_name: z.string(),
  view_type: z.enum(['list', 'kanban']),
  config: z.object({
    projectIds: z.array(z.string().uuid()),
    groupBy: z.string().nullable(),
    sortBy: z.string(),
    visibleProperties: z.array(z.string())
  }),
  created_at: z.string(),
  updated_at: z.string()
});
```

### Service Layer

From `packages/data/services/viewService.ts`:

**Core Functions:**
- `getViewsForUser(userId)` - Fetch all views owned by a user
- `getViewById(viewId)` - Retrieve a specific view with validation
- `createView(viewData)` - Create a new view with automatic user association
- `updateView(viewId, updates)` - Modify view name, type, or config
- `deleteView(viewId)` - Remove a view (with RLS enforcement)

**Example Service Function:**
```typescript
export const createView = async (viewData: CreateViewInput): Promise<View> => {
  const { data, error } = await supabase
    .from('views')
    .insert({
      user_id: viewData.userId,
      view_name: viewData.viewName,
      view_type: viewData.viewType,
      config: viewData.config
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create view: ${error.message}`);

  return ViewSchema.parse(data); // Zod validation ensures type safety
};
```

### React Hook Layer

From `packages/data/hooks/useView.ts`:

**Available Hooks:**
- `useViews(userId)` - Query hook for fetching all user views (5min stale time)
- `useView(viewId)` - Query hook for a single view (5min stale time)
- `useCreateView()` - Mutation hook for creating views with cache invalidation
- `useUpdateView()` - Mutation hook for updating views with optimistic updates
- `useDeleteView()` - Mutation hook for deleting views with cache cleanup

**Example Hook Usage:**
```typescript
// In a React component
const { data: views, isLoading } = useViews(userId);
const createView = useCreateView();

const handleCreateView = () => {
  createView.mutate({
    userId: currentUser.id,
    viewName: "My To-Dos",
    viewType: "list",
    config: {
      projectIds: ["work-id", "side-hustle-id"],
      groupBy: "project",
      sortBy: "dueDate",
      visibleProperties: []
    }
  });
};
```

## UI Integration (Three-Column Layout)

### Column 2: Bottom Row - Saved Views

From `docs/project-wide-context/project-overview.md` Section 3:

> **Bottom Row: Saved Views**
> - This is the personalization layer. A user can save a specific combination of filters and display settings as a "View".
> - **User Flow:** A user selects the "Work" and "Side Hustle" projects in Column 1. They then choose to group the tasks by "Project" and display them as a "List". They can click a "Save View" button and name it "My To-Dos".
> - This row then displays tabs for each saved view (e.g., `[All Tasks]`, `[My To-Dos]`, `[Bugs Kanban]`, `[Groceries]`). Clicking a tab instantly re-configures the Task View.

### Component Integration

Views integrate with the Task Hub components:

1. **SavedViews Component** - Displays view tabs and manages view selection
2. **TaskView Component** - Renders tasks according to the active view's configuration
3. **ProjectsPanel Component** - Syncs with view's `projectIds` for multi-select state

## Row-Level Security (RLS)

From `supabase/migrations/20250922000000_phase3_and_phase4_tables.sql`:

```sql
-- Users can only read their own views
CREATE POLICY "Users can read their own views"
  ON views FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own views
CREATE POLICY "Users can create their own views"
  ON views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own views
CREATE POLICY "Users can update their own views"
  ON views FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own views
CREATE POLICY "Users can delete their own views"
  ON views FOR DELETE
  USING (auth.uid() = user_id);
```

**Security Guarantees:**
- Users can only access, modify, and delete their own views
- No cross-user view access (privacy protected)
- Automatic enforcement via Supabase RLS at the database level

## View Types

### List View
- **Display**: Traditional table/list format with configurable columns
- **Grouping**: Support for grouping by project, due date, status, assignee, or custom properties
- **Sorting**: Primary and secondary sort criteria
- **Columns**: Dynamic column visibility based on selected projects' custom properties

### Kanban View
- **Display**: Card-based board with draggable tasks
- **Columns**: Based on a custom "Status" property defined at the project level
- **Drag & Drop**: Tasks can be moved between status columns
- **Grouping**: Tasks within columns can be further grouped by project or assignee

## Key Features

### "Sticky" View Configuration
When a user switches to a different view and returns, the view's complete state is restored:
- Selected projects are re-applied to Column 1 (Projects Panel)
- Task list is filtered, grouped, and sorted according to saved config
- View type (List/Kanban) is restored
- Default project for new tasks is set from view's config

### Default Views
- **"All Tasks" View**: Every user has a default view showing all their tasks regardless of project
- **Auto-Created**: The system creates this view automatically on user registration
- **Non-Deletable**: Users cannot delete the "All Tasks" view to ensure a baseline workspace

### View Switching Performance
- **Instant UI Updates**: Views leverage TanStack Query's caching for immediate tab switching
- **Optimistic Updates**: UI updates immediately when creating/updating views, with background sync
- **Stale Time**: 5-minute stale time balances performance with data freshness

## Future Enhancements (Out of Scope for V1)

From `docs/project-wide-context/project-overview.md` Section 6:

- **View Sharing**: Allow users to share view configurations with team members
- **View Templates**: Pre-built view templates for common use cases (GTD, Eisenhower Matrix, etc.)
- **Advanced Filters**: Complex filtering with AND/OR logic, date ranges, custom property filters
- **View Permissions**: Role-based access control for shared project views
- **View Analytics**: Track which views are used most frequently for UX optimization

## Related Documentation

- **Database Schema**: `supabase/migrations/20250922000000_phase3_and_phase4_tables.sql`
- **Data Models**: `packages/models/view.ts`
- **Service Layer**: `packages/data/services/viewService.ts`
- **Hooks**: `packages/data/hooks/useView.ts`
- **Project Overview**: `docs/project-wide-context/project-overview.md` (Section 3)
- **Testing Strategy**: `docs/project-wide-context/testing-strategy.md` (Phase 1.A)

## Testing Coverage

Views have comprehensive test coverage following the project's testing strategy:

### Service Integration Tests
- ✅ `viewService.test.ts` - Tests against live Supabase instance
- ✅ CRUD operations (create, read, update, delete)
- ✅ RLS policy validation (cross-user access prevention)
- ✅ JSON config validation with Zod schemas

### Hook Unit Tests
- ✅ `useView.test.ts` - Isolated testing with mocked services
- ✅ Loading, success, and error states
- ✅ Cache invalidation on mutations
- ✅ Optimistic updates for better UX
