'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@perfect-task-app/data';

// Re-export useSupabase for components that need direct Supabase access (auth, etc.)
// This ensures everyone uses the same client instance
export function useSupabase() {
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

  // Use the shared Supabase client from the data package
  const supabase = getSupabaseClient();

  // Handle auth state changes and invalidate queries
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Invalidate all queries when auth state changes
        queryClient.invalidateQueries();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}