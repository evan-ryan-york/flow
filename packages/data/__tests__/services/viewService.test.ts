import { supabase } from '../../supabase';
import {
  getViewsForUser,
  createView,
  updateView,
  deleteView,
  type CreateViewData,
  type UpdateViewData
} from '../../services/viewService';
import { ViewSchema } from '@flow-app/models';

// Test users and data
let testUserA: any;
let testUserB: any;

describe('viewService Integration Tests', () => {
  beforeEach(async () => {
    // Create test users
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
  });

  describe('getViewsForUser', () => {
    it('should return an empty array when user has no views', async () => {
      // Authenticate as User A
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const views = await getViewsForUser(testUserA.id);

      expect(Array.isArray(views)).toBe(true);
      expect(views).toHaveLength(0);
      // Verify Zod validation - if this doesn't throw, validation passed
      expect(() => ViewSchema.array().parse(views)).not.toThrow();
    });

    it('should return only views belonging to the specified user', async () => {
      // Authenticate as User A and create a view
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const viewDataA: CreateViewData = {
        name: 'User A View',
        type: 'list',
        config: {
          projectIds: ['project-1'],
          groupBy: 'project',
          sortBy: 'created_at',
        },
      };

      const createdViewA = await createView(viewDataA);

      // Authenticate as User B and create a different view
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      const viewDataB: CreateViewData = {
        name: 'User B View',
        type: 'kanban',
        config: {
          projectIds: ['project-2'],
          groupBy: 'status',
        },
      };

      await createView(viewDataB);

      // Get views for User A - should only return User A's view
      const viewsForUserA = await getViewsForUser(testUserA.id);
      expect(viewsForUserA).toHaveLength(1);
      expect(viewsForUserA[0].user_id).toBe(testUserA.id);
      expect(viewsForUserA[0].name).toBe('User A View');
    });
  });

  describe('createView', () => {
    it('should create a new view with authentication', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const viewData: CreateViewData = {
        name: 'My Project View',
        type: 'list',
        config: {
          projectIds: ['project-1', 'project-2'],
          groupBy: 'project',
          sortBy: 'due_date',
          visibleProperties: ['prop-1', 'prop-2'],
        },
      };

      const createdView = await createView(viewData);

      expect(createdView.name).toBe('My Project View');
      expect(createdView.type).toBe('list');
      expect(createdView.user_id).toBe(testUserA.id);
      expect(createdView.config.projectIds).toEqual(['project-1', 'project-2']);
      expect(createdView.config.groupBy).toBe('project');

      // Verify Zod validation
      expect(() => ViewSchema.parse(createdView)).not.toThrow();
    });

    it('should throw an error when user is not authenticated', async () => {
      // Sign out to test unauthenticated access
      await supabase.auth.signOut();

      const viewData: CreateViewData = {
        name: 'Unauthorized View',
        type: 'list',
        config: { projectIds: [] },
      };

      await expect(createView(viewData)).rejects.toThrow(
        'User must be authenticated to create views'
      );
    });
  });

  describe('updateView', () => {
    it('should update a view successfully', async () => {
      // Create a view first
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const initialViewData: CreateViewData = {
        name: 'Initial View',
        type: 'list',
        config: { projectIds: ['project-1'] },
      };

      const createdView = await createView(initialViewData);

      // Update the view
      const updates: UpdateViewData = {
        name: 'Updated View',
        type: 'kanban',
        config: {
          projectIds: ['project-1', 'project-2'],
          groupBy: 'status',
        },
      };

      const updatedView = await updateView(createdView.id, updates);

      expect(updatedView.id).toBe(createdView.id);
      expect(updatedView.name).toBe('Updated View');
      expect(updatedView.type).toBe('kanban');
      expect(updatedView.config.projectIds).toEqual(['project-1', 'project-2']);
      expect(updatedView.config.groupBy).toBe('status');

      // Verify updated_at timestamp changed
      expect(new Date(updatedView.updated_at).getTime()).toBeGreaterThan(
        new Date(createdView.updated_at).getTime()
      );

      // Verify Zod validation
      expect(() => ViewSchema.parse(updatedView)).not.toThrow();
    });
  });

  describe('deleteView', () => {
    it('should delete a view successfully', async () => {
      // Create a view first
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const viewData: CreateViewData = {
        name: 'View to Delete',
        type: 'list',
        config: { projectIds: ['project-1'] },
      };

      const createdView = await createView(viewData);

      // Delete the view
      await expect(deleteView(createdView.id)).resolves.not.toThrow();

      // Verify the view is deleted by trying to fetch it
      const viewsAfterDeletion = await getViewsForUser(testUserA.id);
      const deletedView = viewsAfterDeletion.find(v => v.id === createdView.id);
      expect(deletedView).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      // Test invalid view ID for updates
      const invalidViewId = 'invalid-uuid-format';
      const updates: UpdateViewData = { name: 'Updated Name' };

      await expect(updateView(invalidViewId, updates)).rejects.toThrow();

      // Test invalid view ID for deletion
      await expect(deleteView(invalidViewId)).rejects.toThrow();
    });
  });
});