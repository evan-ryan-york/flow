import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '../services/timeBlockService';

// Query key constants
const TIME_BLOCK_KEYS = {
  all: ['timeBlocks'] as const,
  user: (userId: string) => ['timeBlocks', 'user', userId] as const,
  userRange: (userId: string, dateRange: DateRange) =>
    ['timeBlocks', 'user', userId, 'range', dateRange.start, dateRange.end] as const,
  blockTasks: (blockId: string) => ['timeBlocks', 'block', blockId, 'tasks'] as const,
};

// Time Block Query Hooks

export const useUserTimeBlocks = (userId: string, dateRange: DateRange) => {
  return useQuery({
    queryKey: TIME_BLOCK_KEYS.userRange(userId, dateRange),
    queryFn: () => getTimeBlocksForUser(userId, dateRange),
    enabled: !!userId && !!dateRange.start && !!dateRange.end,
    staleTime: 1000 * 60 * 2, // 2 minutes - time blocks change more frequently than views
  });
};

export const useBlockTasks = (blockId: string) => {
  return useQuery({
    queryKey: TIME_BLOCK_KEYS.blockTasks(blockId),
    queryFn: () => getTasksForTimeBlock(blockId),
    enabled: !!blockId,
    staleTime: 1000 * 30, // 30 seconds - task associations can change frequently
  });
};

// Time Block Mutation Hooks

export const useCreateTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockData: CreateTimeBlockData) => createTimeBlock(blockData),
    onSuccess: (newTimeBlock) => {
      // Invalidate all user time blocks queries to ensure the new block appears
      queryClient.invalidateQueries({
        queryKey: TIME_BLOCK_KEYS.user(newTimeBlock.user_id)
      });
    },
  });
};

export const useUpdateTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, updates }: { blockId: string; updates: UpdateTimeBlockData }) =>
      updateTimeBlock(blockId, updates),
    onSuccess: (updatedTimeBlock) => {
      // Invalidate user time blocks queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: TIME_BLOCK_KEYS.user(updatedTimeBlock.user_id)
      });
    },
  });
};

export const useDeleteTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockId: string) => deleteTimeBlock(blockId),
    onSuccess: (_, blockId) => {
      // Remove the specific block tasks query from cache
      queryClient.removeQueries({ queryKey: TIME_BLOCK_KEYS.blockTasks(blockId) });

      // Invalidate all time blocks queries to remove the deleted block from lists
      queryClient.invalidateQueries({ queryKey: TIME_BLOCK_KEYS.all });
    },
  });
};

// Task Linking Mutation Hooks

export const useLinkTaskToTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, taskId }: { blockId: string; taskId: string }) =>
      linkTaskToTimeBlock(blockId, taskId),
    onSuccess: (_, { blockId }) => {
      // Invalidate the specific time block's tasks query to show the new link
      queryClient.invalidateQueries({
        queryKey: TIME_BLOCK_KEYS.blockTasks(blockId)
      });
    },
  });
};

export const useUnlinkTaskFromTimeBlock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ blockId, taskId }: { blockId: string; taskId: string }) =>
      unlinkTaskFromTimeBlock(blockId, taskId),
    onSuccess: (_, { blockId }) => {
      // Invalidate the specific time block's tasks query to remove the unlinked task
      queryClient.invalidateQueries({
        queryKey: TIME_BLOCK_KEYS.blockTasks(blockId)
      });
    },
  });
};