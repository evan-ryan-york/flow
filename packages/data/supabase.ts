// packages/data/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Supabase client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, 'public', any> | null = null;

// Initialize Supabase with config from the app
export function initializeSupabase(url: string, anonKey: string) {
  if (!supabaseInstance) {
    if (typeof window !== 'undefined') {
      supabaseInstance = createBrowserClient(url, anonKey);
    } else {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Server-side doesn't persist
        },
      });
    }
  }
  return supabaseInstance;
}

// Helper function to get the current Supabase client
export function getSupabaseClient() {
  if (!supabaseInstance) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return supabaseInstance;
}

// Legacy export for backward compatibility - use getSupabaseClient() in new code
export function getSupabase() {
  return getSupabaseClient();
}

// Direct export that throws if not initialized
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof ReturnType<typeof getSupabaseClient>];
  }
});