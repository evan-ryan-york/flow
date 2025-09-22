import { supabase } from '../../supabase';
import {
  getTimeBlocksForUser,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  linkTaskToTimeBlock,
  unlinkTaskFromTimeBlock,
  getTasksForTimeBlock,
  type CreateTimeBlockData,
  type UpdateTimeBlockData,
  type DateRange
} from '../../services/timeBlockService';
import { createTask } from '../../services/taskService';
import { TimeBlockSchema, TaskSchema } from '@perfect-task-app/models';

// Test users and data
let testUserA: any;
let testUserB: any;
let testProjectA: any;
let testTaskA: any;

describe('timeBlockService Integration Tests', () => {
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

    // Authenticate as User A and get their General project
    await supabase.auth.signInWithPassword({
      email: 'testusera@example.com',
      password: 'testpassword123',
    });

    const { data: projectsA } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', testUserA.id)
      .eq('is_general', true)
      .single();

    testProjectA = projectsA;

    // Create a test task for linking tests
    testTaskA = await createTask({
      project_id: testProjectA.id,
      name: 'Test Task for Time Block',
      description: 'A task to test time block linking',
    });
  });

  describe('getTimeBlocksForUser', () => {
    it('should return an empty array when user has no time blocks', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const dateRange: DateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const timeBlocks = await getTimeBlocksForUser(testUserA.id, dateRange);

      expect(Array.isArray(timeBlocks)).toBe(true);
      expect(timeBlocks).toHaveLength(0);
      // Verify Zod validation
      expect(() => TimeBlockSchema.array().parse(timeBlocks)).not.toThrow();
    });

    it('should return time blocks within the specified date range', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      // Create time blocks - one in range, one out of range
      const inRangeBlockData: CreateTimeBlockData = {
        title: 'Work Session',
        start_time: '2025-01-15T09:00:00Z',
        end_time: '2025-01-15T11:00:00Z',
      };

      const outOfRangeBlockData: CreateTimeBlockData = {
        title: 'Other Work',
        start_time: '2025-02-15T09:00:00Z',
        end_time: '2025-02-15T11:00:00Z',
      };

      await createTimeBlock(inRangeBlockData);
      await createTimeBlock(outOfRangeBlockData);

      const dateRange: DateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const timeBlocks = await getTimeBlocksForUser(testUserA.id, dateRange);

      expect(timeBlocks).toHaveLength(1);
      expect(timeBlocks[0].title).toBe('Work Session');
      expect(timeBlocks[0].user_id).toBe(testUserA.id);
    });

    it('should only return time blocks for the specified user', async () => {
      // Create time block for User A
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const userABlockData: CreateTimeBlockData = {
        title: 'User A Work',
        start_time: '2025-01-15T09:00:00Z',
        end_time: '2025-01-15T11:00:00Z',
      };

      await createTimeBlock(userABlockData);

      // Create time block for User B
      await supabase.auth.signInWithPassword({
        email: 'testuserb@example.com',
        password: 'testpassword123',
      });

      const userBBlockData: CreateTimeBlockData = {
        title: 'User B Work',
        start_time: '2025-01-15T14:00:00Z',
        end_time: '2025-01-15T16:00:00Z',
      };

      await createTimeBlock(userBBlockData);

      // Get time blocks for User A only
      const dateRange: DateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const timeBlocksA = await getTimeBlocksForUser(testUserA.id, dateRange);

      expect(timeBlocksA).toHaveLength(1);
      expect(timeBlocksA[0].user_id).toBe(testUserA.id);
      expect(timeBlocksA[0].title).toBe('User A Work');
    });
  });

  describe('createTimeBlock', () => {
    it('should create a new time block with authentication', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const blockData: CreateTimeBlockData = {
        title: 'Focus Time',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
        google_calendar_event_id: 'gcal-event-123',
      };

      const createdBlock = await createTimeBlock(blockData);

      expect(createdBlock.title).toBe('Focus Time');
      expect(createdBlock.start_time).toBe('2025-01-20T10:00:00Z');
      expect(createdBlock.end_time).toBe('2025-01-20T12:00:00Z');
      expect(createdBlock.google_calendar_event_id).toBe('gcal-event-123');
      expect(createdBlock.user_id).toBe(testUserA.id);

      // Verify Zod validation
      expect(() => TimeBlockSchema.parse(createdBlock)).not.toThrow();
    });

    it('should throw an error when user is not authenticated', async () => {
      await supabase.auth.signOut();

      const blockData: CreateTimeBlockData = {
        title: 'Unauthorized Block',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
      };

      await expect(createTimeBlock(blockData)).rejects.toThrow(
        'User must be authenticated to create time blocks'
      );
    });
  });

  describe('updateTimeBlock', () => {
    it('should update a time block successfully', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      // Create initial time block
      const initialBlockData: CreateTimeBlockData = {
        title: 'Initial Work',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
      };

      const createdBlock = await createTimeBlock(initialBlockData);

      // Update the time block
      const updates: UpdateTimeBlockData = {
        title: 'Updated Work Session',
        start_time: '2025-01-20T09:00:00Z',
        end_time: '2025-01-20T13:00:00Z',
      };

      const updatedBlock = await updateTimeBlock(createdBlock.id, updates);

      expect(updatedBlock.id).toBe(createdBlock.id);
      expect(updatedBlock.title).toBe('Updated Work Session');
      expect(updatedBlock.start_time).toBe('2025-01-20T09:00:00Z');
      expect(updatedBlock.end_time).toBe('2025-01-20T13:00:00Z');

      // Verify updated_at timestamp changed
      expect(new Date(updatedBlock.updated_at).getTime()).toBeGreaterThan(
        new Date(createdBlock.updated_at).getTime()
      );

      // Verify Zod validation
      expect(() => TimeBlockSchema.parse(updatedBlock)).not.toThrow();
    });
  });

  describe('deleteTimeBlock', () => {
    it('should delete a time block successfully', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const blockData: CreateTimeBlockData = {
        title: 'Block to Delete',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
      };

      const createdBlock = await createTimeBlock(blockData);

      await expect(deleteTimeBlock(createdBlock.id)).resolves.not.toThrow();

      // Verify deletion by checking user's time blocks
      const dateRange: DateRange = {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z',
      };

      const remainingBlocks = await getTimeBlocksForUser(testUserA.id, dateRange);
      const deletedBlock = remainingBlocks.find(b => b.id === createdBlock.id);
      expect(deletedBlock).toBeUndefined();
    });
  });

  describe('Task Linking Functions', () => {
    let testTimeBlock: any;

    beforeEach(async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      const blockData: CreateTimeBlockData = {
        title: 'Work Block for Tasks',
        start_time: '2025-01-20T10:00:00Z',
        end_time: '2025-01-20T12:00:00Z',
      };

      testTimeBlock = await createTimeBlock(blockData);
    });

    describe('linkTaskToTimeBlock', () => {
      it('should link a task to a time block', async () => {
        await expect(
          linkTaskToTimeBlock(testTimeBlock.id, testTaskA.id)
        ).resolves.not.toThrow();

        // Verify the link by getting tasks for the time block
        const linkedTasks = await getTasksForTimeBlock(testTimeBlock.id);
        expect(linkedTasks).toHaveLength(1);
        expect(linkedTasks[0].id).toBe(testTaskA.id);
      });

      it('should throw an error when user is not authenticated', async () => {
        await supabase.auth.signOut();

        await expect(
          linkTaskToTimeBlock(testTimeBlock.id, testTaskA.id)
        ).rejects.toThrow('User must be authenticated to link tasks to time blocks');
      });
    });

    describe('unlinkTaskFromTimeBlock', () => {
      it('should unlink a task from a time block', async () => {
        // First, link the task
        await linkTaskToTimeBlock(testTimeBlock.id, testTaskA.id);

        // Verify it's linked
        let linkedTasks = await getTasksForTimeBlock(testTimeBlock.id);
        expect(linkedTasks).toHaveLength(1);

        // Now unlink it
        await expect(
          unlinkTaskFromTimeBlock(testTimeBlock.id, testTaskA.id)
        ).resolves.not.toThrow();

        // Verify it's unlinked
        linkedTasks = await getTasksForTimeBlock(testTimeBlock.id);
        expect(linkedTasks).toHaveLength(0);
      });
    });

    describe('getTasksForTimeBlock', () => {
      it('should return empty array when no tasks are linked', async () => {
        const tasks = await getTasksForTimeBlock(testTimeBlock.id);

        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks).toHaveLength(0);
        // Verify Zod validation
        expect(() => TaskSchema.array().parse(tasks)).not.toThrow();
      });

      it('should return linked tasks with full task data', async () => {
        // Link the task
        await linkTaskToTimeBlock(testTimeBlock.id, testTaskA.id);

        const linkedTasks = await getTasksForTimeBlock(testTimeBlock.id);

        expect(linkedTasks).toHaveLength(1);
        expect(linkedTasks[0].id).toBe(testTaskA.id);
        expect(linkedTasks[0].name).toBe('Test Task for Time Block');
        expect(linkedTasks[0].project_id).toBe(testProjectA.id);

        // Verify Zod validation on task data
        expect(() => TaskSchema.parse(linkedTasks[0])).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      await supabase.auth.signInWithPassword({
        email: 'testusera@example.com',
        password: 'testpassword123',
      });

      // Test invalid time block ID
      const invalidBlockId = 'invalid-uuid-format';
      const updates: UpdateTimeBlockData = { title: 'Updated Title' };

      await expect(updateTimeBlock(invalidBlockId, updates)).rejects.toThrow();
      await expect(deleteTimeBlock(invalidBlockId)).rejects.toThrow();
      await expect(getTasksForTimeBlock(invalidBlockId)).rejects.toThrow();
    });
  });
});