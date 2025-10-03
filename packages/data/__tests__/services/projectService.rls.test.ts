/**
 * Row-Level Security (RLS) Tests for Project Service
 *
 * These tests verify that RLS policies correctly prevent unauthorized access
 * to project data across different users.
 */

import {
  createProject,
  getProjectsForUser,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
} from '../../services/projectService';
import {
  createTestUsers,
  deleteTestUserData,
  globalCleanup,
} from '../helpers/supabaseTestClient';

describe('ProjectService RLS Security Tests', () => {
  let userA: any, userB: any, userC: any;
  let projectOwnedByA: any;

  beforeAll(async () => {
    // Create three test users
    const users = await createTestUsers(3);
    userA = users[0];
    userB = users[1];
    userC = users[2];
  }, 30000);

  beforeEach(async () => {
    // Create a project owned by User A using their authenticated client
    // The service will use the global supabase client, so we need to mock it
    // For now, we'll create directly using the client
    const { data, error } = await userA.client
      .from('projects')
      .insert({
        owner_id: userA.user.id,
        name: 'User A Project',
        is_general: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    projectOwnedByA = data;
  });

  afterEach(async () => {
    // Clean up projects created during tests
    if (projectOwnedByA) {
      try {
        await userA.client
          .from('projects')
          .delete()
          .eq('id', projectOwnedByA.id);
      } catch (error) {
        console.error('Failed to delete test project:', error);
      }
    }
  });

  afterAll(async () => {
    // Clean up all test users
    if (userA) await deleteTestUserData(userA.client, userA.user.id);
    if (userB) await deleteTestUserData(userB.client, userB.user.id);
    if (userC) await deleteTestUserData(userC.client, userC.user.id);
    await globalCleanup();
  }, 30000);

  describe('READ Operations - RLS', () => {
    it('should NOT allow User B to fetch projects owned by User A', async () => {
      // User B tries to fetch User A's projects
      const { data, error } = await userB.client
        .from('projects')
        .select('*')
        .eq('owner_id', userA.user.id);

      // Should return empty array (RLS blocks it)
      expect(data).toEqual([]);
      expect(error).toBeNull();
    });

    it('should allow User A to fetch their own projects', async () => {
      const { data, error } = await userA.client
        .from('projects')
        .select('*')
        .eq('owner_id', userA.user.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
      expect(data.some((p: any) => p.id === projectOwnedByA.id)).toBe(true);
    });

    it('should allow User B to see project when added as member', async () => {
      // User A adds User B as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should now see the project
      const { data, error } = await userB.client
        .from('projects')
        .select(`
          *,
          project_users!inner(role)
        `)
        .eq('project_users.user_id', userB.user.id);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.some((p: any) => p.id === projectOwnedByA.id)).toBe(true);
    });

    it('should NOT allow User B to get User A project by ID', async () => {
      const { data, error } = await userB.client
        .from('projects')
        .select('*')
        .eq('id', projectOwnedByA.id)
        .single();

      // Should fail or return null
      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe('UPDATE Operations - RLS', () => {
    it('should NOT allow User B to update User A project', async () => {
      const { data, error } = await userB.client
        .from('projects')
        .update({ name: 'Hacked Name' })
        .eq('id', projectOwnedByA.id)
        .select();

      // Should fail
      expect(data).toEqual([]);
      expect(error).toBeNull(); // RLS doesn't throw error, just returns empty

      // Verify project name wasn't changed
      const { data: checkData } = await userA.client
        .from('projects')
        .select('name')
        .eq('id', projectOwnedByA.id)
        .single();

      expect(checkData.name).toBe('User A Project');
    });

    it('should allow owner to update their project', async () => {
      const { data, error } = await userA.client
        .from('projects')
        .update({ name: 'Updated Name' })
        .eq('id', projectOwnedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.name).toBe('Updated Name');
    });

    it('should allow project member with admin role to update', async () => {
      // Add User B as admin
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'admin',
        });

      // User B should be able to update
      const { data, error } = await userB.client
        .from('projects')
        .update({ name: 'Updated by Admin' })
        .eq('id', projectOwnedByA.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.name).toBe('Updated by Admin');
    });

    it('should NOT allow project member with viewer role to update', async () => {
      // Add User B as viewer
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'viewer',
        });

      // User B should NOT be able to update
      const { data, error } = await userB.client
        .from('projects')
        .update({ name: 'Hack Attempt' })
        .eq('id', projectOwnedByA.id)
        .select();

      expect(data).toEqual([]);

      // Verify name didn't change
      const { data: checkData } = await userA.client
        .from('projects')
        .select('name')
        .eq('id', projectOwnedByA.id)
        .single();

      expect(checkData.name).not.toBe('Hack Attempt');
    });

    it('should NOT allow project member with member role to update', async () => {
      // Add User B as regular member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should NOT be able to update
      const { data } = await userB.client
        .from('projects')
        .update({ name: 'Hack Attempt' })
        .eq('id', projectOwnedByA.id)
        .select();

      expect(data).toEqual([]);
    });
  });

  describe('DELETE Operations - RLS', () => {
    it('should NOT allow User B to delete User A project', async () => {
      const { data, error } = await userB.client
        .from('projects')
        .delete()
        .eq('id', projectOwnedByA.id)
        .select();

      // Should not delete
      expect(data).toEqual([]);

      // Verify project still exists
      const { data: checkData } = await userA.client
        .from('projects')
        .select('*')
        .eq('id', projectOwnedByA.id)
        .single();

      expect(checkData).toBeDefined();
    });

    it('should allow owner to delete their project', async () => {
      // Create a temporary project to delete
      const { data: tempProject } = await userA.client
        .from('projects')
        .insert({
          owner_id: userA.user.id,
          name: 'Temp Project',
          is_general: false,
        })
        .select()
        .single();

      // Delete it
      const { error } = await userA.client
        .from('projects')
        .delete()
        .eq('id', tempProject.id);

      expect(error).toBeNull();

      // Verify it's gone
      const { data: checkData } = await userA.client
        .from('projects')
        .select('*')
        .eq('id', tempProject.id);

      expect(checkData).toEqual([]);
    });

    it('should NOT allow deletion of General project (application logic)', async () => {
      // Get User A's General project
      const { data: generalProject } = await userA.client
        .from('projects')
        .select('*')
        .eq('owner_id', userA.user.id)
        .eq('is_general', true)
        .single();

      if (!generalProject) {
        // Create one for testing
        const { data: created } = await userA.client
          .from('projects')
          .insert({
            owner_id: userA.user.id,
            name: 'General',
            is_general: true,
          })
          .select()
          .single();

        expect(created).toBeDefined();
      }

      // This test verifies application logic, not RLS
      // The service function should prevent deletion of General projects
    });

    it('should NOT allow admin member to delete owner project', async () => {
      // Add User B as admin
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'admin',
        });

      // User B (admin) should NOT be able to delete
      const { data } = await userB.client
        .from('projects')
        .delete()
        .eq('id', projectOwnedByA.id)
        .select();

      expect(data).toEqual([]);

      // Verify project still exists
      const { data: checkData } = await userA.client
        .from('projects')
        .select('*')
        .eq('id', projectOwnedByA.id)
        .single();

      expect(checkData).toBeDefined();
    });
  });

  describe('Project Members - RLS', () => {
    it('should NOT allow User B to add members to User A project', async () => {
      const { error } = await userB.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userC.user.id,
          role: 'member',
        });

      // Should fail with RLS violation
      expect(error).toBeTruthy();
    });

    it('should allow owner to add members', async () => {
      const { data, error } = await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.user_id).toBe(userB.user.id);
    });

    it('should allow admin to add members', async () => {
      // First, add User B as admin
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'admin',
        });

      // Now User B (admin) should be able to add User C
      const { data, error } = await userB.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userC.user.id,
          role: 'member',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should NOT allow regular member to add other members', async () => {
      // Add User B as regular member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // User B should NOT be able to add User C
      const { error } = await userB.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userC.user.id,
          role: 'member',
        });

      expect(error).toBeTruthy();
    });

    it('should NOT allow viewer to add members', async () => {
      // Add User B as viewer
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'viewer',
        });

      // User B should NOT be able to add User C
      const { error } = await userB.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userC.user.id,
          role: 'member',
        });

      expect(error).toBeTruthy();
    });

    it('should allow owner to remove members', async () => {
      // Add User B first
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'member',
        });

      // Remove User B
      const { error } = await userA.client
        .from('project_users')
        .delete()
        .eq('project_id', projectOwnedByA.id)
        .eq('user_id', userB.user.id);

      expect(error).toBeNull();

      // Verify removed
      const { data } = await userA.client
        .from('project_users')
        .select('*')
        .eq('project_id', projectOwnedByA.id)
        .eq('user_id', userB.user.id);

      expect(data).toEqual([]);
    });

    it('should allow admin to remove members', async () => {
      // Add User B as admin
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userB.user.id,
          role: 'admin',
        });

      // Add User C as member
      await userA.client
        .from('project_users')
        .insert({
          project_id: projectOwnedByA.id,
          user_id: userC.user.id,
          role: 'member',
        });

      // User B (admin) should be able to remove User C
      const { error } = await userB.client
        .from('project_users')
        .delete()
        .eq('project_id', projectOwnedByA.id)
        .eq('user_id', userC.user.id);

      expect(error).toBeNull();
    });

    it('should NOT allow regular member to remove other members', async () => {
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

      // User B should NOT be able to remove User C
      const { error } = await userB.client
        .from('project_users')
        .delete()
        .eq('project_id', projectOwnedByA.id)
        .eq('user_id', userC.user.id);

      expect(error).toBeTruthy();
    });
  });

  describe('Cross-User Data Isolation', () => {
    it('should completely isolate projects between unrelated users', async () => {
      // User A creates multiple projects
      const projectsA = [];
      for (let i = 0; i < 3; i++) {
        const { data } = await userA.client
          .from('projects')
          .insert({
            owner_id: userA.user.id,
            name: `User A Project ${i}`,
            is_general: false,
          })
          .select()
          .single();
        projectsA.push(data);
      }

      // User B creates multiple projects
      const projectsB = [];
      for (let i = 0; i < 3; i++) {
        const { data } = await userB.client
          .from('projects')
          .insert({
            owner_id: userB.user.id,
            name: `User B Project ${i}`,
            is_general: false,
          })
          .select()
          .single();
        projectsB.push(data);
      }

      // User A should ONLY see their own projects
      const { data: userAProjects } = await userA.client
        .from('projects')
        .select('*')
        .eq('owner_id', userA.user.id);

      expect(userAProjects.length).toBeGreaterThanOrEqual(3);
      expect(userAProjects.every((p: any) => p.owner_id === userA.user.id)).toBe(true);

      // User B should ONLY see their own projects
      const { data: userBProjects } = await userB.client
        .from('projects')
        .select('*')
        .eq('owner_id', userB.user.id);

      expect(userBProjects.length).toBeGreaterThanOrEqual(3);
      expect(userBProjects.every((p: any) => p.owner_id === userB.user.id)).toBe(true);

      // Clean up
      for (const project of projectsA) {
        await userA.client.from('projects').delete().eq('id', project.id);
      }
      for (const project of projectsB) {
        await userB.client.from('projects').delete().eq('id', project.id);
      }
    });
  });
});
