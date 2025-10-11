// Environment variables for client-side use
// These must be prefixed with NEXT_PUBLIC_ to be available in the browser

// CRITICAL: Next.js replaces process.env.NEXT_PUBLIC_* at BUILD time
// If these are empty strings in production, the build didn't have the env vars
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Always log in browser to debug what actually got embedded
if (typeof window !== 'undefined') {
  console.log('🔍 Client-side env check:', {
    url: NEXT_PUBLIC_SUPABASE_URL,
    urlLength: NEXT_PUBLIC_SUPABASE_URL.length,
    hasKey: !!NEXT_PUBLIC_SUPABASE_ANON_KEY,
    keyLength: NEXT_PUBLIC_SUPABASE_ANON_KEY.length,
  });

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ CRITICAL: Supabase env vars are EMPTY in client bundle!');
    console.error('This means Next.js did not embed them during build.');
    console.error('Check Vercel build logs for environment variable availability.');
    throw new Error('Supabase environment variables not embedded in build');
  }
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;
