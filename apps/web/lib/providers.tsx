'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, createContext, useContext, useEffect } from 'react';
import { createClient } from './supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase Context
const SupabaseContext = createContext<SupabaseClient | null>(null);

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error) => {
          // Don't retry on 4xx errors or auth errors
          if ((error as any)?.status >= 400 && (error as any)?.status < 500) {
            return false;
          }
          if ((error as any)?.message?.includes('JWT')) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: false, // Disable for better UX
      },
      mutations: {
        retry: (failureCount, error) => {
          // Don't retry mutations on client errors
          if ((error as any)?.status >= 400 && (error as any)?.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  }));

  const [supabase] = useState(() => createClient());

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
    <SupabaseContext.Provider value={supabase}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </SupabaseContext.Provider>
  );
}