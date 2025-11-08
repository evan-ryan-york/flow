// packages/data/supabase.ts
import { createBrowserClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { capacitorStorage } from './capacitor-storage';

// Supabase client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, 'public', any> | null = null;

// Track operation timing to detect hangs
const operationTimers = new Map<string, number>();

// Logging wrapper to instrument auth operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapAuthWithLogging(client: SupabaseClient<any, 'public', any>) {
  const originalAuth = client.auth;

  // Create a proxy to intercept all auth method calls
  const authProxy = new Proxy(originalAuth, {
    get(target, prop: string) {
      const original = target[prop as keyof typeof target];

      // Only wrap functions
      if (typeof original !== 'function') {
        return original;
      }

      // Return a wrapped version that logs before/after
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return function (...args: any[]) {
        const operationId = `${prop}-${Date.now()}`;
        const timestamp = new Date().toISOString();

        console.log(`🔵 [Supabase.auth.${prop}] STARTING at ${timestamp}`, {
          operationId,
          isCapacitor: isCapacitor(),
          args: prop === 'setSession' ? '[REDACTED]' : args,
          stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n  '), // Show caller
        });

        operationTimers.set(operationId, Date.now());

        // Set up a timeout warning
        const timeoutWarning = setTimeout(() => {
          const elapsed = Date.now() - (operationTimers.get(operationId) || 0);
          console.warn(`⚠️  [Supabase.auth.${prop}] STILL RUNNING after ${elapsed}ms`, {
            operationId,
            likelyHung: elapsed > 5000,
          });
        }, 3000);

        try {
          // Bind to target to preserve correct 'this' context
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = (original as any).apply(target, args);

          // Handle promises
          if (result && typeof result.then === 'function') {
            return result.then(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (value: any) => {
                clearTimeout(timeoutWarning);
                const elapsed = Date.now() - (operationTimers.get(operationId) || 0);
                console.log(`✅ [Supabase.auth.${prop}] COMPLETED in ${elapsed}ms`, {
                  operationId,
                  hasError: value?.error ? true : false,
                  errorMessage: value?.error?.message,
                });
                operationTimers.delete(operationId);
                return value;
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (error: any) => {
                clearTimeout(timeoutWarning);
                const elapsed = Date.now() - (operationTimers.get(operationId) || 0);
                console.error(`❌ [Supabase.auth.${prop}] FAILED in ${elapsed}ms`, {
                  operationId,
                  error: error?.message || error,
                });
                operationTimers.delete(operationId);
                throw error;
              }
            );
          }

          // Non-promise return
          clearTimeout(timeoutWarning);
          const elapsed = Date.now() - (operationTimers.get(operationId) || 0);
          console.log(`✅ [Supabase.auth.${prop}] COMPLETED (sync) in ${elapsed}ms`, {
            operationId,
          });
          operationTimers.delete(operationId);
          return result;
        } catch (error) {
          clearTimeout(timeoutWarning);
          const elapsed = Date.now() - (operationTimers.get(operationId) || 0);
          console.error(`❌ [Supabase.auth.${prop}] THREW ERROR in ${elapsed}ms`, {
            operationId,
            error,
          });
          operationTimers.delete(operationId);
          throw error;
        }
      };
    },
  });

  // Replace the auth object with our proxy
  Object.defineProperty(client, 'auth', {
    get() {
      return authProxy;
    },
  });

  return client;
}

// Store initialization credentials for reinitialization
let cachedUrl: string | null = null;
let cachedAnonKey: string | null = null;

// Detect if we're running in Capacitor
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

// Detect if we're running in Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Helper to get stored access token from Capacitor
async function getCapacitorAccessToken(): Promise<string | null> {
  if (!isCapacitor()) return null;

  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'perfect-task-access-token' });
    return value;
  } catch (err) {
    console.error('Error getting Capacitor access token:', err);
    return null;
  }
}

