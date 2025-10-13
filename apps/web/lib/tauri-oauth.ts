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
      (window as any).__TAURI_INTERNALS__ &&
      typeof (window as any).__TAURI_INTERNALS__.invoke === 'function'
    ) {
      console.log('✅ window.__TAURI_INTERNALS__.invoke ready after', attempt, 'attempts');
      return true;
    }

    // Log progress every 20 attempts
    if (attempt % 20 === 0) {
      console.log(`⏳ Attempt ${attempt}, checking for __TAURI_INTERNALS__.invoke...`, {
        hasTauriInternals: '__TAURI_INTERNALS__' in window,
        hasInvoke: (window as any).__TAURI_INTERNALS__ ? 'invoke' in (window as any).__TAURI_INTERNALS__ : false,
        internalsType: typeof (window as any).__TAURI_INTERNALS__
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.error('❌ window.__TAURI_INTERNALS__.invoke never loaded after', attempt, 'attempts');
  console.error('Final state:', {
    hasTauriInternals: '__TAURI_INTERNALS__' in window,
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

    // 1. Generate PKCE parameters
    console.log('🔐 Generating PKCE parameters...');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    console.log('✅ PKCE parameters generated');

    // Store code_verifier in sessionStorage with Supabase's expected key format
    // Supabase expects the key to be: `{storageKeyPrefix}-auth-token-code-verifier`
    if (typeof window !== 'undefined' && window.sessionStorage) {
      // Debug: Check Supabase's internal storage key before storing
      const supabaseStorageKey = (supabase.auth as any).storageKey;
      console.log('🔍 DEBUG (before storing): Supabase storage key:', supabaseStorageKey);

      // Try multiple possible key formats
      const possibleKeys = [
        'sb-ewuhxqbfwbenkhnkzokp-auth-token-code-verifier',
        `${supabaseStorageKey}-code-verifier`,
        'supabase.auth.token-code-verifier',
        'sb-auth-token-code-verifier',
      ];

      console.log('🔍 DEBUG: Possible storage keys:', possibleKeys);

      // Store with all possible keys to ensure Supabase finds it
      possibleKeys.forEach(key => {
        if (key) {
          window.sessionStorage.setItem(key, codeVerifier);
          console.log(`💾 Code verifier stored with key: ${key}`);
        }
      });

      // Debug: Verify storage
      console.log('🔍 DEBUG: All sessionStorage keys after storing:',
        Object.keys(window.sessionStorage)
      );
    }

    // 2. Start the local OAuth server on a FIXED port (required for Google OAuth)
    // Google requires the exact redirect URI to be registered in Cloud Console
    // Using port 3000 which must be registered as http://localhost:3000 in Google Console
    const FIXED_PORT = 3000;
    console.log(`📡 Starting OAuth server on port ${FIXED_PORT}...`);
    const port = await tauriOAuth.start({ ports: [FIXED_PORT] });
    console.log(`✅ OAuth server started on port ${port}`);

    // 3. Get OAuth URL from Supabase with redirect to localhost and PKCE challenge
    console.log('🔗 Getting OAuth URL from Supabase with PKCE challenge...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `http://localhost:${port}`,
        queryParams: {
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        }
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

    // 4. Open OAuth URL in system browser
    await tauriShell.open(data.url);

    // 5. Wait for the callback with auth code
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

          // 6. Get stored code_verifier
          const codeVerifierKey = 'sb-ewuhxqbfwbenkhnkzokp-auth-token-code-verifier';
          const codeVerifier = typeof window !== 'undefined' && window.sessionStorage
            ? window.sessionStorage.getItem(codeVerifierKey)
            : null;

          if (!codeVerifier) {
            console.error('❌ Code verifier not found in sessionStorage');
            console.log('🔍 Available keys:', Object.keys(window.sessionStorage));
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: 'Code verifier not found' });
            return;
          }

          console.log('✅ Code verifier found:', codeVerifier.substring(0, 10) + '...');

          // 7. Exchange code for tokens using raw Supabase API
          // Bypass the SDK to have full control over PKCE parameters
          console.log('🔄 Exchanging code for tokens via Supabase API...');

          // Get Supabase URL and anon key from the client
          const supabaseUrl = (supabase as any).supabaseUrl ||
                             'https://ewuhxqbfwbenkhnkzokp.supabase.co';
          const supabaseKey = (supabase as any).supabaseKey ||
                             process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

          console.log('🔗 Supabase URL:', supabaseUrl);

          const tokenResponse = await fetch(
            `${supabaseUrl}/auth/v1/token`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey!
              },
              body: JSON.stringify({
                grant_type: 'pkce',
                auth_code: code,
                code_verifier: codeVerifier
              })
            }
          );

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token exchange failed:', errorText);
            await tauriOAuth!.cancel(port);
            resolve({
              success: false,
              error: `Token exchange failed: ${tokenResponse.status} ${errorText}`
            });
            return;
          }

          const tokenData = await tokenResponse.json();
          console.log('✅ Tokens received from Supabase');

          // 8. Set the session in Supabase client
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token
          });

          if (sessionError) {
            console.error('❌ Failed to set session:', sessionError);
            await tauriOAuth!.cancel(port);
            resolve({ success: false, error: sessionError.message });
            return;
          }

          console.log('✅ Authentication successful!');
          console.log('👤 User:', sessionData.user?.email);

          // Clean up the code_verifier from sessionStorage
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(codeVerifierKey);
            console.log('🧹 Code verifier cleaned from sessionStorage');
          }

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
