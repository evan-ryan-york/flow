# Testing Implementation Plan: Projects Feature

**Status**: In Progress
**Last Updated**: 2025-10-03
**Owner**: Development Team

## Executive Summary

This document provides a step-by-step plan to achieve 100% test coverage for the Projects feature (Column 1 of the three-column layout) in alignment with our [Testing Strategy](../../project-wide-context/testing-strategy.md).

**Current State:**
- ✅ Basic service layer mock tests exist
- ⚠️ RLS security tests are MISSING (critical gap)
- ❌ Hook unit tests are incomplete
- ❌ Component tests do NOT exist
- ❌ E2E tests do NOT exist

**Goal State:**
- ✅ Full service layer integration tests with live Supabase
- ✅ Comprehensive RLS security tests
- ✅ Complete hook unit tests with React Testing Library
- ✅ Component tests for ProjectsPanel and ProjectItem
- ✅ E2E tests for critical user journeys

---

## Testing Pyramid for Projects Feature

```
        ┌─────────────────┐
        │   E2E Tests     │  ← 5-10 critical user journeys
        │   (Detox/       │     (Slow, high confidence)
        │   Playwright)   │
        └─────────────────┘
              ▲
              │
        ┌─────────────────┐
        │  Integration    │  ← Hook + Component tests
        │  Tests (RTL)    │     (Medium speed, medium confidence)
        └─────────────────┘
              ▲
              │
        ┌─────────────────┐
        │  Service Layer  │  ← Service + RLS tests
        │  Tests (Jest +  │     (Fast, low confidence)
        │  Live Supabase) │
        └─────────────────┘
```

---

## Phase 1: Service Layer Integration Tests

**Priority**: CRITICAL
**Estimated Time**: 2-3 days
**Dependencies**: Local Supabase instance running

### 1.1 Setup Test Infrastructure

**File**: `packages/data/__tests__/helpers/supabaseTestClient.ts` (already exists, needs enhancement)

**Tasks:**
1. ✅ Verify local Supabase is running (`supabase start`)
2. ✅ Configure test environment variables:
   ```bash
   SUPABASE_TEST_URL=http://localhost:54321
   SUPABASE_TEST_ANON_KEY=<your-local-anon-key>
   SUPABASE_TEST_SERVICE_ROLE_KEY=<your-local-service-role-key>
   ```

3. **Enhance test helpers** with:
   - `resetDatabase()` - Calls `supabase db reset` before each test suite
   - `createTestUsers(count: number)` - Creates multiple test users
   - `authenticateAs(userId: string)` - Switches auth context
   - `cleanupTestData()` - Removes test data after tests

**Example Helper Addition:**
```typescript
// Add to supabaseTestClient.ts
export const resetDatabase = async () => {
  // Run: supabase db reset
  // Or call a stored procedure to clean all tables
};

export const createTestUsers = async (count: number) => {
  const users = [];
  for (let i = 0; i < count; i++) {
    const email = `testuser${i}@test.com`;
    const password = 'testpassword123';
    const user = await createTestUser(testClient, email, password);
    users.push(user);
  }
  return users;
};
```

### 1.2 Create RLS Security Tests

**File**: `packages/data/__tests__/services/projectService.rls.test.ts` (NEW)

**Purpose**: Verify Row-Level Security policies prevent unauthorized access

**Test Cases:**

```typescript
describe('projectService RLS Security Tests', () => {
  let userA, userB, projectOwnedByA;

  beforeEach(async () => {
    await resetDatabase();
    [userA, userB] = await createTestUsers(2);

    // Authenticate as User A and create a project
    await authenticateAs(userA.id);
    projectOwnedByA = await createProject({
      ownerId: userA.id,
      name: 'User A Project'
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('READ Operations', () => {
    it('should NOT allow User B to fetch User A projects', async () => {
      // Authenticate as User B
      await authenticateAs(userB.id);

      // Try to fetch User A's projects
      const projects = await getProjectsForUser(userA.id);

      // Should return empty array (RLS blocks it)
      expect(projects).toEqual([]);
    });

    it('should allow User A to fetch their own projects', async () => {
      await authenticateAs(userA.id);

      const projects = await getProjectsForUser(userA.id);

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(projectOwnedByA.id);
    });

    it('should allow User B to see project when added as member', async () => {
      // User A adds User B as member
      await authenticateAs(userA.id);
      await addProjectMember(projectOwnedByA.id, userB.id, 'member');

      // User B should now see the project
      await authenticateAs(userB.id);
      const projects = await getProjectsForUser(userB.id);

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe(projectOwnedByA.id);
      expect(projects[0].userRole).toBe('member');
    });
  });

  describe('UPDATE Operations', () => {
    it('should NOT allow User B to update User A project', async () => {
      await authenticateAs(userB.id);

      // Attempt to update User A's project should fail
      await expect(
        updateProject(projectOwnedByA.id, { name: 'Hacked Name' })
      ).rejects.toThrow();
    });

    it('should allow project member with admin role to update', async () => {
      // Add User B as admin
      await authenticateAs(userA.id);
      await addProjectMember(projectOwnedByA.id, userB.id, 'admin');

      // User B should be able to update
      await authenticateAs(userB.id);
      const updated = await updateProject(projectOwnedByA.id, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
    });

    it('should NOT allow project member with viewer role to update', async () => {
      // Add User B as viewer
      await authenticateAs(userA.id);
      await addProjectMember(projectOwnedByA.id, userB.id, 'viewer');

      // User B should NOT be able to update
      await authenticateAs(userB.id);
      await expect(
        updateProject(projectOwnedByA.id, { name: 'New Name' })
      ).rejects.toThrow();
    });
  });

  describe('DELETE Operations', () => {
    it('should NOT allow User B to delete User A project', async () => {
      await authenticateAs(userB.id);

      await expect(
        deleteProject(projectOwnedByA.id)
      ).rejects.toThrow();
    });

    it('should NOT allow deletion of General project', async () => {
      await authenticateAs(userA.id);

      // Get General project
      const generalProject = await getGeneralProject(userA.id);

      // Should throw error
      await expect(
        deleteProject(generalProject.id)
      ).rejects.toThrow('Cannot delete the General project');
    });

    it('should allow owner to delete their project', async () => {
      await authenticateAs(userA.id);

      await expect(
        deleteProject(projectOwnedByA.id)
      ).resolves.not.toThrow();

      // Verify project is gone
      const projects = await getProjectsForUser(userA.id);
      expect(projects.find(p => p.id === projectOwnedByA.id)).toBeUndefined();
    });
  });
});
```

