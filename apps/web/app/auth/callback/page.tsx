'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabase } from '@/lib/providers';

// Force dynamic rendering - this page must not be statically generated
export const dynamic = 'force-dynamic';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  useEffect(() => {
    const handleCallback = async () => {
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

          try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
              console.error('❌ Code exchange error:', exchangeError);
              router.push(`/login?error=auth_callback_error&message=${encodeURIComponent(exchangeError.message)}`);
              return;
            }

            console.log('✅ OAuth code exchange successful:', data);

            // Close this window/tab since OAuth is complete
            window.close();

            // If window.close() doesn't work (some browsers block it), redirect
            setTimeout(() => {
              router.push('/dashboard');
            }, 100);
            return;
          } catch (err) {
            console.error('❌ Exchange error:', err);
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
  }, [searchParams, supabase, router]);

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
