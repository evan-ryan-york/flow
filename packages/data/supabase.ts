// packages/data/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, 'public', any> | null = null;

// Initialize Supabase with config from the app
export function initializeSupabase(url: string, anonKey: string) {
  // Validate inputs
  if (!url || !anonKey || url === 'undefined' || anonKey === 'undefined') {
    throw new Error(`Invalid Supabase configuration: url=${url}, anonKey=${anonKey ? '[REDACTED]' : 'missing'}`);
  }

  if (!supabaseInstance) {
    // Use standard createClient for both browser and server
    // This handles auth persistence automatically via localStorage in browser
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: typeof window !== 'undefined', // Only persist in browser
        detectSessionInUrl: true, // REQUIRED for PKCE flow to work properly
        flowType: 'pkce', // Use PKCE flow for OAuth
      },
    });
  }
  return supabaseInstance;
}

// Helper function to get the current Supabase client
export function getSupabaseClient() {
  // During SSR/build, return a dummy client that will be properly initialized in browser
  if (!supabaseInstance && typeof window === 'undefined') {
    throw new Error('Supabase client accessed during SSR. This should only be called in client components.');
  }

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