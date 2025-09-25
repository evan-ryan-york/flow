# Task Manager Feature Implementation Plan

## Overview
This document provides a step-by-step implementation plan to complete the Task Manager feature, specifically focusing on the enhanced Quick-Add Bar with sticky project behavior and `/in` command functionality.

**Scope**: Task creation and viewing functionality in Column 2 (Task Hub)
**Out of Scope**: Drag-and-drop calendar scheduling functionality (Column 3 interactions)

## Current State Analysis

### ✅ What's Already Built
1. **Database Schema**: Complete tables (tasks, projects, profiles, project_users)
2. **TypeScript Types**: All Zod schemas defined in `packages/models/index.ts`
3. **Backend Services**: Full taskService.ts and projectService.ts implementation
4. **React Hooks**: Complete TanStack Query hooks (useTask.ts, useProject.ts)
5. **UI Components**: TaskQuickAdd, TaskHub, TaskList components exist
6. **shadcn/ui Library**: Complete component library with Input, Button, Popover, Badge, etc.

### ❌ What's Missing
1. **Last-used project tracking** in database and backend
2. **`/in` command parsing logic** in TaskQuickAdd component
3. **Project autocomplete dropdown** UI component
4. **Sticky project behavior** in quick-add form
5. **Visual project chip** display in input field

## Implementation Plan

### Phase 1: Database Schema Update

#### Step 1.1: Add last_used_project_id Column
Create new migration to add user preference tracking:

**File**: `supabase/migrations/[timestamp]_add_last_used_project.sql`
```sql
-- Add last_used_project_id to profiles table
ALTER TABLE profiles
ADD COLUMN last_used_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_last_used_project
ON profiles(last_used_project_id);
```

#### Step 1.2: Update ProfileSchema
**File**: `packages/models/index.ts`
- Add `last_used_project_id: z.string().uuid().nullable().optional()` to ProfileSchema
- Update Profile type export

### Phase 2: Backend Service Updates

#### Step 2.1: Enhance ProfileService
**File**: `packages/data/services/profileService.ts`

Add new functions:
```typescript
export const updateLastUsedProject = async (projectId: string): Promise<void>
export const getLastUsedProject = async (): Promise<string | null>
```

#### Step 2.2: Update TaskService
**File**: `packages/data/services/taskService.ts`

Modify `createTask` function to:
1. Update user's last_used_project_id after successful task creation
2. Call `updateLastUsedProject(taskData.project_id)`

#### Step 2.3: Add Project Search Service
**File**: `packages/data/services/projectService.ts`

Add function:
```typescript
export const searchProjects = async (userId: string, query: string): Promise<Project[]>
```

### Phase 3: Hook Layer Updates

#### Step 3.1: Enhance Profile Hooks
**File**: `packages/data/hooks/useProfile.ts`

Add hooks:
```typescript
export const useLastUsedProject = () => // Get last used project
export const useUpdateLastUsedProject = () => // Update last used project
```

#### Step 3.2: Add Project Search Hook
**File**: `packages/data/hooks/useProject.ts`

Add hook:
```typescript
export const useProjectSearch = (userId: string, query: string, enabled: boolean)
```

### Phase 4: UI Component Development

#### Step 4.1: Create ProjectAutocomplete Component
**File**: `packages/ui/components/custom/ProjectAutocomplete.tsx`

Features:
- Input field with dropdown
- Real-time search with debouncing
- Keyboard navigation (Arrow keys, Enter, Escape)
- Click-to-select functionality
- Loading and empty states

Dependencies:
- `@perfect-task-app/ui` (Input, Popover, Button)
- `@perfect-task-app/data` (useProjectSearch hook)

#### Step 4.2: Create ProjectChip Component
**File**: `packages/ui/components/custom/ProjectChip.tsx`

Features:
- Display selected project name
- Color coding based on project color
- Remove functionality (X button)
- Compact design for inline display

Dependencies:
- `@perfect-task-app/ui` (Badge)

#### Step 4.3: Update TaskQuickAdd Component
**File**: `apps/web/components/TaskQuickAdd.tsx`

Major enhancements:
1. **Text Parsing Logic**:
   - Parse `/in` command from task name
   - Extract project search query
   - Clean task name by removing `/in` portion

