# Testing Implementation Plan: Task Manager Feature

**Status**: In Progress
**Last Updated**: 2025-10-03
**Owner**: Development Team

## Executive Summary

This document provides a step-by-step plan to achieve 100% test coverage for the Task Manager feature (Column 2 - Task Hub) in alignment with our [Testing Strategy](../../project-wide-context/testing-strategy.md).

**Current State:**
- ✅ Basic service layer unit tests exist (mocked)
- ⚠️ RLS security tests are MISSING (critical gap)
- ❌ Hook unit tests are incomplete
- ❌ Component tests do NOT exist
- ❌ E2E tests do NOT exist

**Goal State:**
- ✅ Full service layer integration tests with live Supabase
- ✅ Comprehensive RLS security tests
- ✅ Complete hook unit tests with React Testing Library
- ✅ Component tests for all Task Hub components
- ✅ E2E tests for critical user journeys

---

## Testing Pyramid for Task Manager Feature

```
        ┌─────────────────┐
        │   E2E Tests     │  ← 8-12 critical user journeys
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
**Estimated Time**: 3-4 days
**Dependencies**: Production Supabase running

### 1.1 Reuse Existing Test Infrastructure

**Files**: Already created from Projects testing
- ✅ `packages/data/__tests__/helpers/supabaseTestClient.ts`
- ✅ Helpers: `createTestUsers`, `authenticateAs`, `deleteTestUserData`, `globalCleanup`

**Tasks:**
1. No additional setup needed - reuse existing infrastructure
2. Verify Supabase connection is working

### 1.2 Create RLS Security Tests

**File**: `packages/data/__tests__/services/taskService.rls.test.ts` (NEW)

**Purpose**: Verify Row-Level Security policies prevent unauthorized access

**Test Cases:**

```typescript
describe('TaskService RLS Security Tests', () => {
  let userA: any, userB: any, userC: any;
  let projectOwnedByA: any;
  let taskCreatedByA: any;

  beforeAll(async () => {
    const users = await createTestUsers(3);
    userA = users[0];
    userB = users[1];
    userC = users[2];
  }, 30000);

  beforeEach(async () => {
    // Create project and task owned by User A
    const { data: project } = await userA.client
      .from('projects')
      .insert({
        owner_id: userA.user.id,
        name: 'User A Project',
        is_general: false,
      })
      .select()
      .single();

    projectOwnedByA = project;

    const { data: task } = await userA.client
      .from('tasks')
      .insert({
        project_id: projectOwnedByA.id,
        name: 'User A Task',
        created_by: userA.user.id,
        assigned_to: userA.user.id,
        status: 'To Do',
      })
      .select()
      .single();

    taskCreatedByA = task;
  });

  afterEach(async () => {
    // Cleanup
    if (taskCreatedByA) {
      await userA.client.from('tasks').delete().eq('id', taskCreatedByA.id);
    }
    if (projectOwnedByA) {
      await userA.client.from('projects').delete().eq('id', projectOwnedByA.id);
    }
  });

  afterAll(async () => {
    if (userA) await deleteTestUserData(userA.client, userA.user.id);
    if (userB) await deleteTestUserData(userB.client, userB.user.id);
    if (userC) await deleteTestUserData(userC.client, userC.user.id);
    await globalCleanup();
  }, 30000);

  describe('READ Operations - RLS', () => {
    it('should NOT allow User B to read tasks from User A project', async () => {
      const { data, error } = await userB.client
        .from('tasks')
        .select('*')
        .eq('project_id', projectOwnedByA.id);

      // RLS should block - empty result
      expect(data).toEqual([]);
      expect(error).toBeNull();
    });

    it('should allow User A to read their own tasks', async () => {
      const { data, error } = await userA.client
        .from('tasks')
        .select('*')
        .eq('project_id', projectOwnedByA.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((t: any) => t.id === taskCreatedByA.id)).toBe(true);
    });

    it('should allow User B to read task when assigned to them', async () => {
      // User A assigns task to User B
      await userA.client
        .from('tasks')
        .update({ assigned_to: userB.user.id })
        .eq('id', taskCreatedByA.id);

      // User B should now be able to read it
      const { data, error } = await userB.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.assigned_to).toBe(userB.user.id);
    });

    it('should allow User B to read tasks when they are project member', async () => {
      // Add User B as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should see tasks in the project
      const { data, error } = await userB.client
        .from('tasks')
        .select('*')
        .eq('project_id', projectOwnedByA.id);

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should NOT allow User B to read specific task by ID from User A project', async () => {
      const { data, error } = await userB.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      // Should fail
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe('CREATE Operations - RLS', () => {
    it('should allow user to create task in their own project', async () => {
      const { data, error } = await userA.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'New Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.name).toBe('New Task');

      // Cleanup
      await userA.client.from('tasks').delete().eq('id', data.id);
    });

    it('should NOT allow User B to create task in User A project', async () => {
      const { data, error } = await userB.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Unauthorized Task',
          created_by: userB.user.id,
          assigned_to: userB.user.id,
          status: 'To Do',
        })
        .select();

      // Should fail with RLS violation
      expect(error).toBeTruthy();
      expect(data).toBeNull();
    });

    it('should allow project member to create tasks', async () => {
      // Add User B as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should be able to create task
      const { data, error } = await userB.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Member Task',
          created_by: userB.user.id,
          assigned_to: userB.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Cleanup
      await userB.client.from('tasks').delete().eq('id', data.id);
    });

    it('should allow assigning task to another user', async () => {
      const { data, error } = await userA.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Task for User B',
          created_by: userA.user.id,
          assigned_to: userB.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.assigned_to).toBe(userB.user.id);

      // Cleanup
      await userA.client.from('tasks').delete().eq('id', data.id);
    });
  });

  describe('UPDATE Operations - RLS', () => {
    it('should NOT allow User B to update User A task', async () => {
      const { data, error } = await userB.client
        .from('tasks')
        .update({ name: 'Hacked Name' })
        .eq('id', taskCreatedByA.id)
        .select();

      // RLS should block
      expect(data).toEqual([]);

      // Verify name didn't change
      const { data: checkData } = await userA.client
        .from('tasks')
        .select('name')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(checkData.name).toBe('User A Task');
    });

    it('should allow task creator to update their task', async () => {
      const { data, error } = await userA.client
        .from('tasks')
        .update({ name: 'Updated Name' })
        .eq('id', taskCreatedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.name).toBe('Updated Name');
    });

    it('should allow assigned user to update task status', async () => {
      // Assign task to User B
      await userA.client
        .from('tasks')
        .update({ assigned_to: userB.user.id })
        .eq('id', taskCreatedByA.id);

      // User B should be able to update status
      const { data, error } = await userB.client
        .from('tasks')
        .update({ status: 'Done', is_completed: true })
        .eq('id', taskCreatedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('Done');
      expect(data.is_completed).toBe(true);
    });

    it('should allow project member to update tasks', async () => {
      // Add User B as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should be able to update task
      const { data, error } = await userB.client
        .from('tasks')
        .update({ name: 'Updated by Member' })
        .eq('id', taskCreatedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.name).toBe('Updated by Member');
    });

    it('should NOT allow viewer to update tasks', async () => {
      // Add User B as viewer
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'viewer',
        });

      // User B (viewer) should NOT be able to update
      const { data } = await userB.client
        .from('tasks')
        .update({ name: 'Hack Attempt' })
        .eq('id', taskCreatedByA.id)
        .select();

      expect(data).toEqual([]);
    });
  });

  describe('DELETE Operations - RLS', () => {
    it('should NOT allow User B to delete User A task', async () => {
      const { data } = await userB.client
        .from('tasks')
        .delete()
        .eq('id', taskCreatedByA.id)
        .select();

      expect(data).toEqual([]);

      // Verify task still exists
      const { data: checkData } = await userA.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(checkData).toBeDefined();
    });

    it('should allow task creator to delete their task', async () => {
      // Create temp task
      const { data: tempTask } = await userA.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Temp Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      // Delete it
      const { error } = await userA.client
        .from('tasks')
        .delete()
        .eq('id', tempTask.id);

      expect(error).toBeNull();

      // Verify deleted
      const { data } = await userA.client
        .from('tasks')
        .select('*')
        .eq('id', tempTask.id);

      expect(data).toEqual([]);
    });

    it('should allow project owner to delete tasks', async () => {
      // User B creates task in User A's project as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      const { data: taskByB } = await userB.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Task by User B',
          created_by: userB.user.id,
          assigned_to: userB.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      // User A (project owner) should be able to delete it
      const { error } = await userA.client
        .from('tasks')
        .delete()
        .eq('id', taskByB.id);

      expect(error).toBeNull();
    });

    it('should NOT allow regular member to delete other members tasks', async () => {
      // Add User B and User C as members
      await userA.client
        .from('project_users')
        .insert([
          {
            project_id: projectOwnedByA.id,
            user_id: userB.user.id,
            role: 'member',
          },
          {
            project_id: projectOwnedByA.id,
            user_id: userC.user.id,
            role: 'member',
          },
        ]);

      // User C creates a task
      const { data: taskByC } = await userC.client
        .from('tasks')
        .insert({
          project_id: projectOwnedByA.id,
          name: 'Task by User C',
          created_by: userC.user.id,
          assigned_to: userC.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      // User B should NOT be able to delete User C's task
      const { data } = await userB.client
        .from('tasks')
        .delete()
        .eq('id', taskByC.id)
        .select();

      expect(data).toEqual([]);

      // Cleanup
      await userC.client.from('tasks').delete().eq('id', taskByC.id);
    });
  });

  describe('Task Assignment Security', () => {
    it('should allow reassigning task to another user in same project', async () => {
      // Add User B as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User A assigns task to User B
      const { data, error } = await userA.client
        .from('tasks')
        .update({ assigned_to: userB.user.id })
        .eq('id', taskCreatedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.assigned_to).toBe(userB.user.id);

      // User B should now see the task
      const { data: taskFromB } = await userB.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(taskFromB).toBeDefined();
    });

    it('should NOT allow assigning task to user not in project', async () => {
      // User A tries to assign to User C (not a member)
      const { data, error } = await userA.client
        .from('tasks')
        .update({ assigned_to: userC.user.id })
        .eq('id', taskCreatedByA.id)
        .select();

      // This might be allowed by database, but User C won't be able to see it
      // Verify User C cannot read the task
      const { data: taskFromC } = await userC.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(taskFromC).toBeNull();
    });
  });

  describe('Cross-User Data Isolation', () => {
    it('should completely isolate tasks between unrelated users', async () => {
      // User A creates tasks
      const tasksA = [];
      for (let i = 0; i < 3; i++) {
        const { data } = await userA.client
          .from('tasks')
          .insert({
            project_id: projectOwnedByA.id,
            name: `User A Task ${i}`,
            created_by: userA.user.id,
            assigned_to: userA.user.id,
            status: 'To Do',
          })
          .select()
          .single();
        tasksA.push(data);
      }

      // User B creates project and tasks
      const { data: projectB } = await userB.client
        .from('projects')
        .insert({
          owner_id: userB.user.id,
          name: 'User B Project',
          is_general: false,
        })
        .select()
        .single();

      const tasksB = [];
      for (let i = 0; i < 3; i++) {
        const { data } = await userB.client
          .from('tasks')
          .insert({
            project_id: projectB.id,
            name: `User B Task ${i}`,
            created_by: userB.user.id,
            assigned_to: userB.user.id,
            status: 'To Do',
          })
          .select()
          .single();
        tasksB.push(data);
      }

      // User A should ONLY see their tasks
      const { data: userATasks } = await userA.client
        .from('tasks')
        .select('*')
        .eq('project_id', projectOwnedByA.id);

      expect(userATasks.length).toBeGreaterThanOrEqual(3);
      expect(userATasks.every((t: any) => t.created_by === userA.user.id)).toBe(true);

      // User B should ONLY see their tasks
      const { data: userBTasks } = await userB.client
        .from('tasks')
        .select('*')
        .eq('project_id', projectB.id);

      expect(userBTasks.length).toBeGreaterThanOrEqual(3);
      expect(userBTasks.every((t: any) => t.created_by === userB.user.id)).toBe(true);

      // Cleanup
      for (const task of tasksA) {
        await userA.client.from('tasks').delete().eq('id', task.id);
      }
      for (const task of tasksB) {
        await userB.client.from('tasks').delete().eq('id', task.id);
      }
      await userB.client.from('projects').delete().eq('id', projectB.id);
    });
  });
});
```

### 1.3 Add Missing Integration Tests

**File**: `packages/data/__tests__/services/taskService.integration.test.ts` (NEW)

**Test Cases:**

```typescript
describe('TaskService Integration Tests', () => {
  let userA: any;
  let project: any;
  let createdTasks: any[] = [];

  beforeAll(async () => {
    const users = await createTestUsers(1);
    userA = users[0];

    // Create project
    const { data } = await userA.client
      .from('projects')
      .insert({
        owner_id: userA.user.id,
        name: 'Test Project',
        is_general: false,
      })
      .select()
      .single();

    project = data;
  }, 30000);

  afterEach(async () => {
    // Clean up tasks
    for (const task of createdTasks) {
      await userA.client.from('tasks').delete().eq('id', task.id);
    }
    createdTasks = [];
  });

  afterAll(async () => {
    if (project) {
      await userA.client.from('projects').delete().eq('id', project.id);
    }
    if (userA) await deleteTestUserData(userA.client, userA.user.id);
    await globalCleanup();
  }, 30000);

  describe('getTasksForProject', () => {
    it('should return all tasks for a project', async () => {
      // Create multiple tasks
      for (let i = 0; i < 3; i++) {
        const { data } = await userA.client
          .from('tasks')
          .insert({
            project_id: project.id,
            name: `Task ${i}`,
            created_by: userA.user.id,
            assigned_to: userA.user.id,
            status: 'To Do',
          })
          .select()
          .single();
        createdTasks.push(data);
      }

      const { data, error } = await userA.client
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(data.length).toBe(3);
    });

    it('should return empty array for project with no tasks', async () => {
      const { data: emptyProject } = await userA.client
        .from('projects')
        .insert({
          owner_id: userA.user.id,
          name: 'Empty Project',
          is_general: false,
        })
        .select()
        .single();

      const { data } = await userA.client
        .from('tasks')
        .select('*')
        .eq('project_id', emptyProject.id);

      expect(data).toEqual([]);

      // Cleanup
      await userA.client.from('projects').delete().eq('id', emptyProject.id);
    });

    it('should order tasks by created_at descending', async () => {
      // Create tasks with delays
      const task1 = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'First Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();
      createdTasks.push(task1.data);

      await new Promise(resolve => setTimeout(resolve, 100));

      const task2 = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Second Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();
      createdTasks.push(task2.data);

      const { data } = await userA.client
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      expect(data[0].name).toBe('Second Task');
      expect(data[1].name).toBe('First Task');
    });
  });

  describe('getTasksForUser', () => {
    it('should return all tasks assigned to user across projects', async () => {
      // Create another project
      const { data: project2 } = await userA.client
        .from('projects')
        .insert({
          owner_id: userA.user.id,
          name: 'Project 2',
          is_general: false,
        })
        .select()
        .single();

      // Create tasks in different projects
      const task1 = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Task in Project 1',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      const task2 = await userA.client
        .from('tasks')
        .insert({
          project_id: project2.id,
          name: 'Task in Project 2',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      createdTasks.push(task1.data, task2.data);

      const { data } = await userA.client
        .from('tasks')
        .select('*')
        .eq('assigned_to', userA.user.id);

      expect(data.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await userA.client.from('projects').delete().eq('id', project2.id);
    });

    it('should include tasks from projects where user is member', async () => {
      // This test would require creating a second user
      // and adding them as project member - similar to RLS tests
    });
  });

  describe('createTask', () => {
    it('should create task with all properties', async () => {
      const taskData = {
        project_id: project.id,
        name: 'Complete Task',
        description: 'Task description',
        due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        created_by: userA.user.id,
        assigned_to: userA.user.id,
      };

      const { data, error } = await userA.client
        .from('tasks')
        .insert({
          ...taskData,
          status: 'To Do',
          is_completed: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.name).toBe('Complete Task');
      expect(data.description).toBe('Task description');
      expect(data.due_date).toBeTruthy();
      expect(data.assigned_to).toBe(userA.user.id);
      expect(data.status).toBe('To Do');

      createdTasks.push(data);
    });

    it('should auto-assign to creator when no assignee specified', async () => {
      const { data } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Auto-assigned Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id, // Explicitly set in Supabase insert
          status: 'To Do',
        })
        .select()
        .single();

      expect(data.assigned_to).toBe(userA.user.id);
      expect(data.created_by).toBe(userA.user.id);

      createdTasks.push(data);
    });

    it('should set default status to To Do', async () => {
      const { data } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Default Status Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(data.status).toBe('To Do');
      expect(data.is_completed).toBe(false);

      createdTasks.push(data);
    });

    it('should handle missing optional fields', async () => {
      const { data } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Minimal Task',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(data.description).toBeNull();
      expect(data.due_date).toBeNull();

      createdTasks.push(data);
    });
  });

  describe('updateTask', () => {
    let task: any;

    beforeEach(async () => {
      const { data } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Task to Update',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();
      task = data;
      createdTasks.push(task);
    });

    it('should update task name', async () => {
      const { data } = await userA.client
        .from('tasks')
        .update({ name: 'Updated Name' })
        .eq('id', task.id)
        .select()
        .single();

      expect(data.name).toBe('Updated Name');
    });

    it('should update task status', async () => {
      const { data } = await userA.client
        .from('tasks')
        .update({ status: 'In Progress' })
        .eq('id', task.id)
        .select()
        .single();

      expect(data.status).toBe('In Progress');
    });

    it('should mark task as completed', async () => {
      const { data } = await userA.client
        .from('tasks')
        .update({ status: 'Done', is_completed: true })
        .eq('id', task.id)
        .select()
        .single();

      expect(data.status).toBe('Done');
      expect(data.is_completed).toBe(true);
    });

    it('should update due date', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const { data } = await userA.client
        .from('tasks')
        .update({ due_date: dueDate })
        .eq('id', task.id)
        .select()
        .single();

      expect(data.due_date).toBe(dueDate);
    });

    it('should reassign task to different user', async () => {
      // Create second user
      const users = await createTestUsers(1);
      const userB = users[0];

      // Add userB as project member
      await userA.client
        .from('project_users')
        .insert({
          project_id: project.id,
          user_id: userB.user.id,
          role: 'member',
        });

      const { data } = await userA.client
        .from('tasks')
        .update({ assigned_to: userB.user.id })
        .eq('id', task.id)
        .select()
        .single();

      expect(data.assigned_to).toBe(userB.user.id);

      // Cleanup
      await deleteTestUserData(userB.client, userB.user.id);
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      const { data: task } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: 'Task to Delete',
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      const { error } = await userA.client
        .from('tasks')
        .delete()
        .eq('id', task.id);

      expect(error).toBeNull();

      // Verify deleted
      const { data: deletedTask } = await userA.client
        .from('tasks')
        .select('*')
        .eq('id', task.id);

      expect(deletedTask).toEqual([]);
    });

    it('should handle deleting non-existent task', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';

      const { error } = await userA.client
        .from('tasks')
        .delete()
        .eq('id', nonExistentId);

      // Should not error, just no rows affected
      expect(error).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with very long names', async () => {
      const longName = 'A'.repeat(500);

      const { data, error } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: longName,
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      if (error) {
        // Database constraint should handle this
        expect(error).toBeTruthy();
      } else {
        expect(data.name).toBe(longName);
        createdTasks.push(data);
      }
    });

    it('should handle tasks with unicode characters', async () => {
      const unicodeName = 'Task 任务 タスク 🚀';

      const { data } = await userA.client
        .from('tasks')
        .insert({
          project_id: project.id,
          name: unicodeName,
          created_by: userA.user.id,
          assigned_to: userA.user.id,
          status: 'To Do',
        })
        .select()
        .single();

      expect(data.name).toBe(unicodeName);
      createdTasks.push(data);
    });

    it('should handle concurrent task creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        userA.client
          .from('tasks')
          .insert({
            project_id: project.id,
            name: `Concurrent Task ${i}`,
            created_by: userA.user.id,
            assigned_to: userA.user.id,
            status: 'To Do',
          })
          .select()
          .single()
      );

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.error).toBeNull();
        expect(result.data).toBeDefined();
        if (result.data) createdTasks.push(result.data);
      });

      expect(createdTasks.length).toBe(10);
    });
  });
});
```

### 1.4 Run and Verify Service Tests

**Commands:**
```bash
# Run all task service tests
pnpm test taskService

