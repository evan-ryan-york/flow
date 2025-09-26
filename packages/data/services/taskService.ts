import { getSupabaseClient } from '../supabase';

const supabase = getSupabaseClient();
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
  status?: string;
  is_completed?: boolean;
  sort_order?: number;
}

export const getTasksForProject = async (projectId: string): Promise<Task[]> => {
  try {
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
        status: 'To Do', // Set default status
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

// ---------------------------------
// Task Reordering Functions
// ---------------------------------

export interface TaskReorderPosition {
  taskId: string;
  sortOrder: number;
}

export interface MoveTaskBetweenParams {
  taskId: string;
  beforeTaskId?: string;
  afterTaskId?: string;
}

/**
 * Get tasks with proper sorting (manual or automatic based on project settings)
 */
export const getTasksWithSortOrder = async (userId: string, projectIds: string[]): Promise<Task[]> => {
  try {
    if (projectIds.length === 0) {
      return [];
    }

    // Use the database function for optimal sorting
    const { data, error } = await supabase
      .rpc('get_sorted_tasks', {
        p_user_id: userId,
        p_project_ids: projectIds
      });

    if (error) {
      throw new Error(`Failed to fetch sorted tasks: ${error.message}`);
    }

    // Zod validation
    const validatedTasks = TaskSchema.array().parse(data || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksWithSortOrder error:', error);
    throw error;
  }
};

/**
 * Calculate optimal sort order for positioning a task between two others
 */
export const calculateTaskSortOrder = async (
  projectId: string,
  beforeTaskId?: string,
  afterTaskId?: string
): Promise<number> => {
  try {
    const { data, error } = await supabase
      .rpc('calculate_task_sort_order', {
        p_project_id: projectId,
        p_before_task_id: beforeTaskId || null,
        p_after_task_id: afterTaskId || null
      });

    if (error) {
      throw new Error(`Failed to calculate sort order: ${error.message}`);
    }

    return data as number;
  } catch (error) {
    console.error('TaskService.calculateTaskSortOrder error:', error);
    throw error;
  }
};

/**
 * Move a task between two other tasks with precise positioning
 */
export const moveTaskBetween = async (params: MoveTaskBetweenParams): Promise<Task> => {
  try {
    // Get the task to determine its project
    const task = await getTaskById(params.taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Calculate the new sort order
    const newSortOrder = await calculateTaskSortOrder(
      task.project_id,
      params.beforeTaskId,
      params.afterTaskId
    );

    // Update the task with new sort order
    const updatedTask = await updateTask(params.taskId, {
      sort_order: newSortOrder
    });

    return updatedTask;
  } catch (error) {
    console.error('TaskService.moveTaskBetween error:', error);
    throw error;
  }
};

/**
 * Reorder multiple tasks atomically
 */
export const reorderTasks = async (reorderPositions: TaskReorderPosition[]): Promise<Task[]> => {
  try {
    if (reorderPositions.length === 0) {
      return [];
    }

    // Prepare the JSONB array for the database function
    const taskUpdates = reorderPositions.map(pos => ({
      task_id: pos.taskId,
      sort_order: pos.sortOrder
    }));

    // Call the atomic reorder function
    const { error } = await supabase
      .rpc('reorder_tasks_atomic', {
        task_updates: taskUpdates
      });

    if (error) {
      throw new Error(`Failed to reorder tasks: ${error.message}`);
    }

    // Fetch the updated tasks
    const taskIds = reorderPositions.map(pos => pos.taskId);
    const { data: updatedTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .in('id', taskIds);

    if (fetchError) {
      throw new Error(`Failed to fetch updated tasks: ${fetchError.message}`);
    }

    // Zod validation
    const validatedTasks = TaskSchema.array().parse(updatedTasks || []);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.reorderTasks error:', error);
    throw error;
  }
};

/**
 * Toggle manual sort mode for a project
 */
export const toggleProjectSortMode = async (projectId: string, manualSortEnabled: boolean): Promise<void> => {
  try {
    const { error } = await supabase
      .from('projects')
      .update({
        manual_sort_enabled: manualSortEnabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      throw new Error(`Failed to toggle sort mode: ${error.message}`);
    }
  } catch (error) {
    console.error('TaskService.toggleProjectSortMode error:', error);
    throw error;
  }
};

/**
 * Reset all tasks in a project to automatic ordering (by created_at)
 */
export const resetProjectTaskOrder = async (projectId: string): Promise<void> => {
  try {
    // First, renumber the tasks based on created_at order
    const { error: renumberError } = await supabase
      .rpc('renumber_project_tasks', { p_project_id: projectId });

    if (renumberError) {
      throw new Error(`Failed to renumber tasks: ${renumberError.message}`);
    }

    // Disable manual sorting for the project
    await toggleProjectSortMode(projectId, false);
  } catch (error) {
    console.error('TaskService.resetProjectTaskOrder error:', error);
    throw error;
  }
};