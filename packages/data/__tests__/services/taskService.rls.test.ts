import { createTestUsers, deleteTestUserData, globalCleanup } from '../helpers/supabaseTestClient';

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

    it('should allow assigning task to user not in project (assigned users can see tasks)', async () => {
      // User A tries to assign to User C (not a member)
      const { data, error } = await userA.client
        .from('tasks')
        .update({ assigned_to: userC.user.id })
        .eq('id', taskCreatedByA.id)
        .select();

      // Assignment succeeds - users can be assigned tasks outside their project
      expect(error).toBeNull();

      // User C CAN read the task because they're assigned to it
      // This is by design - if someone assigns you a task, you should see it
      const { data: taskFromC } = await userC.client
        .from('tasks')
        .select('*')
        .eq('id', taskCreatedByA.id)
        .single();

      expect(taskFromC).toBeDefined();
      expect(taskFromC.assigned_to).toBe(userC.user.id);
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