### 1.3 Add Missing Service Function Tests

**File**: `packages/data/__tests__/services/projectService.integration.test.ts` (NEW)

**Test Cases:**

```typescript
describe('projectService Integration Tests (Live DB)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('searchProjects', () => {
    it('should return empty array for empty query', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      const results = await searchProjects(user.id, '');
      expect(results).toEqual([]);
    });

    it('should find projects by partial name match', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      await createProject({ ownerId: user.id, name: 'Marketing Campaign' });
      await createProject({ ownerId: user.id, name: 'Marketing Budget' });
      await createProject({ ownerId: user.id, name: 'Sales Pipeline' });

      const results = await searchProjects(user.id, 'market');

      expect(results).toHaveLength(2);
      expect(results.every(p => p.name.toLowerCase().includes('market'))).toBe(true);
    });

    it('should prioritize exact matches over partial matches', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      await createProject({ ownerId: user.id, name: 'Marketing' });
      await createProject({ ownerId: user.id, name: 'Marketing Campaign' });

      const results = await searchProjects(user.id, 'Marketing');

      expect(results[0].name).toBe('Marketing'); // Exact match first
    });

    it('should limit results to 10 projects', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      // Create 15 projects with similar names
      for (let i = 0; i < 15; i++) {
        await createProject({ ownerId: user.id, name: `Project ${i}` });
      }

      const results = await searchProjects(user.id, 'project');

      expect(results).toHaveLength(10);
    });

    it('should only return projects user has access to (RLS)', async () => {
      const [userA, userB] = await createTestUsers(2);

      // User A creates a project
      await authenticateAs(userA.id);
      await createProject({ ownerId: userA.id, name: 'Secret Project' });

      // User B searches - should NOT find User A's project
      await authenticateAs(userB.id);
      const results = await searchProjects(userB.id, 'secret');

      expect(results).toHaveLength(0);
    });
  });

  describe('getGeneralProject', () => {
    it('should return General project when it exists', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      // Assuming General project is auto-created on user signup
      const generalProject = await getGeneralProject(user.id);

      expect(generalProject).not.toBeNull();
      expect(generalProject.is_general).toBe(true);
      expect(generalProject.owner_id).toBe(user.id);
    });

    it('should return null when General project does not exist', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      // Delete General project (if testing in isolated environment)
      const general = await getGeneralProject(user.id);
      if (general) {
        // Force delete via admin/service role for test purposes
        await deleteProject(general.id);
      }

      const result = await getGeneralProject(user.id);
      expect(result).toBeNull();
    });

    it('should only return General project for correct user', async () => {
      const [userA, userB] = await createTestUsers(2);

      await authenticateAs(userA.id);
      const userAGeneral = await getGeneralProject(userA.id);

      await authenticateAs(userB.id);
      const userBGeneral = await getGeneralProject(userB.id);

      expect(userAGeneral.id).not.toBe(userBGeneral.id);
      expect(userAGeneral.owner_id).toBe(userA.id);
      expect(userBGeneral.owner_id).toBe(userB.id);
    });
  });

  describe('reassignProjectTasks', () => {
    it('should move all tasks from one project to another', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      const projectA = await createProject({ ownerId: user.id, name: 'Project A' });
      const projectB = await createProject({ ownerId: user.id, name: 'Project B' });

      // Create tasks in Project A
      const task1 = await createTask({ projectId: projectA.id, name: 'Task 1' });
      const task2 = await createTask({ projectId: projectA.id, name: 'Task 2' });
      const task3 = await createTask({ projectId: projectA.id, name: 'Task 3' });

      // Reassign tasks from A to B
      await reassignProjectTasks(projectA.id, projectB.id);

      // Verify tasks moved
      const tasksInA = await getTasksForProject(projectA.id);
      const tasksInB = await getTasksForProject(projectB.id);

      expect(tasksInA).toHaveLength(0);
      expect(tasksInB).toHaveLength(3);
      expect(tasksInB.map(t => t.id)).toEqual(
        expect.arrayContaining([task1.id, task2.id, task3.id])
      );
    });

    it('should handle error when target project does not exist', async () => {
      const [user] = await createTestUsers(1);
      await authenticateAs(user.id);

      const projectA = await createProject({ ownerId: user.id, name: 'Project A' });
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';

      await expect(
        reassignProjectTasks(projectA.id, nonExistentId)
      ).rejects.toThrow();
    });
  });
});
```

