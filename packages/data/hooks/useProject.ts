import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createProject,
  getProjectsForUser,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateMemberRole,
  type UpdateProjectData,
  type ProjectWithRole,
} from '../services/projectService';

// Query key factory for consistent caching
const PROJECT_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_KEYS.all, 'list'] as const,
  list: (userId: string) => [...PROJECT_KEYS.lists(), userId] as const,
  details: () => [...PROJECT_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PROJECT_KEYS.details(), id] as const,
  members: (projectId: string) => [...PROJECT_KEYS.detail(projectId), 'members'] as const,
};

// Hook to get all projects for a user (owner + member)
export const useProjectsForUser = (userId: string | undefined) => {
  return useQuery({
    queryKey: PROJECT_KEYS.list(userId || ''),
    queryFn: () => getProjectsForUser(userId!),
    enabled: !!userId, // Only run query if userId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to get a single project by ID
export const useProject = (projectId: string | undefined) => {
  return useQuery({
    queryKey: PROJECT_KEYS.detail(projectId || ''),
    queryFn: () => getProjectById(projectId!),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to get project members
export const useProjectMembers = (projectId: string | undefined) => {
  return useQuery({
    queryKey: PROJECT_KEYS.members(projectId || ''),
    queryFn: () => getProjectMembers(projectId!),
    enabled: !!projectId, // Only run query if projectId is provided
    staleTime: 1000 * 60 * 2, // 2 minutes (more frequent updates for collaboration)
  });
};

// Mutation hook to create a new project
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ownerId, name }: { ownerId: string; name: string }) =>
      createProject(ownerId, name),
    onSuccess: (newProject, { ownerId }) => {
      // Add the new project to the user's project list cache
      queryClient.setQueryData<ProjectWithRole[]>(
        PROJECT_KEYS.list(ownerId),
        (old) => {
          if (!old) return [{ ...newProject, userRole: 'owner' }];
          return [...old, { ...newProject, userRole: 'owner' }];
        }
      );

      // Invalidate the projects list to ensure consistency
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};

// Mutation hook to update a project
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, updates }: { projectId: string; updates: UpdateProjectData }) =>
      updateProject(projectId, updates),
    onSuccess: (updatedProject) => {
      // Update the specific project in cache
      queryClient.setQueryData(
        PROJECT_KEYS.detail(updatedProject.id),
        updatedProject
      );

      // Update the project in all user lists that might contain it
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};

// Mutation hook to delete a project
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: (_, deletedProjectId) => {
      // Remove the project from all caches
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(deletedProjectId) });
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.members(deletedProjectId) });

      // Invalidate project lists to remove the deleted project
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};

// Mutation hook to add a project member
export const useAddProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      role = 'member'
    }: {
      projectId: string;
      userId: string;
      role?: 'admin' | 'member' | 'viewer';
    }) => addProjectMember(projectId, userId, role),
    onSuccess: (newMember) => {
      // Add the new member to the project members cache
      queryClient.setQueryData(
        PROJECT_KEYS.members(newMember.project_id),
        (old: any) => {
          if (!old) return [newMember];
          return [...old, newMember];
        }
      );

      // The new member should now see this project in their project list
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};

// Mutation hook to remove a project member
export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      removeProjectMember(projectId, userId),
    onSuccess: (_, { projectId, userId }) => {
      // Remove the member from the project members cache
      queryClient.setQueryData(
        PROJECT_KEYS.members(projectId),
        (old: any) => {
          if (!old) return [];
          return old.filter((member: any) => member.user_id !== userId);
        }
      );

      // The removed member should no longer see this project in their list
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};

// Mutation hook to update a member's role
export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      newRole
    }: {
      projectId: string;
      userId: string;
      newRole: 'admin' | 'member' | 'viewer';
    }) => updateMemberRole(projectId, userId, newRole),
    onSuccess: (updatedMember) => {
      // Update the specific member in the project members cache
      queryClient.setQueryData(
        PROJECT_KEYS.members(updatedMember.project_id),
        (old: any) => {
          if (!old) return [updatedMember];
          return old.map((member: any) =>
            member.user_id === updatedMember.user_id ? updatedMember : member
          );
        }
      );

      // Update the user's role in project lists
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
    },
  });
};