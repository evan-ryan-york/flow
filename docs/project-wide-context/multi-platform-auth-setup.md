# Multi-Platform Google OAuth Authentication Setup

## Overview

Flow supports Google OAuth authentication across **web**, **desktop (Tauri)**, and **mobile (iOS/Android via Capacitor)** platforms using a unified codebase with platform-specific OAuth flows. This document explains the complete authentication architecture, configuration requirements, and implementation details that enable seamless authentication across all platforms.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Flow                          │
│                  (Single Codebase)                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  Web OAuth   │              │ Tauri OAuth  │            │
│  │   (PKCE)     │              │    (PKCE)    │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                              │                     │
└─────────┼──────────────────────────────┼─────────────────────┘
          │                              │
          │                              │
     ┌────▼─────┐                  ┌─────▼────┐
     │  Google  │                  │  Google  │
     │  OAuth   │                  │  OAuth   │
     │  Server  │                  │  Server  │
     └────┬─────┘                  └─────┬────┘
          │                              │
          ▼                              ▼
     Supabase                      Local OAuth
     Callback                      Server (port 3210)
          │                              │
          │                              │
          └──────────┬───────────────────┘
                     │
                     ▼
             ┌──────────────┐
             │   Supabase   │
             │ Auth Service │
             └──────────────┘
```

## Configuration Requirements

### 1. Google Cloud Console Configuration

**Required Setup**: Create an OAuth 2.0 Web Application Client in Google Cloud Console

#### Authorized JavaScript Origins

These origins allow Google OAuth to trust requests from your application:

```
https://sprjddkfkwrrebazjxvf.supabase.co
http://localhost:3000
https://current-web-flax.vercel.app
```

**Screenshot Reference**: See "Screenshot 2025-10-28 at 8.08.37 AM.png" - Shows the complete OAuth client configuration.

#### Authorized Redirect URIs

These URIs define where Google can redirect after authentication:

```
https://sprjddkfkwrrebazjxvf.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
https://sprjddkfkwrrebazjxvf.supabase.co/functions/v1/google-calendar-callback
https://current-web-flax.vercel.app/auth/callback
http://localhost:3000
http://localhost:3535
http://localhost:9999
http://localhost
http://localhost:3210   # ⚠️ CRITICAL for Tauri desktop auth
```

**Key Points**:
- `http://localhost:3210` is **essential** for Tauri desktop app authentication
- Port 3210 is chosen specifically to avoid conflicts with Next.js dev server (port 3000)
- All localhost ports support local development testing
- Production URLs support deployed web and desktop apps

#### OAuth Credentials

```
Client ID: <your-google-client-id>.apps.googleusercontent.com
Client Secret: <your-google-client-secret> (get from Google Cloud Console)
```

**Screenshot Reference**: See "Screenshot 2025-10-28 at 8.08.37 AM.png" - Shows client ID and partially hidden secret.

### 2. Supabase Configuration

#### Google OAuth Provider Settings

**Location**: Supabase Dashboard → Authentication → Providers → Google

**Screenshot Reference**: See "Screenshot 2025-10-28 at 8.07.36 AM.png"

```yaml
Enable Sign in with Google: ✓ Enabled

Client IDs:
  <your-google-client-id>.apps.googleusercontent.com

Client Secret (for OAuth):
  <your-google-client-secret>

Skip nonce checks: ✗ Disabled
  # Security feature - keeps token validation strict

Allow users without an email: ✗ Disabled
  # Requires email address for all authenticated users

Callback URL (for OAuth):
  https://<your-supabase-project>.supabase.co/auth/v1/callback
  # Supabase's OAuth callback endpoint
```

#### URL Configuration

**Location**: Supabase Dashboard → Authentication → URL Configuration

**Screenshot Reference**: See "Screenshot 2025-10-28 at 8.07.47 AM.png"

```yaml
Site URL:
  https://current-web-flax.vercel.app
  # Default redirect URL when not specified

Redirect URLs (Whitelist):
  - https://current-web-flax.vercel.app/auth/callback
  - https://current-web-flax.vercel.app/**  # Wildcard for all routes
  - http://localhost:3000
  - http://localhost:3535
  - http://localhost:9999
  - http://localhost:*  # Wildcard for all localhost ports
```

**Purpose**: These redirect URLs define where Supabase can redirect users after OAuth completes. The wildcards provide flexibility during development.

### 3. Environment Variables

