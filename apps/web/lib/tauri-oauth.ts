/**
 * Tauri OAuth Helper
 *
 * This module provides OAuth authentication for Tauri desktop apps using the
 * tauri-plugin-oauth to handle OAuth redirects via a localhost server.
 *
 * Based on: https://github.com/JeaneC/tauri-oauth-supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Dynamically import Tauri modules only when in Tauri context
let tauriOAuth: typeof import('@fabianlars/tauri-plugin-oauth') | null = null;
let tauriShell: typeof import('@tauri-apps/api/shell') | null = null;
let tauriEvent: typeof import('@tauri-apps/api/event') | null = null;

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;

  // Multiple checks for Tauri environment
  const checks = {
    hasTauriInternals: '__TAURI_INTERNALS__' in window,
    hasTauriMetadata: '__TAURI_METADATA__' in window,
    hasTauriIPC: '__TAURI_IPC__' in window,
    isTauriProtocol: window.location.protocol === 'tauri:',
    isTauriHost: window.location.hostname === 'localhost' && window.location.protocol === 'tauri:',
  };

  console.log('🔍 Tauri detection checks:', checks);

  // Return true if any Tauri indicator is present
  return Object.values(checks).some(check => check === true);
}

/**
 * Wait for Tauri API to be fully loaded and ready
 * Checks for the EXACT object that the OAuth plugin requires
 */