### 1.4 Run and Verify Service Tests

**Commands:**
```bash
# Start local Supabase
supabase start

# Run all service tests
cd packages/data
pnpm test services/projectService

# Run only RLS tests
pnpm test projectService.rls.test.ts

# Run only integration tests
pnpm test projectService.integration.test.ts
```

**Success Criteria:**
- ✅ All RLS tests pass
- ✅ All integration tests pass
- ✅ Test coverage for projectService.ts is >90%
- ✅ No flaky tests (run 3 times to verify)

---

## Phase 2: Hook Unit Tests

**Priority**: HIGH
**Estimated Time**: 1-2 days
**Dependencies**: Phase 1 complete

### 2.1 Setup React Testing Library

**File**: `packages/data/jest.setup.js` (enhance existing)

**Add:**
```javascript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Clean up after each test
afterEach(() => {
  cleanup();
});
```

### 2.2 Create Hook Tests with Mocked Services

**File**: `packages/data/__tests__/hooks/useProject.test.tsx` (NEW - replace simple.test.ts)

**Test Cases:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProjectsForUser,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useProjectSearch,
  useGeneralProject,
} from '../../hooks/useProject';
import * as projectService from '../../services/projectService';

// Mock the entire service layer
jest.mock('../../services/projectService');

const mockedService = projectService as jest.Mocked<typeof projectService>;

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useProject Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectsForUser', () => {
    const mockProjects = [
      {
        id: 'proj1',
        name: 'Project 1',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        userRole: 'owner',
      },
    ];

    it('should return loading state initially', () => {
      mockedService.getProjectsForUser.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return data on success', async () => {
      mockedService.getProjectsForUser.mockResolvedValue(mockProjects);

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProjects);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should return error state on failure', async () => {
      const error = new Error('Database error');
      mockedService.getProjectsForUser.mockRejectedValue(error);

      const { result } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
      expect(result.current.data).toBeUndefined();
    });

    it('should not run query when userId is undefined', () => {
      const { result } = renderHook(
        () => useProjectsForUser(undefined),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.getProjectsForUser).not.toHaveBeenCalled();
    });

    it('should respect staleTime of 5 minutes', async () => {
      mockedService.getProjectsForUser.mockResolvedValue(mockProjects);

      const { result, rerender } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Clear mock calls
      mockedService.getProjectsForUser.mockClear();

      // Rerender within stale time - should NOT refetch
      rerender();

      expect(mockedService.getProjectsForUser).not.toHaveBeenCalled();
    });
  });

  describe('useCreateProject', () => {
    const mockProject = {
      id: 'new-proj',
      name: 'New Project',
      owner_id: 'user1',
      color: 'sky',
      is_general: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('should show isPending during mutation', async () => {
      mockedService.createProject.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockProject), 100))
      );

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
    });

    it('should call createProject service with correct params', async () => {
      mockedService.createProject.mockResolvedValue(mockProject);

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.createProject).toHaveBeenCalledWith({
        ownerId: 'user1',
        name: 'New Project',
      });
    });

    it('should update cache on success', async () => {
      // Setup initial projects in cache
      mockedService.getProjectsForUser.mockResolvedValue([]);
      mockedService.createProject.mockResolvedValue(mockProject);

      const wrapper = createWrapper();

      // First render the list hook to populate cache
      const { result: listResult } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper }
      );

      await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
      expect(listResult.current.data).toHaveLength(0);

      // Now create a project
      const { result: createResult } = renderHook(
        () => useCreateProject(),
        { wrapper }
      );

      createResult.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

      // List should now include new project (cache updated)
      expect(listResult.current.data).toHaveLength(1);
      expect(listResult.current.data[0].id).toBe('new-proj');
    });

    it('should show error state on mutation failure', async () => {
      const error = new Error('Creation failed');
      mockedService.createProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useCreateProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({ ownerId: 'user1', name: 'New Project' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDeleteProject', () => {
    it('should remove project from cache on success', async () => {
      const projectToDelete = {
        id: 'proj-to-delete',
        name: 'Delete Me',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      // Setup initial state with project
      mockedService.getProjectsForUser.mockResolvedValue([projectToDelete]);
      mockedService.deleteProject.mockResolvedValue();

      const wrapper = createWrapper();

      // Render list to populate cache
      const { result: listResult } = renderHook(
        () => useProjectsForUser('user1'),
        { wrapper }
      );

      await waitFor(() => expect(listResult.current.data).toHaveLength(1));

      // Delete the project
      const { result: deleteResult } = renderHook(
        () => useDeleteProject(),
        { wrapper }
      );

      deleteResult.current.mutate('proj-to-delete');

      await waitFor(() => expect(deleteResult.current.isSuccess).toBe(true));

      // Verify service was called
      expect(mockedService.deleteProject).toHaveBeenCalledWith('proj-to-delete');

      // Cache should invalidate (in real test, we'd need to wait for refetch)
      // This is tricky to test without actual refetching logic
    });

    it('should prevent deleting General project', async () => {
      const error = new Error('Cannot delete the General project');
      mockedService.deleteProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useDeleteProject(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('general-project-id');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useProjectSearch', () => {
    const mockSearchResults = [
      {
        id: 'proj1',
        name: 'Marketing',
        owner_id: 'user1',
        color: 'sky',
        is_general: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
    ];

    it('should not search when query is empty', () => {
      const { result } = renderHook(
        () => useProjectSearch('user1', ''),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.searchProjects).not.toHaveBeenCalled();
    });

    it('should search when query has content', async () => {
      mockedService.searchProjects.mockResolvedValue(mockSearchResults);

      const { result } = renderHook(
        () => useProjectSearch('user1', 'market'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.searchProjects).toHaveBeenCalledWith('user1', 'market');
      expect(result.current.data).toEqual(mockSearchResults);
    });

    it('should respect enabled flag', () => {
      const { result } = renderHook(
        () => useProjectSearch('user1', 'market', false),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.searchProjects).not.toHaveBeenCalled();
    });
  });

  describe('useGeneralProject', () => {
    const mockGeneralProject = {
      id: 'general',
      name: 'General',
      owner_id: 'user1',
      color: 'sky',
      is_general: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('should fetch General project', async () => {
      mockedService.getGeneralProject.mockResolvedValue(mockGeneralProject);

      const { result } = renderHook(
        () => useGeneralProject('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockGeneralProject);
      expect(result.current.data.is_general).toBe(true);
    });

    it('should handle null when General project does not exist', async () => {
      mockedService.getGeneralProject.mockResolvedValue(null);

      const { result } = renderHook(
        () => useGeneralProject('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it('should respect staleTime of 10 minutes', async () => {
      mockedService.getGeneralProject.mockResolvedValue(mockGeneralProject);

      const { result, rerender } = renderHook(
        () => useGeneralProject('user1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      mockedService.getGeneralProject.mockClear();

      // Rerender - should NOT refetch within stale time
      rerender();

      expect(mockedService.getGeneralProject).not.toHaveBeenCalled();
    });
  });
});
```

### 2.3 Run and Verify Hook Tests

**Commands:**
```bash
cd packages/data
pnpm test hooks/useProject.test.tsx
```

**Success Criteria:**
- ✅ All hook tests pass
- ✅ Test coverage for useProject.ts is >85%
- ✅ All loading/success/error states tested
- ✅ Cache invalidation logic verified

---

## Phase 3: Component Tests

**Priority**: MEDIUM
**Estimated Time**: 2-3 days
**Dependencies**: Phase 2 complete

### 3.1 Setup Component Testing Environment

**File**: `packages/ui/jest.config.js` (CREATE if doesn't exist)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/components'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@perfect-task-app/data$': '<rootDir>/../data/index.ts',
    '^@perfect-task-app/models$': '<rootDir>/../models/index.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

**File**: `packages/ui/jest.setup.js` (CREATE)

```javascript
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

### 3.2 Create ProjectsPanel Component Tests

**File**: `packages/ui/components/custom/__tests__/ProjectsPanel.test.tsx` (NEW)

**Test Cases:**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectsPanel } from '../ProjectsPanel';
import * as dataHooks from '@perfect-task-app/data';

// Mock the data hooks
jest.mock('@perfect-task-app/data');

const mockedHooks = dataHooks as jest.Mocked<typeof dataHooks>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ProjectsPanel', () => {
  const mockOnProjectSelectionChange = jest.fn();
  const mockProjects = [
    {
      id: 'general-id',
      name: 'General',
      owner_id: 'user1',
      color: 'sky',
      is_general: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      userRole: 'owner',
    },
    {
      id: 'proj1',
      name: 'Marketing',
      owner_id: 'user1',
      color: 'rose',
      is_general: false,
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      userRole: 'owner',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockedHooks.useProjectsForUser.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
      error: null,
    });

    mockedHooks.useCreateProject.mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    });

    mockedHooks.useUpdateProject.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  describe('Loading State', () => {
    it('should render loading skeleton while loading', () => {
      mockedHooks.useProjectsForUser.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Check for loading skeletons
      const skeletons = screen.getAllByRole('generic', { hidden: true });
      expect(skeletons.some(el => el.className.includes('animate-pulse'))).toBe(true);
    });
  });

  describe('Error State', () => {
    it('should render error message on error', () => {
      mockedHooks.useProjectsForUser.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Database error'),
      });

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Failed to load projects/i)).toBeInTheDocument();
      expect(screen.getByText(/Database error/i)).toBeInTheDocument();
    });
  });

  describe('Project List Rendering', () => {
    it('should render list of projects', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('should render General project first', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const projectNames = screen.getAllByRole('button').map(btn => btn.textContent);
      expect(projectNames[1]).toContain('General'); // Index 0 is the + button
    });

    it('should show lock icon for General project', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Lock icon should be present (check via data-testid or class)
      const generalButton = screen.getByText('General').closest('button');
      expect(generalButton).toBeInTheDocument();
      // Check for Lock icon component (adjust selector based on implementation)
    });
  });

  describe('Project Selection', () => {
    it('should call onProjectSelectionChange when project clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingButton = screen.getByText('Marketing').closest('button');
      fireEvent.click(marketingButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith(['proj1']);
    });

    it('should toggle selection when clicking selected project', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={['proj1']}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingButton = screen.getByText('Marketing').closest('button');
      fireEvent.click(marketingButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([]);
    });

    it('should allow multi-select with Ctrl+Click', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={['general-id']}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingButton = screen.getByText('Marketing').closest('button');
      fireEvent.click(marketingButton, { ctrlKey: true });

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([
        'general-id',
        'proj1',
      ]);
    });
  });

  describe('Select All/None Buttons', () => {
    it('should select all projects when "All" clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const allButton = screen.getByText('All');
      fireEvent.click(allButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([
        'general-id',
        'proj1',
      ]);
    });

    it('should deselect all projects when "None" clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={['general-id', 'proj1']}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const noneButton = screen.getByText('None');
      fireEvent.click(noneButton);

      expect(mockOnProjectSelectionChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Create Project Flow', () => {
    it('should show create form when + button clicked', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      expect(screen.getByPlaceholderText('Project name...')).toBeInTheDocument();
    });

    it('should validate empty project name', async () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      // Try to submit empty
      const submitButton = screen.getByRole('button', { name: /check/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Project name is required')).toBeInTheDocument();
      });
    });

    it('should validate project name length > 50', async () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      // Enter long name
      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, {
        target: { value: 'A'.repeat(51) },
      });

      const submitButton = screen.getByRole('button', { name: /check/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Project name must be 50 characters or less')
        ).toBeInTheDocument();
      });
    });

    it('should submit valid project name on Enter', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        id: 'new-proj',
        name: 'New Project',
      });

      mockedHooks.useCreateProject.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: false,
        isError: false,
      });

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      // Enter name
      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, { target: { value: 'New Project' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          ownerId: 'user1',
          name: 'New Project',
        });
      });
    });

    it('should cancel create form on Escape', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open create form
      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByPlaceholderText('Project name...')).not.toBeInTheDocument();
    });

    it('should auto-select new project after creation', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({
        id: 'new-proj',
        name: 'New Project',
      });

      mockedHooks.useCreateProject.mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
        isSuccess: false,
        isError: false,
      });

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Open and submit
      const plusButton = screen.getByRole('button', { name: /plus/i });
      fireEvent.click(plusButton);

      const input = screen.getByPlaceholderText('Project name...');
      fireEvent.change(input, { target: { value: 'New Project' } });

      const submitButton = screen.getByRole('button', { name: /check/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnProjectSelectionChange).toHaveBeenCalledWith(['new-proj']);
      });
    });
  });

  describe('Color Picker', () => {
    it('should allow color change for non-general projects', () => {
      const mockUpdateMutate = jest.fn();
      mockedHooks.useUpdateProject.mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
      });

      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      // Find color picker for Marketing project
      // Implementation depends on your UI - adjust selectors
      const marketingItem = screen.getByText('Marketing').closest('div[class*="group"]');

      // Hover to show color picker
      fireEvent.mouseEnter(marketingItem);

      // Click color picker and select violet
      // (This test depends on your ProjectColorPicker implementation)
      // Example: fireEvent.click(screen.getByLabelText('violet'));

      // Verify mutation called with correct color
      // expect(mockUpdateMutate).toHaveBeenCalledWith({
      //   projectId: 'proj1',
      //   updates: { color: 'violet' },
      // });
    });

    it('should NOT show color picker for General project', () => {
      render(
        <ProjectsPanel
          userId="user1"
          selectedProjectIds={[]}
          onProjectSelectionChange={mockOnProjectSelectionChange}
        />,
        { wrapper: createWrapper() }
      );

      const generalItem = screen.getByText('General').closest('div[class*="group"]');

      // Color picker should not be rendered for General project
      // Adjust selector based on implementation
      // expect(generalItem.querySelector('[data-testid="color-picker"]')).toBeNull();
    });
  });
});
```

### 3.3 Create ProjectItem Component Tests

**File**: `packages/ui/components/custom/__tests__/ProjectItem.test.tsx` (NEW)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectItem } from '../ProjectItem';

describe('ProjectItem', () => {
  const mockOnClick = jest.fn();
  const mockOnColorChange = jest.fn();

  const mockProject = {
    id: 'proj1',
    name: 'Marketing Campaign',
    owner_id: 'user1',
    color: 'rose' as const,
    is_general: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render project name', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument();
    });

    it('should show solid dot when selected', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={true}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Check for solid dot indicator
      // Adjust selector based on your implementation
      const indicator = screen.getByRole('button').previousSibling;
      expect(indicator).toHaveStyle({ backgroundColor: expect.any(String) });
    });

    it('should show hollow circle when not selected', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Check for hollow circle indicator
      const indicator = screen.getByRole('button').previousSibling;
      expect(indicator).toHaveStyle({ borderColor: expect.any(String) });
    });

    it('should show lock icon only for General project', () => {
      const generalProject = { ...mockProject, is_general: true, name: 'General' };

      const { rerender } = render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Lock icon should be present
      expect(screen.getByText('General')).toBeInTheDocument();
      // Check for Lock component - adjust based on implementation

      rerender(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Lock icon should NOT be present for non-general project
    });
  });

  describe('Click Handling', () => {
    it('should call onClick with projectId when clicked', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledWith('proj1', false);
    });

    it('should pass isCtrlClick flag when Ctrl+Click', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button, { ctrlKey: true });

      expect(mockOnClick).toHaveBeenCalledWith('proj1', true);
    });

    it('should pass isCtrlClick flag when Cmd+Click on Mac', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button, { metaKey: true });

      expect(mockOnClick).toHaveBeenCalledWith('proj1', true);
    });
  });

  describe('Color Picker', () => {
    it('should render color picker for non-general projects', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // Color picker should be present
      // Adjust based on implementation
    });

    it('should NOT render color picker for General project', () => {
      const generalProject = { ...mockProject, is_general: true };

      render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // Color picker should NOT be present
    });

    it('should call onColorChange with correct values', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          onColorChange={mockOnColorChange}
          userId="user1"
        />
      );

      // Simulate color change
      // Implementation depends on ProjectColorPicker
      // fireEvent.click(colorPickerButton);
      // fireEvent.click(violetOption);

      // expect(mockOnColorChange).toHaveBeenCalledWith('proj1', 'violet');
    });
  });

  describe('Context Menu', () => {
    it('should show context menu on hover for non-general projects', () => {
      render(
        <ProjectItem
          project={mockProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      const container = screen.getByRole('button').closest('div[class*="group"]');
      fireEvent.mouseEnter(container);

      // Context menu should appear
      // Check for context menu element
    });

    it('should NOT show context menu for General project', () => {
      const generalProject = { ...mockProject, is_general: true };

      render(
        <ProjectItem
          project={generalProject}
          isSelected={false}
          onClick={mockOnClick}
          userId="user1"
        />
      );

      // Context menu should NOT be rendered
    });
  });
});
```

