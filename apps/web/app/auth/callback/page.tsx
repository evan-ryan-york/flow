'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/lib/providers';

// Force dynamic rendering - this page must not be statically generated
export const dynamic = 'force-dynamic';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only run in browser, not during SSR
    if (typeof window === 'undefined') return;

    const handleCallback = async () => {
      // Import supabase hook inside useEffect to avoid SSR execution
      const { useSupabase } = await import('@/lib/providers');
      const { getSupabaseClient } = await import('@perfect-task-app/data');
      const supabase = getSupabaseClient();
      try {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        console.log('🔄 Auth callback called');
        console.log('URL:', window.location.href);

        if (error) {
          console.error('❌ Auth callback error:', error, errorDescription);
          const message = errorDescription || error;
          router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(message)}`);
          return;
        }

        // Check for hash fragments (magic link and some OAuth flows)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('Hash params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hash: window.location.hash
        });

        // If we have tokens in the hash, set the session
        if (accessToken) {
          console.log('🔑 Setting session from hash tokens...');
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('❌ Session set error:', sessionError);
            router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(sessionError.message)}`);
            return;
          }

          console.log('✅ Session set successfully:', data);
          router.push('/dashboard');
          return;
        }

        // Check for OAuth code in query params
        const code = searchParams.get('code');
        if (code) {
          console.log('🔑 Exchanging OAuth code for session...');
          console.log('Code value:', code);
          console.log('Code type:', typeof code);
          console.log('Code length:', code.length);

          // Check for PKCE code verifier in localStorage
          const storageKeys = Object.keys(localStorage);
          console.log('LocalStorage keys:', storageKeys);
          const supabaseKeys = storageKeys.filter(k => k.includes('supabase') || k.includes('pkce') || k.includes('code'));
          console.log('Supabase-related keys:', supabaseKeys);
          supabaseKeys.forEach(key => {
            console.log(`${key}:`, localStorage.getItem(key)?.substring(0, 100));
          });

          try {
            console.log('🔄 About to call exchangeCodeForSession...');
            console.log('Code to exchange:', code);
            console.log('Code type:', typeof code);
            console.log('Code length:', code.length);

            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
              console.error('❌ Code exchange error:', {
                message: exchangeError.message,
                name: exchangeError.name,
                status: exchangeError.status,
                stack: exchangeError.stack,
                fullError: JSON.stringify(exchangeError, null, 2)
              });
              router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(exchangeError.message)}`);
              return;
            }

            console.log('✅ OAuth code exchange successful:', data);

            // Don't close window - just redirect
            router.push('/dashboard');
            return;
          } catch (err) {
            console.error('❌ Exchange error (caught):', {
              error: err,
              message: err instanceof Error ? err.message : 'Unknown',
              stack: err instanceof Error ? err.stack : 'No stack',
              type: typeof err,
              stringified: JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
            });

            // Try to get more details from the error
            if (err instanceof Error) {
              console.error('Error name:', err.name);
              console.error('Error cause:', (err as any).cause);
            }
          }
        }

        // Fallback: check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          console.log('✅ Existing session found, redirecting to dashboard');
          router.push('/dashboard');
        } else {
          console.log('⚠️ No session or auth params found, redirecting to login');
          router.push('/login');
        }
      } catch (err) {
        console.error('❌ Callback error:', err);
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
