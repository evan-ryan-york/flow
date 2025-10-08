/**
 * Tauri OAuth Helper
 *
 * This module provides OAuth authentication for Tauri desktop apps using the
 * tauri-plugin-oauth to handle OAuth redirects via a localhost server.
 *
 * Based on: https://github.com/JeaneC/tauri-oauth-supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Dynamically import Tauri modules only when in Tauri context
let tauriOAuth: typeof import('@fabianlars/tauri-plugin-oauth') | null = null;
let tauriShell: typeof import('@tauri-apps/api/shell') | null = null;
let tauriEvent: typeof import('@tauri-apps/api/event') | null = null;

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Initialize Tauri modules (lazy load to prevent errors in web context)
 */
async function initTauriModules() {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  if (!tauriOAuth) {
    tauriOAuth = await import('@fabianlars/tauri-plugin-oauth');
  }
  if (!tauriShell) {
    tauriShell = await import('@tauri-apps/api/shell');
  }
  if (!tauriEvent) {
    tauriEvent = await import('@tauri-apps/api/event');
  }

  return { tauriOAuth, tauriShell, tauriEvent };
}

/**
 * Handle Google OAuth flow in Tauri desktop app
 *
 * @param supabase - Supabase client instance
 * @returns Promise that resolves when authentication is complete
 */
export async function handleTauriGoogleOAuth(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isTauri()) {
      throw new Error('This function should only be called in Tauri environment');
    }

    console.log('🔐 Starting Tauri OAuth flow...');

    // Initialize Tauri modules
    const { tauriOAuth, tauriShell, tauriEvent } = await initTauriModules();

    if (!tauriOAuth || !tauriShell || !tauriEvent) {
      throw new Error('Failed to load Tauri modules');
    }

    // 1. Start the local OAuth server on a random port
    console.log('📡 Starting OAuth server...');
    const port = await tauriOAuth.start();
    console.log(`✅ OAuth server started on port ${port}`);

    // 2. Get OAuth URL from Supabase with redirect to localhost
    console.log('🔗 Getting OAuth URL from Supabase...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `http://localhost:${port}`,
      },
    });

    if (error) {
      console.error('❌ Failed to get OAuth URL:', error);
      await tauriOAuth.cancel(port);
      throw error;
    }

    if (!data?.url) {
      console.error('❌ No OAuth URL returned');
      await tauriOAuth.cancel(port);
      throw new Error('No OAuth URL returned from Supabase');
    }

    console.log('🌐 Opening OAuth URL in system browser...');

    // 3. Open OAuth URL in system browser
    await tauriShell.open(data.url);

    // 4. Wait for the callback with auth code
    console.log('⏳ Waiting for OAuth callback...');

    return new Promise((resolve) => {
      // Set a timeout for the OAuth flow (5 minutes)
      const timeout = setTimeout(async () => {
        console.error('⏰ OAuth flow timed out');
        await tauriOAuth!.cancel(port);
        resolve({ success: false, error: 'OAuth flow timed out' });
      }, 5 * 60 * 1000);

      // Listen for OAuth callback events
      tauriEvent!.listen<string>('oauth://url', async (event) => {
        console.log('📩 Received OAuth callback:', event.payload);
        clearTimeout(timeout);

        try {
          const url = event.payload;

          // Parse the URL to extract the auth code
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');

          if (!code) {
            console.error('❌ No auth code in callback URL');
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: 'No authorization code received' });
            return;
          }

          console.log('🔑 Auth code received, exchanging for session...');

          // 5. Exchange code for session using Supabase PKCE flow
          const { data: sessionData, error: sessionError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (sessionError) {
            console.error('❌ Failed to exchange code for session:', sessionError);
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: sessionError.message });
            return;
          }

          if (!sessionData?.session) {
            console.error('❌ No session returned');
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: 'No session returned' });
            return;
          }

          console.log('✅ Authentication successful!');
          console.log('👤 User:', sessionData.user?.email);

          // Clean up the OAuth server
          await tauriOAuth!.cancel(port);

          resolve({ success: true });
        } catch (err) {
          console.error('❌ Error processing OAuth callback:', err);
          await tauriOAuth!.cancel(port);
          resolve({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      });
    });
  } catch (error) {
    console.error('❌ Tauri OAuth error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle magic link authentication in Tauri (NOT RECOMMENDED)
 *
 * Note: Magic links are problematic in Tauri because:
 * 1. Email links open in the system browser, not the Tauri app
 * 2. The system browser cannot navigate to tauri:// URLs
 * 3. The localhost server approach has race conditions
 *
 * Consider using email/password or OTP code instead.
 */
export async function handleTauriMagicLink(
  email: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  console.warn('⚠️  Magic links are not recommended for Tauri apps');
  console.warn('⚠️  Consider using email/password or OTP codes instead');

  try {
    if (!isTauri()) {
      throw new Error('This function should only be called in Tauri environment');
    }

    // Initialize Tauri modules
    const { tauriOAuth } = await initTauriModules();

    if (!tauriOAuth) {
      throw new Error('Failed to load Tauri OAuth module');
    }

    // Start OAuth server
    const port = await tauriOAuth.start();

    // Send magic link with localhost redirect
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `http://localhost:${port}`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      await tauriOAuth.cancel(port);
      throw error;
    }

    // Note: The magic link will open in the system browser
    // This approach is fragile and not recommended
    return {
      success: true,
      error: 'Magic link sent. Click the link in your email. Note: This may not work reliably in desktop apps.'
    };
  } catch (error) {
    console.error('❌ Tauri magic link error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