# Run only RLS tests
pnpm test taskService.rls.test.ts

# Run only integration tests
pnpm test taskService.integration.test.ts
```

**Success Criteria:**
- ✅ All RLS tests pass (once email issue resolved)
- ✅ All integration tests pass
- ✅ Test coverage for taskService.ts is >90%
- ✅ No flaky tests

---

## Phase 2: Hook Unit Tests

**Priority**: HIGH
**Estimated Time**: 2-3 days
**Dependencies**: Phase 1 complete

### 2.1 Reuse React Testing Library Setup

**Files**: Already configured from Projects testing
- ✅ `packages/data/jest.setup.js`
- ✅ `packages/data/jest.config.js`

### 2.2 Create Hook Tests with Mocked Services

**File**: `packages/data/__tests__/hooks/useTask.test.tsx` (REPLACE existing simple test)

**Test Cases:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProjectTasks,
  useUserTasks,
  useProjectsTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from '../../hooks/useTask';
import * as taskService from '../../services/taskService';

jest.mock('../../services/taskService');

const mockedService = taskService as jest.Mocked<typeof taskService>;

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

describe('useTask Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProjectTasks', () => {
    const mockTasks = [
      {
        id: 'task1',
        project_id: 'proj1',
        name: 'Task 1',
        created_by: 'user1',
        assigned_to: 'user1',
        status: 'To Do',
        is_completed: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
    ];

    it('should return loading state initially', () => {
      mockedService.getTasksForProject.mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(
        () => useProjectTasks('proj1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should return tasks on success', async () => {
      mockedService.getTasksForProject.mockResolvedValue(mockTasks);

      const { result } = renderHook(
        () => useProjectTasks('proj1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockTasks);
    });

    it('should return error state on failure', async () => {
      const error = new Error('Failed to fetch tasks');
      mockedService.getTasksForProject.mockRejectedValue(error);

      const { result } = renderHook(
        () => useProjectTasks('proj1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });

    it('should not run query when projectId is undefined', () => {
      const { result } = renderHook(
        () => useProjectTasks(undefined as any),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockedService.getTasksForProject).not.toHaveBeenCalled();
    });

    it('should respect staleTime of 30 seconds', async () => {
      mockedService.getTasksForProject.mockResolvedValue(mockTasks);

      const { result, rerender } = renderHook(
        () => useProjectTasks('proj1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      mockedService.getTasksForProject.mockClear();

      rerender();

      expect(mockedService.getTasksForProject).not.toHaveBeenCalled();
    });
  });

  describe('useCreateTask', () => {
    const mockTask = {
      id: 'new-task',
      project_id: 'proj1',
      name: 'New Task',
      created_by: 'user1',
      assigned_to: 'user1',
      status: 'To Do',
      is_completed: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('should show isPending during mutation', async () => {
      mockedService.createTask.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTask), 100))
      );

      const { result } = renderHook(
        () => useCreateTask(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({
        project_id: 'proj1',
        name: 'New Task',
      });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
    });

    it('should call createTask service with correct params', async () => {
      mockedService.createTask.mockResolvedValue(mockTask);

      const { result } = renderHook(
        () => useCreateTask(),
        { wrapper: createWrapper() }
      );

      result.current.mutate({
        project_id: 'proj1',
        name: 'New Task',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.createTask).toHaveBeenCalledWith({
        project_id: 'proj1',
        name: 'New Task',
      });
    });

    it('should invalidate project tasks on success', async () => {
      mockedService.createTask.mockResolvedValue(mockTask);
      mockedService.getTasksForProject.mockResolvedValue([]);

      const wrapper = createWrapper();

      // Render project tasks hook
      const { result: projectTasksResult } = renderHook(
        () => useProjectTasks('proj1'),
        { wrapper }
      );

      await waitFor(() => expect(projectTasksResult.current.isSuccess).toBe(true));

      // Create a task
      const { result: createResult } = renderHook(
        () => useCreateTask(),
        { wrapper }
      );

      createResult.current.mutate({
        project_id: 'proj1',
        name: 'New Task',
      });

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true));

      // Query should be invalidated (would refetch in real scenario)
    });
  });

  describe('useUpdateTask', () => {
    const originalTask = {
      id: 'task1',
      project_id: 'proj1',
      name: 'Original Name',
      created_by: 'user1',
      assigned_to: 'user1',
      status: 'To Do',
      is_completed: false,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    const updatedTask = {
      ...originalTask,
      name: 'Updated Name',
    };

    it('should perform optimistic update', async () => {
      mockedService.updateTask.mockResolvedValue(updatedTask);
      mockedService.getTaskById.mockResolvedValue(originalTask);

      const wrapper = createWrapper();

      // Fetch original task
      const { result: taskResult } = renderHook(
        () => useTask('task1'),
        { wrapper }
      );

      await waitFor(() => expect(taskResult.current.data).toEqual(originalTask));

      // Update task
      const { result: updateResult } = renderHook(
        () => useUpdateTask(),
        { wrapper }
      );

      updateResult.current.mutate({
        taskId: 'task1',
        updates: { name: 'Updated Name' },
      });

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true));

      expect(mockedService.updateTask).toHaveBeenCalledWith('task1', {
        name: 'Updated Name',
      });
    });

    it('should rollback on error', async () => {
      const error = new Error('Update failed');
      mockedService.updateTask.mockRejectedValue(error);
      mockedService.getTaskById.mockResolvedValue(originalTask);

      const wrapper = createWrapper();

      const { result: taskResult } = renderHook(
        () => useTask('task1'),
        { wrapper }
      );

      await waitFor(() => expect(taskResult.current.data).toEqual(originalTask));

      const { result: updateResult } = renderHook(
        () => useUpdateTask(),
        { wrapper }
      );

      updateResult.current.mutate({
        taskId: 'task1',
        updates: { name: 'Updated Name' },
      });

      await waitFor(() => expect(updateResult.current.isError).toBe(true));

      // Task should revert to original
      expect(taskResult.current.data?.name).toBe('Original Name');
    });
  });

  describe('useDeleteTask', () => {
    it('should delete task and invalidate queries', async () => {
      mockedService.deleteTask.mockResolvedValue();

      const { result } = renderHook(
        () => useDeleteTask(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('task1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedService.deleteTask).toHaveBeenCalledWith('task1');
    });

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed');
      mockedService.deleteTask.mockRejectedValue(error);

      const { result } = renderHook(
        () => useDeleteTask(),
        { wrapper: createWrapper() }
      );

      result.current.mutate('task1');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });
});
```

