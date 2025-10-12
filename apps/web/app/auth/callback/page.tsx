'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Force dynamic rendering - this page must not be statically generated
export const dynamic = 'force-dynamic';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only run in browser, not during SSR
    if (typeof window === 'undefined') return;

    const handleCallback = async () => {
      const { getSupabaseClient } = await import('@perfect-task-app/data');
      const supabase = getSupabaseClient();

      try {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          const message = errorDescription || error;
          router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(message)}`);
          return;
        }

        // Check for hash fragments (magic link/some OAuth flows)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Session set error:', sessionError);
            router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(sessionError.message)}`);
            return;
          }

          router.push('/dashboard');
          return;
        }

        // For PKCE flow, createBrowserClient handles code exchange automatically
        // Just wait a moment for it to process, then check for session
        const code = searchParams.get('code');
        if (code) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Check if we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Callback error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(message)}`);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Completing sign in...</h2>
          <p className="mt-2 text-sm text-gray-600">Please wait while we redirect you.</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
