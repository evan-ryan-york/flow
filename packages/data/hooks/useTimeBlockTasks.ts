import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTimeBlockTasks,
  assignTaskToTimeBlock,
  unassignTaskFromTimeBlock,
  getTaskTimeBlocks,
} from '../services/timeBlockTaskService';

console.log('🔥 useTimeBlockTasks module loaded at:', new Date().toISOString());

/**
 * Query hook to fetch all tasks assigned to a specific time block
 * @param timeBlockId - UUID of the time block
 * @returns Query result with array of tasks
 */
export const useTimeBlockTasks = (timeBlockId: string | undefined) => {
  console.log('🎣 useTimeBlockTasks hook called with timeBlockId:', timeBlockId);

  const result = useQuery({
    queryKey: ['time-block-tasks', timeBlockId],
    queryFn: () => {
      console.log('🎣 queryFn executing for timeBlockId:', timeBlockId);
      return getTimeBlockTasks(timeBlockId!);
    },
    enabled: !!timeBlockId,
    staleTime: 0, // Always refetch when invalidated (was 2 minutes)
  });

  console.log('🎣 useTimeBlockTasks result:', {
    timeBlockId,
    tasksCount: result.data?.length || 0,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    status: result.status
  });

  return result;
};

/**
 * Mutation hook to assign a task to a time block
 * Automatically refetches the time block's task list after assignment
 * @returns Mutation function and status
 */
export const useAssignTaskToTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, timeBlockId }: { taskId: string; timeBlockId: string }) =>
      assignTaskToTimeBlock(taskId, timeBlockId),
    onSuccess: async (_, { timeBlockId, taskId }) => {
      console.log('🔄 Mutation success, invalidating queries for:', timeBlockId);

      // Use the CORRECT query key from useTimeBlock.ts
      // The query key is: ['timeBlocks', 'block', blockId, 'tasks']
      const correctQueryKey = ['timeBlocks', 'block', timeBlockId, 'tasks'];

      console.log('🔍 Invalidating query with key:', correctQueryKey);

      // Remove and invalidate to force fresh fetch
      queryClient.removeQueries({ queryKey: correctQueryKey });
      queryClient.invalidateQueries({ queryKey: correctQueryKey });

      // Also invalidate any time-block-tasks queries (in case both exist)
      queryClient.removeQueries({ queryKey: ['time-block-tasks', timeBlockId] });
      queryClient.invalidateQueries({ queryKey: ['time-block-tasks', timeBlockId] });

      console.log('✅ Task assigned to time block successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to assign task to time block:', error);
    },
  });
};

/**
 * Mutation hook to remove a task from a time block
 * Automatically refetches the time block's task list after removal
 * @returns Mutation function and status
 */
export const useUnassignTaskFromTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, timeBlockId }: { taskId: string; timeBlockId: string }) =>
      unassignTaskFromTimeBlock(taskId, timeBlockId),
    onSuccess: async (_, { timeBlockId, taskId }) => {
      console.log('🔄 Mutation success, removing task from block:', timeBlockId);

      // Use the CORRECT query key from useTimeBlock.ts
      const correctQueryKey = ['timeBlocks', 'block', timeBlockId, 'tasks'];

      console.log('🔍 Invalidating query with key:', correctQueryKey);

      // Remove and invalidate to force fresh fetch
      queryClient.removeQueries({ queryKey: correctQueryKey });
      queryClient.invalidateQueries({ queryKey: correctQueryKey });

      // Also invalidate any time-block-tasks queries (in case both exist)
      queryClient.removeQueries({ queryKey: ['time-block-tasks', timeBlockId] });
      queryClient.invalidateQueries({ queryKey: ['time-block-tasks', timeBlockId] });

      console.log('✅ Task removed from time block successfully');
    },
    onError: (error) => {
      console.error('❌ Failed to remove task from time block:', error);
    },
  });
};

/**
 * Query hook to fetch all time blocks that a task is assigned to
 * @param taskId - UUID of the task
 * @returns Query result with array of time blocks
 */
export const useTaskTimeBlocks = (taskId: string | undefined) => {
  return useQuery({
    queryKey: ['task-time-blocks', taskId],
    queryFn: () => getTaskTimeBlocks(taskId!),
    enabled: !!taskId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