2. **State Management**:
   - Add state for parsed project query
   - Track selected project from autocomplete
   - Show/hide autocomplete dropdown

3. **Sticky Project Behavior**:
   - Use `useLastUsedProject` hook
   - Default to last used project on component mount
   - Update last used project on task creation

4. **UI Updates**:
   - Integrate ProjectAutocomplete component
   - Show ProjectChip for selected project
   - Handle input field focus/blur states

### Phase 5: Text Parsing Logic

#### Step 5.1: Create Text Parser Utility
**File**: `packages/ui/lib/textParser.ts`

Functions:
```typescript
interface ParsedTaskInput {
  taskName: string;
  projectQuery?: string;
  hasProjectCommand: boolean;
}

export const parseTaskInput = (input: string): ParsedTaskInput
export const cleanTaskName = (input: string): string
export const extractProjectQuery = (input: string): string | null
```

Logic:
- Detect `/in` command anywhere in text
- Extract text after `/in` as project query
- Clean task name by removing `/in [query]` portion
- Handle edge cases (multiple `/in`, empty queries, etc.)

### Phase 6: Enhanced TaskQuickAdd Implementation

#### Step 6.1: State Management Updates
```typescript
interface TaskQuickAddState {
  taskName: string;
  parsedInput: ParsedTaskInput;
  selectedProject: Project | null;
  showAutocomplete: boolean;
  projectQuery: string;
  lastUsedProjectId: string | null;
}
```

#### Step 6.2: Input Handler Logic
```typescript
const handleInputChange = (value: string) => {
  const parsed = parseTaskInput(value);

  if (parsed.hasProjectCommand) {
    // Show autocomplete dropdown
    setShowAutocomplete(true);
    setProjectQuery(parsed.projectQuery || '');
  } else {
    // Hide autocomplete
    setShowAutocomplete(false);
    setProjectQuery('');
  }

  setTaskName(value);
  setParsedInput(parsed);
};
```

#### Step 6.3: Project Selection Logic
```typescript
const handleProjectSelect = (project: Project) => {
  setSelectedProject(project);
  setShowAutocomplete(false);

  // Update input to show clean task name with project chip
  const cleanName = cleanTaskName(taskName);
  setTaskName(cleanName);
};
```

