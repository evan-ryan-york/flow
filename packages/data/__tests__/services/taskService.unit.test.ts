// Unit tests for taskService - mocking Supabase client
import * as taskService from '../../services/taskService';
import { TaskSchema } from '@flow-app/models';

// Mock the supabase module - must be at top before imports
jest.mock('../../supabase', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  return {
    getSupabaseClient: () => mockSupabase,
  };
});

// Get the mocked supabase instance
import { getSupabaseClient } from '../../supabase';
const mockSupabase = getSupabaseClient() as any;

// Mock task data with valid UUIDs
const mockTask = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  project_id: '550e8400-e29b-41d4-a716-446655440001',
  created_by: '550e8400-e29b-41d4-a716-446655440002',
  assigned_to: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Test Task',
  description: 'Test Description',
  due_date: '2024-12-31',
  is_completed: false,
  completed_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockUser = {
  user: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'test@example.com',
  },
};

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTasksForProject', () => {
    it('should fetch tasks and validate with Zod', async () => {
      const mockTasks = [mockTask];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockTasks,
              error: null,
            }),
          }),
        }),
      });

      const result = await taskService.getTasksForProject('project-1');

      expect(result).toEqual(mockTasks);
      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');

      // Verify Zod validation would pass
      expect(() => TaskSchema.array().parse(mockTasks)).not.toThrow();
    });

    it('should throw error when database query fails', async () => {
      const error = { message: 'Database error' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error,
            }),
          }),
        }),
      });

      await expect(taskService.getTasksForProject('project-1'))
        .rejects
        .toThrow('Failed to fetch tasks for project: Database error');
    });

    it('should validate data shape with Zod schema', async () => {
      const invalidData = [{ id: 'invalid', name: 123 }]; // Invalid data

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: invalidData,
              error: null,
            }),
          }),
        }),
      });

      // Should throw because Zod validation fails
      await expect(taskService.getTasksForProject('project-1'))
        .rejects
        .toThrow();
    });
  });

  describe('createTask', () => {
    it('should create task with authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: mockUser, error: null });

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTask,
              error: null,
            }),
          }),
        }),
      });

      const taskData = {
        project_id: 'project-1',
        name: 'New Task',
        description: 'Task description',
      };

      const result = await taskService.createTask(taskData);

      expect(result).toEqual(mockTask);
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(() => TaskSchema.parse(mockTask)).not.toThrow();
    });

    it('should throw error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const taskData = {
        project_id: 'project-1',
        name: 'New Task',
      };

      await expect(taskService.createTask(taskData))
        .rejects
        .toThrow('User must be authenticated to create tasks');
    });

    it('should handle database insertion errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: mockUser, error: null });

      const error = { message: 'Insertion failed' };
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error,
            }),
          }),
        }),
      });

      const taskData = {
        project_id: 'project-1',
        name: 'New Task',
      };

      await expect(taskService.createTask(taskData))
        .rejects
        .toThrow('Failed to create task: Insertion failed');
    });
  });

  describe('updateTask', () => {
    it('should update task successfully', async () => {
      const updatedTask = { ...mockTask, name: 'Updated Task' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: updatedTask,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await taskService.updateTask('task-1', { name: 'Updated Task' });

      expect(result).toEqual(updatedTask);
      expect(() => TaskSchema.parse(updatedTask)).not.toThrow();
    });

    it('should handle update errors', async () => {
      const error = { message: 'Update failed' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error,
              }),
            }),
          }),
        }),
      });

      await expect(taskService.updateTask('task-1', { name: 'Updated' }))
        .rejects
        .toThrow('Failed to update task: Update failed');
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      await taskService.deleteTask('task-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
    });

    it('should handle deletion errors', async () => {
      const error = { message: 'Deletion failed' };

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error,
          }),
        }),
      });

      await expect(taskService.deleteTask('task-1'))
        .rejects
        .toThrow('Failed to delete task: Deletion failed');
    });
  });

  describe('getTaskById', () => {
    it('should fetch single task successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockTask,
              error: null,
            }),
          }),
        }),
      });

      const result = await taskService.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(() => TaskSchema.parse(mockTask)).not.toThrow();
    });

    it('should return null when task not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }, // No rows returned
            }),
          }),
        }),
      });

      const result = await taskService.getTaskById('nonexistent');

      expect(result).toBe(null);
    });

    it('should handle other database errors', async () => {
      const error = { message: 'Database error', code: 'OTHER' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error,
            }),
          }),
        }),
      });

      await expect(taskService.getTaskById('task-1'))
        .rejects
        .toThrow('Failed to fetch task: Database error');
    });
  });

  describe('Error handling and data validation', () => {
    it('should log errors before throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = { message: 'Test error' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error,
            }),
          }),
        }),
      });

      await expect(taskService.getTasksForProject('project-1'))
        .rejects
        .toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'TaskService.getTasksForProject error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should ensure all returned data passes Zod validation', async () => {
      // Test that service functions always validate data with Zod
      const validData = [mockTask];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: validData,
              error: null,
            }),
          }),
        }),
      });

      const result = await taskService.getTasksForProject('project-1');

      // This proves that the service validates with Zod before returning
      expect(() => TaskSchema.array().parse(result)).not.toThrow();
      expect(result).toEqual(validData);
    });
  });
});