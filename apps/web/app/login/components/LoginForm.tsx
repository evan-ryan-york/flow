'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/providers';
import { useSearchParams } from 'next/navigation';
import { isTauri, handleTauriGoogleOAuth } from '@/lib/tauri-oauth';
import { isCapacitor, handleCapacitorGoogleOAuth } from '@/lib/capacitor-oauth';
import type { User } from '@supabase/supabase-js';

async function storeCapacitorSession(session: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string }, user: User) {
  const { Preferences } = await import('@capacitor/preferences');
  const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';

  const sessionData = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user,
  };

  await Preferences.set({ key: storageKey, value: JSON.stringify(sessionData) });
  await Preferences.set({ key: 'flow-app-access-token', value: session.access_token });
  await Preferences.set({
    key: 'flow-app-user-data',
    value: JSON.stringify({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    }),
  });

  const { reinitializeSupabaseClient } = await import('@flow-app/data');
  reinitializeSupabaseClient();
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [isCapacitorEnv, setIsCapacitorEnv] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  // Detect Tauri and Capacitor environment on mount
  useEffect(() => {
    const detectedTauri = isTauri();
    const detectedCapacitor = isCapacitor();
    console.log('Environment detection:', {
      tauri: detectedTauri,
      capacitor: detectedCapacitor,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    });
    setIsTauriEnv(detectedTauri);
    setIsCapacitorEnv(detectedCapacitor);
  }, []);

  // Check for callback errors
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (errorParam === 'auth_callback_error') {
      const errorMessage = messageParam
        ? decodeURIComponent(messageParam)
        : 'Authentication failed';
      console.error('Auth callback error:', errorMessage);
      setError(`Authentication failed: ${errorMessage}`);
    }
  }, [searchParams]);

  // Check URL hash for auth tokens (web OAuth callback)
  useEffect(() => {
    if (isCapacitorEnv) return;

    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('refresh_token')) {
      console.log('Auth tokens found in URL hash on page load (web flow)');
      setIsLoading(true);

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const storeSessionAndRedirect = async () => {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) throw error;

            window.history.replaceState(null, '', ' ');
            router.push('/dashboard');
          } catch (err) {
            console.error('Error setting session from hash:', err);
            setError(err instanceof Error ? err.message : 'Failed to log in');
            setIsLoading(false);
            window.history.replaceState(null, '', ' ');
          }
        };

        storeSessionAndRedirect();
      }
    }
  }, [supabase, router, isCapacitorEnv]);

  // Check for existing session on mount and redirect if logged in
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        if (isCapacitorEnv) {
          const { Preferences } = await import('@capacitor/preferences');
          const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';
          const { value } = await Preferences.get({ key: storageKey });

          if (value && isMounted) {
            const session = JSON.parse(value);
            if (session.access_token) {
              router.push('/dashboard');
            }
          }
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session && isMounted) {
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('Error checking session on mount:', err);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [isCapacitorEnv, router, supabase]);

  const handleMagicLink = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isTauriEnv) {
        console.warn('Magic links may not work reliably in desktop app');
        setError(
          'Magic links are not recommended for desktop app. Please use Google Sign-In instead.',
        );
        setIsLoading(false);
        return;
      }

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { createClient } = await import('@supabase/supabase-js');
      const directClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            flowType: 'implicit',
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { error } = await directClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setEmailSent(true);
    } catch (error: unknown) {
      console.error('Magic link error:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to send magic link',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use Capacitor-specific OAuth flow (native Google SDK)
      if (isCapacitorEnv) {
        console.log('Using native Google Sign-In SDK...');
        const result = await handleCapacitorGoogleOAuth(supabase);

        if (!result.success || !result.idToken) {
          throw new Error(result.error || 'Failed to authenticate with Google');
        }

        // Exchange the Google ID token for a Supabase session
        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });

        if (signInError) throw signInError;
        if (!data.session || !data.user) throw new Error('No session returned from Supabase');

        await storeCapacitorSession(data.session, data.user);
        router.replace('/dashboard');
        return;
      }

      // Use Tauri-specific OAuth flow if in Tauri environment
      if (isTauriEnv) {
        console.log('Using Tauri OAuth flow...');
        const result = await handleTauriGoogleOAuth(supabase);

        if (!result.success) {
          throw new Error(result.error || 'Failed to authenticate');
        }

        let session = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!session && attempts < maxAttempts) {
          attempts++;
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession) {
            session = currentSession;
            break;
          }

          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        if (!session) {
          throw new Error('Authentication succeeded but no session was created');
        }

        router.push('/dashboard');
        return;
      }

      // Web browser OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false,
        },
      });

      if (error) throw error;

      console.log('OAuth initiated:', data);
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to sign in with Google',
      );
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (isCapacitorEnv) {
        // Native Apple Sign-In (stays in-app via AuthenticationServices framework)
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        const result = await SignInWithApple.authorize({
          clientId: 'com.perfecttask.app',
          redirectURI: 'https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback',
          scopes: 'email name',
        });

        const idToken = result.response.identityToken;
        if (!idToken) {
          throw new Error('No identity token received from Apple');
        }

        // Exchange Apple ID token for Supabase session
        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: idToken,
        });

        if (signInError) throw signInError;
        if (!data.session || !data.user) throw new Error('No session returned from Supabase');

        await storeCapacitorSession(data.session, data.user);
        router.replace('/dashboard');
        return;
      }

      // Web/Desktop: standard OAuth redirect
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      console.error('Apple sign-in error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign in with Apple');
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    if (email) {
      handleMagicLink(email);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {emailSent
            ? 'Check your email!'
            : 'Welcome back! Please sign in to continue.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {emailSent ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            <p className="font-semibold mb-2">Check your email!</p>
            <p className="text-sm">
              Check your email and click the login link.
            </p>
            <p className="text-sm mt-2">
              The link will open in your default browser. After you click it,
              come back to this app and it should automatically log you in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmailSent(false);
              setError(null);
            }}
            className="w-full text-sm text-blue-600 hover:text-blue-500"
          >
            Send to a different email
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={handleAppleSignIn}
              disabled={isLoading}
              className="w-full inline-flex justify-center items-center py-2 px-4 rounded-md shadow-sm bg-black text-sm font-medium text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Sign in with Apple
            </button>
          </div>
        </>
      )}
    </div>
  );
}
