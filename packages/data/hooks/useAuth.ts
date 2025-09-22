import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signUp, signIn, signOut, getSession, getCurrentUser, signInWithGoogleIdToken, type SignUpCredentials, type SignInCredentials } from '../services/authService';

// Query key constants
const AUTH_KEYS = {
  session: ['auth', 'session'] as const,
  user: ['auth', 'user'] as const,
};

export const useSession = () => {
  return useQuery({
    queryKey: AUTH_KEYS.session,
    queryFn: getSession,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: AUTH_KEYS.user,
    queryFn: getCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
};

export const useSignUp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: SignUpCredentials) => signUp(credentials),
    onSuccess: () => {
      // Invalidate auth queries after successful signup
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
};

export const useSignIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: SignInCredentials) => signIn(credentials),
    onSuccess: () => {
      // Invalidate auth queries after successful signin
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
};

export const useSignOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Clear all queries after signout
      queryClient.clear();
    },
  });
};

export const useSignInWithGoogleIdToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (idToken: string) => signInWithGoogleIdToken(idToken),
    onSuccess: () => {
      // Invalidate auth queries after successful Google signin
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
};