**File**: `apps/web/.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://sprjddkfkwrrebazjxvf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth Configuration (Desktop Only)
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

**Note**: Desktop OAuth requires explicit client secret because Tauri exchanges the authorization code directly with Google (not through Supabase).

## Web OAuth Flow (Standard PKCE)

### Flow Diagram

```
┌─────────┐                          ┌─────────┐
│ User    │                          │ Browser │
│ Clicks  │                          │ (Web)   │
│ Sign In │                          │         │
└────┬────┘                          └────┬────┘
     │                                     │
     │ 1. Click "Sign in with Google"     │
     ├────────────────────────────────────►│
     │                                     │
     │                                     │ 2. signInWithOAuth()
     │                                     ├──────────────────┐
     │                                     │                  │
     │                                     │ 3. Redirect to Google
     │                                     │    with redirectTo param
     │                                     ▼
     │                          ┌──────────────────┐
     │                          │   Google OAuth   │
     │                          │   Authorization  │
     │                          └────────┬─────────┘
     │                                   │
     │ 4. User authorizes app            │
     │◄──────────────────────────────────┤
     │                                   │
     │                                   │ 5. Redirect to Supabase
     │                                   │    callback with code
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │    Supabase      │
     │                          │  /auth/v1/       │
     │                          │   callback       │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 6. Exchange code for tokens
     │                                   │    (server-side)
     │                                   │
     │ 7. Redirect to app                │
     │    callback with code             │
     │◄──────────────────────────────────┤
     │                                   │
     │ /auth/callback?code=xxx           │
     ▼                                   │
┌──────────────────┐                    │
│ Auth Callback    │                    │
│ Page Component   │                    │
└────────┬─────────┘                    │
         │                              │
         │ 8. exchangeCodeForSession()  │
         ├──────────────────────────────►
         │                              │
         │ 9. Session created           │
         │◄─────────────────────────────┤
         │                              │
         │ 10. Redirect to /dashboard   │
         ▼                              │
    ┌────────┐                         │
    │ User   │                         │
    │ Logged │                         │
    │ In!    │                         │
    └────────┘                         │
```

### Implementation Details

**Entry Point**: `apps/web/app/login/components/LoginForm.tsx:221-328`

```typescript
const handleGoogleSignIn = async () => {
  // Web browser OAuth flow
  console.log('🌐 Using web OAuth flow...');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      skipBrowserRedirect: false,
    },
  });

  // Browser automatically redirects to Google
}
```

**Callback Handler**: `apps/web/app/auth/callback/page.tsx:6-123`

```typescript
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseClient();

      // Extract authorization code from URL
      const code = searchParams.get('code');

      if (code) {
        // Exchange code for session using PKCE
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (data.session) {
          // Session created successfully
          router.push('/dashboard');
        }
      }
    };

    handleCallback();
  }, [searchParams, router]);
}
```

**Key Features**:
- Uses Supabase's built-in PKCE flow
- Supabase handles the OAuth token exchange server-side
- Browser automatically redirects through the flow
- Session persisted via `@supabase/ssr` browser client
- No manual token management required

## Desktop (Tauri) OAuth Flow (Manual PKCE)

### Flow Diagram

```
┌─────────┐                          ┌──────────┐
│ User    │                          │  Tauri   │
│ Clicks  │                          │  Desktop │
│ Sign In │                          │  App     │
└────┬────┘                          └────┬─────┘
     │                                     │
     │ 1. Click "Sign in with Google"     │
     ├────────────────────────────────────►│
     │                                     │
     │                                     │ 2. handleTauriGoogleOAuth()
     │                                     ├────────────────────┐
     │                                     │                    │
     │                                     │ 3. Generate PKCE   │
     │                                     │    code_verifier   │
     │                                     │    code_challenge  │
     │                                     │                    │
     │                                     │ 4. Start OAuth     │
     │                                     │    server on       │
     │                                     │    port 3210       │
     │                                     │                    │
     │                                     │ 5. Open browser    │
     │                                     │    with Google URL │
     │                                     ▼
     │                          ┌──────────────────┐
     │                          │ System Browser   │
     │                          │ (Chrome/Safari)  │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 6. Redirect to Google
     │                                   │    with PKCE params
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │   Google OAuth   │
     │                          │   Authorization  │
     │                          └────────┬─────────┘
     │                                   │
     │ 7. User authorizes app            │
     │◄──────────────────────────────────┤
     │                                   │
     │                                   │ 8. Browser redirect
     │                                   │    to localhost:3210
     │                                   │    with auth code
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │ Local OAuth      │
     │                          │ Server           │
     │                          │ (tauri-plugin-   │
     │                          │  oauth)          │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 9. Emit 'oauth://url'
     │                                   │    event with code
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │  Tauri Event     │
     │                          │  Listener        │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 10. Exchange code with
     │                                   │     Google using PKCE
     │                                   │     verifier
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │   Google Token   │
     │                          │   Endpoint       │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 11. Receive id_token
     │                                   │     access_token
     │                                   │     refresh_token
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │  Supabase        │
     │                          │  signInWithIdToken│
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 12. Create Supabase
     │                                   │     session from
     │                                   │     Google ID token
     │◄──────────────────────────────────┤
     │                                   │
     │ 13. Session persisted             │
     │     to localStorage               │
     │                                   │
     │ 14. Redirect to /dashboard        │
     ▼                                   │
