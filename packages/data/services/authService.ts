import { supabase } from '../supabase';
import type { User } from '@supabase/supabase-js';

export interface SignUpCredentials {
  email: string;
  password: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export const signUp = async (credentials: SignUpCredentials): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(`Sign up failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Sign up failed: No user data returned');
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.signUp error:', error);
    throw error;
  }
};

export const signIn = async (credentials: SignInCredentials): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(`Sign in failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Sign in failed: No user data returned');
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.signIn error:', error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(`Sign out failed: ${error.message}`);
    }
  } catch (error) {
    console.error('AuthService.signOut error:', error);
    throw error;
  }
};

export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    console.log('AuthService.getSession debug:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      error: error?.message
    });

    if (error) {
      throw new Error(`Get session failed: ${error.message}`);
    }

    return data.session;
  } catch (error) {
    console.error('AuthService.getSession error:', error);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw new Error(`Get current user failed: ${error.message}`);
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.getCurrentUser error:', error);
    throw error;
  }
};

export const signInWithGoogleIdToken = async (idToken: string): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      throw new Error(`Google sign in failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Google sign in failed: No user data returned');
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.signInWithGoogleIdToken error:', error);
    throw error;
  }
};