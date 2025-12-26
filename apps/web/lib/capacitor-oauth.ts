// apps/web/lib/capacitor-oauth.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Detect if we're running in Capacitor
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

/**
 * Handles the Google OAuth redirect for Capacitor.
 * This function just builds the URL and redirects the system browser.
 * The *listener* for the return is now in LoginForm.tsx.
 */
export async function handleCapacitorGoogleOAuth(_supabase: SupabaseClient) {
  try {
    console.log('🚀 Starting Capacitor Google OAuth redirect...');

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Use the custom deep link scheme as the redirect URL.
    const redirectUrl = encodeURIComponent('com.flow.app://auth/callback');

    const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectUrl}`;

    console.log('✅ Opening system browser with OAuth URL:', oauthUrl);

    // This is correct! It will open the system Safari/Chrome.
    window.location.href = oauthUrl;

    return { success: true };
  } catch (error) {
    console.error('❌ Error during Capacitor OAuth redirect:', error);
    return { success: false, error: (error as Error).message };
  }
}
