import * as authService from '../../services/authService';

// Mock the entire supabase module
jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

const mockSupabase = require('../../supabase').supabase;

describe('authService Unit Tests (Mock-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      const mockAuthResponse = {
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
          },
          session: {
            access_token: 'mock-token',
          },
        },
        error: null,
      };

      mockSupabase.auth.signUp.mockResolvedValue(mockAuthResponse);

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.email).toBe('test@example.com');
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle sign up errors', async () => {
      const mockAuthResponse = {
        data: { user: null, session: null },
        error: { message: 'User already exists' },
      };

      mockSupabase.auth.signUp.mockResolvedValue(mockAuthResponse);

      await expect(authService.signUp({
        email: 'existing@example.com',
        password: 'password123',
      })).rejects.toThrow('Sign up failed: User already exists');
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const mockAuthResponse = {
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
          },
          session: {
            access_token: 'mock-token',
          },
        },
        error: null,
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle sign in errors', async () => {
      const mockAuthResponse = {
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);

      await expect(authService.signIn({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow('Sign in failed: Invalid credentials');
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await expect(authService.signOut()).resolves.not.toThrow();
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: { message: 'Sign out failed' } });

      await expect(authService.signOut()).rejects.toThrow('Sign out failed: Sign out failed');
    });
  });

  describe('getSession', () => {
    it('should return session when user is authenticated', async () => {
      const mockSession = {
        access_token: 'mock-token',
        user: { id: '550e8400-e29b-41d4-a716-446655440002', email: 'test@example.com' },
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const session = await authService.getSession();
      expect(session).toEqual(mockSession);
    });

    it('should return null when no user is authenticated', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await authService.getSession();
      expect(session).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const user = await authService.getCurrentUser();
      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const user = await authService.getCurrentUser();
      expect(user).toBeNull();
    });
  });
});