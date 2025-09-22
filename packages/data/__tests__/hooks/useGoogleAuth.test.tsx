import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSignInWithGoogleIdToken } from '../../hooks/useAuth';
import { useCurrentProfile, useUpdateProfile } from '../../hooks/useProfile';
import * as authService from '../../services/authService';
import * as profileService from '../../services/profileService';

// Mock the service layers
jest.mock('../../services/authService');
jest.mock('../../services/profileService');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockProfileService = profileService as jest.Mocked<typeof profileService>;

// Test wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Google Auth Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSignInWithGoogleIdToken', () => {
    it('should return loading state initially and success state after mutation', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
      };

      mockAuthService.signInWithGoogleIdToken.mockResolvedValue(mockUser as any);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSignInWithGoogleIdToken(), { wrapper });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);

      // Trigger the mutation
      result.current.mutate('test-id-token');

      expect(result.current.isPending).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toEqual(mockUser);
      expect(mockAuthService.signInWithGoogleIdToken).toHaveBeenCalledWith('test-id-token');
    });

    it('should handle authentication errors', async () => {
      const errorMessage = 'Invalid token';
      mockAuthService.signInWithGoogleIdToken.mockRejectedValue(new Error(errorMessage));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useSignInWithGoogleIdToken(), { wrapper });

      result.current.mutate('invalid-token');

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(errorMessage);
      expect(result.current.isPending).toBe(false);
    });
  });
});

describe('Profile Hooks for Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useCurrentProfile', () => {
    it('should fetch current profile and detect onboarding need', async () => {
      const mockProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        full_name: null, // This indicates onboarding is needed
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      mockProfileService.getCurrentProfile.mockResolvedValue(mockProfile);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCurrentProfile(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProfile);
      expect(result.current.data?.full_name).toBeNull(); // Should trigger onboarding
      expect(mockProfileService.getCurrentProfile).toHaveBeenCalled();
    });

    it('should fetch existing user profile without onboarding', async () => {
      const mockProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        full_name: 'John Doe', // User has completed onboarding
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      mockProfileService.getCurrentProfile.mockResolvedValue(mockProfile);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCurrentProfile(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockProfile);
      expect(result.current.data?.full_name).toBe('John Doe'); // No onboarding needed
    });

    it('should handle profile fetch errors', async () => {
      const errorMessage = 'Profile not found';
      mockProfileService.getCurrentProfile.mockRejectedValue(new Error(errorMessage));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCurrentProfile(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(errorMessage);
    });
  });

  describe('useUpdateProfile', () => {
    it('should update profile with full_name during onboarding', async () => {
      const mockUpdatedProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        full_name: 'John Doe',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T01:00:00.000Z',
      };

      mockProfileService.updateProfile.mockResolvedValue(mockUpdatedProfile);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProfile(), { wrapper });

      result.current.mutate({
        fullName: 'John Doe',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUpdatedProfile);
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith({
        fullName: 'John Doe',
      });
    });

    it('should handle profile update errors', async () => {
      const errorMessage = 'Update failed';
      mockProfileService.updateProfile.mockRejectedValue(new Error(errorMessage));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateProfile(), { wrapper });

      result.current.mutate({
        fullName: 'John Doe',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe(errorMessage);
    });
  });
});