import { signInWithGoogleIdToken } from '../../services/authService';
import { getCurrentProfile, updateProfile } from '../../services/profileService';
import { supabase } from '../../supabase';
import type { User } from '@supabase/supabase-js';

// Mock the supabase client
jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

describe('Google Authentication Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signInWithGoogleIdToken', () => {
    it('should successfully sign in with valid Google ID token', async () => {
      const mockUser: Partial<User> = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };

      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await signInWithGoogleIdToken('valid-id-token');

      expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'valid-id-token',
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw error when Supabase returns an error', async () => {
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(signInWithGoogleIdToken('invalid-token')).rejects.toThrow(
        'Google sign in failed: Invalid token'
      );
    });

    it('should throw error when no user data is returned', async () => {
      (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(signInWithGoogleIdToken('valid-token')).rejects.toThrow(
        'Google sign in failed: No user data returned'
      );
    });
  });
});

describe('Profile Service for Google Auth Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentProfile', () => {
    it('should fetch current user profile successfully', async () => {
      const mockProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      };

      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await getCurrentProfile();

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockProfile);
    });

    it('should throw error when profile not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        }),
      });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      await expect(getCurrentProfile()).rejects.toThrow(
        'Failed to fetch current profile: No rows found'
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile for onboarding completion', async () => {
      const mockUpdatedProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: null,
        last_name: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T01:00:00.000Z',
      };

      // Mock getUser to return the current user
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: '550e8400-e29b-41d4-a716-446655440000' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockUpdatedProfile,
          error: null,
        }),
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateProfile({ first_name: 'John' });

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockUpdate).toHaveBeenCalledWith({
        first_name: 'John',
        updated_at: expect.any(String),
      });
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should throw error when update fails', async () => {
      // Mock getUser to return the current user
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: '550e8400-e29b-41d4-a716-446655440000' } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' },
        }),
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      await expect(
        updateProfile({ first_name: 'John' })
      ).rejects.toThrow('Failed to update profile: Update failed');
    });
  });
});