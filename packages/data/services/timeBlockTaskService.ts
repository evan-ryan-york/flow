import { getSupabaseClient } from '../supabase';
import { TaskSchema } from '@perfect-task-app/models';
import { z } from 'zod';

/**
 * Fetch all tasks assigned to a specific time block
 */
export const getTimeBlockTasks = async (timeBlockId: string) => {
  const supabase = getSupabaseClient();

  console.log('🔍 Fetching tasks for time block:', timeBlockId);

  const { data, error } = await supabase
    .from('time_block_tasks')
    .select(`
      task_id,
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
    .eq('time_block_id', timeBlockId);

  if (error) {
    console.error('❌ Error fetching time block tasks:', error);
    throw error;
  }

  console.log('📦 Raw data from database:', data);

  // Extract tasks from the nested structure and filter out nulls
  const tasks = data
    .map(item => item.tasks)
    .filter((task): task is NonNullable<typeof task> => task !== null);

  console.log('✅ Parsed tasks:', tasks.length, tasks);

  return z.array(TaskSchema).parse(tasks);
};

/**
 * Assign a task to a time block
 * Note: Tasks can be assigned to multiple time blocks
 */
export const assignTaskToTimeBlock = async (
  taskId: string,
  timeBlockId: string
) => {
  const supabase = getSupabaseClient();

  console.log('➕ Assigning task to time block:', { taskId, timeBlockId });

  const { data, error } = await supabase
    .from('time_block_tasks')
    .insert({
      task_id: taskId,
      time_block_id: timeBlockId
    })
    .select();

  if (error) {
    // Ignore duplicate key errors (task already assigned to this block)
    if (error.code === '23505') {
      console.log('⚠️ Task already assigned to this block');
      return; // Already assigned, no-op
    }
    console.error('❌ Error assigning task:', error);
    throw error;
  }

  console.log('✅ Task assigned successfully:', data);
};

/**
 * Remove a task from a time block
 */
export const unassignTaskFromTimeBlock = async (
  taskId: string,
  timeBlockId: string
) => {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('time_block_tasks')
    .delete()
    .match({ task_id: taskId, time_block_id: timeBlockId });

  if (error) throw error;
};

/**
 * Get all time blocks that a task is assigned to
 */
export const getTaskTimeBlocks = async (taskId: string) => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('time_block_tasks')
    .select(`
      time_block_id,
      time_blocks (
        id,
        user_id,
        google_calendar_event_id,
        title,
        start_time,
        end_time,
        created_at,
        updated_at
      )
    `)
    .eq('task_id', taskId);

  if (error) throw error;

  // Extract time blocks from the nested structure
  const timeBlocks = data
    .map(item => item.time_blocks)
    .filter((block): block is NonNullable<typeof block> => block !== null);

  return timeBlocks;
};
