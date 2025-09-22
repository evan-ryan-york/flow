import * as profileService from '../../services/profileService';
import { ProfileSchema } from '@perfect-task-app/models';

// Mock the entire supabase module
jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
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

const mockSupabase = require('../../supabase').supabase;

describe('profileService Unit Tests (Mock-based)', () => {
  const mockProfile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should successfully fetch a user profile', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const profile = await profileService.getProfile('user-1');

      expect(profile).toEqual(mockProfile);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockChain.select).toHaveBeenCalledWith('*');
    });

    it('should throw an error when profile is not found', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(profileService.getProfile('nonexistent-user')).rejects.toThrow('Profile not found');
    });

    it('should handle database errors', async () => {
      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(profileService.getProfile('user-1')).rejects.toThrow('Failed to fetch profile: Database error');
    });

    it('should validate profile data with Zod schema', async () => {
      const validProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        avatar_url: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: validProfile,
              error: null,
            }),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const profile = await profileService.getProfile('user-1');

      // Should not throw validation error
      expect(() => ProfileSchema.parse(profile)).not.toThrow();
      expect(profile).toEqual(validProfile);
    });
  });

  describe('updateProfile', () => {
    it('should successfully update profile fields', async () => {
      const updatedProfile = {
        ...mockProfile,
        first_name: 'Jane',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: updatedProfile,
                error: null,
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await profileService.updateProfile('550e8400-e29b-41d4-a716-446655440000',{ first_name: 'Jane' });

      expect(result).toEqual(updatedProfile);
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Jane',
          updated_at: expect.any(String),
        })
      );
    });

    it('should handle update errors', async () => {
      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' },
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await expect(profileService.updateProfile('user-1', { first_name: 'Jane' }))
        .rejects.toThrow('Failed to update profile: Update failed');
    });

    it('should handle empty updates', async () => {
      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockProfile,
                  updated_at: '2023-01-02T00:00:00Z',
                },
                error: null,
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await profileService.updateProfile('550e8400-e29b-41d4-a716-446655440000',{});

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        })
      );
    });

    it('should validate updated profile data with Zod schema', async () => {
      const updatedProfile = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        first_name: 'UpdatedName',
        last_name: 'UpdatedLast',
        email: 'updated@example.com',
        avatar_url: 'https://example.com/new-avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockChain = {
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: updatedProfile,
                error: null,
              }),
            })),
          })),
        })),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      const result = await profileService.updateProfile('550e8400-e29b-41d4-a716-446655440000',{
        first_name: 'UpdatedName',
        last_name: 'UpdatedLast',
        avatar_url: 'https://example.com/new-avatar.jpg',
      });

      // Should not throw validation error
      expect(() => ProfileSchema.parse(result)).not.toThrow();
      expect(result).toEqual(updatedProfile);
    });
  });
});