### 2.3 Run and Verify Hook Tests

**Commands:**
```bash
pnpm test hooks/useTask.test.tsx
```

**Success Criteria:**
- ✅ All hook tests pass
- ✅ Test coverage for useTask.ts is >85%
- ✅ All loading/success/error states tested
- ✅ Optimistic updates verified

---

## Phase 3: Component Tests

**Priority**: MEDIUM
**Estimated Time**: 3-4 days
**Dependencies**: Phase 2 complete

### 3.1 Component Testing Setup

**Files**: Reuse from Projects testing
- ✅ `packages/ui/jest.config.js`
- ✅ `packages/ui/jest.setup.js`

### 3.2 Create Component Tests

**Priority Component Tests:**

1. **TaskQuickAdd.test.tsx** - Quick-add bar with `/in` command
2. **TaskItem.test.tsx** - Individual task rendering and interactions
3. **TaskList.test.tsx** - Task list with drag-and-drop
4. **TaskFiltersBar.test.tsx** - Search and filtering
5. **TaskGroup.test.tsx** - Grouped task display

**Example: TaskQuickAdd.test.tsx**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskQuickAdd } from '../TaskQuickAdd';
import * as dataHooks from '@perfect-task-app/data';

jest.mock('@perfect-task-app/data');

const mockedHooks = dataHooks as jest.Mocked<typeof dataHooks>;

