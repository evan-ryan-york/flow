'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/providers';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      // First check session from storage (synchronous, faster)
      const { data: { session } } = await supabase.auth.getSession();

      // Give it a moment to restore session from storage if needed
      if (!session) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Re-check after delay
      const { data: { session: finalSession } } = await supabase.auth.getSession();

      if (!finalSession && mounted) {
        console.log('No session found after grace period, redirecting to login');
        router.push('/login');
      } else if (finalSession) {
        console.log('Session restored:', finalSession.user.email);
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.push('/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
