'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { initializeSupabase, getSupabaseClient } from '@perfect-task-app/data';
import { env } from './env';

// Lazy initialization flag
let isInitialized = false;

// Initialize Supabase lazily (only in browser)
function ensureSupabaseInitialized() {
  if (!isInitialized && typeof window !== 'undefined') {
    initializeSupabase(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    isInitialized = true;
  }
}

// Re-export useSupabase for components that need direct Supabase access (auth, etc.)
// This ensures everyone uses the same client instance
// IMPORTANT: Don't call this during component render - only in useEffect or event handlers
export function useSupabase() {
  ensureSupabaseInitialized();
  return getSupabaseClient();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors or auth errors
          const errorWithStatus = error as unknown as { status?: number };
          if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
            return false;
          }
          if ((error as { message?: string })?.message?.includes('JWT')) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: false, // Disable for better UX
      },
      mutations: {
        retry: (failureCount, error) => {
          // Don't retry mutations on client errors
          const errorWithStatus = error as unknown as { status?: number };
          if (errorWithStatus?.status && errorWithStatus.status >= 400 && errorWithStatus.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  }));

  // Handle auth state changes and invalidate queries
  useEffect(() => {
    // Only set up auth listener in browser
    if (typeof window === 'undefined') return;

    // Ensure Supabase is initialized before accessing it
    ensureSupabaseInitialized();
    const supabase = getSupabaseClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Invalidate all queries when auth state changes
        queryClient.invalidateQueries();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}