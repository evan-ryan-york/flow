'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/providers';
import { useSearchParams } from 'next/navigation';
import { isTauri, handleTauriGoogleOAuth } from '@/lib/tauri-oauth';
import { isCapacitor, handleCapacitorGoogleOAuth } from '@/lib/capacitor-oauth';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [isCapacitorEnv, setIsCapacitorEnv] = useState(false);
  const [authUrlToProcess, setAuthUrlToProcess] = useState<string | null>(null); // <-- NEW STATE
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  // Detect Tauri and Capacitor environment on mount
  useEffect(() => {
    const detectedTauri = isTauri();
    const detectedCapacitor = isCapacitor();
    console.log('🔍 Environment detection:', {
      tauri: detectedTauri,
      capacitor: detectedCapacitor,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      href: window.location.href,
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
      console.error('🔴 Auth callback error:', errorMessage);
      setError(`Authentication failed: ${errorMessage}`);
    }
  }, [searchParams]);

  // This hook runs *after* the page reloads (from the deep link)
  // It checks the URL hash for auth tokens and manually stores the session.
  // NOTE: Only relevant for web OAuth flow, not Capacitor
  useEffect(() => {
    // Skip this in Capacitor since we handle OAuth via deep links
    if (isCapacitorEnv) return;

    // Check if we just reloaded with auth tokens in the hash
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('refresh_token')) {
      console.log('🔐 Auth tokens found in URL hash on page load (web flow)');
      setIsLoading(true); // Show loading spinner

      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const storeSessionAndRedirect = async () => {
          try {
            console.log('🔑 Storing session from URL hash...');

            // For web, we can use setSession() since it doesn't hang there
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              throw error;
            }

            console.log(
              '✅ Session set successfully! Redirecting to dashboard...',
            );
            // Clear the hash from the URL
            window.history.replaceState(null, '', ' ');
            router.push('/dashboard');
          } catch (err) {
            console.error('❌ Error setting session from hash:', err);
            setError(
              err instanceof Error ? err.message : 'Failed to log in',
            );
            setIsLoading(false);
            window.history.replaceState(null, '', ' '); // Clear the hash on error too
          }
        };

        // Call the async function
        storeSessionAndRedirect();
      }
    }
  }, [supabase, router, isCapacitorEnv]);

  // Check for existing session on mount and redirect if logged in (run once)
  useEffect(() => {
    console.log('🔍 [LoginForm] Session check useEffect triggered');
    let isMounted = true;

    const checkSession = async () => {
      try {
        console.log('🔍 [LoginForm] Starting checkSession, isCapacitor:', isCapacitorEnv);

        // For Capacitor, check storage directly
        if (isCapacitorEnv) {
          console.log('🔍 [LoginForm] Capacitor: Importing Preferences...');
          const { Preferences } = await import('@capacitor/preferences');
          console.log('🔍 [LoginForm] Capacitor: Calling Preferences.get()...');
          const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';
          const { value } = await Preferences.get({ key: storageKey });
          console.log('🔍 [LoginForm] Capacitor: Preferences.get() returned, hasValue:', !!value);

          if (value && isMounted) {
            const session = JSON.parse(value);
            if (session.access_token) {
              console.log(
                '✅ [LoginForm] Session detected in storage on mount, redirecting to dashboard...',
              );
              router.push('/dashboard');
            } else {
              console.log('🔍 [LoginForm] Value found but no access_token');
            }
          } else {
            console.log('🔍 [LoginForm] No session in storage');
          }
        } else {
          console.log('🔍 [LoginForm] Web/Desktop: Calling supabase.auth.getSession()...');
          // For web/desktop, getSession() is safe to use
          const {
            data: { session },
          } = await supabase.auth.getSession();
          console.log('🔍 [LoginForm] Web/Desktop: getSession() returned, hasSession:', !!session);

          if (session && isMounted) {
            console.log(
              '✅ [LoginForm] Session detected on mount, redirecting to dashboard...',
            );
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('❌ [LoginForm] Error checking session on mount:', err);
        console.error('❌ [LoginForm] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      }
    };

    checkSession();

    return () => {
      console.log('🔍 [LoginForm] Session check useEffect cleanup');
      isMounted = false;
    };
  }, [isCapacitorEnv, router, supabase]);

  // --- REFACTORED LISTENER LOGIC ---
  // This useEffect ONLY sets up the listeners
  useEffect(() => {
    // Only run this effect if in Capacitor
    if (!isCapacitorEnv) {
      return;
    }

    let stateListener: PluginListenerHandle | null = null;

    const setupListeners = async () => {
      // CRITICAL: Check if we already have a valid session in storage FIRST
      let hasSession = false;
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';
        const { value } = await Preferences.get({ key: storageKey });
        if (value) {
          const session = JSON.parse(value);
          if (session.access_token) {
            console.log(
              '✅ Found existing session in storage, redirecting to dashboard...',
            );
            router.push('/dashboard');
            hasSession = true;
          }
        }
      } catch (err) {
        console.error('Error checking existing session:', err);
      }

      if (hasSession) {
        console.log('✅ Session exists, NOT setting up app listeners.');
        return; // Don't set up listeners if we're redirecting
      }

      console.log(
        'No existing session, setting up Capacitor App state/URL listeners...',
      );

      // 1. Check if the app was opened with a URL (cold start)
      // This runs once when the component mounts
      App.getLaunchUrl().then((launchUrl) => {
        if (launchUrl && launchUrl.url) {
          console.log('App launched with URL, setting for processing...');
          setAuthUrlToProcess(launchUrl.url); // <-- DECOUPLED
        }
      });

      // 2. Listen for when the app resumes from background
      // This is the main one for our OAuth flow
      stateListener = await App.addListener('appStateChange', async (state) => {
        // state.isActive is true when app comes to foreground
        if (state.isActive) {
          console.log('App resumed. Checking for launch URL...');
          // Get the URL that opened the app
          const launchUrl = await App.getLaunchUrl();
          if (launchUrl && launchUrl.url) {
            console.log('App resumed with URL, setting for processing...');
            setAuthUrlToProcess(launchUrl.url); // <-- DECOUPLED
          }
        }
      });
    };

    setupListeners();

    // Clean up the listener when the component unmounts
    return () => {
      console.log('Removing Capacitor App state listener...');
      stateListener?.remove();
    };
  }, [isCapacitorEnv, router]); // Removed supabase dependency, it's not needed here

  // --- NEW useEffect TO PROCESS THE URL ---
  // This hook watches the authUrlToProcess state and runs setSession
  // *outside* of the native listener, avoiding the deadlock.
  useEffect(() => {
    if (!authUrlToProcess) {
      return;
    }

    console.log('🚀 useEffect processing auth URL:', authUrlToProcess);

    // This function will process the URL and log the user in
    const handleAuthUrl = async (url: string) => {
      console.log('📱 Processing auth URL:', url);

      // Check if it's our auth callback
      if (url.startsWith('com.perfecttask.app://auth/callback')) {
        // We are back in the app!
        // The URL has the hash fragment with auth tokens.

        const authUrl = new URL(url);
        const hash = authUrl.hash;
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresAt = params.get('expires_at');

        console.log(`✅ Auth tokens found! Setting session...`);
        console.log('📊 Token info:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasExpiresAt: !!expiresAt,
          accessTokenLength: accessToken?.length,
          refreshTokenLength: refreshToken?.length,
        });

        if (accessToken && refreshToken) {
          try {
            console.log('🎯 [LoginForm] Step 1: Setting loading state');
            setIsLoading(true);
            console.log('🎯 [LoginForm] Step 2: Starting manual session storage');
            console.log('🔑 BYPASSING setSession() - manually storing session...');

            // NUCLEAR OPTION: setSession() hangs in Capacitor no matter what we try.
            // So we'll manually store the session in the exact format Supabase expects,
            // then reinitialize the client to pick it up from storage.

            console.log('🎯 [LoginForm] Step 3: Decoding JWT token');
            // Decode JWT to get user info and expiry
            const base64Url = accessToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              // eslint-disable-next-line no-undef
              atob(base64)
                .split('')
                .map((c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);

            console.log('🎯 [LoginForm] Step 4: JWT decoded successfully:', {
              sub: payload.sub,
              email: payload.email,
              exp: payload.exp,
            });

            console.log('🎯 [LoginForm] Step 5: Creating session data object');
            // Create session object in Supabase's exact format
            const sessionData = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: parseInt(expiresAt || '3600'),
              expires_at: parseInt(expiresAt || '0'),
              token_type: 'bearer',
              user: {
                id: payload.sub,
                aud: payload.aud || 'authenticated',
                role: payload.role || 'authenticated',
                email: payload.email,
                email_confirmed_at: payload.email_confirmed_at || new Date().toISOString(),
                phone: payload.phone || '',
                confirmed_at: payload.confirmed_at || new Date().toISOString(),
                last_sign_in_at: new Date().toISOString(),
                app_metadata: payload.app_metadata || {},
                user_metadata: payload.user_metadata || {},
                identities: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            };

            console.log('🎯 [LoginForm] Step 6: Importing Capacitor Preferences...');
            console.log('📦 Manually storing session to Capacitor Preferences...');
            const { Preferences } = await import('@capacitor/preferences');
            console.log('🎯 [LoginForm] Step 7: Preferences imported, calling Preferences.set()...');

            const storageKey = 'sb-sprjddkfkwrrebazjxvf-auth-token';

            await Preferences.set({
              key: storageKey,
              value: JSON.stringify(sessionData),
            });

            console.log('🎯 [LoginForm] Step 8: Preferences.set() completed');
            console.log('✅ Session stored manually!');

            console.log('🎯 [LoginForm] Step 9: Storing user data and access token separately...');
            // ALSO store user data separately so dashboard can access it directly
            const userData = {
              id: sessionData.user.id,
              email: sessionData.user.email,
              user_metadata: sessionData.user.user_metadata,
            };
            await Preferences.set({
              key: 'perfect-task-user-data',
              value: JSON.stringify(userData),
            });

            // Store access token separately for Supabase requests
            await Preferences.set({
              key: 'perfect-task-access-token',
              value: accessToken,
            });
            console.log('✅ User data and access token stored separately!');

            console.log('🎯 [LoginForm] Step 10: Importing reinitializeSupabaseClient...');
            // Now reinitialize the Supabase client to pick up the session from storage
            console.log('🔄 Reinitializing Supabase client to load session from storage...');
            const { reinitializeSupabaseClient } = await import('@perfect-task-app/data');
            console.log('🎯 [LoginForm] Step 11: Calling reinitializeSupabaseClient()...');
            reinitializeSupabaseClient();

            console.log('🎯 [LoginForm] Step 12: Client reinitialized!');
            console.log('✅ Client reinitialized! Session should be loaded from storage automatically.');

            console.log('🎯 [LoginForm] Step 13: Removing App listeners...');
            // CRITICAL: Remove the App URL listeners to prevent re-processing
            // We do this *after* success
            await App.removeAllListeners();
            console.log('🎯 [LoginForm] Step 14: App listeners removed');
            console.log('🧹 Cleared App listeners');

            console.log('🎯 [LoginForm] Step 15: Navigating to dashboard...');
            console.log('🧭 Navigating to dashboard...');
            // Use replace to prevent user from going "back" to the login screen
            router.replace('/dashboard');
            console.log('🎯 [LoginForm] Step 16: router.replace() called');
          } catch (err) {
            console.error('❌ Error in auth flow:', err);
            console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
            setError(
              err instanceof Error ? err.message : 'Failed to log in',
            );
            setIsLoading(false);
          }
        } else {
          console.error('❌ Missing tokens:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });
          setError('Missing authentication tokens');
          setIsLoading(false);
        }
      } else {
        console.log('URL is not an auth callback, ignoring.');
      }

      // Consume the URL so this doesn't run again
      setAuthUrlToProcess(null);
    };

    handleAuthUrl(authUrlToProcess);
  }, [authUrlToProcess, supabase, router]); // Add all dependencies

  const handleMagicLink = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Warn users about magic links in Tauri
      if (isTauriEnv) {
        console.warn('⚠️  Magic links may not work reliably in desktop app');
        setError(
          'Magic links are not recommended for desktop app. Please use Google Sign-In instead.',
        );
        setIsLoading(false);
        return;
      }

      // Use origin for web
      const redirectTo = `${window.location.origin}/auth/callback`;

      console.log('Sending magic link to:', email);
      console.log('Redirect URL:', redirectTo);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      console.log('✅ Magic link sent successfully');
    } catch (error: unknown) {
      console.error('❌ Magic link error:', error);
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

      console.log('🚀 Starting Google sign-in...');

      // Use Capacitor-specific OAuth flow if in Capacitor environment
      if (isCapacitorEnv) {
        console.log('📱 Using Capacitor OAuth flow...');
        const result = await handleCapacitorGoogleOAuth(supabase);

        if (!result.success) {
          console.error('❌ Capacitor OAuth failed:', result.error);
          throw new Error(result.error || 'Failed to authenticate');
        }

        // Don't setIsLoading(false) here.
        // We are now waiting for the app to re-open via deep link,
        // so the disabled button is correct.
        // The listener above will handle the callback and redirect.
        return;
      }

      // Use Tauri-specific OAuth flow if in Tauri environment
      if (isTauriEnv) {
        console.log('📱 Using Tauri OAuth flow...');
        console.log('⏰ Current time:', new Date().toISOString());

        const result = await handleTauriGoogleOAuth(supabase);
        console.log('🔍 OAuth result:', result);

        if (!result.success) {
          console.error('❌ OAuth failed:', result.error);
          throw new Error(result.error || 'Failed to authenticate');
        }

        // Verify session was set (with retry logic for timing issues)
        console.log('🔍 Checking for session after OAuth...');
        let session = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!session && attempts < maxAttempts) {
          attempts++;
          const {
            data: { session: currentSession },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (currentSession) {
            session = currentSession;
            console.log('✅ Session found after', attempts, 'attempt(s)');
            break;
          }

          if (sessionError) {
            console.error('❌ Session error:', sessionError);
          }

          // Wait 100ms before retrying
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        console.log('🔍 Final session check after OAuth:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          attempts,
        });

        if (!session) {
          console.error(
            '❌ No session found after successful OAuth (tried',
            attempts,
            'times)',
          );
          throw new Error(
            'Authentication succeeded but no session was created',
          );
        }

        // Success! Session is now set, redirect to dashboard
        console.log(
          '✅ Tauri OAuth successful, redirecting to /dashboard...',
        );
        console.log('⏰ Redirect time:', new Date().toISOString());
        router.push('/dashboard');
        return;
      }

      // Web browser OAuth flow
      console.log('🌐 Using web OAuth flow...');
      console.log('Origin:', window.location.origin);
      console.log(
        'Redirect URL:',
        `${window.location.origin}/auth/callback`,
      );

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error('❌ OAuth initiation error:', error);
        throw error;
      }

      // Browser will automatically redirect to Google
      console.log('✅ OAuth initiated:', data);
    } catch (error: unknown) {
      console.error('❌ Google sign-in error:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to sign in with Google',
      );
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
            <p className="font-semibold mb-2">✓ Email sent!</p>
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

          <div>
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
          </div>
        </>
      )}
    </div>
  );
}
