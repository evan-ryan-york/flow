import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTasksForProject,
  getTasksForUser,
  getTasksForProjects,
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  type CreateTaskData,
  type UpdateTaskData
} from '../services/taskService';

// Query key constants
const TASK_KEYS = {
  all: ['tasks'] as const,
  project: (projectId: string) => ['tasks', 'project', projectId] as const,
  projects: (userId: string, projectIds: string[]) => ['tasks', 'projects', userId, ...projectIds.sort()] as const,
  user: (userId: string) => ['tasks', 'user', userId] as const,
  task: (taskId: string) => ['tasks', 'task', taskId] as const,
};

export const useProjectTasks = (projectId: string) => {
  return useQuery({
    queryKey: TASK_KEYS.project(projectId),
    queryFn: () => getTasksForProject(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useUserTasks = (userId: string) => {
  return useQuery({
    queryKey: TASK_KEYS.user(userId),
    queryFn: () => getTasksForUser(userId),
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useProjectsTasks = (userId: string, projectIds: string[]) => {
  return useQuery({
    queryKey: TASK_KEYS.projects(userId, projectIds),
    queryFn: () => getTasksForProjects(userId, projectIds),
    enabled: !!userId && projectIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useTask = (taskId: string) => {
  return useQuery({
    queryKey: TASK_KEYS.task(taskId),
    queryFn: () => getTaskById(taskId),
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskData: CreateTaskData) => createTask(taskData),
    onSuccess: (newTask) => {
      // Invalidate project tasks query to refetch the list
      queryClient.invalidateQueries({
        queryKey: TASK_KEYS.project(newTask.project_id)
      });

      // Invalidate user tasks queries
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'user']
      });

      // Invalidate all project combination queries
      queryClient.invalidateQueries({
        queryKey: ['tasks', 'projects']
      });

      // Add the new task to the individual cache
      queryClient.setQueryData(TASK_KEYS.task(newTask.id), newTask);
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: UpdateTaskData }) =>
      updateTask(taskId, updates),

    // Optimistic updates for immediate UI feedback
    onMutate: async ({ taskId, updates }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.task(taskId) });

      // Snapshot the previous task value
      const previousTask = queryClient.getQueryData(TASK_KEYS.task(taskId));

      // Optimistically update the individual task
      queryClient.setQueryData(TASK_KEYS.task(taskId), (old: any) => {
        if (!old) return old;
        return { ...old, ...updates, updated_at: new Date().toISOString() };
      });

      // Optimistically update tasks in project lists
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'project'] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((task: any) =>
            task.id === taskId
              ? { ...task, ...updates, updated_at: new Date().toISOString() }
              : task
          );
        }
      );

      // Optimistically update tasks in user lists
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'user'] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((task: any) =>
            task.id === taskId
              ? { ...task, ...updates, updated_at: new Date().toISOString() }
              : task
          );
        }
      );

      // Optimistically update tasks in projects lists
      queryClient.setQueriesData(
        { queryKey: ['tasks', 'projects'] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((task: any) =>
            task.id === taskId
              ? { ...task, ...updates, updated_at: new Date().toISOString() }
              : task
          );
        }
      );

      // Return a context object with the snapshotted value
      return { previousTask };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, { taskId }, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(TASK_KEYS.task(taskId), context.previousTask);
      }
    },

    // Always refetch after error or success to ensure consistency
    onSettled: (updatedTask) => {
      if (updatedTask) {
        // Refresh the specific task
        queryClient.invalidateQueries({ queryKey: TASK_KEYS.task(updatedTask.id) });

        // Refresh project tasks query to ensure consistency
        queryClient.invalidateQueries({
          queryKey: TASK_KEYS.project(updatedTask.project_id)
        });

        // Refresh user tasks queries
        queryClient.invalidateQueries({
          queryKey: ['tasks', 'user']
        });

        // Refresh project combination queries
        queryClient.invalidateQueries({
          queryKey: ['tasks', 'projects']
        });
      }
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_, taskId) => {
      // Remove task from individual cache
      queryClient.removeQueries({ queryKey: TASK_KEYS.task(taskId) });

      // Invalidate all project tasks queries to ensure the task is removed from lists
      queryClient.invalidateQueries({ queryKey: TASK_KEYS.all });
    },
  });
};