┌────────┐                              │
│ User   │                              │
│ Logged │                              │
│ In!    │                              │
└────────┘                              │
```

### Implementation Details

**Entry Point**: `apps/web/app/login/components/LoginForm.tsx:246-300`

```typescript
const handleGoogleSignIn = async () => {
  // Detect Tauri environment
  if (isTauriEnv) {
    console.log('📱 Using Tauri OAuth flow...');

    const result = await handleTauriGoogleOAuth(supabase);

    if (!result.success) {
      throw new Error(result.error || 'Failed to authenticate');
    }

    // Verify session and redirect
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      router.push('/dashboard');
    }
  }
}
```

**Core OAuth Logic**: `apps/web/lib/tauri-oauth.ts:153-366`

```typescript
export async function handleTauriGoogleOAuth(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {

  // 1. Wait for Tauri API to be ready
  const apiReady = await waitForTauriAPI();

  // 2. Start local OAuth server on fixed port 3210
  const port = await tauriOAuth.start({ ports: [FIXED_PORT] });

  // 3. Generate PKCE parameters manually
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // 4. Build Google OAuth URL with PKCE challenge
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', googleClientId);
  googleAuthUrl.searchParams.set('redirect_uri', `http://localhost:${port}`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
  googleAuthUrl.searchParams.set('code_challenge_method', 'S256');

  // 5. Open system browser with OAuth URL
  await tauriShell.open(googleAuthUrl.toString());

  // 6. Listen for OAuth callback event
  return new Promise((resolve) => {
    tauriEvent.listen<string>('oauth://url', async (event) => {
      const url = event.payload;
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');

      // 7. Exchange code with Google using PKCE verifier
      const googleTokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,  // Required for token exchange
          code_verifier: codeVerifier,        // PKCE verifier
          grant_type: 'authorization_code',
          redirect_uri: `http://localhost:${port}`,
        }),
      });

      const googleTokens = await googleTokenResponse.json();

      // 8. Sign in to Supabase using Google ID token
      const { data: sessionData, error: signInError } =
        await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleTokens.id_token,
        });

      // 9. Session created and persisted to localStorage
      await new Promise(resolve => setTimeout(resolve, 500));

      // 10. Clean up OAuth server
      await tauriOAuth.cancel(port);

      resolve({ success: true });
    });
  });
}
```

**Key Features**:
- **Manual PKCE implementation**: App generates code_verifier and code_challenge
- **Local OAuth server**: `tauri-plugin-oauth` starts server on port 3210 to catch callback
- **System browser**: Opens default browser for Google auth (better UX than embedded WebView)
- **Direct token exchange**: Exchanges authorization code with Google directly (not through Supabase)
- **ID Token authentication**: Uses Google's ID token to create Supabase session
- **localStorage persistence**: Session stored in Tauri's localStorage for persistence

### Why Desktop is Different

**Tauri Limitations**:
1. **No URL interception**: Tauri apps cannot intercept HTTPS redirects to Supabase
2. **Custom protocol issues**: `tauri://` protocol not recognized by external browsers
3. **Static build**: Desktop app is static export, cannot run Next.js API routes
4. **Security model**: Cannot safely expose client secrets in web environment

**Solution**: Manual PKCE flow with localhost server
- Uses `tauri-plugin-oauth` to run local HTTP server on fixed port
- Google redirects to `http://localhost:3210` (which Tauri controls)
- App exchanges code directly with Google (requires client secret)
- Creates Supabase session using Google's ID token

## Mobile (iOS/Android Capacitor) OAuth Flow

### 🔥 The 14-Hour Mobile Auth Nightmare (And How We Solved It)

**TL;DR**: Capacitor's OAuth flow works, but Supabase's `getSession()` and `setSession()` calls **completely hang** in Capacitor's WebView. The solution required bypassing Supabase's entire auth system for data queries by manually storing tokens and injecting them via a custom fetch wrapper.

### Flow Diagram

