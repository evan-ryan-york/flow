// apps/web/lib/capacitor-oauth.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// Detect if we're running in Capacitor
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

/**
 * Handles Google OAuth for Capacitor using the native Google Sign-In SDK.
 * Shows an in-app Google sign-in sheet instead of redirecting to Safari.
 * Returns the Google ID token for exchange with Supabase.
 */
export async function handleCapacitorGoogleOAuth(_supabase: SupabaseClient) {
  try {
    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

    // Initialize the plugin
    await GoogleAuth.initialize();

    // Native Google sign-in sheet (stays in-app)
    const googleUser = await GoogleAuth.signIn();

    // Extract the ID token
    const idToken = googleUser.authentication.idToken;

    if (!idToken) {
      throw new Error('No ID token received from Google');
    }

    return { success: true, idToken };
  } catch (error) {
    console.error('Capacitor Google OAuth error:', error);
    return { success: false, error: (error as Error).message, idToken: undefined };
  }
}
