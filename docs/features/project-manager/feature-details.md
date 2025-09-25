# Project Manager Feature - Column 1 Navigation Panel

**Feature Status:** ✅ IMPLEMENTED & FUNCTIONAL (as of 2025-09-25)
**Component Location:** `packages/ui/components/custom/ProjectsPanel.tsx`
**Target Platforms:** Web, iOS, Android, Desktop
**Dependencies:** Authentication system, Project services, Project hooks

## Overview

The Project Manager implements **Column 1** of the three-column layout as described in the project overview. This is a persistent navigation sidebar that allows users to filter their entire task management experience by project context. It serves as the primary organizational structure for the application.

## Core Functionality

### 1. Default "General" Project Creation

**Requirement:** Every user must have a default "General" project created automatically when they sign up.

**Implementation Details:**
- **Database Trigger Integration:** Extend the existing `create_profile_for_new_user()` trigger function to also create a "General" project
- **Project Properties:**
  - `project_name`: "General" (non-editable)
  - `owner_id`: The new user's ID
  - `is_default`: `true` (new boolean field to prevent deletion)
  - `created_at`: Current timestamp
- **Position:** Always appears at the top of the project list
- **Behavior:** Cannot be deleted, cannot be renamed, always selected by default

### 2. Project List Display

**Visual Design:**
- Clean, minimal list design with consistent spacing
- Each project item shows:
  - Project name (truncated if too long)
  - Visual indicator if selected (background color, border, or checkmark)
  - Project color indicator (small colored circle/square)
- Scrollable list for users with many projects
- Empty state handling (should never occur due to General project)

**Interaction Patterns:**
- **Single Click:** Select/deselect individual project (filters Task Hub to show only tasks from that project)
- **Ctrl/Cmd + Click:** Multi-select projects (shows combined tasks from all selected projects)
- **Visual Feedback:** Clear indication of selected state(s)
- **Keyboard Navigation:** Arrow keys to navigate, Space/Enter to select

### 3. Add New Project Functionality

**UI Elements:**
- **"+ Add Project" Button:** Prominently placed (likely at bottom of project list)
- **Inline Creation Mode:** Click button transforms into an input field
- **Input Validation:**
  - Project name required (1-50 characters)
  - No duplicate names for the same user
  - Trim whitespace, reject empty strings

**User Flow:**
1. User clicks "+ Add Project" button
2. Button transforms into text input field with placeholder "Project name..."
3. User types project name and presses Enter (or clicks save icon)
4. Project is created and immediately appears in the list
5. Input field returns to "+ Add Project" button state
6. New project is automatically selected

**Error Handling:**
- Invalid names show inline error message
- Network errors show toast notification with retry option
- Optimistic UI updates with rollback on failure

### 4. Project Management Actions

**Context Menu/Actions (Right-click or three-dot menu):**
- **Rename Project:** Inline editing (except for "General" project)
- **Change Project Color:** Color picker or predefined palette
- **Delete Project:** Confirmation dialog with cascade options
  - Warning if project has tasks
  - Option to reassign tasks to another project
  - Cannot delete "General" project

**Drag and Drop (Future Enhancement):**
- Reorder projects in the list (personal preference only)
- Drag tasks from Task Hub onto projects to reassign

## Technical Specifications

### Database Schema Updates

**Projects Table Modifications:**
```sql
-- Add new columns to existing projects table
ALTER TABLE projects ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN project_color VARCHAR(7) DEFAULT '#3B82F6'; -- Blue hex color
ALTER TABLE projects ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update the create_profile_for_new_user trigger
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');

  -- Create default "General" project for new user
  INSERT INTO projects (project_name, owner_id, is_default, project_color, display_order)
  VALUES ('General', NEW.id, TRUE, '#6B7280', 0); -- Gray color for General

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Service Layer Functions

**Required Functions in `packages/data/services/projectService.ts`:**

```typescript
// Get all projects for a user (already exists, verify it orders correctly)
export const getProjectsForUser = async (userId: string): Promise<Project[]>

