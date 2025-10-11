import { getSupabaseClient } from '../supabase';
import { TimeBlockSchema, TaskSchema, type TimeBlock, type Task } from '@perfect-task-app/models';

export interface CreateTimeBlockData {
  title: string;
  start_time: string;
  end_time: string;
  google_calendar_event_id?: string;
}

export interface UpdateTimeBlockData {
  title?: string;
  start_time?: string;
  end_time?: string;
  google_calendar_event_id?: string;
}

export interface DateRange {
  start: string; // ISO date string
  end: string;   // ISO date string
}

// Time Block CRUD Functions

export const getTimeBlocksForUser = async (userId: string, dateRange: DateRange): Promise<TimeBlock[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', dateRange.start)
      .lte('end_time', dateRange.end)
      .order('start_time', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch time blocks for user: ${error.message}`);
    }

    // Zod validation happens here - ensuring type safety
    const validatedTimeBlocks = TimeBlockSchema.array().parse(data);
    return validatedTimeBlocks;
  } catch (error) {
    console.error('TimeBlockService.getTimeBlocksForUser error:', error);
    throw error;
  }
};

export const createTimeBlock = async (blockData: CreateTimeBlockData): Promise<TimeBlock> => {
  try {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      throw new Error('User must be authenticated to create time blocks');
    }

    const { data, error } = await supabase
      .from('time_blocks')
      .insert({
        ...blockData,
        user_id: user.user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create time block: ${error.message}`);
    }

    // Zod validation
    const validatedTimeBlock = TimeBlockSchema.parse(data);
    return validatedTimeBlock;
  } catch (error) {
    console.error('TimeBlockService.createTimeBlock error:', error);
    throw error;
  }
};

export const updateTimeBlock = async (blockId: string, updates: UpdateTimeBlockData): Promise<TimeBlock> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('time_blocks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blockId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update time block: ${error.message}`);
    }

    // Zod validation
    const validatedTimeBlock = TimeBlockSchema.parse(data);
    return validatedTimeBlock;
  } catch (error) {
    console.error('TimeBlockService.updateTimeBlock error:', error);
    throw error;
  }
};

export const deleteTimeBlock = async (blockId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('time_blocks')
      .delete()
      .eq('id', blockId);

    if (error) {
      throw new Error(`Failed to delete time block: ${error.message}`);
    }
  } catch (error) {
    console.error('TimeBlockService.deleteTimeBlock error:', error);
    throw error;
  }
};

// Time Block - Task Linking Functions

export const linkTaskToTimeBlock = async (blockId: string, taskId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase.auth.getUser();

    if (!user.user) {
      throw new Error('User must be authenticated to link tasks to time blocks');
    }

    const { error } = await supabase
      .from('time_block_tasks')
      .insert({
        time_block_id: blockId,
        task_id: taskId,
        added_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to link task to time block: ${error.message}`);
    }
  } catch (error) {
    console.error('TimeBlockService.linkTaskToTimeBlock error:', error);
    throw error;
  }
};

export const unlinkTaskFromTimeBlock = async (blockId: string, taskId: string): Promise<void> => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('time_block_tasks')
      .delete()
      .eq('time_block_id', blockId)
      .eq('task_id', taskId);

    if (error) {
      throw new Error(`Failed to unlink task from time block: ${error.message}`);
    }
  } catch (error) {
    console.error('TimeBlockService.unlinkTaskFromTimeBlock error:', error);
    throw error;
  }
};

export const getTasksForTimeBlock = async (blockId: string): Promise<Task[]> => {
  try {
    const supabase = getSupabaseClient();
    // Join time_block_tasks with tasks to get the full task data
    const { data, error } = await supabase
      .from('time_block_tasks')
      .select(`
        task_id,
        added_at,
        tasks (
          id,
          project_id,
          created_by,
          assigned_to,
          name,
          description,
          due_date,
          status,
          is_completed,
          created_at,
          updated_at
        )
      `)
      .eq('time_block_id', blockId)
      .order('added_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch tasks for time block: ${error.message}`);
    }

    // Extract the task data from the join result
    const tasksData = data.map((item: { tasks: unknown }) => item.tasks).filter(Boolean);

    // Zod validation on the task data
    const validatedTasks = TaskSchema.array().parse(tasksData);
    return validatedTasks;
  } catch (error) {
    console.error('TimeBlockService.getTasksForTimeBlock error:', error);
    throw error;
  }
};