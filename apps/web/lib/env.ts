// Environment variables for client-side use
// Next.js will replace these at build time
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug logging
console.log('Environment check:', {
  hasUrl: !!NEXT_PUBLIC_SUPABASE_URL,
  hasKey: !!NEXT_PUBLIC_SUPABASE_ANON_KEY,
  urlValue: NEXT_PUBLIC_SUPABASE_URL,
});

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const;

// Validate that required env vars are present
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!', {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20),
  });
  throw new Error('Missing required environment variables');
}
