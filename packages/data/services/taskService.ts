import { getSupabaseClient } from '../supabase';

const supabase = getSupabaseClient();
import { TaskSchema, type Task } from '@perfect-task-app/models';

export interface CreateTaskData {
  project_id: string;
  name: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  status?: string;
}

export interface UpdateTaskData {
  name?: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  status?: string;
  is_completed?: boolean;
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

    // Zod validation happens here - ensuring type safety
    const validatedTasks = TaskSchema.array().parse(data);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksForProject error:', error);
    throw error;
  }
};

export const createTask = async (taskData: CreateTaskData): Promise<Task> => {
  try {
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      throw new Error('User must be authenticated to create tasks');
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        created_by: user.user.id,
        assigned_to: taskData.assigned_to || user.user.id,
        status: taskData.status || 'todo',
        is_completed: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    // Zod validation
    const validatedTask = TaskSchema.parse(data);
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
      .select(`
        *,
        projects!inner(
          *,
          project_users!inner(user_id)
        )
      `)
      .eq('projects.project_users.user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tasks for user: ${error.message}`);
    }

    // Extract tasks and validate with Zod
    const tasks = data?.map((item: any) => ({
      id: item.id,
      project_id: item.project_id,
      created_by: item.created_by,
      assigned_to: item.assigned_to,
      name: item.name,
      description: item.description,
      due_date: item.due_date,
      status: item.status,
      is_completed: item.is_completed,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })) || [];

    const validatedTasks = TaskSchema.array().parse(tasks);
    return validatedTasks;
  } catch (error) {
    console.error('TaskService.getTasksForUser error:', error);
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