#### Step 6.4: Form Submission Updates
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const cleanName = cleanTaskName(taskName);
  const projectId = selectedProject?.id || lastUsedProjectId || defaultProjectId;

  await createTaskMutation.mutateAsync({
    name: cleanName,
    project_id: projectId,
    // ... other properties
  });

  // Reset form but keep sticky project behavior
  setTaskName('');
  setSelectedProject(null);
  // Note: lastUsedProjectId is automatically updated by backend
};
```

### Phase 7: UI/UX Enhancements

#### Step 7.1: Visual Polish
- Smooth animations for autocomplete dropdown
- Proper z-index management for overlays
- Loading states during project search
- Error handling for failed project lookups

#### Step 7.2: Keyboard UX
- Tab to select first autocomplete result
- Enter to confirm selection
- Escape to close autocomplete
- Arrow keys for navigation

#### Step 7.3: Mobile Responsiveness
- Touch-friendly autocomplete dropdown
- Appropriate sizing for mobile input fields
- Optimized project chip display

### Phase 8: Comprehensive Testing Strategy

Following the project's Testing Pyramid strategy (Unit → Integration → E2E), we will build a robust test suite that covers all layers from individual functions to complete user workflows.

#### Step 8.1: Service Layer Integration Tests (Critical Foundation)

These tests run against a live, local Supabase instance to validate database operations and RLS policies.

**Environment Setup**:
- Use Jest as test runner
- Run against clean, ephemeral database (`supabase db reset` before each test run)
- Test with real Supabase client and RLS policies

**Files to create**:

```typescript
// packages/data/services/__tests__/profileService.integration.test.ts
// Test new profile service functions against live database
describe('profileService Integration Tests', () => {
  beforeEach(async () => {
    // Reset local DB and seed with test users
    // Authenticate supabase client as test user
  });

  it('updateLastUsedProject should persist to database', async () => {
    await profileService.updateLastUsedProject('project-123');
    const result = await profileService.getLastUsedProject();
    expect(result).toBe('project-123');
  });

  it('getLastUsedProject should return null for new users', async () => {
    const result = await profileService.getLastUsedProject();
    expect(result).toBeNull();
  });

  it('should handle non-existent project IDs gracefully', async () => {
    await expect(
      profileService.updateLastUsedProject('non-existent-id')
    ).rejects.toThrow(); // Or handle gracefully based on implementation
  });
});
```

```typescript
// packages/data/services/__tests__/taskService.integration.test.ts
// Test enhanced task creation with last-used project updates
describe('taskService Integration Tests', () => {
  it('createTask should update user\'s last_used_project_id', async () => {
    const taskData = {
      name: 'Test Task',
      project_id: 'project-456',
      assigned_to: testUser.id
    };

    await taskService.createTask(taskData);

    // Verify task was created
    const tasks = await taskService.getTasksForUser(testUser.id);
    expect(tasks).toHaveLength(1);

    // Verify last_used_project_id was updated
    const lastUsedProject = await profileService.getLastUsedProject();
    expect(lastUsedProject).toBe('project-456');
  });

  it('should enforce RLS policies for task creation', async () => {
    // Authenticate as User A, try to create task for User B's project
    // Assert that operation fails or is filtered by RLS
  });
});
```

```typescript
// packages/data/services/__tests__/projectService.integration.test.ts
// Test project search functionality
describe('projectService Integration Tests', () => {
  it('searchProjects should return matching projects for user', async () => {
    // Create projects: "Marketing Campaign", "Market Research", "Sales"
    const results = await projectService.searchProjects(testUser.id, 'mark');
    expect(results).toHaveLength(2);
    expect(results.map(p => p.name)).toContain('Marketing Campaign');
    expect(results.map(p => p.name)).toContain('Market Research');
  });

  it('searchProjects should respect RLS and only return user\'s projects', async () => {
    // Create projects for User A and User B
    // Search as User A, verify only User A's projects are returned
  });

  it('searchProjects should handle empty query gracefully', async () => {
    const results = await projectService.searchProjects(testUser.id, '');
    expect(Array.isArray(results)).toBe(true);
  });
});
```

#### Step 8.2: Hook Unit Tests (Mocked Service Layer)

Test hook state management logic in isolation by mocking the service layer.

**Files to create/update**:

```typescript
// packages/data/hooks/__tests__/useProfile.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useLastUsedProject, useUpdateLastUsedProject } from '../useProfile';
import { profileService } from '../../services/profileService';

// Mock the entire service layer
jest.mock('../../services/profileService');

describe('useLastUsedProject', () => {
  it('should return loading state initially and then return data', async () => {
    profileService.getLastUsedProject.mockResolvedValue('project-123');

    const { result } = renderHook(() => useLastUsedProject());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('project-123');
  });

  it('should handle null last used project', async () => {
    profileService.getLastUsedProject.mockResolvedValue(null);

    const { result } = renderHook(() => useLastUsedProject());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('should handle service errors gracefully', async () => {
    profileService.getLastUsedProject.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useLastUsedProject());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error.message).toBe('Network error');
  });
});

describe('useUpdateLastUsedProject', () => {
  it('should call service function with correct parameters', async () => {
    profileService.updateLastUsedProject.mockResolvedValue();

    const { result } = renderHook(() => useUpdateLastUsedProject());

    await result.current.mutateAsync('project-456');

    expect(profileService.updateLastUsedProject).toHaveBeenCalledWith('project-456');
  });

  it('should handle mutation errors', async () => {
    profileService.updateLastUsedProject.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useUpdateLastUsedProject());

    await expect(result.current.mutateAsync('project-456')).rejects.toThrow('Update failed');
  });
});
```

```typescript
// packages/data/hooks/__tests__/useProject.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useProjectSearch } from '../useProject';
import { projectService } from '../../services/projectService';

jest.mock('../../services/projectService');

