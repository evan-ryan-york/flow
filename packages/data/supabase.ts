// packages/data/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Get Supabase config from environment variables
// Support both browser and server environments
const supabaseUrl =
  (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_URL) ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : process.env.SUPABASE_ANON_KEY) ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please check your .env.local file.');
  // Don't throw in server environments to allow for graceful degradation
}

// Create a shared client for the data package
// This will be used by services and can be overridden by specific implementations
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: typeof window !== 'undefined', // Only detect in browser
  },
}) : null;

// Add auth state change listener (only in browser)
if (typeof window !== 'undefined' && supabase) {
  supabase.auth.onAuthStateChange((_event, _session) => {
    // Auth state change tracking without logging
  });
}

// Helper function to get the current Supabase client
// This allows for dependency injection in Next.js environments
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Please check your environment variables.');
  }
  return supabase;
}