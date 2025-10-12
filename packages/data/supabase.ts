// packages/data/supabase.ts
import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';

// Supabase client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, 'public', any> | null = null;

// Initialize Supabase with config from the app
export function initializeSupabase(url: string, anonKey: string) {
  // Trim whitespace and validate inputs
  url = url?.trim() || '';
  anonKey = anonKey?.trim() || '';

  if (!url || !anonKey || url === 'undefined' || anonKey === 'undefined') {
    throw new Error(`Invalid Supabase configuration: url=${url}, anonKey=${anonKey ? '[REDACTED]' : 'missing'}`);
  }

  // Log the actual values being used (in browser only)
  if (typeof window !== 'undefined') {
    console.log('🔧 Initializing Supabase with:', {
      url,
      urlValid: url.startsWith('https://'),
      keyLength: anonKey.length,
      keyValid: anonKey.length > 100, // Supabase keys are long
    });
  }

  if (!supabaseInstance) {
    // Intercept fetch to see what's failing
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          console.log('🌐 Fetch called with:', {
            url: args[0],
            options: args[1]
          });
          return await originalFetch(...args);
        } catch (err) {
          console.error('❌ Fetch failed:', err);
          throw err;
        }
      };
    }

    // Use createBrowserClient from @supabase/ssr - this is the official Next.js pattern
    // It automatically handles PKCE, cookies, and session management correctly
    supabaseInstance = createBrowserClient(url, anonKey);

    if (typeof window !== 'undefined') {
      console.log('✅ Supabase client created with createBrowserClient');
    }
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