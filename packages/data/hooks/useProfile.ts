import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, getCurrentProfile } from '../services/profileService';

// Query key factory
const PROFILE_KEYS = {
  all: ['profiles'] as const,
  profile: (userId: string) => [...PROFILE_KEYS.all, userId] as const,
  current: ['profiles', 'current'] as const,
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
  return useQuery({
    queryKey: PROFILE_KEYS.current,
    queryFn: getCurrentProfile,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: { fullName: string }) => updateProfile(updates),
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