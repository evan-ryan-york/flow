import { getSupabaseClient } from '../supabase';
import { TaskSchema, type Task } from '@perfect-task-app/models';
import { updateLastUsedProject } from './profileService';

export interface CreateTaskData {
  project_id: string;
  name: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  created_by?: string; // Optional: if not provided, will try to get from auth
}

export interface UpdateTaskData {
  name?: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  is_completed?: boolean;
  completed_at?: string | null;
  project_id?: string;
}

export const getTasksForProject = async (projectId: string): Promise<Task[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tasks for project: ${error.message}`);
    }

    // Zod validation - no field mapping needed
    const validatedTasks = TaskSchema.array().parse(data || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksForProject error:', error);
    throw error;
  }
};

export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  try {
    const supabase = getSupabaseClient();
    let userId = taskData.created_by;

    // If no user ID provided, try to get from auth
    if (!userId) {
      const { data: user } = await supabase.auth.getUser();

      if (!user.user) {
        throw new Error('User must be authenticated to create tasks');
      }

      userId = user.user.id;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        created_by: userId,
        assigned_to: taskData.assigned_to || userId,
        is_completed: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    // Zod validation
    const validatedTask = TaskSchema.parse(data);

    // Update user's last used project for sticky behavior
    try {
      await updateLastUsedProject(taskData.project_id, userId);
    } catch (error) {
      // Don't fail the task creation if updating last used project fails
      console.warn('Failed to update last used project:', error);
    }

    return validatedTask;
  } catch (error) {
    console.error('TaskService.createTask error:', error);
    throw error;
  }
};

export const updateTask = async (taskId: string, updates: UpdateTaskData): Promise<Task> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    // Zod validation
    const validatedTask = TaskSchema.parse(data);
    return validatedTask;
  } catch (error) {
    console.error('TaskService.updateTask error:', error);
    throw error;
  }
};

export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }
  } catch (error) {
    console.error('TaskService.deleteTask error:', error);
    throw error;
  }
};

export const getTasksForUser = async (userId: string): Promise<Task[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tasks for user: ${error.message}`);
    }

    // Zod validation - no field mapping needed
    const validatedTasks = TaskSchema.array().parse(data || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksForUser error:', error);
    throw error;
  }
};

export const getTasksForProjects = async (userId: string, projectIds: string[]): Promise<Task[]> => {
  try {
    const supabase = getSupabaseClient();
    if (projectIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tasks for projects: ${error.message}`);
    }

    // Zod validation - no field mapping needed
    const validatedTasks = TaskSchema.array().parse(data || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksForProjects error:', error);
    throw error;
  }
};

export const getTaskById = async (taskId: string): Promise<Task | null> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - task not found
        return null;
      }
      throw new Error(`Failed to fetch task: ${error.message}`);
    }

    // Zod validation
    const validatedTask = TaskSchema.parse(data);
    return validatedTask;
  } catch (error) {
    console.error('TaskService.getTaskById error:', error);
    throw error;
  }
};

/**
 * Bulk update multiple tasks with the same updates
 * @param taskIds - Array of task IDs to update
 * @param updates - Updates to apply to all tasks
 * @returns Array of updated tasks
 */
export const bulkUpdateTasks = async (taskIds: string[], updates: UpdateTaskData): Promise<Task[]> => {
  try {
    const supabase = getSupabaseClient();

    if (taskIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .in('id', taskIds)
      .select();

    if (error) {
      throw new Error(`Failed to bulk update tasks: ${error.message}`);
    }

    // Zod validation
    const validatedTasks = TaskSchema.array().parse(data || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.bulkUpdateTasks error:', error);
    throw error;
  }
};

/**
 * Bulk delete multiple tasks
 * @param taskIds - Array of task IDs to delete
 */
export const bulkDeleteTasks = async (taskIds: string[]): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    if (taskIds.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', taskIds);

    if (error) {
      throw new Error(`Failed to bulk delete tasks: ${error.message}`);
    }
  } catch (error) {
    console.error('TaskService.bulkDeleteTasks error:', error);
    throw error;
  }
};