describe('useProjectSearch', () => {
  it('should debounce search queries', async () => {
    const mockProjects = [{ id: 'p1', name: 'Marketing' }];
    projectService.searchProjects.mockResolvedValue(mockProjects);

    const { result, rerender } = renderHook(
      ({ query }) => useProjectSearch('user-123', query, true),
      { initialProps: { query: '' } }
    );

    // Rapidly change query
    rerender({ query: 'm' });
    rerender({ query: 'ma' });
    rerender({ query: 'mar' });

    // Wait for debounce delay
    await waitFor(() =>
      expect(projectService.searchProjects).toHaveBeenCalledTimes(1),
      { timeout: 500 }
    );
    expect(projectService.searchProjects).toHaveBeenCalledWith('user-123', 'mar');
  });

  it('should not search when disabled', async () => {
    const { result } = renderHook(() =>
      useProjectSearch('user-123', 'query', false)
    );

    expect(projectService.searchProjects).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
```

#### Step 8.3: Utility Function Unit Tests

```typescript
// packages/ui/lib/__tests__/textParser.test.ts
import { parseTaskInput, cleanTaskName, extractProjectQuery } from '../textParser';

describe('textParser', () => {
  describe('parseTaskInput', () => {
    it('should parse task without project command', () => {
      const result = parseTaskInput('Buy groceries');
      expect(result).toEqual({
        taskName: 'Buy groceries',
        projectQuery: undefined,
        hasProjectCommand: false
      });
    });

    it('should parse task with /in command', () => {
      const result = parseTaskInput('Buy milk /in groceries');
      expect(result).toEqual({
        taskName: 'Buy milk /in groceries',
        projectQuery: 'groceries',
        hasProjectCommand: true
      });
    });

    it('should handle partial project queries', () => {
      const result = parseTaskInput('Task name /in mark');
      expect(result.projectQuery).toBe('mark');
    });

    it('should handle /in at start of task name', () => {
      const result = parseTaskInput('/in project Task name');
      expect(result).toEqual({
        taskName: '/in project Task name',
        projectQuery: 'project Task name',
        hasProjectCommand: true
      });
    });

    it('should handle multiple /in commands (use first)', () => {
      const result = parseTaskInput('Task /in project1 /in project2');
      expect(result.projectQuery).toBe('project1 /in project2');
    });

    it('should handle empty query after /in', () => {
      const result = parseTaskInput('Task name /in');
      expect(result).toEqual({
        taskName: 'Task name /in',
        projectQuery: '',
        hasProjectCommand: true
      });
    });
  });

  describe('cleanTaskName', () => {
    it('should remove /in command from task name', () => {
      expect(cleanTaskName('Buy milk /in groceries')).toBe('Buy milk');
    });

    it('should trim whitespace after cleaning', () => {
      expect(cleanTaskName('Task name  /in project')).toBe('Task name');
    });

    it('should return original name if no /in command', () => {
      expect(cleanTaskName('Regular task name')).toBe('Regular task name');
    });
  });

  describe('extractProjectQuery', () => {
    it('should extract query after /in', () => {
      expect(extractProjectQuery('Task /in marketing')).toBe('marketing');
    });

    it('should return null if no /in command', () => {
      expect(extractProjectQuery('Regular task')).toBeNull();
    });

    it('should handle empty query', () => {
      expect(extractProjectQuery('Task /in')).toBe('');
    });
  });
});
```

#### Step 8.4: Component Integration Tests

Test components with real behavior but mocked data dependencies.

```typescript
// packages/ui/components/custom/__tests__/ProjectAutocomplete.integration.test.tsx
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { ProjectAutocomplete } from '../ProjectAutocomplete';
import { useProjectSearch } from '@perfect-task-app/data';

// Mock the hook
jest.mock('@perfect-task-app/data', () => ({
  useProjectSearch: jest.fn()
}));

describe('ProjectAutocomplete Integration', () => {
  beforeEach(() => {
    useProjectSearch.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    });
  });

  it('should show loading state during search', async () => {
    useProjectSearch.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    });

    render(
      <ProjectAutocomplete
        query="mar"
        onSelect={jest.fn()}
        userId="user-123"
      />
    );

    expect(screen.getByText('Searching...')).toBeTruthy();
  });

  it('should display search results', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Marketing Campaign', color: '#ff0000' },
      { id: 'p2', name: 'Market Research', color: '#00ff00' }
    ];

    useProjectSearch.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      error: null
    });

    const onSelect = jest.fn();
    render(
      <ProjectAutocomplete
        query="mar"
        onSelect={onSelect}
        userId="user-123"
      />
    );

    expect(screen.getByText('Marketing Campaign')).toBeTruthy();
    expect(screen.getByText('Market Research')).toBeTruthy();

    // Test selection
    fireEvent.press(screen.getByText('Marketing Campaign'));
    expect(onSelect).toHaveBeenCalledWith(mockProjects[0]);
  });

  it('should handle keyboard navigation', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Project 1', color: '#ff0000' },
      { id: 'p2', name: 'Project 2', color: '#00ff00' }
    ];

    useProjectSearch.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      error: null
    });

    const onSelect = jest.fn();
    render(
      <ProjectAutocomplete
        query="proj"
        onSelect={onSelect}
        userId="user-123"
      />
    );

    // Simulate arrow down and enter key
    fireEvent(screen.getByTestId('autocomplete-dropdown'), 'onKeyDown', {
      nativeEvent: { key: 'ArrowDown' }
    });
    fireEvent(screen.getByTestId('autocomplete-dropdown'), 'onKeyDown', {
      nativeEvent: { key: 'Enter' }
    });

    expect(onSelect).toHaveBeenCalledWith(mockProjects[0]);
  });

  it('should show empty state when no results', () => {
    useProjectSearch.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    });

    render(
      <ProjectAutocomplete
        query="nonexistent"
        onSelect={jest.fn()}
        userId="user-123"
      />
    );

    expect(screen.getByText('No projects found')).toBeTruthy();
  });

  it('should handle search errors', () => {
    useProjectSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Search failed')
    });

    render(
      <ProjectAutocomplete
        query="test"
        onSelect={jest.fn()}
        userId="user-123"
      />
    );

    expect(screen.getByText('Search failed')).toBeTruthy();
  });
});
```

```typescript
// apps/web/components/__tests__/TaskQuickAdd.integration.test.tsx
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { TaskQuickAdd } from '../TaskQuickAdd';
import { useCreateTask, useLastUsedProject, useProjectSearch } from '@perfect-task-app/data';