```
┌─────────┐                          ┌──────────┐
│ User    │                          │Capacitor │
│ Clicks  │                          │  Mobile  │
│ Sign In │                          │   App    │
└────┬────┘                          └────┬─────┘
     │                                     │
     │ 1. Click "Sign in with Google"     │
     ├────────────────────────────────────►│
     │                                     │
     │                                     │ 2. signInWithOAuth()
     │                                     ├────────────────────┐
     │                                     │                    │
     │                                     │ 3. Open SYSTEM     │
     │                                     │    browser with    │
     │                                     │    custom redirect │
     │                                     │    com.flow │
     │                                     │    .app://auth/    │
     │                                     │    callback        │
     │                                     ▼
     │                          ┌──────────────────┐
     │                          │ System Browser   │
     │                          │ (Safari/Chrome)  │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 4. Redirect to Google
     │                                   │    for authorization
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │   Google OAuth   │
     │                          │   Authorization  │
     │                          └────────┬─────────┘
     │                                   │
     │ 5. User authorizes app            │
     │◄──────────────────────────────────┤
     │                                   │
     │                                   │ 6. Redirect to
     │                                   │    Supabase callback
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │    Supabase      │
     │                          │  /auth/v1/       │
     │                          │   callback       │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 7. Redirect to app
     │                                   │    with tokens in
     │                                   │    fragment:
     │                                   │    com.flow.app://
     │                                   │    auth/callback#
     │                                   │    access_token=xxx&
     │                                   │    refresh_token=yyy
     │                                   ▼
     │                          ┌──────────────────┐
     │                          │  iOS/Android     │
     │                          │  Deep Link       │
     │                          │  Handler         │
     │                          └────────┬─────────┘
     │                                   │
     │                                   │ 8. App resumes with
     │                                   │    getLaunchUrl()
     │◄──────────────────────────────────┤
     │                                   │
     │ App extracts tokens from URL      │
     │                                   │
     │ 9. 🚨 CRITICAL: Manually store    │
     │    session data (setSession       │
     │    HANGS in Capacitor!)           │
     │                                   │
     │ 10. Store access token separately │
     │     for data queries              │
     │                                   │
     │ 11. Store user data separately    │
     │     for UI display                │
     │                                   │
     │ 12. Redirect to /dashboard        │
     ▼                                   │
┌────────┐                              │
│ User   │                              │
│ Logged │                              │
│ In!    │                              │
└────────┘                              │
```

### The Capacitor-Specific Challenges

#### Challenge 1: Supabase `setSession()` Hangs Forever

**Symptom**: Calling `supabase.auth.setSession()` in Capacitor never completes. The promise hangs indefinitely.

**Root Cause**: Supabase's auth library (`@supabase/gotrue-js`) uses async operations that don't work properly in Capacitor's WebView environment.

**Our Solution**: **Bypass `setSession()` entirely** and manually store session data in Capacitor Preferences.

```typescript
// ❌ This hangs forever in Capacitor
await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
});

// ✅ Manual storage that actually works
const { Preferences } = await import('@capacitor/preferences');
await Preferences.set({
  key: 'sb-sprjddkfkwrrebazjxvf-auth-token',
  value: JSON.stringify(sessionData),
});
```

#### Challenge 2: Supabase `getSession()` Hangs Forever

**Symptom**: Every call to `supabase.auth.getSession()` hangs, which means:
- Dashboard can't check if user is logged in
- All data queries fail (they internally call `getSession()` to get auth token)
- App stuck on "Loading..." forever

**Root Cause**: Same as above - Supabase's session recovery from storage doesn't work in Capacitor.

**Our Solution**: **Two-part workaround**:

1. **For UI authentication check**: Store user data separately and load it directly
```typescript
// Dashboard bypasses Supabase session loading
const { Preferences } = await import('@capacitor/preferences');
const { value } = await Preferences.get({ key: 'flow-user-data' });
const userData = JSON.parse(value);
setUser(userData); // Display user as authenticated
```

2. **For data queries**: Custom fetch wrapper that injects auth token

#### Challenge 3: All Supabase Data Queries Fail

**Symptom**: After login, data queries fail with:
```json
{
  "error": "No API key found in request",
  "hint": "No `apikey` request header or url param was found.",
  "status": 401
}
```

**Root Cause**: When you create a Supabase client and make queries, it internally calls `getSession()` to get the access token for the Authorization header. Since `getSession()` hangs, queries never get auth headers.

**Our Solution**: **Custom fetch wrapper** that intercepts all Supabase requests and manually injects the Authorization header from separately stored token.

### Implementation Details

#### Google Console Configuration

**CRITICAL**: Add your app's custom URL scheme to Authorized Redirect URIs:

```
com.flow.app://auth/callback
```

This tells Google it's safe to redirect to your mobile app after OAuth.

#### Supabase Configuration

**Location**: Supabase Dashboard → Authentication → URL Configuration

Add to Redirect URLs whitelist:
```
com.flow.app://auth/callback
com.flow.app://**
```

#### iOS Configuration

**File**: `apps/mobile/ios/App/App/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.flow.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.flow.app</string>
    </array>
  </dict>
</array>
```

This registers your custom URL scheme with iOS so the app can handle deep links.

#### OAuth Flow Entry Point

**File**: `apps/web/app/login/components/LoginForm.tsx:328-390`

