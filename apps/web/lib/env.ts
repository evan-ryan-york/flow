// Environment variables for client-side use
// These must be prefixed with NEXT_PUBLIC_ to be available in the browser

function getEnvVar(key: string): string {
  const value = process.env[key];

  // During SSR/build, we might not have access to env vars yet
  // Only throw error if we're actually in the browser
  if (typeof window !== 'undefined' && (!value || value === 'undefined' || value === '')) {
    console.error(`❌ Missing or invalid environment variable: ${key}`, {
      value,
      type: typeof value,
      allEnvKeys: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_'))
    });
    throw new Error(`Missing required environment variable: ${key}`);
  }

  // Return the value (might be empty during SSR, but that's okay)
  return value || '';
}

// Get and validate environment variables
const NEXT_PUBLIC_SUPABASE_URL = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const NEXT_PUBLIC_SUPABASE_ANON_KEY = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Debug logging (only show in development and in browser)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  console.log('✅ Environment variables loaded:', {
    hasUrl: !!NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!NEXT_PUBLIC_SUPABASE_ANON_KEY,
    urlValue: NEXT_PUBLIC_SUPABASE_URL,
  });
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;