// Create a new project
export const createProject = async (data: {
  projectName: string;
  userId: string;
  projectColor?: string;
}): Promise<Project>

// Update project (name, color, order)
export const updateProject = async (projectId: string, data: {
  projectName?: string;
  projectColor?: string;
  displayOrder?: number;
}): Promise<Project>

// Delete project with cascade handling
export const deleteProject = async (projectId: string): Promise<void>

// Reassign tasks when deleting a project
export const reassignProjectTasks = async (
  fromProjectId: string,
  toProjectId: string
): Promise<void>
```

### Hook Layer Functions

**Required Hooks in `packages/data/hooks/useProject.ts`:**

```typescript
// Get user's projects (with General always first)
export const useUserProjects = (userId: string)

// Create project mutation
export const useCreateProject = ()

// Update project mutation
export const useUpdateProject = ()

// Delete project mutation
export const useDeleteProject = ()

// Get default "General" project for user
export const useDefaultProject = (userId: string)
```

### Component Structure

**Main Component:** `packages/ui/components/custom/ProjectsPanel.tsx`

```typescript
interface ProjectsPanelProps {
  userId: string;
  selectedProjectIds: string[];
  onProjectSelectionChange: (projectIds: string[]) => void;
  className?: string;
}

export function ProjectsPanel({
  userId,
  selectedProjectIds,
  onProjectSelectionChange,
  className
}: ProjectsPanelProps)
```

**Child Components:**
- `ProjectItem.tsx` - Individual project list item with selection state
- `AddProjectButton.tsx` - Button that transforms into input field
- `ProjectContextMenu.tsx` - Right-click actions menu
- `DeleteProjectDialog.tsx` - Confirmation dialog for project deletion

## State Management

### Selection State
- **Multiple Selection Support:** Array of selected project IDs
- **Default State:** General project selected by default
- **Persistence:** Selected projects remembered in session (not persisted to database)
- **State Lifting:** Selection state managed by parent `ThreeColumnLayout` component

### UI State
- **Add Mode:** Boolean flag for inline project creation
- **Loading States:** Per-project loading indicators for actions
- **Error States:** Inline error messages for validation failures
- **Optimistic Updates:** Immediate UI feedback with rollback capability

## Integration Points

### Authentication Integration
- **Auto-Selection:** When user logs in, automatically select their "General" project
- **Profile Creation:** Extend auth service to ensure "General" project creation
- **Session Management:** Clear selection state on logout

### Task Hub Integration
- **Filter Communication:** Pass selected project IDs to Task Hub component
- **Real-time Updates:** When projects change, notify Task Hub to refresh
- **Empty States:** Handle case when selected projects have no tasks

### Calendar Integration
- **Project Context:** Filter time blocks and associated tasks by selected projects
- **Color Coding:** Use project colors in calendar display
- **Task Assignment:** When creating tasks from calendar, use selected project as default

## Testing Requirements

### Unit Tests

**Component Tests (`ProjectsPanel.test.tsx`):**
- ✅ Renders project list correctly
- ✅ Shows "General" project at top of list
- ✅ Handles single project selection
- ✅ Handles multi-project selection (Ctrl/Cmd+click)
- ✅ Shows selected state visually
- ✅ Displays add project button
- ✅ Transforms to input mode when add button clicked
- ✅ Validates project name input
- ✅ Shows error states appropriately
- ✅ Calls onProjectSelectionChange with correct data

**Hook Tests (`useProject.test.ts`):**
- ✅ useUserProjects returns projects with General first
- ✅ useCreateProject creates project and invalidates cache
- ✅ useUpdateProject updates project properties
- ✅ useDeleteProject removes project and handles cascade
- ✅ All hooks handle loading and error states
- ✅ Cache invalidation works correctly

### Integration Tests

**Service Tests (`projectService.test.ts`):**
- ✅ getProjectsForUser returns user's projects only (RLS test)
- ✅ createProject creates with proper ownership
- ✅ updateProject only allows owner to modify (RLS test)
- ✅ deleteProject prevents deleting General project
- ✅ deleteProject handles task reassignment properly
- ✅ reassignProjectTasks moves tasks correctly

**Database Tests:**
- ✅ create_profile_for_new_user trigger creates General project
- ✅ General project cannot be deleted (constraint test)
- ✅ Projects table accepts all required fields
- ✅ RLS policies prevent unauthorized access

### End-to-End Tests

**Critical User Journeys:**
1. **New User Flow:**
   - Sign up → General project exists → General project selected by default
2. **Project Creation:**
   - Click add button → Type name → Press enter → Project appears and is selected
3. **Project Selection:**
   - Click project → Task Hub filters to show only that project's tasks
   - Ctrl+click multiple projects → Task Hub shows combined tasks
4. **Project Management:**
   - Right-click project → Rename → Verify name change
   - Delete project with tasks → Reassign to General → Verify tasks moved

## Acceptance Criteria

### Must-Have Features
- [ ] **General Project Auto-Creation:** Every new user has a "General" project created automatically
- [ ] **Project List Display:** Shows all user's projects with "General" always at top
- [ ] **Single Selection:** Click project to select it (filter Task Hub)
- [ ] **Multi-Selection:** Ctrl/Cmd+click to select multiple projects
- [ ] **Visual Selection State:** Clear indication of which projects are selected
- [ ] **Add Project:** Inline project creation with validation
- [ ] **Project Management:** Rename and delete projects (except General)
- [ ] **Error Handling:** Graceful handling of network errors and validation failures
- [ ] **Accessibility:** Keyboard navigation and screen reader support

### Quality Gates
- [ ] **Zero TypeScript Errors:** All components fully typed
- [ ] **Test Coverage:** 100% of service functions and hooks tested
- [ ] **Cross-Platform:** Works identically on Web, iOS, Android, Desktop
- [ ] **Performance:** Project list renders in <100ms for up to 100 projects
- [ ] **Responsive Design:** Adapts to different screen sizes appropriately
- [ ] **Design System:** Uses only shadcn/ui components and design tokens

### Integration Requirements
- [ ] **Authentication Integration:** Works with existing auth system
- [ ] **Database Integration:** All CRUD operations work with Supabase
- [ ] **Real-time Updates:** Project changes appear immediately for collaborators
- [ ] **Task Hub Communication:** Selection changes properly filter Task Hub
- [ ] **State Management:** Integrates with parent component state

### User Experience Standards
- [ ] **Responsive Interactions:** All clicks/taps provide immediate feedback
- [ ] **Loading States:** Clear loading indicators for all async operations
- [ ] **Error Recovery:** Users can retry failed operations
- [ ] **Intuitive Interface:** No explanation needed for basic operations
- [ ] **Consistent Patterns:** Follows established app interaction patterns

## Implementation Notes

### Development Approach
1. **Database First:** Implement schema changes and test with migrations
2. **Service Layer:** Build and test all CRUD operations with integration tests
3. **Hook Layer:** Create React hooks with proper caching and error handling
4. **Component Layer:** Build UI components with full TypeScript typing
5. **Integration:** Connect to parent layout and test full functionality
6. **Polish:** Add animations, loading states, and error handling

### Technical Considerations
- **Performance:** Use React.memo for project list items to prevent unnecessary re-renders
- **Accessibility:** Ensure ARIA labels and keyboard navigation work correctly
- **Mobile Adaptation:** Consider touch-friendly sizing and gestures
- **Error Boundaries:** Wrap component in error boundary for graceful failure
- **Optimistic Updates:** Provide immediate UI feedback with rollback capability

### Future Enhancements (Out of Scope)
- Drag and drop reordering of projects
- Project templates for quick setup
- Project archive/unarchive functionality
- Advanced project filtering and search
- Project collaboration status indicators
- Custom project icons in addition to colors

This feature serves as the foundation for all project-based organization in Perfect Task App and must be implemented with high reliability and excellent user experience standards.