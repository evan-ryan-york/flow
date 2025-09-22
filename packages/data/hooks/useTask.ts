import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTasksForProject,
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

      // Add the new task to the cache
      queryClient.setQueryData(TASK_KEYS.task(newTask.id), newTask);
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: UpdateTaskData }) =>
      updateTask(taskId, updates),
    onSuccess: (updatedTask) => {
      // Update the task in cache
      queryClient.setQueryData(TASK_KEYS.task(updatedTask.id), updatedTask);

      // Invalidate project tasks query to ensure consistency
      queryClient.invalidateQueries({
        queryKey: TASK_KEYS.project(updatedTask.project_id)
      });
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