export async function waitForTauriAPI(timeout = 10000): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeout) {
    attempt++;

    // Check for the EXACT thing the OAuth plugin requires
    if (
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__TAURI_INTERNALS__ &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (window as any).__TAURI_INTERNALS__.invoke === 'function'
    ) {
      console.log('✅ window.__TAURI_INTERNALS__.invoke ready after', attempt, 'attempts');
      return true;
    }

    // Log progress every 20 attempts
    if (attempt % 20 === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Need to access Tauri internals
      const internals = (window as any).__TAURI_INTERNALS__;
      console.log(`⏳ Attempt ${attempt}, checking for __TAURI_INTERNALS__.invoke...`, {
        hasTauriInternals: '__TAURI_INTERNALS__' in window,
        hasInvoke: internals ? 'invoke' in internals : false,
        internalsType: typeof internals
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error('❌ window.__TAURI_INTERNALS__.invoke never loaded after', attempt, 'attempts');
  console.error('Final state:', {
    hasTauriInternals: '__TAURI_INTERNALS__' in window,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    internals: (window as any).__TAURI_INTERNALS__
  });
  return false;
}

/**
 * Initialize Tauri modules (lazy load to prevent errors in web context)
 * IMPORTANT: Must wait for Tauri API to be ready before importing these modules
 */
async function initTauriModules() {
  if (!isTauri()) {
    throw new Error('Not running in Tauri environment');
  }

  // CRITICAL: Wait for Tauri API to be fully loaded before importing any Tauri packages
  // The @fabianlars/tauri-plugin-oauth package immediately calls window.__TAURI_INTERNALS__.invoke()
  // when it's loaded, so we must ensure the Tauri API exists first
  const apiReady = await waitForTauriAPI();
  if (!apiReady) {
    throw new Error('Tauri API not available after waiting');
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
 * Generate a cryptographically secure random string for PKCE code_verifier
 * Must be 43-128 characters, URL-safe base64 encoded
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Base64 URL encode (without padding)
 * Converts binary data to URL-safe base64 string
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate code_challenge from code_verifier using SHA-256
 * Required for PKCE S256 method
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
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

    // Wait for Tauri API to be ready
    const apiReady = await waitForTauriAPI();
    if (!apiReady) {
      return {
        success: false,
        error: 'Tauri API not available. Please restart the app.'
      };
    }

    // Initialize Tauri modules
    const { tauriOAuth, tauriShell, tauriEvent } = await initTauriModules();

    if (!tauriOAuth || !tauriShell || !tauriEvent) {
      throw new Error('Failed to load Tauri modules');
    }

    // 2. Start the local OAuth server on a FIXED port (required for Google OAuth)
    // Google requires the exact redirect URI to be registered in Cloud Console
    // Using port 3210 (NOT 3000 which is used by Next.js dev server)
    // This must be registered as http://localhost:3210 in Google Cloud Console
    const FIXED_PORT = 3210;
    console.log(`📡 Starting OAuth server on port ${FIXED_PORT}...`);
    const port = await tauriOAuth.start({ ports: [FIXED_PORT] });
    console.log(`✅ OAuth server started on port ${port}`);

    // 3. Manually generate PKCE parameters (since we're bypassing Supabase's callback endpoint)
    console.log('🔐 Generating PKCE parameters...');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    console.log('✅ PKCE parameters generated');

    // 4. Build Google OAuth URL manually with our PKCE parameters
    // We need to get the Google client ID from Supabase config
    console.log('🔗 Building Google OAuth URL with PKCE...');

    // Get Supabase URL and construct the OAuth endpoint
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '';

    if (!googleClientId) {
      throw new Error('NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID not configured');
    }

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', googleClientId);
    googleAuthUrl.searchParams.set('redirect_uri', `http://localhost:${port}`);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
    googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    const finalOAuthUrl = googleAuthUrl.toString();
    console.log('✅ OAuth URL built with PKCE challenge');

    console.log('🌐 Opening OAuth URL in system browser...');

    // 4. Open OAuth URL in system browser (using our modified URL with localhost redirect)
    await tauriShell.open(finalOAuthUrl);

    // 5. Wait for the callback with auth code
    console.log('⏳ Waiting for OAuth callback...');
    console.log('🌐 OAuth server is listening on: http://localhost:' + port);
    console.log('📝 When OAuth completes, Google will redirect your browser to this address');
    console.log('📝 Make sure no other services are running on port ' + port);
    console.log('📝 IMPORTANT: Close all browser tabs for localhost:' + port + ' to prevent cached content');

    return new Promise((resolve) => {
      // Set a timeout for the OAuth flow (5 minutes)
      const timeout = setTimeout(async () => {
        console.error('⏰ OAuth flow timed out');
        try {
          await tauriOAuth!.cancel(port);
        } catch {
          // Ignore cleanup errors on timeout
        }
        resolve({ success: false, error: 'OAuth flow timed out' });
      }, 5 * 60 * 1000);

      // Listen for OAuth callback events
      tauriEvent!.listen<string>('oauth://url', async (event) => {
        console.log('📩 Received OAuth callback:', event.payload);
        clearTimeout(timeout);

        try {
          const url = event.payload;

          // Verify URL contains auth code
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');

          if (!code) {
            console.error('❌ No auth code in callback URL');
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: 'No authorization code received' });
            return;
          }

          console.log('🔑 Auth code received:', code.substring(0, 10) + '...');

          // 6. Exchange Google auth code for Google tokens using PKCE
          console.log('🔄 Exchanging code with Google (PKCE)...');

          const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '';
          const googleClientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

          if (!googleClientSecret) {
            throw new Error('GOOGLE_CLIENT_SECRET not configured in environment variables');
          }

          const googleTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              code,
              client_id: googleClientId,
              client_secret: googleClientSecret,
              code_verifier: codeVerifier,
              grant_type: 'authorization_code',
              redirect_uri: `http://localhost:${port}`,
            }),
          });

          if (!googleTokenResponse.ok) {
            const errorData = await googleTokenResponse.json();
            console.error('❌ Google token exchange failed:', errorData);
            throw new Error(errorData.error_description || errorData.error || 'Google token exchange failed');
          }

          const googleTokens = await googleTokenResponse.json();
          console.log('✅ Received tokens from Google');

          // 7. Sign in to Supabase using Google ID token
          console.log('🔄 Signing in to Supabase with Google ID token...');
          const { data: sessionData, error: signInError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleTokens.id_token,
          });

          if (signInError) {
            console.error('❌ Supabase sign-in failed:', signInError);
            throw signInError;
          }

          if (!sessionData?.session) {
            console.error('❌ No session returned from signInWithIdToken');
            throw new Error('No session returned from authentication');
          }

          console.log('✅ Authentication successful!');
          console.log('👤 User:', sessionData.user?.email);
          console.log('📦 Session received:', {
            hasAccessToken: !!sessionData.session.access_token,
            hasRefreshToken: !!sessionData.session.refresh_token,
            expiresAt: sessionData.session.expires_at
          });

          // Wait a moment for the session to be persisted to storage
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify session is persisted
          const { data: { session: verifySession } } = await supabase.auth.getSession();
          console.log('✅ Session verification:', {
            sessionPersisted: !!verifySession,
            userId: verifySession?.user?.id,
            email: verifySession?.user?.email
          });

          // Clean up the OAuth server (ignore errors as server may already be closed)
          try {
            await tauriOAuth!.cancel(port);
            console.log('🧹 OAuth server cleaned up');
          } catch {
            console.log('ℹ️  OAuth server cleanup skipped (already closed)');
          }

          resolve({ success: true });
        } catch (err) {
          console.error('❌ Error processing OAuth callback:', err);
          // Try to clean up server on error (ignore failures)
          try {
            await tauriOAuth!.cancel(port);
          } catch {
            // Ignore cleanup errors
          }
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
