'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only run in browser, not during SSR
    if (typeof window === 'undefined') return;

    const handleCallback = async () => {
      const { getSupabaseClient } = await import('@flow-app/data');
      const { isTauri } = await import('@/lib/tauri-oauth');
      const supabase = getSupabaseClient();

      // Special handling for Tauri
      const isTauriEnv = isTauri();
      if (isTauriEnv) {
        console.log('⚠️  Tauri environment detected in web callback page');
      }

      try {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          const message = errorDescription || error;
          router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(message)}`);
          return;
        }

        // Check for hash fragments (implicit flow - magic links use this)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken) {
          console.log('🔄 Setting session from hash tokens...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Session set error:', sessionError);
            router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(sessionError.message)}`);
            return;
          }

          console.log('✅ Session established from hash tokens');
          router.push('/dashboard');
          return;
        }

        // For PKCE flow with code parameter - only works if opened in same browser
        const code = searchParams.get('code');
        if (code) {
          console.log('🔄 Auth code detected, attempting exchange...');
          // Try to exchange the code - this will only work if code_verifier exists
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            // If exchange fails, it's likely a cross-browser issue
            console.error('❌ Code exchange failed:', exchangeError.message);

            // Check if it's the PKCE verifier error
            if (exchangeError.message.includes('code verifier')) {
              router.push(`/login?error=auth_callback_error&message=${encodeURIComponent('Magic link must be opened in the same browser where it was requested. Please request a new link.')}`);
            } else {
              router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(exchangeError.message)}`);
            }
            return;
          }

          if (data.session) {
            console.log('✅ Session established from code exchange');
            router.push('/dashboard');
            return;
          }
        }

        // Fallback: check if we already have a session
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
