import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '../supabase';
import {
  getTasksForProject,
  getTasksForUser,
  getTasksForProjects,
  getTasksWithSortOrder,
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  moveTaskBetween,
  reorderTasks,
  toggleProjectSortMode,
  resetProjectTaskOrder,
  type CreateTaskData,
  type UpdateTaskData,
  type MoveTaskBetweenParams,
  type TaskReorderPosition
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

// ---------------------------------
// Task Reordering Hooks
// ---------------------------------

/**
 * Hook for fetching tasks with proper sort order
 */
export const useTasksWithSortOrder = (userId: string, projectIds: string[]) => {
  return useQuery({
    queryKey: [...TASK_KEYS.projects(userId, projectIds), 'sorted'],
    queryFn: () => getTasksWithSortOrder(userId, projectIds),
    enabled: !!userId && projectIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Hook for moving a task between two positions
 */
export const useMoveTaskBetween = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: MoveTaskBetweenParams) => moveTaskBetween(params),

    // Optimistic update for immediate UI feedback
    onMutate: async (params) => {
      // Cancel any outgoing queries to prevent overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.all });

      // Get current task data
      const previousTask = queryClient.getQueryData(TASK_KEYS.task(params.taskId));

      // Optimistic update - we'll calculate approximate sort_order on client side
      // The real sort_order will be calculated by the server
      queryClient.setQueryData(TASK_KEYS.task(params.taskId), (old: any) => {
        if (!old) return old;
        return { ...old, updated_at: new Date().toISOString() };
      });

      return { previousTask };
    },

    onError: (err, params, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(TASK_KEYS.task(params.taskId), context.previousTask);
      }
    },

    onSuccess: (updatedTask) => {
      // Update individual task cache
      queryClient.setQueryData(TASK_KEYS.task(updatedTask.id), updatedTask);

      // Invalidate sorted task queries to refetch with new order
      queryClient.invalidateQueries({
        queryKey: [...TASK_KEYS.projects(updatedTask.assigned_to!, [updatedTask.project_id]), 'sorted']
      });
    },
  });
};

/**
 * Hook for bulk reordering multiple tasks
 */
export const useReorderTasks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reorderPositions: TaskReorderPosition[]) => reorderTasks(reorderPositions),

    // Optimistic updates for instant UI feedback
    onMutate: async (reorderPositions) => {
      // Cancel any outgoing queries
      await queryClient.cancelQueries({ queryKey: TASK_KEYS.all });

      // Store previous state for rollback
      const previousQueries = new Map();

      // Optimistically update each task's sort_order
      reorderPositions.forEach(({ taskId, sortOrder }) => {
        const previousTask = queryClient.getQueryData(TASK_KEYS.task(taskId));
        previousQueries.set(taskId, previousTask);

        queryClient.setQueryData(TASK_KEYS.task(taskId), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            sort_order: sortOrder,
            updated_at: new Date().toISOString()
          };
        });
      });

      // Optimistically reorder in list queries
      const taskIdMap = new Map(reorderPositions.map(pos => [pos.taskId, pos.sortOrder]));

      queryClient.setQueriesData(
        { queryKey: ['tasks', 'projects'] },
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;

          // Sort array by new sort_order values
          const newArray = [...old];
          newArray.sort((a, b) => {
            const aSortOrder = taskIdMap.get(a.id) ?? a.sort_order;
            const bSortOrder = taskIdMap.get(b.id) ?? b.sort_order;
            return aSortOrder - bSortOrder;
          });

          return newArray;
        }
      );

      return { previousQueries };
    },

    onError: (err, reorderPositions, context) => {
      // Rollback optimistic updates
      if (context?.previousQueries) {
        context.previousQueries.forEach((previousTask, taskId) => {
          if (previousTask) {
            queryClient.setQueryData(TASK_KEYS.task(taskId), previousTask);
          }
        });
      }
    },

    onSuccess: (updatedTasks) => {
      // Update individual task caches with server response
      updatedTasks.forEach(task => {
        queryClient.setQueryData(TASK_KEYS.task(task.id), task);
      });

      // Invalidate sorted queries to ensure consistency
      if (updatedTasks.length > 0) {
        const projectId = updatedTasks[0].project_id;
        const userId = updatedTasks[0].assigned_to;

        if (userId) {
          queryClient.invalidateQueries({
            queryKey: [...TASK_KEYS.projects(userId, [projectId]), 'sorted']
          });
        }
      }
    },
  });
};

/**
 * Hook for toggling project sort mode
 */
