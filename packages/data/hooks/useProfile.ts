import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, getCurrentProfile, getLastUsedProject, updateLastUsedProject, getAllProfiles, getConnectedProfiles, getVisibleProjectIds, updateVisibleProjectIds, type ProfileUpdates } from '../services/profileService';
import { useSession } from './useAuth';

// Query key factory
const PROFILE_KEYS = {
  all: ['profiles'] as const,
  list: ['profiles', 'list'] as const,
  connected: ['profiles', 'connected'] as const,
  profile: (userId: string) => [...PROFILE_KEYS.all, userId] as const,
  current: ['profiles', 'current'] as const,
  lastUsedProject: ['profiles', 'lastUsedProject'] as const,
  visibleProjects: (userId: string) => ['profiles', 'visibleProjects', userId] as const,
};

export const useProfile = (userId: string | undefined) => {
  return useQuery({
    queryKey: PROFILE_KEYS.profile(userId || ''),
    queryFn: () => getProfile(userId!),
    enabled: !!userId, // Only run query if userId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useCurrentProfile = () => {
  const { data: session } = useSession();

  return useQuery({
    queryKey: PROFILE_KEYS.current,
    queryFn: getCurrentProfile,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!session?.user, // Only run when we have a session
    retry: false,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: ProfileUpdates) => updateProfile(updates),
    onSuccess: (updatedProfile) => {
      // Update the specific profile in cache as specified in build-spec
      queryClient.setQueryData(
        PROFILE_KEYS.profile(updatedProfile.id),
        updatedProfile
      );

      // Update current profile cache
      queryClient.setQueryData(PROFILE_KEYS.current, updatedProfile);

      // Invalidate the ['profile', userId] query as specified in build-spec
      queryClient.invalidateQueries({ queryKey: ['profile', updatedProfile.id] });
    },
  });
};

export const useLastUsedProject = () => {
  const { data: session } = useSession();

  return useQuery({
    queryKey: PROFILE_KEYS.lastUsedProject,
    queryFn: () => getLastUsedProject(), // Wrap the function call
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!session?.user, // Only run when we have a session
  });
};

export const useUpdateLastUsedProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => updateLastUsedProject(projectId),
    onSuccess: () => {
      // Invalidate last used project cache
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.lastUsedProject });

      // Also invalidate current profile cache since it contains last_used_project_id
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.current });
    },
  });
};

export const useAllProfiles = () => {
  return useQuery({
    queryKey: PROFILE_KEYS.list,
    queryFn: getAllProfiles,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Get profiles of users who share projects with the current user.
 * Use this for task assignment dropdowns to only show relevant users.
 */
export const useConnectedProfiles = () => {
  const { data: session } = useSession();

  return useQuery({
    queryKey: PROFILE_KEYS.connected,
    queryFn: getConnectedProfiles,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!session?.user, // Only run when we have a session
  });
};

export const useVisibleProjectIds = (userId: string | undefined) => {
  return useQuery({
    queryKey: PROFILE_KEYS.visibleProjects(userId || ''),
    queryFn: () => getVisibleProjectIds(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUpdateVisibleProjectIds = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectIds, userId }: { projectIds: string[]; userId: string }) => updateVisibleProjectIds(projectIds, userId),
    onSuccess: (_, { userId }) => {
      // Invalidate visible projects cache for this specific user
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.visibleProjects(userId) });

      // Also invalidate profile cache since it contains visible_project_ids
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.profile(userId) });
    },
  });
};