// Mock all data hooks
jest.mock('@perfect-task-app/data');

describe('TaskQuickAdd Integration', () => {
  const mockCreateTask = jest.fn();
  const mockUseCreateTask = useCreateTask as jest.MockedFunction<typeof useCreateTask>;
  const mockUseLastUsedProject = useLastUsedProject as jest.MockedFunction<typeof useLastUsedProject>;
  const mockUseProjectSearch = useProjectSearch as jest.MockedFunction<typeof useProjectSearch>;

  beforeEach(() => {
    mockUseCreateTask.mockReturnValue({
      mutateAsync: mockCreateTask,
      isLoading: false,
      error: null
    });

    mockUseLastUsedProject.mockReturnValue({
      data: null,
      isLoading: false
    });

    mockUseProjectSearch.mockReturnValue({
      data: [],
      isLoading: false
    });

    mockCreateTask.mockResolvedValue({ id: 'task-123' });
  });

  it('should create task with basic input', async () => {
    render(<TaskQuickAdd />);

    const input = screen.getByPlaceholderText('Add a task...');
    fireEvent.change(input, { target: { value: 'Buy groceries' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        name: 'Buy groceries',
        project_id: expect.any(String), // Default project
        assigned_to: expect.any(String)
      });
    });

    // Input should be cleared after submission
    expect(input.value).toBe('');
  });

  it('should handle /in command workflow', async () => {
    // Mock project search results
    mockUseProjectSearch.mockReturnValue({
      data: [
        { id: 'proj-1', name: 'Groceries', color: '#ff0000' },
        { id: 'proj-2', name: 'Shopping', color: '#00ff00' }
      ],
      isLoading: false
    });

    render(<TaskQuickAdd />);

    const input = screen.getByPlaceholderText('Add a task...');

    // Type task with /in command
    fireEvent.change(input, { target: { value: 'Buy milk /in groc' } });

    // Should show autocomplete dropdown
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Select project from dropdown
    fireEvent.click(screen.getByText('Groceries'));

    // Should show project chip and clean input
    expect(screen.getByText('Buy milk')).toBeInTheDocument(); // Clean task name
    expect(screen.getByText('Groceries')).toBeInTheDocument(); // Project chip

    // Submit form
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        name: 'Buy milk',
        project_id: 'proj-1',
        assigned_to: expect.any(String)
      });
    });
  });

  it('should use last used project as default', async () => {
    mockUseLastUsedProject.mockReturnValue({
      data: 'last-used-project-id',
      isLoading: false
    });

    render(<TaskQuickAdd />);

    const input = screen.getByPlaceholderText('Add a task...');
    fireEvent.change(input, { target: { value: 'Regular task' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        name: 'Regular task',
        project_id: 'last-used-project-id',
        assigned_to: expect.any(String)
      });
    });
  });

  it('should handle project chip removal', async () => {
    render(<TaskQuickAdd />);

    // Set up state with selected project (simulate /in command flow)
    const input = screen.getByPlaceholderText('Add a task...');
    fireEvent.change(input, { target: { value: 'Task /in project' } });

    // ... (simulate project selection)

    // Click remove button on project chip
    fireEvent.click(screen.getByRole('button', { name: /remove project/i }));

    // Project chip should be removed
    expect(screen.queryByTestId('project-chip')).not.toBeInTheDocument();
  });

  it('should handle keyboard shortcuts', async () => {
    render(<TaskQuickAdd />);

    const input = screen.getByPlaceholderText('Add a task...');
    fireEvent.change(input, { target: { value: 'Quick task' } });

    // Test Enter key submission
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled();
    });
  });
});
```

#### Step 8.5: End-to-End (E2E) Tests

Comprehensive user journey tests that validate the complete feature workflow.

**Technology**: Detox for mobile, Playwright for web
**Environment**: Live local Supabase instance with clean database reset

```typescript
// e2e/task-manager/__tests__/sticky-project-behavior.e2e.test.ts
describe('Sticky Project Behavior E2E', () => {
  beforeEach(async () => {
    // Reset local Supabase database
    await device.reloadReactNative();

    // Sign in test user
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('sign-in-button')).tap();

    // Wait for app to load
    await waitFor(element(by.id('task-quick-add'))).toBeVisible().withTimeout(5000);
  });

  it('should remember last used project across task creations', async () => {
    // Create first task in "Work" project
    await element(by.id('task-input')).typeText('First task /in work');

    // Select "Work" from autocomplete
    await waitFor(element(by.text('Work'))).toBeVisible();
    await element(by.text('Work')).tap();

    // Submit task
    await element(by.id('task-input')).tapReturnKey();

    // Verify task was created
    await waitFor(element(by.text('First task'))).toBeVisible();

    // Create second task (should default to "Work" project)
    await element(by.id('task-input')).typeText('Second task');
    await element(by.id('task-input')).tapReturnKey();

    // Verify second task appears in Work project context
    await waitFor(element(by.text('Second task'))).toBeVisible();

    // Navigate to Work project and verify both tasks are there
    await element(by.text('Work')).tap();
    await expect(element(by.text('First task'))).toBeVisible();
    await expect(element(by.text('Second task'))).toBeVisible();
  });

  it('should update sticky project when new project is selected', async () => {
    // Create task in "Personal" project
    await element(by.id('task-input')).typeText('Personal task /in personal');
    await element(by.text('Personal')).tap();
    await element(by.id('task-input')).tapReturnKey();

    // Create task in "Work" project
    await element(by.id('task-input')).typeText('Work task /in work');
    await element(by.text('Work')).tap();
    await element(by.id('task-input')).tapReturnKey();

    // Next task should default to "Work" (most recent)
    await element(by.id('task-input')).typeText('Default project task');
    await element(by.id('task-input')).tapReturnKey();

    // Verify task was created in Work project
    await element(by.text('Work')).tap();
    await expect(element(by.text('Default project task'))).toBeVisible();
  });
});
```

```typescript
// e2e/task-manager/__tests__/project-autocomplete-workflow.e2e.test.ts
describe('Project Autocomplete Workflow E2E', () => {
  beforeEach(async () => {
    await device.reloadReactNative();

    // Sign in and wait for app
    await signInTestUser();
    await waitFor(element(by.id('task-quick-add'))).toBeVisible();
  });

  it('should complete full /in command workflow', async () => {
    // Type task with /in command
    await element(by.id('task-input')).typeText('Buy groceries /in sho');

    // Autocomplete dropdown should appear
    await waitFor(element(by.id('project-autocomplete'))).toBeVisible();

    // Should show matching projects
    await expect(element(by.text('Shopping'))).toBeVisible();
    await expect(element(by.text('Short-term Goals'))).toBeVisible();

    // Select "Shopping" project
    await element(by.text('Shopping')).tap();

    // Autocomplete should hide
    await waitFor(element(by.id('project-autocomplete'))).not.toBeVisible();

    // Project chip should appear
    await expect(element(by.id('project-chip-shopping'))).toBeVisible();

    // Input should show clean task name
    await expect(element(by.id('task-input'))).toHaveText('Buy groceries');

    // Submit task
    await element(by.id('task-input')).tapReturnKey();

    // Verify task was created in Shopping project
    await element(by.text('Shopping')).tap();
    await expect(element(by.text('Buy groceries'))).toBeVisible();
  });

  it('should handle keyboard navigation in autocomplete', async () => {
    await element(by.id('task-input')).typeText('Task /in proj');

    // Wait for autocomplete
    await waitFor(element(by.id('project-autocomplete'))).toBeVisible();

    // Use arrow keys to navigate (platform-specific implementation)
    await element(by.id('task-input')).sendKeys(['ArrowDown']);
    await element(by.id('task-input')).sendKeys(['Enter']);

    // First project should be selected
    await expect(element(by.id('project-chip'))).toBeVisible();
  });

  it('should handle project chip removal', async () => {
    // Create task with project selection
    await element(by.id('task-input')).typeText('Task /in work');
    await element(by.text('Work')).tap();

    // Verify chip is present
    await expect(element(by.id('project-chip-work'))).toBeVisible();

    // Remove project chip
    await element(by.id('remove-project-chip')).tap();

    // Chip should be gone
    await expect(element(by.id('project-chip-work'))).not.toBeVisible();

    // Input should revert to original text with /in command
    await expect(element(by.id('task-input'))).toHaveText('Task /in work');
  });
});
```

#### Step 8.6: Database Migration Tests

```typescript
// supabase/migrations/__tests__/add_last_used_project.test.ts
describe('Add Last Used Project Migration', () => {
  it('should add last_used_project_id column to profiles table', async () => {
    // Run migration
    await supabase.from('profiles').select('last_used_project_id').limit(1);

    // Should not throw error - column exists
  });

  it('should create proper foreign key constraint', async () => {
    // Test that invalid project IDs are rejected
    await expect(
      supabase.from('profiles')
        .update({ last_used_project_id: 'non-existent-uuid' })
        .eq('id', testUserId)
    ).rejects.toThrow(); // Foreign key constraint violation
  });

  it('should handle project deletion gracefully (SET NULL)', async () => {
    // Create test project and set as last used
    const project = await createTestProject();
    await supabase.from('profiles')
      .update({ last_used_project_id: project.id })
      .eq('id', testUserId);

    // Delete the project
    await supabase.from('projects').delete().eq('id', project.id);

    // last_used_project_id should be set to NULL
    const { data } = await supabase.from('profiles')
      .select('last_used_project_id')
      .eq('id', testUserId)
      .single();

    expect(data.last_used_project_id).toBeNull();
  });
});
```

#### Step 8.7: Performance & Load Testing

```typescript
// packages/data/services/__tests__/performance.test.ts
describe('Performance Tests', () => {
  it('project search should respond within 200ms', async () => {
    const startTime = Date.now();
    await projectService.searchProjects(testUserId, 'marketing');
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200);
  });

  it('should handle concurrent task creation', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      name: `Concurrent Task ${i}`,
      project_id: testProjectId,
      assigned_to: testUserId
    }));

    const startTime = Date.now();
    await Promise.all(tasks.map(task => taskService.createTask(task)));
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(2000); // All 10 tasks within 2 seconds
  });

  it('should handle large project lists in search', async () => {
    // Create 100 test projects
    const projects = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        createTestProject(`Test Project ${i}`)
      )
    );

    const startTime = Date.now();
    const results = await projectService.searchProjects(testUserId, 'Test');
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(300);
    expect(results.length).toBeLessThanOrEqual(20); // Should limit results
  });
});
```

### Phase 9: Documentation Updates

#### Step 9.1: Update Technical Documentation
- Add new database schema to technical-guide.md
- Document new service functions and hooks
- Update component API documentation

#### Step 9.2: User Documentation
- Create usage examples for `/in` command
- Document sticky project behavior
- Add troubleshooting guide

## Implementation Timeline

### Week 1: Backend Foundation & Testing
- [ ] Database migration with migration tests
- [ ] Profile service updates with integration tests
- [ ] Task service enhancements with integration tests
- [ ] Project service search function with RLS testing
- [ ] Hook layer additions with unit tests
- [ ] Service layer integration test suite completion

### Week 2: Core UI Components & Component Testing
- [ ] Text parsing utility with comprehensive unit tests
- [ ] ProjectAutocomplete component with integration tests
- [ ] ProjectChip component with unit tests
- [ ] Hook unit tests with mocked service layer
- [ ] Component integration testing framework setup

### Week 3: TaskQuickAdd Enhancement & E2E Foundation
- [ ] Integrate all new components with integration tests
- [ ] Implement full workflow logic with test coverage
- [ ] Add keyboard and mobile support with interaction tests
- [ ] E2E test environment setup (Detox/Playwright)
- [ ] Core user journey E2E tests

### Week 4: Comprehensive Testing & Performance
- [ ] Complete E2E test suite for all workflows
- [ ] Performance and load testing
- [ ] Visual polish and animations
- [ ] Test suite optimization and CI/CD integration
- [ ] Documentation updates with testing examples
- [ ] User acceptance testing with test-driven validation

### Week 5: Testing Validation & Release Preparation
- [ ] Full test suite execution and validation
- [ ] Test coverage analysis and gap filling
- [ ] Performance benchmarking validation
- [ ] Cross-platform E2E test validation
- [ ] Final user acceptance testing
- [ ] Release readiness assessment based on test metrics

## Technical Considerations

### Performance Optimization
1. **Debounced Search**: Implement 300ms debounce for project search queries
2. **Caching**: Leverage TanStack Query caching for frequently searched projects
3. **Virtualization**: Consider virtual scrolling for large project lists

### Error Handling
1. **Network Failures**: Graceful handling of failed project searches
2. **Invalid Projects**: Handle cases where selected project no longer exists
3. **Validation**: Proper Zod validation for all new data structures

### Accessibility
1. **ARIA Labels**: Proper labeling for autocomplete dropdown
2. **Keyboard Navigation**: Full keyboard accessibility
3. **Screen Reader**: Appropriate announcements for dynamic content

## Success Metrics

### Functional Requirements (Validated by E2E Tests)
- [ ] Users can type `/in` to trigger project search
- [ ] Autocomplete shows relevant projects based on partial matching
- [ ] Selected project appears as chip in input field
- [ ] Tasks default to last-used project
- [ ] Database correctly tracks last_used_project_id
- [ ] Project selection persists across app sessions
- [ ] RLS policies prevent unauthorized access to projects

### Performance Requirements (Validated by Performance Tests)
- [ ] Project search responds within 200ms (automated test)
- [ ] Autocomplete dropdown appears within 100ms of typing `/in`
- [ ] Task creation completes within 500ms
- [ ] UI remains responsive during all operations
- [ ] Debounced search prevents excessive API calls
- [ ] Component renders complete within 16ms for 60fps

### User Experience Requirements (Validated by E2E Tests)
- [ ] Workflow feels intuitive and fast (measured by task completion time)
- [ ] No unnecessary context switching
- [ ] Clear visual feedback for all actions
- [ ] Works seamlessly on mobile and desktop
- [ ] Keyboard accessibility fully functional
- [ ] Screen reader compatibility

### Test Coverage Requirements (Definition of Done)
- [ ] Service layer integration tests: 100% coverage of new functions
- [ ] Hook unit tests: 100% coverage of state management logic
- [ ] Component integration tests: All user interactions covered
- [ ] E2E tests: All critical user journeys automated
- [ ] Performance tests: All timing requirements validated
- [ ] Cross-platform tests: iOS, Android, Web validation
- [ ] CI/CD pipeline: All tests passing before merge

## Risk Mitigation

### Technical Risks
1. **Text Parsing Edge Cases**: Comprehensive test suite for parsing logic
2. **Performance Impact**: Monitor query performance with proper indexing
3. **Race Conditions**: Proper handling of async project searches

### UX Risks
1. **Discoverability**: Clear visual cues for `/in` command functionality
2. **Learning Curve**: Progressive disclosure of advanced features
3. **Mobile Usability**: Thorough mobile testing and optimization

This implementation plan provides a complete roadmap for delivering the enhanced Task Manager functionality while building upon the existing, well-architected codebase.