export const useToggleProjectSortMode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, enabled }: { projectId: string; enabled: boolean }) =>
      toggleProjectSortMode(projectId, enabled),

    onSuccess: (_, { projectId }) => {
      // Invalidate all task queries for this project to refetch with new sort mode
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('tasks') && key.includes(projectId);
        }
      });
    },
  });
};

/**
 * Hook for resetting project task order to automatic
 */
export const useResetProjectTaskOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => resetProjectTaskOrder(projectId),

    onSuccess: (_, projectId) => {
      // Invalidate all task queries for this project
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('tasks') && key.includes(projectId);
        }
      });
    },
  });
};

/**
 * Optimistic task reordering hook - provides instant UI updates
 * Use this for drag and drop operations where immediate feedback is critical
 */
export const useOptimisticTaskSort = () => {
  const queryClient = useQueryClient();
  const moveTaskMutation = useMoveTaskBetween();
  const reorderTasksMutation = useReorderTasks();

  const moveTask = (taskId: string, beforeTaskId?: string, afterTaskId?: string) => {
    return moveTaskMutation.mutate({ taskId, beforeTaskId, afterTaskId });
  };

  const reorderTasks = (positions: TaskReorderPosition[]) => {
    return reorderTasksMutation.mutate(positions);
  };

  // Optimistic local reorder without server call (for immediate drag feedback)
  const optimisticReorder = (taskIds: string[], newOrder: string[]) => {
    queryClient.setQueriesData(
      { queryKey: ['tasks', 'projects'] },
      (old: any) => {
        if (!old || !Array.isArray(old)) return old;

        const taskMap = new Map(old.map(task => [task.id, task]));
        const reorderedTasks = newOrder.map(id => taskMap.get(id)).filter(Boolean);
        const otherTasks = old.filter(task => !taskIds.includes(task.id));

        return [...reorderedTasks, ...otherTasks];
      }
    );
  };

  return {
    moveTask,
    reorderTasks,
    optimisticReorder,
    isMoving: moveTaskMutation.isPending,
    isReordering: reorderTasksMutation.isPending,
    error: moveTaskMutation.error || reorderTasksMutation.error,
  };
};

/**
 * Real-time synchronization hook for task updates
 * Listens to database changes and updates the query cache automatically
 */
export const useRealtimeTaskSync = (userId: string, projectIds: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || projectIds.length === 0) return;

    const supabase = getSupabaseClient();

    // Set up real-time subscription for task changes
    const subscription = supabase
      .channel('task-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'tasks',
          filter: `project_id=in.(${projectIds.join(',')})`,
        },
        (payload) => {
          console.log('🔄 Real-time task update:', payload);

          // Handle different types of changes
          switch (payload.eventType) {
            case 'INSERT':
              // Invalidate task lists to refetch with new task
              queryClient.invalidateQueries({
                queryKey: [...TASK_KEYS.projects(userId, projectIds), 'sorted']
              });
              break;

            case 'UPDATE':
              const updatedTask = payload.new;

              // Update individual task cache
              if (updatedTask) {
                queryClient.setQueryData(TASK_KEYS.task(updatedTask.id), updatedTask);
              }

              // Update task in lists (with optimistic approach)
              queryClient.setQueriesData(
                { queryKey: ['tasks', 'projects'] },
                (old: any) => {
                  if (!old || !Array.isArray(old)) return old;

                  return old.map((task: any) =>
                    task.id === updatedTask.id ? { ...task, ...updatedTask } : task
                  );
                }
              );

              // If sort_order changed, invalidate to refetch proper order
              if (payload.old?.sort_order !== updatedTask.sort_order) {
                queryClient.invalidateQueries({
                  queryKey: [...TASK_KEYS.projects(userId, projectIds), 'sorted']
                });
              }
              break;

            case 'DELETE':
              const deletedTaskId = payload.old?.id;
              if (deletedTaskId) {
                // Remove from individual cache
                queryClient.removeQueries({ queryKey: TASK_KEYS.task(deletedTaskId) });

                // Remove from lists
                queryClient.setQueriesData(
                  { queryKey: ['tasks'] },
                  (old: any) => {
                    if (!old || !Array.isArray(old)) return old;
                    return old.filter((task: any) => task.id !== deletedTaskId);
                  }
                );
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time task sync connected');
        } else if (status === 'CLOSED') {
          console.log('❌ Real-time task sync disconnected');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, projectIds, queryClient]);

  // Return connection status
  return {
    isConnected: true, // We could track this more precisely if needed
  };
};