describe('TaskQuickAdd', () => {
  const mockOnTaskCreated = jest.fn();
  const mockProjects = [
    { id: 'proj1', name: 'General' },
    { id: 'proj2', name: 'Work' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockedHooks.useProjectsForUser.mockReturnValue({
      data: mockProjects,
      isLoading: false,
      isError: false,
    });

    mockedHooks.useCreateTask.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    });
  });

  it('should render input field', () => {
    render(<TaskQuickAdd userId="user1" onTaskCreated={mockOnTaskCreated} />);

    expect(screen.getByPlaceholderText(/add a task/i)).toBeInTheDocument();
  });

  it('should create task on Enter press', async () => {
    const mockMutate = jest.fn();
    mockedHooks.useCreateTask.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    });

    render(<TaskQuickAdd userId="user1" onTaskCreated={mockOnTaskCreated} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    fireEvent.change(input, { target: { value: 'New Task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Task',
        })
      );
    });
  });

  it('should show project autocomplete on /in command', async () => {
    render(<TaskQuickAdd userId="user1" onTaskCreated={mockOnTaskCreated} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    fireEvent.change(input, { target: { value: 'Buy milk /in ' } });

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });

  it('should extract project from /in command', async () => {
    const mockMutate = jest.fn();
    mockedHooks.useCreateTask.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    });

    render(<TaskQuickAdd userId="user1" onTaskCreated={mockOnTaskCreated} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    fireEvent.change(input, { target: { value: 'Buy milk /in Work' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Buy milk',
          project_id: 'proj2',
        })
      );
    });
  });
});
```

### 3.3 Run and Verify Component Tests

**Commands:**
```bash
cd packages/ui
pnpm test components/__tests__/Task*.test.tsx
```

**Success Criteria:**
- ✅ All component tests pass
- ✅ Test coverage for Task components >80%
- ✅ All user interactions tested

---

## Phase 4: End-to-End Tests

**Priority**: MEDIUM
**Estimated Time**: 4-5 days
**Dependencies**: Phase 3 complete

### 4.1 Setup E2E Testing (Playwright)

**File**: `apps/web/playwright.config.ts` (reuse from Projects)

### 4.2 Create E2E Tests for Critical User Journeys

**File**: `apps/web/e2e/tasks.spec.ts` (NEW)

**Critical Journeys:**

```typescript
test.describe('Task Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post('http://localhost:3000/api/test/reset-db');
    await page.goto('/signup');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/app');
  });

  test('should create task via quick-add', async ({ page }) => {
    await page.click('[placeholder*="Add a task"]');
    await page.fill('[placeholder*="Add a task"]', 'Buy groceries');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Buy groceries')).toBeVisible();
  });

  test('should create task with /in command', async ({ page }) => {
    // Create a new project first
    await page.click('[aria-label="Create project"]');
    await page.fill('input[placeholder="Project name..."]', 'Shopping');
    await page.keyboard.press('Enter');

    // Create task with /in
    await page.fill('[placeholder*="Add a task"]', 'Buy milk /in Shopping');
    await page.keyboard.press('Enter');

    // Verify task in Shopping project
    await page.click('text=Shopping');
    await expect(page.locator('text=Buy milk')).toBeVisible();
  });

  test('should mark task as complete', async ({ page }) => {
    // Create task
    await page.fill('[placeholder*="Add a task"]', 'Test Task');
    await page.keyboard.press('Enter');

    // Mark complete
    await page.click('[aria-label*="Mark as done"]');

    // Verify strikethrough
    const task = page.locator('text=Test Task');
    await expect(task).toHaveClass(/line-through/);
  });

  test('should drag task to calendar', async ({ page }) => {
    // Create task
    await page.fill('[placeholder*="Add a task"]', 'Schedule me');
    await page.keyboard.press('Enter');

    // Drag to calendar
    const task = page.locator('text=Schedule me');
    const calendar = page.locator('[data-testid="calendar"]');

    await task.dragTo(calendar);

    // Verify task appears in calendar
    await expect(calendar.locator('text=Schedule me')).toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    // Create tasks
    await page.fill('[placeholder*="Add a task"]', 'Task 1');
    await page.keyboard.press('Enter');
    await page.fill('[placeholder*="Add a task"]', 'Task 2');
    await page.keyboard.press('Enter');

    // Mark one complete
    await page.click('[aria-label*="Mark as done"]');

    // Filter by status
    await page.click('text=Filter');
    await page.click('text=To Do');

    // Should only show incomplete task
    await expect(page.locator('text=Task 2')).toBeVisible();
    await expect(page.locator('text=Task 1')).not.toBeVisible();
  });

  test('should search tasks', async ({ page }) => {
    // Create tasks
    await page.fill('[placeholder*="Add a task"]', 'Buy milk');
    await page.keyboard.press('Enter');
    await page.fill('[placeholder*="Add a task"]', 'Buy bread');
    await page.keyboard.press('Enter');
    await page.fill('[placeholder*="Add a task"]', 'Call plumber');
    await page.keyboard.press('Enter');

    // Search
    await page.fill('[placeholder*="Search tasks"]', 'buy');

    // Should show filtered results
    await expect(page.locator('text=Buy milk')).toBeVisible();
    await expect(page.locator('text=Buy bread')).toBeVisible();
    await expect(page.locator('text=Call plumber')).not.toBeVisible();
  });

  test('should edit task inline', async ({ page }) => {
    // Create task
    await page.fill('[placeholder*="Add a task"]', 'Original Name');
    await page.keyboard.press('Enter');

    // Click to edit
    const task = page.locator('text=Original Name');
    await task.click();

    // Edit name
    const editInput = page.locator('input[value="Original Name"]');
    await editInput.fill('Updated Name');
    await editInput.press('Enter');

    // Verify update
    await expect(page.locator('text=Updated Name')).toBeVisible();
    await expect(page.locator('text=Original Name')).not.toBeVisible();
  });

  test('should delete task', async ({ page }) => {
    // Create task
    await page.fill('[placeholder*="Add a task"]', 'Task to Delete');
    await page.keyboard.press('Enter');

    // Delete
    const task = page.locator('text=Task to Delete').locator('..');
    await task.hover();
    await task.locator('[aria-label="Delete"]').click();

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Verify deleted
    await expect(page.locator('text=Task to Delete')).not.toBeVisible();
  });
});
```

### 4.3 Run E2E Tests

**Commands:**
```bash
cd apps/web
pnpm exec playwright test tasks.spec.ts
```

**Success Criteria:**
- ✅ All critical journeys pass
- ✅ Tests run reliably
- ✅ Test execution < 5 minutes

---

## Phase 5: Continuous Integration

**Priority**: HIGH
**Estimated Time**: 1 day
**Dependencies**: All phases complete

### 5.1 Setup GitHub Actions

**File**: `.github/workflows/test-tasks.yml` (NEW)

```yaml
name: Task Manager Tests

