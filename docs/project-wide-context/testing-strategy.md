# Project Unify: Testing Strategy

This document provides the official testing strategy for the Project Unify application. All development must adhere to these guidelines to ensure stability, prevent regressions, and build confidence across all platforms (iOS, Android, Web, and macOS).

The core philosophy is that testing is not a separate phase, but an integral part of the development process. We will build a robust suite of tests that cover everything from individual functions to critical end-to-end user flows.

## 1. The Testing Pyramid: Our Guiding Principle

We will structure our testing efforts according to the "Testing Pyramid." This model prioritizes writing many fast, isolated tests at the base and fewer slow, comprehensive tests at the top.

**Unit Tests (Base)**: Fast, isolated tests for individual functions, Zod schemas, simple UI components, and utility helpers. They are cheap to write and run instantly.

**Integration Tests (Middle)**: Verify that multiple units work together correctly. This is our most critical layer, where we will test custom hooks, service functions interacting with a real (local) database, and complex component compositions.

**End-to-End (E2E) Tests (Top)**: Slow, comprehensive tests that simulate real user journeys through the entire application. They are expensive to maintain but provide the highest confidence that the system works as a whole.

## 2. Phase 1: Testing the Foundation (packages/)

The shared packages are the bedrock of our application. Rigorously testing them ensures that all platforms are built on a stable and reliable foundation.

### A. Testing the Data Layer (@flow-app/data)

This is the most critical area. We will test the services and hooks separately to ensure data flows correctly and securely from the database to our UI state.

#### 1. Service Layer Integration Tests (Jest + Live Supabase)

The service layer (`services/*.ts`) contains all our database logic. Since this logic is tightly coupled to the Supabase client and our Row-Level Security (RLS) policies, we will test it directly against a live, local Supabase instance managed by the Supabase CLI. These are technically integration tests, and they are essential.

**Requirements:**

- **Technology**: Jest as the test runner.
- **Environment**: Tests will run against a clean, ephemeral database instance for each test run (`supabase db reset`).

**What to Test:**

- **CRUD Operations**: Does `createProject` actually create a project? Does `deleteTask` remove it?
- **Data Shape**: Does the data returned from a service function successfully parse against its corresponding Zod schema? This validates our queries.
- **Edge Cases**: How does `getProjectById` behave with a non-existent ID? It should return null or throw a clear error.
- **Security (RLS)**: Write tests that explicitly verify our RLS policies. For example:
  - Authenticate as User A.
  - Try to fetch projects belonging to User B.
  - Assert that the service returns an empty array, proving the RLS policy worked.

**Example**: `services/projectService.test.ts` (Conceptual)

```typescript
import { projectService } from './projectService';
import { supabase } from '../supabaseClient'; // The real client for the local instance

describe('projectService', () => {
  let userA, userB;

  beforeEach(async () => {
    // Reset the local DB and seed it with test users
    // Authenticate the supabase client as User A for the upcoming tests
  });

  it('getProjectsForUser should only return projects for that user', async () => {
    // Create a project for User A and another for User B
    const projects = await projectService.getProjectsForUser(userA.id);
    expect(projects).toHaveLength(1);
    expect(projects[0].owner_id).toBe(userA.id);
  });

  it('deleteProject should not allow a user to delete another user's project', async () => {
    // As User A, attempt to delete a project owned by User B
    // Assert that the function throws an error or returns a failure status
  });
});
```

#### 2. Custom Hook Unit Tests (React Native Testing Library)

Our custom hooks (`hooks/*.ts`) are the bridge between the services and the UI. We will test them in isolation by mocking the service layer. This allows us to test the hook's state management logic (`isLoading`, `isError`, `data`) without making real database calls.

**Requirements:**

- **Technology**: Jest and React Native Testing Library.
- **Crucial Pattern**: You MUST mock the service layer. We are not testing the database again; we are testing the hook's behavior.

**What to Test:**

- Does the hook correctly return `isLoading: true` on initial render?
- If the service resolves successfully, does the hook return the correct data and `isSuccess: true`?
- If the service throws an error, does the hook correctly return an error object and `isError: true`?

**Example**: `hooks/useProjectTasks.test.ts` (Conceptual)

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { useProjectTasks } from './useProjectTasks';
import { taskService } from '../services/taskService';

// Mock the entire service layer
jest.mock('../services/taskService');

describe('useProjectTasks', () => {
  it('should return a loading state initially and then return data', async () => {
    const mockTasks = [{ id: 'task-1', name: 'My First Task' }];
    taskService.getTasksForProject.mockResolvedValue(mockTasks);

    const { result } = renderHook(() => useProjectTasks('project-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockTasks);
  });
});
```

### B. Testing the UI Kit (@flow-app/ui)

**Component Unit Tests**: For simple, presentational components (e.g., Button, Card), we will write basic tests using React Native Testing Library to ensure they render correctly and handle user interactions (like `onPress`).

## 3. Phase 2: Testing the Application (apps/mobile/)

With a tested foundation, we can confidently test the application itself, focusing on user-facing behavior.

### A. Screen Integration Tests

For each screen, we will write tests that mock our custom data hooks. This allows us to test how the screen renders in various states (loading, success, error) without hitting the database. We will verify that loading spinners, error messages, and lists of data are displayed correctly.

### B. End-to-End (E2E) Tests

E2E tests are our ultimate guarantee that the application works as expected. These tests will run on a real device/simulator and interact with the app just like a real user.

**Requirements:**

- **Technology**:
  - Detox for native iOS and Android.
  - Playwright or Cypress for the Web version.
- **Environment**: E2E tests will run against the same local Supabase instance as the service tests.

**What to Test**: We will create test suites for our most critical user journeys.

#### Critical User Journeys to Automate:

**Onboarding & First Task:**
- User signs up for a new account.
- User logs in.
- Assert that the "General" project is visible.
- User creates a new task in the "General" project.
- Assert the task appears in the list.

**Project Management:**
- User creates a new project named "Marketing Campaign".
- User navigates to the new project.
- User creates a task within that project.
- User renames the project.
- User deletes the project.

**Collaboration:**
- User A creates a project and invites User B via email.
- User B logs in and asserts they can see the shared project.
- User B adds a task to the project.
- User A logs in and asserts they can see the task created by User B.
- User A removes User B from the project.

## 4. Tooling & Infrastructure

### Dependencies

```json
"devDependencies": {
  "jest": "...",
  "ts-jest": "...",
  "@types/jest": "...",
  "@testing-library/react-native": "...",
  "detox": "...",
  // etc.
}
```

### NPM Scripts

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:e2e:ios": "detox test --configuration ios.sim.debug",
  "test:e2e:android": "detox test --configuration android.emu.debug"
}
```

## 5. Definition of Done

A feature or user story is not considered complete until:

1. All new functions in the service layer have meaningful integration test coverage.
2. All new custom hooks have unit tests covering their state management logic.
3. The associated critical user journey has a passing E2E test.
4. The entire test suite (`pnpm test`) passes in the CI/CD pipeline before any code is merged to the main branch.