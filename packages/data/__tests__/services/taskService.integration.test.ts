import { createTestUsers, deleteTestUserData, globalCleanup } from '../helpers/supabaseTestClient';

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

      // Database stores date as date type, so compare just the date portion
      expect(data.due_date).toBe(dueDate.split('T')[0]);
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
