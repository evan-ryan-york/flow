// Environment variables for client-side use
// These must be prefixed with NEXT_PUBLIC_ to be available in the browser

// In Next.js, NEXT_PUBLIC_ variables are embedded at BUILD time
// They should be available via process.env during build and runtime
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only validate in browser (not during build)
if (typeof window !== 'undefined') {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables!', {
      hasUrl: !!NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url: NEXT_PUBLIC_SUPABASE_URL,
    });
    throw new Error('Missing required Supabase environment variables');
  }

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment variables loaded:', {
      hasUrl: !!NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlValue: NEXT_PUBLIC_SUPABASE_URL,
    });
  }
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;