### 3.4 Run and Verify Component Tests

**Commands:**
```bash
cd packages/ui
pnpm test components/custom/__tests__/ProjectsPanel.test.tsx
pnpm test components/custom/__tests__/ProjectItem.test.tsx
```

**Success Criteria:**
- ✅ All component tests pass
- ✅ Test coverage for ProjectsPanel.tsx is >80%
- ✅ Test coverage for ProjectItem.tsx is >80%
- ✅ All user interactions tested

---

## Phase 4: End-to-End Tests

**Priority**: MEDIUM-LOW
**Estimated Time**: 3-4 days
**Dependencies**: Phase 3 complete

### 4.1 Setup E2E Testing Framework

**Choose Framework:**
- **Web**: Playwright (recommended)
- **iOS/Android**: Detox
- **macOS**: Playwright or Detox

**Installation (Playwright for Web):**
```bash
pnpm add -D @playwright/test
npx playwright install
```

**File**: `apps/web/playwright.config.ts` (CREATE)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.2 Create E2E Tests for Critical User Journeys

**File**: `apps/web/e2e/projects.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

// Helper to sign in
async function signIn(page, email = 'test@example.com', password = 'testpass123') {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/app');
}

test.describe('Projects Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reset database before each test
    // You might need a test API endpoint for this
    await page.request.post('http://localhost:3000/api/test/reset-db');

    // Sign up a new user
    await page.goto('/signup');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/app');
  });

  test('should show General project on first login', async ({ page }) => {
    // After signup, user should land on /app with General project visible
    await expect(page.locator('text=General')).toBeVisible();

    // General project should have lock icon
    const generalProject = page.locator('text=General').locator('..');
    await expect(generalProject.locator('[data-icon="lock"]')).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // Click the + button to create project
    await page.click('[aria-label="Create project"]');

    // Fill in project name
    await page.fill('input[placeholder="Project name..."]', 'Marketing Campaign');

    // Submit
    await page.keyboard.press('Enter');

    // Project should appear in list
    await expect(page.locator('text=Marketing Campaign')).toBeVisible();

    // Project should be selected
    const marketingProject = page.locator('text=Marketing Campaign').locator('..');
    await expect(marketingProject).toHaveClass(/selected/); // Adjust class name
  });

  test('should change project color', async ({ page }) => {
    // Create a project first
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Test Project');
    await page.keyboard.press('Enter');

    // Wait for project to appear
    await expect(page.locator('text=Test Project')).toBeVisible();

    // Hover over project to show color picker
    const projectItem = page.locator('text=Test Project').locator('..');
    await projectItem.hover();

    // Click color picker
    await projectItem.locator('[data-testid="color-picker"]').click();

    // Select violet color
    await page.click('[data-color="violet"]');

    // Reload page to verify persistence
    await page.reload();

    // Project should still have violet color
    const colorIndicator = projectItem.locator('.color-indicator'); // Adjust selector
    await expect(colorIndicator).toHaveCSS('background-color', /violet/);
  });

  test('should select multiple projects', async ({ page }) => {
    // Create two projects
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Project A');
    await page.keyboard.press('Enter');

    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Project B');
    await page.keyboard.press('Enter');

    // Click "All" button
    await page.click('text=All');

    // All projects should be selected (General + Project A + Project B)
    await expect(page.locator('.project-item.selected')).toHaveCount(3);

    // Task Hub should show tasks from all projects
    const taskHub = page.locator('[data-testid="task-hub"]');
    await expect(taskHub).toContainText('All Projects'); // Adjust based on UI
  });

  test('should deselect all projects', async ({ page }) => {
    // Create a project
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Test Project');
    await page.keyboard.press('Enter');

    // Click "All"
    await page.click('text=All');
    await expect(page.locator('.project-item.selected')).toHaveCount(2);

    // Click "None"
    await page.click('text=None');
    await expect(page.locator('.project-item.selected')).toHaveCount(0);
  });

  test('should delete project and reassign tasks', async ({ page }) => {
    // Create a project
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Temp Project');
    await page.keyboard.press('Enter');

    // Create tasks in the project
    await page.click('text=Temp Project');
    await page.click('[aria-label="Create task"]');
    await page.fill('input[placeholder="Task name..."]', 'Task 1');
    await page.keyboard.press('Enter');

    await page.click('[aria-label="Create task"]');
    await page.fill('input[placeholder="Task name..."]', 'Task 2');
    await page.keyboard.press('Enter');

    // Right-click project
    const tempProject = page.locator('text=Temp Project').locator('..');
    await tempProject.click({ button: 'right' });

    // Click Delete in context menu
    await page.click('text=Delete');

    // Select General project to reassign tasks
    await page.click('text=General');
    await page.click('button:has-text("Delete Project")');

    // Project should be gone
    await expect(page.locator('text=Temp Project')).not.toBeVisible();

    // Tasks should be in General project
    await page.click('text=General');
    await expect(page.locator('text=Task 1')).toBeVisible();
    await expect(page.locator('text=Task 2')).toBeVisible();
  });

  test('should NOT allow deleting General project', async ({ page }) => {
    // Right-click General project
    const generalProject = page.locator('text=General').locator('..');
    await generalProject.click({ button: 'right' });

    // Delete option should be disabled or not shown
    const deleteOption = page.locator('text=Delete');
    await expect(deleteOption).toBeDisabled();
    // OR
    await expect(deleteOption).not.toBeVisible();
  });

  test('should persist project selection across page refresh', async ({ page }) => {
    // Create and select multiple projects
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Project A');
    await page.keyboard.press('Enter');

    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Project B');
    await page.keyboard.press('Enter');

    // Select both
    await page.click('text=All');

    // Reload page
    await page.reload();

    // Projects should still be selected
    await expect(page.locator('.project-item.selected')).toHaveCount(3);
  });

  test('should validate project name on creation', async ({ page }) => {
    // Try to create with empty name
    await page.click('[aria-label="Create project"]');
    await page.click('button[aria-label="Submit"]');

    await expect(page.locator('text=Project name is required')).toBeVisible();

    // Try with name > 50 characters
    await page.fill('input[placeholder="Project name..."]', 'A'.repeat(51));
    await page.click('button[aria-label="Submit"]');

    await expect(
      page.locator('text=Project name must be 50 characters or less')
    ).toBeVisible();
  });
});

test.describe('Project Collaboration E2E', () => {
  test('should allow owner to invite member', async ({ page, context }) => {
    // User A signs up
    await page.goto('/signup');
    await page.fill('input[name="email"]', 'usera@example.com');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/app');

    // Create a project
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Shared Project');
    await page.keyboard.press('Enter');

    // Open project settings / members
    const sharedProject = page.locator('text=Shared Project').locator('..');
    await sharedProject.click({ button: 'right' });
    await page.click('text=Manage Members');

    // Invite User B
    await page.fill('input[placeholder="Email..."]', 'userb@example.com');
    await page.click('button:has-text("Invite")');

    // Sign out
    await page.click('[aria-label="User menu"]');
    await page.click('text=Sign Out');

    // User B signs up in new tab
    const page2 = await context.newPage();
    await page2.goto('/signup');
    await page2.fill('input[name="email"]', 'userb@example.com');
    await page2.fill('input[name="password"]', 'testpass123');
    await page2.click('button[type="submit"]');
    await page2.waitForURL('/app');

    // User B should see shared project
    await expect(page2.locator('text=Shared Project')).toBeVisible();

    // User B should have 'member' badge
    const sharedProjectB = page2.locator('text=Shared Project').locator('..');
    await expect(sharedProjectB.locator('text=Member')).toBeVisible();
  });
});
```