```typescript
const handleGoogleSignIn = async () => {
  if (isCapacitorEnv) {
    console.log('📱 Using Capacitor OAuth flow...');

    // Open system browser with custom redirect
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'com.flow.app://auth/callback',
        skipBrowserRedirect: false,
      },
    });

    // Supabase returns immediately - actual auth happens when app resumes
  }
}
```

#### Deep Link Handler & Manual Session Storage

**File**: `apps/web/app/login/components/LoginForm.tsx:250-380`

```typescript
// Listen for app resume with auth URL
useEffect(() => {
  const setupListeners = async () => {
    // Listen for app state changes
    await App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          // Extract tokens from URL fragment
          const url = new URL(launchUrl.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const expiresAt = params.get('expires_at');

          // 🚨 CRITICAL: Bypass setSession() - it hangs!
          // Manually decode JWT to get user info
          const payload = JSON.parse(atob(accessToken.split('.')[1]));

          // Store session in Supabase's expected format
          await Preferences.set({
            key: 'sb-sprjddkfkwrrebazjxvf-auth-token',
            value: JSON.stringify({
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: parseInt(expiresAt),
              expires_in: 3600,
              token_type: 'bearer',
              user: {
                id: payload.sub,
                email: payload.email,
                // ... other user fields
              },
            }),
          });

          // Store user data separately for dashboard
          await Preferences.set({
            key: 'flow-user-data',
            value: JSON.stringify({
              id: payload.sub,
              email: payload.email,
              user_metadata: payload.user_metadata,
            }),
          });

          // Store access token separately for data queries
          await Preferences.set({
            key: 'flow-access-token',
            value: accessToken,
          });

          // Reinitialize Supabase client and navigate
          reinitializeSupabaseClient();
          router.replace('/dashboard');
        }
      }
    });
  };

  setupListeners();
}, []);
```

#### Dashboard Authentication Check

**File**: `apps/web/app/dashboard/page.tsx:29-77`

```typescript
useEffect(() => {
  const checkUser = async () => {
    // 🚨 CRITICAL: Bypass Supabase session loading in Capacitor
    if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
      console.log('🔍 Capacitor detected, checking for stored user data...');

      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'flow-user-data' });

      if (value) {
        const userData = JSON.parse(value);

        // Create minimal User object for UI display
        const user = {
          id: userData.id,
          email: userData.email,
          user_metadata: userData.user_metadata,
          // ... minimal required fields
        };

        setUser(user);
        setLoading(false);
        return; // Skip Supabase session loading entirely
      } else {
        router.push('/login');
        return;
      }
    }

    // Non-Capacitor: Use standard Supabase flow
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    // ... standard web/desktop auth check
  };

  checkUser();
}, [router]);
```

#### Custom Fetch Wrapper for Data Queries

**File**: `packages/data/supabase.ts:132-199`

This is the **CRITICAL PIECE** that makes data loading work.

```typescript
// Helper to get stored access token
async function getCapacitorAccessToken(): Promise<string | null> {
  if (!isCapacitor()) return null;

  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: 'flow-access-token' });
  return value;
}

export function initializeSupabase(url: string, anonKey: string) {
  if (isCapacitor()) {
    console.log('🔧 Initializing Supabase FOR CAPACITOR with custom auth bypass');

    // Custom fetch that injects auth token
    const originalFetch = fetch;
    const customFetch: typeof fetch = async (input, init?) => {
      const accessToken = await getCapacitorAccessToken();

      if (accessToken) {
        console.log('🔐 Injecting access token into Supabase request');
        init = init || {};

        // 🚨 CRITICAL: Preserve existing headers (including apikey)
        const existingHeaders = new Headers(init.headers);
        existingHeaders.set('Authorization', `Bearer ${accessToken}`);
        init.headers = existingHeaders;
      }

      return originalFetch(input, init);
    };

    // Create Supabase client with custom fetch
    const client = createClient(url, anonKey, {
      auth: {
        storage: capacitorStorage,
        autoRefreshToken: false,  // Can't use - would call getSession()
        persistSession: false,    // We handle persistence manually
        detectSessionInUrl: true,
      },
      global: {
        fetch: customFetch,  // 🎯 This is what makes data queries work!
      },
    });

    return client;
  }

  // ... standard web/desktop initialization
}
```

**Why this works**:
1. Every Supabase query internally does: `fetch('https://supabase.co/rest/v1/...', { headers: { apikey: 'xxx' } })`
2. Our custom fetch intercepts this and adds: `Authorization: Bearer <user_token>`
3. Supabase's Postgres RLS policies verify the JWT token and allow the query
4. **We completely bypass Supabase's broken `getSession()` calls**

### Storage Keys Reference

```typescript
// Supabase's expected session storage format
'sb-sprjddkfkwrrebazjxvf-auth-token' // Full session object

// Our custom storage for workarounds
'flow-user-data'    // User info for UI display
'flow-access-token' // JWT token for data queries
```

