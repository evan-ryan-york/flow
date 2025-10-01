import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDefinitionsForProject,
  getAllDefinitionsForUser,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  getValuesForTask,
  getValuesForTasks,
  setPropertyValue,
  deletePropertyValue,
  getProjectsForDefinition,
  updateDefinitionProjects,
  type CreateDefinitionData,
  type CreateDefinitionDataLegacy,
  type UpdateDefinitionData,
} from "../services/customPropertyService";

// Query key constants
const CUSTOM_PROPERTY_KEYS = {
  all: ["customProperties"] as const,
  definitions: ["customProperties", "definitions"] as const,
  projectDefinitions: (projectId: string) => ["customProperties", "definitions", "project", projectId] as const,
  userDefinitions: (userId: string) => ["customProperties", "definitions", "user", userId] as const,
  values: ["customProperties", "values"] as const,
  taskValues: (taskId: string) => ["customProperties", "values", "task", taskId] as const,
};

// Custom Property Definitions Hooks

export const useProjectDefinitions = (projectId: string) => {
  return useQuery({
    queryKey: CUSTOM_PROPERTY_KEYS.projectDefinitions(projectId),
    queryFn: () => getDefinitionsForProject(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes - definitions don't change often
  });
};

export const useAllUserDefinitions = (userId: string) => {
  return useQuery({
    queryKey: CUSTOM_PROPERTY_KEYS.userDefinitions(userId),
    queryFn: () => getAllDefinitionsForUser(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes - definitions don't change often
  });
};

export const useCreateDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definitionData: CreateDefinitionData) => createDefinition(definitionData),
    onSuccess: (newDefinition) => {
      // Invalidate project definitions queries for all affected projects
      newDefinition.project_ids.forEach((projectId) => {
        queryClient.invalidateQueries({
          queryKey: CUSTOM_PROPERTY_KEYS.projectDefinitions(projectId),
        });
      });
      // Invalidate user definitions query
      queryClient.invalidateQueries({
        queryKey: CUSTOM_PROPERTY_KEYS.userDefinitions(newDefinition.created_by),
      });
    },
  });
};

// Legacy hook for backward compatibility
export const useCreateDefinitionLegacy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definitionData: CreateDefinitionDataLegacy) => {
      // Convert legacy format to new format
      const newFormatData: CreateDefinitionData = {
        ...definitionData,
        project_ids: [definitionData.project_id],
      };
      return createDefinition(newFormatData);
    },
    onSuccess: (newDefinition) => {
      // Invalidate project definitions queries for all affected projects
      newDefinition.project_ids.forEach((projectId) => {
        queryClient.invalidateQueries({
          queryKey: CUSTOM_PROPERTY_KEYS.projectDefinitions(projectId),
        });
      });
    },
  });
};

export const useUpdateDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      definitionId,
      updates,
    }: {
      definitionId: string;
      updates: UpdateDefinitionData & { project_ids?: string[] };
    }) => updateDefinition(definitionId, updates),
    onSuccess: (updatedDefinition) => {
      // Invalidate project definitions queries for all affected projects
      updatedDefinition.project_ids.forEach((projectId) => {
        queryClient.invalidateQueries({
          queryKey: CUSTOM_PROPERTY_KEYS.projectDefinitions(projectId),
        });
      });
      // Invalidate user definitions query
      queryClient.invalidateQueries({
        queryKey: CUSTOM_PROPERTY_KEYS.userDefinitions(updatedDefinition.created_by),
      });
    },
  });
};

// Hook to get projects assigned to a definition
export const useDefinitionProjects = (definitionId: string) => {
  return useQuery({
    queryKey: ["customProperties", "projects", "definition", definitionId],
    queryFn: () => getProjectsForDefinition(definitionId),
    enabled: !!definitionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to update project assignments for a definition
export const useUpdateDefinitionProjects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ definitionId, projectIds }: { definitionId: string; projectIds: string[] }) =>
      updateDefinitionProjects(definitionId, projectIds),
    onSuccess: (_, { definitionId, projectIds }) => {
      // Invalidate the definition projects query
      queryClient.invalidateQueries({
        queryKey: ["customProperties", "projects", "definition", definitionId],
      });

      // Invalidate project definitions queries for all affected projects
      projectIds.forEach((projectId) => {
        queryClient.invalidateQueries({
          queryKey: CUSTOM_PROPERTY_KEYS.projectDefinitions(projectId),
        });
      });

      // Also invalidate all project definitions to be safe
      queryClient.invalidateQueries({ queryKey: CUSTOM_PROPERTY_KEYS.definitions });
    },
  });
};

export const useDeleteDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definitionId: string) => deleteDefinition(definitionId),
    onSuccess: () => {
      // Invalidate all definitions queries since we don't know which project it belonged to
      queryClient.invalidateQueries({ queryKey: CUSTOM_PROPERTY_KEYS.definitions });
    },
  });
};

// Custom Property Values Hooks

export const useTaskPropertyValues = (taskId: string) => {
  return useQuery({
    queryKey: CUSTOM_PROPERTY_KEYS.taskValues(taskId),
    queryFn: () => getValuesForTask(taskId),
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useTasksPropertyValues = (taskIds: string[]) => {
  return useQuery({
    queryKey: ['customProperties', 'values', 'tasks', taskIds.sort().join(',')],
    queryFn: () => getValuesForTasks(taskIds),
    enabled: taskIds.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useSetPropertyValue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { taskId: string; definitionId: string; value: string; userId: string }) =>
      setPropertyValue({
        task_id: data.taskId,
        definition_id: data.definitionId,
        value: data.value,
        user_id: data.userId,
      }),
    onSuccess: (updatedValue) => {
      // Invalidate task property values query to refetch
      queryClient.invalidateQueries({
        queryKey: CUSTOM_PROPERTY_KEYS.taskValues(updatedValue.task_id),
      });

      // Invalidate all bulk property values queries (for grouping)
      queryClient.invalidateQueries({
        queryKey: ['customProperties', 'values', 'tasks'],
      });

      // Also invalidate tasks queries to ensure UI updates for newly created tasks
      queryClient.invalidateQueries({
        queryKey: ["tasks"],
      });
    },
  });
};

export const useDeletePropertyValue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, definitionId }: { taskId: string; definitionId: string }) =>
      deletePropertyValue(taskId, definitionId),
    onSuccess: (_, { taskId }) => {
      // Invalidate task property values query to refetch
      queryClient.invalidateQueries({
        queryKey: CUSTOM_PROPERTY_KEYS.taskValues(taskId),
      });
    },
  });
};