### 4.3 Run E2E Tests

**Commands:**
```bash
# Start Supabase locally
supabase start

# Run E2E tests
cd apps/web
pnpm exec playwright test

# Run with UI
pnpm exec playwright test --ui

# Generate HTML report
pnpm exec playwright show-report
```

**Success Criteria:**
- ✅ All critical user journeys pass
- ✅ Tests run reliably (no flakiness)
- ✅ Tests run in CI/CD pipeline
- ✅ Test execution time < 5 minutes

---

## Phase 5: Continuous Integration

**Priority**: HIGH
**Estimated Time**: 1 day
**Dependencies**: All phases complete

### 5.1 Setup GitHub Actions

**File**: `.github/workflows/test-projects.yml` (CREATE)

```yaml
name: Projects Feature Tests

on:
  pull_request:
    paths:
      - 'packages/data/services/projectService.ts'
      - 'packages/data/hooks/useProject.ts'
      - 'packages/ui/components/custom/Projects*'
      - 'apps/web/components/ThreeColumnLayout.tsx'
      - 'packages/data/__tests__/**'
      - 'packages/ui/__tests__/**'
      - 'apps/web/e2e/**'
  push:
    branches: [main, develop]

jobs:
  service-tests:
    name: Service Layer Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.12.4

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase
        run: supabase start

      - name: Run Service Tests
        run: |
          cd packages/data
          pnpm test services/projectService

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/data/coverage/lcov.info
          flags: service-layer

  hook-tests:
    name: Hook Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.12.4

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run Hook Tests
        run: |
          cd packages/data
          pnpm test hooks/useProject.test.tsx

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/data/coverage/lcov.info
          flags: hooks

  component-tests:
    name: Component Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.12.4

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run Component Tests
        run: |
          cd packages/ui
          pnpm test components/custom/__tests__

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/ui/coverage/lcov.info
          flags: components

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10.12.4

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Setup Supabase
        uses: supabase/setup-cli@v1

      - name: Start Supabase
        run: supabase start

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium

      - name: Build app
        run: |
          cd apps/web
          pnpm build

      - name: Run E2E Tests
        run: |
          cd apps/web
          pnpm exec playwright test

      - name: Upload Playwright Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 30
```

