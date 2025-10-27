// packages/data/supabase.ts
import { createBrowserClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { capacitorStorage } from './capacitor-storage';

// Supabase client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, 'public', any> | null = null;

// Detect if we're running in Capacitor
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

// Detect if we're running in Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Initialize Supabase with config from the app
export function initializeSupabase(url: string, anonKey: string) {
  // Trim whitespace and validate inputs
  url = url?.trim() || '';
  anonKey = anonKey?.trim() || '';

  if (!url || !anonKey || url === 'undefined' || anonKey === 'undefined') {
    throw new Error(`Invalid Supabase configuration: url=${url}, anonKey=${anonKey ? '[REDACTED]' : 'missing'}`);
  }

  if (!supabaseInstance) {
    // Use custom storage for Capacitor
    if (isCapacitor()) {
      console.log('🔧 Initializing Supabase with Capacitor storage adapter');
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          storage: capacitorStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    }
    // Use regular client for Tauri (static export needs explicit storage)
    else if (isTauri()) {
      console.log('🔧 Initializing Supabase for Tauri with localStorage');
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // No URL detection in Tauri
        },
      });
    }
    // Use SSR-aware client for web
    else {
      console.log('🔧 Initializing Supabase with standard browser client');
      // Use createBrowserClient from @supabase/ssr - the official Next.js pattern
      supabaseInstance = createBrowserClient(url, anonKey);
    }
  }
  return supabaseInstance;
}

// Helper function to get the current Supabase client
export function getSupabaseClient() {
  // During SSR/build, initialize the client but it won't have a real session
  // This allows static export to work - the actual auth will happen client-side
  if (typeof window === 'undefined' && !supabaseInstance) {
    // Get env vars for SSR context
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      supabaseInstance = createBrowserClient(url, anonKey);
    }
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