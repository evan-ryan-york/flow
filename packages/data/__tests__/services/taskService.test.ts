import { supabase } from '../../supabase';
import {
  getTasksForProject,
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  type CreateTaskData,
  type UpdateTaskData
} from '../../services/taskService';
import { TaskSchema } from '@perfect-task-app/models';

// Test users and data
let testUserA: any;
let testUserB: any;
let testProjectA: any;
let testProjectB: any;

describe('taskService Integration Tests', () => {
  beforeEach(async () => {
    // Note: In a real implementation, you would reset the database here
    // using `supabase db reset` or similar test database setup

    // Create test users for authentication testing
    const { data: userAAuth } = await supabase.auth.signUp({
      email: 'testusera@example.com',
      password: 'testpassword123',
    });

    const { data: userBAuth } = await supabase.auth.signUp({
      email: 'testuserb@example.com',
      password: 'testpassword123',
    });

    testUserA = userAAuth.user;
    testUserB = userBAuth.user;

    // Authenticate as User A to create test project
    await supabase.auth.signInWithPassword({
      email: 'testusera@example.com',
      password: 'testpassword123',
    });

    // Create test project for User A (General project should be auto-created by trigger)
    const { data: projectsA } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', testUserA.id)
      .eq('is_general', true)
      .single();

    testProjectA = projectsA;

    // Authenticate as User B and get their project
    await supabase.auth.signInWithPassword({
      email: 'testuserb@example.com',
      password: 'testpassword123',
    });

    const { data: projectsB } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', testUserB.id)
      .eq('is_general', true)
      .single();

    testProjectB = projectsB;
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.auth.signOut();
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Authenticate as User A for these tests
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should create a task successfully', async () => {
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Test Task',
        description: 'This is a test task',
        status: 'todo',
      };

      const result = await createTask(taskData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Task');
      expect(result.project_id).toBe(testProjectA.id);
      expect(result.created_by).toBe(testUserA.id);
      expect(result.is_completed).toBe(false);

      // Verify Zod validation passed (no error thrown)
      expect(() => TaskSchema.parse(result)).not.toThrow();
    });

    it('should fetch tasks for a project', async () => {
      // First create a test task
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Project Task 1',
        description: 'Task for project A',
      };

      const createdTask = await createTask(taskData);

      // Now fetch tasks for the project
      const tasks = await getTasksForProject(testProjectA.id);

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.find(task => task.id === createdTask.id)).toBeDefined();

      // Verify all tasks belong to the project
      tasks.forEach(task => {
        expect(task.project_id).toBe(testProjectA.id);
        expect(() => TaskSchema.parse(task)).not.toThrow();
      });
    });

    it('should fetch a single task by ID', async () => {
      // Create a test task
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Single Task Test',
      };

      const createdTask = await createTask(taskData);

      // Fetch the task by ID
      const fetchedTask = await getTaskById(createdTask.id);

      expect(fetchedTask).toBeDefined();
      expect(fetchedTask?.id).toBe(createdTask.id);
      expect(fetchedTask?.name).toBe('Single Task Test');
      expect(() => TaskSchema.parse(fetchedTask)).not.toThrow();
    });

    it('should return null for non-existent task', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const result = await getTaskById(nonExistentId);

      expect(result).toBeNull();
    });

    it('should update a task successfully', async () => {
      // Create a test task
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Task to Update',
        status: 'todo',
      };

      const createdTask = await createTask(taskData);

      // Update the task
      const updates: UpdateTaskData = {
        name: 'Updated Task Name',
        status: 'in-progress',
        is_completed: false,
      };

      const updatedTask = await updateTask(createdTask.id, updates);

      expect(updatedTask.id).toBe(createdTask.id);
      expect(updatedTask.name).toBe('Updated Task Name');
      expect(updatedTask.status).toBe('in-progress');
      expect(updatedTask.is_completed).toBe(false);
      expect(() => TaskSchema.parse(updatedTask)).not.toThrow();
    });

    it('should delete a task successfully', async () => {
      // Create a test task
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Task to Delete',
      };

      const createdTask = await createTask(taskData);

      // Verify task exists
      let fetchedTask = await getTaskById(createdTask.id);
      expect(fetchedTask).toBeDefined();

      // Delete the task
      await deleteTask(createdTask.id);

      // Verify task is deleted
      fetchedTask = await getTaskById(createdTask.id);
      expect(fetchedTask).toBeNull();
    });
  });

  describe('Row Level Security (RLS) Tests', () => {
    it('should only allow users to fetch tasks from their own projects', async () => {
      // As User A, create a task in their project
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const taskDataA: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'User A Task',
      };
      await createTask(taskDataA);

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not be able to see User A's tasks
      const tasksForUserAProject = await getTasksForProject(testProjectA.id);
      expect(tasksForUserAProject).toEqual([]);

      // But User B should be able to see their own project (even if empty)
      const tasksForUserBProject = await getTasksForProject(testProjectB.id);
      expect(Array.isArray(tasksForUserBProject)).toBe(true);
    });

    it('should not allow users to update tasks in projects they dont own', async () => {
      // As User A, create a task
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Protected Task',
      };
      const createdTask = await createTask(taskData);

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not be able to update User A's task
      await expect(updateTask(createdTask.id, { name: 'Hacked!' }))
        .rejects
        .toThrow();
    });

    it('should not allow users to delete tasks in projects they dont own', async () => {
      // As User A, create a task
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Protected Task',
      };
      const createdTask = await createTask(taskData);

      // Switch to User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      // User B should not be able to delete User A's task
      await expect(deleteTask(createdTask.id))
        .rejects
        .toThrow();
    });
  });

  describe('Data Shape Validation', () => {
    beforeEach(async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should validate all task data against Zod schema', async () => {
      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Schema Test Task',
        description: 'Testing schema validation',
        due_date: '2024-12-31',
        status: 'todo',
      };

      const result = await createTask(taskData);

      // This should not throw because the service validates with Zod
      expect(() => TaskSchema.parse(result)).not.toThrow();

      // Verify all expected fields are present and correctly typed
      expect(typeof result.id).toBe('string');
      expect(typeof result.project_id).toBe('string');
      expect(typeof result.created_by).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.is_completed).toBe('boolean');
      expect(typeof result.created_at).toBe('string');
      expect(typeof result.updated_at).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });
    });

    it('should handle empty task lists gracefully', async () => {
      // Create a new project for this test
      const { data: emptyProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUserA.id,
          name: 'Empty Project',
        })
        .select()
        .single();

      const tasks = await getTasksForProject(emptyProject.id);

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBe(0);
    });

    it('should require authentication for all operations', async () => {
      // Sign out to test unauthenticated access
      await supabase.auth.signOut();

      const taskData: CreateTaskData = {
        project_id: testProjectA.id,
        name: 'Unauthorized Task',
      };

      await expect(createTask(taskData))
        .rejects
        .toThrow('User must be authenticated');
    });
  });
});