on:
  pull_request:
    paths:
      - 'packages/data/services/taskService.ts'
      - 'packages/data/hooks/useTask.ts'
      - 'apps/web/components/Task*'
      - 'packages/data/__tests__/**'
      - 'apps/web/e2e/**'
  push:
    branches: [main, develop]

jobs:
  service-tests:
    name: Service Layer Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.12.4
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test services/taskService

  hook-tests:
    name: Hook Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test hooks/useTask.test.tsx

  component-tests:
    name: Component Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test components/__tests__/Task

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm exec playwright test tasks.spec.ts
```

### 5.2 Definition of Done

**A PR for Task Manager is NOT ready to merge unless:**

```markdown
## Testing Checklist

### Service Layer
- [ ] All service functions have integration tests with live Supabase
- [ ] RLS security tests pass for all CRUD operations
- [ ] Edge cases tested
- [ ] Service test coverage > 90%

### Hooks
- [ ] All hooks have unit tests with mocked services
- [ ] Loading/success/error states tested
- [ ] Optimistic updates verified
- [ ] Hook test coverage > 85%

### Components
- [ ] All Task components have tests
- [ ] User interactions tested
- [ ] Component test coverage > 80%

### E2E
- [ ] Critical user journeys have E2E tests
- [ ] All E2E tests pass locally
- [ ] All E2E tests pass in CI

### CI/CD
- [ ] All test suites pass in GitHub Actions
- [ ] No flaky tests
- [ ] Test execution time < 10 minutes
```

---

## Tracking Progress

**Create GitHub Issues:**

1. **Issue #1**: Task Service Integration Tests + RLS
2. **Issue #2**: Task Hook Unit Tests
3. **Issue #3**: Task Component Tests
4. **Issue #4**: Task E2E Tests
5. **Issue #5**: Task CI/CD Pipeline

**Estimated Total Time**: 12-18 days (1 developer)

---

## Conclusion

This plan provides a systematic approach to achieve 100% test coverage for the Task Manager feature. By following the testing pyramid, we ensure stability and maintainability.

**Next Steps:**
1. Review plan with team
2. Create GitHub issues
3. Start Phase 1 immediately
4. Weekly progress check-ins