// Initialize Supabase with config from the app
export function initializeSupabase(url: string, anonKey: string) {
  // Trim whitespace and validate inputs
  url = url?.trim() || '';
  anonKey = anonKey?.trim() || '';

  if (!url || !anonKey || url === 'undefined' || anonKey === 'undefined') {
    throw new Error(`Invalid Supabase configuration: url=${url}, anonKey=${anonKey ? '[REDACTED]' : 'missing'}`);
  }

  // Cache credentials for reinitialization
  cachedUrl = url;
  cachedAnonKey = anonKey;

  if (!supabaseInstance) {
    // Use custom storage for Capacitor
    if (isCapacitor()) {
      console.log('🔧 Initializing Supabase FOR CAPACITOR with custom auth bypass');

      // CAPACITOR FIX: Create client with custom fetch that injects auth token
      // This bypasses Supabase's broken session loading in Capacitor
      const originalFetch = fetch;
      const customFetch: typeof fetch = async (input, init?) => {
        const accessToken = await getCapacitorAccessToken();

        if (accessToken) {
          console.log('🔐 Injecting access token into Supabase request');
          init = init || {};

          // IMPORTANT: Preserve existing headers (like apikey) and add Authorization
          const existingHeaders = new Headers(init.headers);
          existingHeaders.set('Authorization', `Bearer ${accessToken}`);
          init.headers = existingHeaders;
        } else {
          console.warn('⚠️  No access token found for Capacitor request');
        }

        return originalFetch(input, init);
      };

      const client = createClient(url, anonKey, {
        auth: {
          storage: capacitorStorage,
          autoRefreshToken: false, // Disable auto-refresh since we're managing tokens manually
          persistSession: false,   // Disable session persistence (we handle it ourselves)
          detectSessionInUrl: true,
        },
        global: {
          fetch: customFetch,
        },
      });

      console.log('✅ Supabase client initialized for Capacitor with auth bypass');
      console.log('🔍 Wrapping client with logging proxy...');
      supabaseInstance = wrapAuthWithLogging(client);
    }
    // Use regular client for Tauri (static export needs explicit storage)
    else if (isTauri()) {
      console.log('🔧 Initializing Supabase for Tauri with localStorage');
      const client = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // No URL detection in Tauri
        },
      });
      supabaseInstance = wrapAuthWithLogging(client);
    }
    // Use SSR-aware client for web
    else {
      console.log('🔧 Initializing Supabase with standard browser client');
      // Use createBrowserClient from @supabase/ssr - the official Next.js pattern
      const client = createBrowserClient(url, anonKey);
      supabaseInstance = wrapAuthWithLogging(client);
    }
  }
  return supabaseInstance;
}

// Helper function to get the current Supabase client
export function getSupabaseClient() {
  console.log('🔍 [Supabase] getSupabaseClient called', {
    hasInstance: !!supabaseInstance,
    isCapacitor: isCapacitor(),
    isTauri: isTauri(),
    isSSR: typeof window === 'undefined',
    hasCachedCredentials: !!(cachedUrl && cachedAnonKey),
  });

  // During SSR/build, initialize the client but it won't have a real session
  // This allows static export to work - the actual auth will happen client-side
  if (typeof window === 'undefined' && !supabaseInstance) {
    console.log('🔍 [Supabase] SSR: Creating browser client for build');
    // Get env vars for SSR context
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      const client = createBrowserClient(url, anonKey);
      supabaseInstance = wrapAuthWithLogging(client);
    }
  }

  if (!supabaseInstance) {
    console.error('❌ [Supabase] No instance available - need to initialize first');
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }

  console.log('✅ [Supabase] Returning existing client instance');
  return supabaseInstance;
}

// Legacy export for backward compatibility - use getSupabaseClient() in new code
export function getSupabase() {
  return getSupabaseClient();
}

// Force reinitialize the Supabase client (generally not needed, but available)
export function reinitializeSupabaseClient() {
  console.log('🔄 [Supabase] Forcing client reinitialization...', {
    timestamp: new Date().toISOString(),
    hasCachedCredentials: !!(cachedUrl && cachedAnonKey),
    isCapacitor: isCapacitor(),
    stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n  '),
  });

  if (!cachedUrl || !cachedAnonKey) {
    throw new Error('Cannot reinitialize: Supabase was never initialized with credentials');
  }

  console.log('🔄 [Supabase] Clearing existing instance...');
  // Clear the existing instance
  supabaseInstance = null;

  console.log('🔄 [Supabase] Calling initializeSupabase() with cached credentials...');
  // Reinitialize with cached credentials
  const client = initializeSupabase(cachedUrl, cachedAnonKey);

  console.log('✅ [Supabase] Client reinitialized successfully');

  return client;
}

// Direct export that throws if not initialized
// NOTE: This proxy is safe for React Fast Refresh introspection
export const supabase = new Proxy({} as ReturnType<typeof getSupabaseClient>, {
  get(_target, prop) {
    // Allow React Fast Refresh and other tools to inspect metadata without triggering initialization
    // These are properties that dev tools/bundlers check but aren't actual Supabase client methods
    if (typeof prop === 'symbol' || prop === '$$typeof' || prop === '__esModule' || prop === 'default') {
      return undefined;
    }

    // Only initialize for actual Supabase client property access
    return getSupabaseClient()[prop as keyof ReturnType<typeof getSupabaseClient>];
  }
});