### 5.2 Definition of Done Checklist

**A PR for Projects feature is NOT ready to merge unless:**

```markdown
## Testing Checklist

### Service Layer
- [ ] All service functions have integration tests with live Supabase
- [ ] RLS security tests pass for all CRUD operations
- [ ] Edge cases tested (empty results, non-existent IDs, etc.)
- [ ] Service test coverage > 90%

### Hooks
- [ ] All hooks have unit tests with mocked services
- [ ] Loading/success/error states tested
- [ ] Cache invalidation logic verified
- [ ] Hook test coverage > 85%

### Components
- [ ] All user-facing components have tests
- [ ] User interactions tested (click, hover, keyboard)
- [ ] Conditional rendering tested
- [ ] Component test coverage > 80%

### E2E
- [ ] Critical user journeys have E2E tests
- [ ] All E2E tests pass locally
- [ ] All E2E tests pass in CI

### CI/CD
- [ ] All test suites pass in GitHub Actions
- [ ] No flaky tests (run 3x to verify)
- [ ] Test execution time < 10 minutes total
```

---

## Tracking Progress

**Create GitHub Issues for Each Phase:**

1. **Issue #1**: Service Layer Integration Tests + RLS
2. **Issue #2**: Hook Unit Tests
3. **Issue #3**: Component Tests (ProjectsPanel + ProjectItem)
4. **Issue #4**: E2E Tests - Critical User Journeys
5. **Issue #5**: CI/CD Pipeline Setup

**Estimated Total Time**: 9-14 days (1 developer)

---

## Conclusion

This plan provides a systematic approach to achieve 100% test coverage for the Projects feature, fully aligned with our testing strategy. By following the testing pyramid (Service → Hooks → Components → E2E), we ensure a stable, maintainable, and well-tested codebase.

**Next Steps:**
1. Review this plan with the team
2. Create GitHub issues for tracking
3. Assign Phase 1 to start immediately
4. Set up weekly check-ins to track progress