### Why Mobile is Different from Web/Desktop

| Aspect | Web | Desktop | Mobile (Capacitor) |
|--------|-----|---------|-------------------|
| **OAuth Flow** | Supabase PKCE | Manual PKCE | System browser OAuth |
| **Redirect Target** | Supabase callback | localhost:3210 | Custom URL scheme (com.flow.app://) |
| **Session Storage** | @supabase/ssr | localStorage | Manual Capacitor Preferences |
| **setSession()** | ✅ Works | ✅ Works | ❌ **HANGS FOREVER** |
| **getSession()** | ✅ Works | ✅ Works | ❌ **HANGS FOREVER** |
| **Auth Check** | Standard | Standard | Custom user data storage |
| **Data Queries** | Standard | Standard | Custom fetch wrapper with token injection |
| **Browser** | Same window | System browser | System browser |

### Common Pitfalls and Solutions

#### 1. App Hangs on "Loading..." After Login

**Symptom**: Login succeeds, tokens stored, but dashboard stuck on loading

**Root Cause**: Dashboard is calling `supabase.auth.getSession()` which hangs

**Solution**: Implement the Capacitor-specific user check in dashboard (see code above)

#### 2. Data Queries Return "No API key found"

**Symptom**: User authenticated but all data queries fail with 401 errors

**Root Cause**: Custom fetch wrapper not preserving the `apikey` header

**Solution**: Use `new Headers(init.headers)` to preserve existing headers before adding Authorization

```typescript
// ❌ Wrong - overwrites apikey header
init.headers = {
  ...init.headers,
  'Authorization': `Bearer ${accessToken}`,
};

// ✅ Correct - preserves all headers
const existingHeaders = new Headers(init.headers);
existingHeaders.set('Authorization', `Bearer ${accessToken}`);
init.headers = existingHeaders;
```

#### 3. iOS Deep Link Not Opening App

**Symptom**: OAuth completes in browser but doesn't return to app

**Root Cause**: URL scheme not registered in Info.plist

**Solution**: Add CFBundleURLTypes configuration (see iOS Configuration above)

#### 4. Session Not Persisting After App Restart

**Symptom**: User logged out every time app closes

**Root Cause**: Access token not stored, or stored in wrong key

**Solution**: Verify all three storage keys are set during login:
- `sb-sprjddkfkwrrebazjxvf-auth-token`
- `flow-user-data`
- `flow-access-token`

#### 5. "Multiple GoTrueClient instances" Warning

**Symptom**: Warning in console about multiple auth clients

**Root Cause**: Calling `reinitializeSupabaseClient()` creates new client instance

**Solution**: This is expected and safe - we need to reinitialize after manual session storage. Can be ignored.

### Testing Mobile Authentication

**iOS Simulator**:
```bash
# Terminal 1: Build web app
cd apps/web
NEXT_OUTPUT=export pnpm run build

# Terminal 2: Sync and run iOS
cd apps/mobile
pnpm run sync
pnpm run ios
```

**Physical Device**:
```bash
# Build production app
cd apps/web
NEXT_OUTPUT=export pnpm run build

cd apps/mobile
pnpm run sync
pnpm run open:ios  # Opens Xcode

# In Xcode:
# 1. Select your physical device
# 2. Configure signing with your Apple ID
# 3. Build and Run (Cmd+R)
# 4. App installs on device
# 5. Trust developer profile in Settings if first time
```

**Test Flow**:
1. Open app on device (works without laptop!)
2. Click "Sign in with Google"
3. System browser opens with Google OAuth
4. Authorize app
5. Browser redirects with deep link
6. App resumes and completes auth
7. **Dashboard loads with actual data from Supabase!**

### Debug Logging

Mobile flow includes extensive logging. Watch for:

```
🔧 Initializing Supabase FOR CAPACITOR with custom auth bypass
✅ Supabase client initialized for Capacitor with auth bypass
📱 Processing auth URL: com.flow.app://auth/callback#access_token=...
✅ Session stored manually!
✅ User data and access token stored separately!
🔄 Reinitializing Supabase client...
🧭 Navigating to dashboard...
🔍 Capacitor detected, checking for stored user data...
✅ Found stored user data!
✅ User authenticated from stored data: user@example.com
🔐 Injecting access token into Supabase request  ← This means queries will work!
```

If you see "No API key found in request" errors, the custom fetch wrapper isn't working correctly.

### Security Considerations

**Mobile-Specific Security**:

1. **Deep Link Security**: Custom URL scheme (com.flow.app://) is specific to your app bundle ID
2. **Token Storage**: Capacitor Preferences uses platform-native secure storage:
   - iOS: NSUserDefaults (sandboxed per app)
   - Android: SharedPreferences (sandboxed per app)
3. **No Client Secret**: Mobile OAuth doesn't require client secret (unlike desktop)
4. **Access Token Exposure**: Tokens stored in device storage, but:
   - Only accessible to the app itself (OS sandboxing)
   - Encrypted at rest by iOS/Android
   - User can revoke from Google account settings
5. **Token Expiration**: Access tokens expire after 1 hour, but we don't implement refresh (user must re-login)

**Future Improvements**:
- Implement token refresh without triggering `getSession()` hang
- Add biometric authentication for stored tokens
- Implement secure token storage using iOS Keychain / Android Keystore

## Key Differences: Web vs Desktop vs Mobile

| Aspect | Web | Desktop (Tauri) | Mobile (Capacitor) |
|--------|-----|-----------------|-------------------|
| **OAuth Flow** | Supabase PKCE (automatic) | Manual PKCE with localhost server | System browser with deep link |
| **PKCE Generation** | Handled by Supabase | Manual generation in app code | Handled by Supabase |
| **Redirect Target** | Supabase callback endpoint | `localhost:3210` local server | Custom URL scheme (`com.flow.app://`) |
| **Token Exchange** | Supabase handles server-side | Direct exchange with Google | Supabase handles server-side |
| **Client Secret** | Stored in Supabase | Required in app environment vars | Stored in Supabase |
| **Browser** | Same browser window | System default browser | System default browser |
| **Session Storage** | `@supabase/ssr` browser client | localStorage (Tauri) | **Manual Capacitor Preferences** |
| **Callback Handler** | `/auth/callback` Next.js page | Event listener in login page | Deep link listener in login page |
| **setSession()** | ✅ Works normally | ✅ Works normally | ❌ **Hangs - bypass required** |
| **getSession()** | ✅ Works normally | ✅ Works normally | ❌ **Hangs - bypass required** |
| **Data Query Auth** | ✅ Automatic | ✅ Automatic | ❌ **Custom fetch wrapper required** |

## Common Pitfalls and Solutions

### 1. Port 3210 Not Configured in Google Console

**Symptom**: Desktop auth redirects to localhost:3210 but Google shows "redirect_uri_mismatch" error

**Solution**: Add `http://localhost:3210` to Authorized Redirect URIs in Google Cloud Console (see screenshot 3)

### 2. Missing Client Secret for Desktop

**Symptom**: Desktop auth fails with "GOOGLE_CLIENT_SECRET not configured" error

**Solution**: Add both environment variables to `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### 3. Tauri API Not Ready

**Symptom**: Desktop app crashes on login with "window.__TAURI_INTERNALS__ is undefined"

**Solution**: The code includes `waitForTauriAPI()` function that polls for Tauri API readiness before attempting OAuth (see `tauri-oauth.ts:42-82`)

### 4. Web Auth Callback Loaded from Cache in Tauri

**Symptom**: Desktop auth completes but redirects to cached HTML instead of triggering callback

**Solution**: Callback page includes Tauri detection (see `auth/callback/page.tsx:22-27`) and falls back to manual PKCE flow if needed

### 5. Session Not Persisting After Desktop Auth

**Symptom**: Desktop auth succeeds but user is not logged in after redirect

**Solution**:
- App waits 500ms after `signInWithIdToken()` for persistence
- Includes retry logic with `getSession()` verification
- See `tauri-oauth.ts:324-333` and `LoginForm.tsx:258-294`

### 6. Localhost Port Conflicts

**Symptom**: Desktop auth fails to start with "port already in use" error

**Solution**:
- App uses fixed port 3210 (not 3000 which Next.js uses)
- Error message instructs users to close any services on port 3210
- See `tauri-oauth.ts:183-186`

## Security Considerations

### Web OAuth Security

1. **PKCE Flow**: Uses SHA-256 code challenge to prevent authorization code interception
2. **Server-side Exchange**: Supabase exchanges code for tokens server-side (client secret never exposed)
3. **Session Storage**: Uses secure cookie storage via `@supabase/ssr`
4. **HTTPS Only**: Production web app uses HTTPS for all OAuth communications

### Desktop OAuth Security

1. **PKCE Flow**: Implements full PKCE S256 with cryptographically secure code_verifier
2. **Client Secret Exposure**: Required for direct token exchange, but acceptable risk because:
   - Desktop app binary is distributed to users anyway
   - Alternative would be running a backend service (adds complexity)
   - Google's PKCE provides primary security against interception
3. **Localhost Server**: Temporary local server only listens during auth flow
4. **Token Storage**: Tokens stored in Tauri's encrypted localStorage (platform-dependent encryption)

## Testing the Authentication

### Web Testing

**Local Development**:
```bash
cd apps/web
pnpm dev
# Visit http://localhost:3000/login
# Click "Sign in with Google"
# Should redirect through Google and back to /dashboard
```

**Production**:
```
Visit https://current-web-flax.vercel.app/login
Click "Sign in with Google"
Should redirect through Google and back to /dashboard
```

### Desktop Testing

**Local Development**:
```bash
# Terminal 1: Start Next.js dev server
cd apps/web
pnpm dev

# Terminal 2: Start Tauri desktop app
cd apps/desktop
pnpm tauri dev

# In desktop app:
# - Click "Sign in with Google"
# - System browser opens with Google OAuth
# - After authorization, browser redirects to localhost:3210
# - Desktop app detects callback and completes auth
# - Should redirect to /dashboard in desktop app
```

**Production Build**:
```bash
cd apps/web
pnpm build

cd apps/desktop
pnpm tauri build

# Run the built app:
# - macOS: open apps/desktop/src-tauri/target/release/bundle/macos/Perfect\ Task\ App.app
# - Windows: apps/desktop/src-tauri/target/release/bundle/msi/Flow_0.1.0_x64_en-US.msi
```

## Debugging Tips

### Enable Verbose Logging

Both web and desktop implementations include extensive console logging:

**Web**: Check browser DevTools console for:
- `🌐 Using web OAuth flow...`
- `🔄 Exchanging authorization code for session...`
- `✅ Session established successfully`

**Desktop**: Check terminal/console for:
- `📱 Using Tauri OAuth flow...`
- `🔐 Generating PKCE parameters...`
- `📡 Starting OAuth server on port 3210...`
- `🌐 Opening OAuth URL in system browser...`
- `📩 Received OAuth callback:`
- `🔄 Exchanging code with Google (PKCE)...`
- `✅ Authentication successful!`

### Common Debug Commands

```bash
# Check if port 3210 is in use (macOS/Linux)
lsof -i :3210

# Check Supabase session in browser
localStorage.getItem('supabase.auth.token')

# Check Tauri build configuration
cat apps/desktop/src-tauri/tauri.conf.json | jq '.tauri.bundle'

# Check Google OAuth credentials
grep GOOGLE_ apps/web/.env.local
```

## File Reference

### Key Implementation Files

```
apps/web/app/
├── login/
│   └── components/
│       └── LoginForm.tsx          # Login UI + platform detection
└── auth/
    └── callback/
        └── page.tsx                # Web OAuth callback handler

apps/web/lib/
├── tauri-oauth.ts                  # Desktop OAuth implementation
└── capacitor-oauth.ts              # Mobile OAuth implementation

packages/data/
├── supabase.ts                     # Unified Supabase client
└── services/
    └── authService.ts              # Auth service functions

apps/desktop/src-tauri/
├── Cargo.toml                      # Rust dependencies (tauri-plugin-oauth)
└── tauri.conf.json                 # Tauri configuration
```

### Configuration Files

```
apps/web/
├── .env.local                      # Environment variables
└── .env.local.example              # Environment template

docs/infrastructure/
└── supabase-setup.md               # Supabase configuration docs
```

## Migration from Previous Auth System

If you previously had a different authentication system, here's what changed:

### Before (Hypothetical)

```typescript
// Simple OAuth without PKCE
await supabase.auth.signIn({
  provider: 'google'
});
```

### After (Current Implementation)

**Web**:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

**Desktop**:
```typescript
const result = await handleTauriGoogleOAuth(supabase);
// Manual PKCE flow with:
// - Local OAuth server
// - System browser
// - Direct Google token exchange
// - ID token authentication with Supabase
```

## Maintenance Checklist

When updating authentication:

- [ ] **Google Console**: Update redirect URIs for new domains/ports
- [ ] **Supabase**: Update redirect URL whitelist
- [ ] **Environment Variables**: Update `.env.local` with new credentials
- [ ] **Test Web OAuth**: Verify production and localhost auth
- [ ] **Test Desktop OAuth**: Verify built app (not just dev mode)
- [ ] **Check Logs**: Verify console logs show successful auth flow
- [ ] **Session Persistence**: Verify login persists after app restart
- [ ] **Token Refresh**: Verify refresh tokens work for long sessions

## Related Documentation

- [Supabase Setup](../infrastructure/supabase-setup.md) - Database and backend configuration
- [Tauri Documentation](https://tauri.app/v1/guides/features/oauth) - Official Tauri OAuth guide
- [tauri-plugin-oauth](https://github.com/FabianLars/tauri-plugin-oauth) - OAuth plugin source
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) - Google's OAuth documentation

## Credits

Desktop OAuth implementation based on [tauri-oauth-supabase](https://github.com/JeaneC/tauri-oauth-supabase) by @JeaneC.

---

**Last Updated**: 2025-10-28
**Supabase Project**: sprjddkfkwrrebazjxvf
**Desktop OAuth Port**: 3210
**Tested Platforms**: Web (Chrome, Safari, Firefox), macOS Desktop
