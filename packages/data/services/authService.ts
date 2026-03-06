import { getSupabaseClient } from '../supabase';
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    // Detect if we're in Capacitor
    const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

    if (isCapacitor) {
      // In Capacitor, getSession() hangs, so we read from storage directly
      const { Preferences } = await import('@capacitor/preferences');
      const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';
      const { value } = await Preferences.get({ key: storageKey });

      if (!value) {
        console.log('AuthService.getSession: No session in storage');
        return null;
      }

      const session = JSON.parse(value);

      console.log('AuthService.getSession (Capacitor) debug:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        hasAccessToken: !!session?.access_token,
      });

      return session;
    } else {
      // For web/desktop, getSession() works fine
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getSession();

      console.log('AuthService.getSession (web) debug:', {
        hasSession: !!data.session,
        hasUser: !!data.session?.user,
        userId: data.session?.user?.id,
        error: error?.message
      });

      if (error) {
        throw new Error(`Get session failed: ${error.message}`);
      }

      return data.session;
    }
  } catch (error) {
    console.error('AuthService.getSession error:', error);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    // Detect if we're in Capacitor
    const isCapacitor = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

    if (isCapacitor) {
      // In Capacitor, getUser() might hang, so we get user from session storage
      const session = await getSession();
      return session?.user || null;
    } else {
      // For web/desktop, getUser() works fine
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        throw new Error(`Get current user failed: ${error.message}`);
      }

      return data.user;
    }
  } catch (error) {
    console.error('AuthService.getCurrentUser error:', error);
    throw error;
  }
};

export const signInWithGoogleIdToken = async (idToken: string): Promise<User> => {
  try {
    const supabase = getSupabaseClient();
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

export const signInWithAppleIdToken = async (idToken: string, nonce?: string): Promise<User> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce,
    });

    if (error) {
      throw new Error(`Apple sign in failed: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Apple sign in failed: No user data returned');
    }

    return data.user;
  } catch (error) {
    console.error('AuthService.signInWithAppleIdToken error:', error);
    throw error;
  }
};

export const deleteAccount = async (): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    let accessToken: string | null = null;
    const isCapacitorEnv = typeof window !== 'undefined' && window.location.protocol === 'capacitor:';

    if (isCapacitorEnv) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'flow-app-access-token' });
      accessToken = value;
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token ?? null;
    }

    if (!accessToken) {
      throw new Error('No active session');
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete account');
    }

    if (isCapacitorEnv) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: 'sb-sprjddkfkwrrebazjxvf-auth-token' });
      await Preferences.remove({ key: 'flow-app-access-token' });
      await Preferences.remove({ key: 'flow-app-user-data' });
    }

    await supabase.auth.signOut();
  } catch (error) {
    console.error('AuthService.deleteAccount error:', error);
    throw error;
  }
};