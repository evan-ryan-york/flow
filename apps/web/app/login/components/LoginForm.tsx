'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/providers';
import { useSearchParams } from 'next/navigation';
import { isTauri, handleTauriGoogleOAuth } from '@/lib/tauri-oauth';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  // Detect Tauri environment on mount
  useEffect(() => {
    setIsTauriEnv(isTauri());
  }, []);

  // Check for callback errors
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    if (errorParam === 'auth_callback_error') {
      const errorMessage = messageParam ? decodeURIComponent(messageParam) : 'Authentication failed';
      console.error('🔴 Auth callback error:', errorMessage);
      setError(`Authentication failed: ${errorMessage}`);
    }
  }, [searchParams]);

  // Poll for session after sending email or OAuth (for cross-browser flow)
  useEffect(() => {
    console.log('Starting session polling...');
    const pollInterval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('✅ Session detected! Redirecting to dashboard...');
        clearInterval(pollInterval);
        router.push('/dashboard');
      }
    }, 1000); // Check every second

    return () => clearInterval(pollInterval);
  }, [router, supabase]);

  const handleMagicLink = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Warn users about magic links in Tauri
      if (isTauriEnv) {
        console.warn('⚠️  Magic links may not work reliably in desktop app');
        setError('Magic links are not recommended for desktop app. Please use Google Sign-In instead.');
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
      setError(error instanceof Error ? error.message : 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('🚀 Starting Google sign-in...');

      // Use Tauri-specific OAuth flow if in Tauri environment
      if (isTauriEnv) {
        console.log('📱 Using Tauri OAuth flow...');
        const result = await handleTauriGoogleOAuth(supabase);

        if (!result.success) {
          throw new Error(result.error || 'Failed to authenticate');
        }

        // Success! Session is now set, redirect to dashboard
        console.log('✅ Tauri OAuth successful, redirecting...');
        router.push('/dashboard');
        return;
      }

      // Web browser OAuth flow
      console.log('🌐 Using web OAuth flow...');
      console.log('Origin:', window.location.origin);
      console.log('Redirect URL:', `${window.location.origin}/auth/callback`);

      // Log localStorage state BEFORE OAuth initiation
      console.log('📦 LocalStorage BEFORE OAuth:', typeof window !== 'undefined' ? {
        // eslint-disable-next-line no-undef
        keys: Object.keys(localStorage),
        // eslint-disable-next-line no-undef
        supabaseKeys: Object.keys(localStorage).filter(k => k.includes('supabase'))
      } : {});

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false, // Explicitly set this
        },
      });

      if (error) {
        console.error('❌ OAuth initiation error:', error);
        throw error;
      }

      // Log localStorage state AFTER OAuth initiation (before redirect)
      console.log('📦 LocalStorage AFTER OAuth:', typeof window !== 'undefined' ? {
        // eslint-disable-next-line no-undef
        keys: Object.keys(localStorage),
        // eslint-disable-next-line no-undef
        supabaseKeys: Object.keys(localStorage).filter(k => k.includes('supabase'))
      } : {});

      // Browser will automatically redirect to Google
      console.log('✅ OAuth initiated:', data);
    } catch (error: unknown) {
      console.error('❌ Google sign-in error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google');
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
          {emailSent ? 'Check your email!' : 'Welcome back! Please sign in to continue.'}
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
            <p className="text-sm">Check your email and click the login link.</p>
            <p className="text-sm mt-2">
              The link will open in your default browser. After you click it, come back to this app
              and it should automatically log you in.
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
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